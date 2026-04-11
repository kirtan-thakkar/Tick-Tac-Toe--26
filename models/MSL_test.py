import numpy as np
import pandas as pd
import json
import ast
import os
from pathlib import Path
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import IsolationForest
from sklearn.metrics import f1_score, precision_score, recall_score
from keras.models import Sequential, load_model
from keras.layers import LSTM, Dense, Dropout, RepeatVector, TimeDistributed, Bidirectional
from keras.callbacks import EarlyStopping, ReduceLROnPlateau
import joblib
from scipy.stats import genpareto

# ── PATHS ─────────────────────────────────────────────────────────────────────
base_dir = Path(__file__).parent
data_dir = base_dir / "data" / "MSL"
model_dir = base_dir / "Trained Models"
model_dir.mkdir(exist_ok=True, parents=True)

LSTM_MODEL_PATH = model_dir / "msl_lstm_autoencoder.h5"
LSTM_SCALER_PATH = model_dir / "msl_lstm_scaler.joblib"
IF_SCALER_PATH = model_dir / "msl_if_scaler.joblib"
LSTM_THRESHOLD_PATH = model_dir / "msl_lstm_threshold.joblib"

# ── 1. LOAD DATA ──────────────────────────────────────────────────────────────
train_data = np.load(data_dir / "MSL_train.npy")
test_data = np.load(data_dir / "MSL_test.npy")

labels_df = pd.read_csv(data_dir / "labeled_anomalies.csv")
a1_label = labels_df[labels_df['chan_id'] == 'A-1'].iloc[0]
anomaly_sequences = ast.literal_eval(a1_label['anomaly_sequences'])
anomaly_type = str(a1_label.get('class', 'point')).strip("[]").split(", ")[0].strip("'\"")

y_true = np.zeros(len(test_data))
for start, end in anomaly_sequences:
    y_true[start:end] = 1

print(f"Data loaded: train={train_data.shape}, test={test_data.shape}")

# ── 2. Z-SCORE ────────────────────────────────────────────────────────────────
train_mean = np.mean(train_data, axis=0)
train_std = np.std(train_data, axis=0)
train_std[train_std < 1e-2] = 1e-2

z_scores = np.abs((test_data - train_mean) / train_std)
overall_z = np.max(z_scores, axis=1)
z_pred = (overall_z > 3.0).astype(int)

# ── 3. ISOLATION FOREST ───────────────────────────────────────────────────────
scaler_if = StandardScaler()
train_if = scaler_if.fit_transform(train_data)
test_if = scaler_if.transform(test_data)

if_model = IsolationForest(n_estimators=200, contamination=0.01,
                            random_state=42, n_jobs=-1)
if_model.fit(train_if)
if_pred = (if_model.predict(test_if) == -1).astype(int)
if_scores_raw = -if_model.decision_function(test_if)

# Save IF scaler for later use
joblib.dump(scaler_if, IF_SCALER_PATH)
print(f"Saved IForest scaler to {IF_SCALER_PATH}")

# ── 4. LSTM AUTOENCODER (improved) ────────────────────────────────────────────
TIME_STEPS = 60
N_FEATURES = train_data.shape[1]

scaler_lstm = StandardScaler()
train_lstm_sc = scaler_lstm.fit_transform(train_data)
test_lstm_sc = scaler_lstm.transform(test_data)

def make_sequences(X, T=TIME_STEPS):
    return np.array([X[i:i+T] for i in range(len(X) - T)])

X_train = make_sequences(train_lstm_sc)
X_test = make_sequences(test_lstm_sc)

print(f"Sequence shapes: X_train={X_train.shape}, X_test={X_test.shape}")

# Check if model already exists
if LSTM_MODEL_PATH.exists():
    print(f"Loading existing LSTM model from {LSTM_MODEL_PATH}...")
    model = load_model(LSTM_MODEL_PATH)
    scaler_lstm = joblib.load(LSTM_SCALER_PATH)
    lstm_threshold = joblib.load(LSTM_THRESHOLD_PATH)
    print("Model and components loaded successfully!")
else:
    print("Training new LSTM Autoencoder model...")
    model = Sequential([
        # Encoder
        Bidirectional(LSTM(64, activation='tanh', return_sequences=True),
                      input_shape=(TIME_STEPS, N_FEATURES)),
        Dropout(0.2),
        Bidirectional(LSTM(32, activation='tanh', return_sequences=False)),
        Dropout(0.2),

        # Bottleneck repeat
        RepeatVector(TIME_STEPS),

        # Decoder (reverse order — shorter gradient path)
        LSTM(32, activation='tanh', return_sequences=True),
        Dropout(0.2),
        LSTM(64, activation='tanh', return_sequences=True),
        TimeDistributed(Dense(N_FEATURES))
    ])

    model.compile(optimizer='adam', loss='mse')
    print("\nModel architecture:")
    model.summary()

    # Proper callbacks
    callbacks = [
        EarlyStopping(monitor='val_loss', patience=7, restore_best_weights=True),
        ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=3, min_lr=1e-5)
    ]

    print("\nFitting model...")
    model.fit(X_train, X_train,
              epochs=60, batch_size=64,
              validation_split=0.1,
              callbacks=callbacks,
              shuffle=True,
              verbose=1)

    # Save model and scaler
    print(f"\nSaving LSTM model to {LSTM_MODEL_PATH}...")
    model.save(LSTM_MODEL_PATH)
    joblib.dump(scaler_lstm, LSTM_SCALER_PATH)
    print(f"Saved LSTM scaler to {LSTM_SCALER_PATH}")

    # Compute per-channel MAE for threshold calculation
    def reconstruction_errors(X):
        X_hat = model.predict(X, verbose=0)
        per_ch = np.mean(np.abs(X_hat - X), axis=1)   # mean over time → (N, F)
        max_ch = np.max(per_ch, axis=1)                # worst channel → (N,)
        return per_ch, max_ch

    train_per_ch, train_max = reconstruction_errors(X_train)

    # Compute POT threshold
    def pot_threshold(errors, q=0.90, risk=1e-3):
        """Peak Over Threshold: fit GPD to the tail of training errors."""
        thresh_init = np.quantile(errors, q)
        excesses = errors[errors > thresh_init] - thresh_init
        if len(excesses) < 10:
            return np.percentile(errors, 99)
        c, loc, scale = genpareto.fit(excesses, floc=0)
        n, Nt = len(errors), len(excesses)
        if abs(c) < 1e-4:
            t = thresh_init - scale * np.log(risk * n / Nt)
        else:
            t = thresh_init + (scale / c) * ((n / Nt * (1 / risk)) ** c - 1)
        return float(t)

    lstm_threshold = pot_threshold(train_max)
    print(f"LSTM threshold (POT): {lstm_threshold:.6f}")
    joblib.dump(lstm_threshold, LSTM_THRESHOLD_PATH)
    print(f"Saved LSTM threshold to {LSTM_THRESHOLD_PATH}")

# ── 5. RECONSTRUCTION ERRORS & EVALUATION ────────────────────────────────────
def reconstruction_errors(X):
    X_hat = model.predict(X, verbose=0)
    per_ch = np.mean(np.abs(X_hat - X), axis=1)   # mean over time → (N, F)
    max_ch = np.max(per_ch, axis=1)                # worst channel → (N,)
    return per_ch, max_ch

# Get test errors
test_per_ch, test_max = reconstruction_errors(X_test)

# Rolling z-score normalization on test errors
ROLL = 200
def rolling_zscore(errors, window=ROLL):
    z = np.zeros_like(errors)
    for i in range(len(errors)):
        w = errors[max(0, i-window):i+1]
        z[i] = (errors[i] - w.mean()) / (w.std() + 1e-8)
    return z

test_max_z = rolling_zscore(test_max)

# Predict on aligned full-length arrays
pad = np.zeros(TIME_STEPS)
lstm_scores_full = np.concatenate([pad, test_max])
lstm_max_z_full = np.concatenate([pad, test_max_z])

lstm_pred_seq = (test_max > lstm_threshold).astype(int)
lstm_pred = np.concatenate([np.zeros(TIME_STEPS, int), lstm_pred_seq])

# Per-channel anomaly contributions for affected sensor detection
test_per_ch_full = np.zeros((len(test_data), N_FEATURES))
test_per_ch_full[TIME_STEPS:] = test_per_ch

# ── 6. ENSEMBLE — weighted score, LSTM-dominant ────────────────────────────────
def norm_score(s):
    lo, hi = np.min(s), np.max(s)
    return (s - lo) / (hi - lo + 1e-9)

z_norm = norm_score(overall_z)
if_norm = norm_score(if_scores_raw)
lstm_norm = norm_score(lstm_scores_full)

# LSTM gets double weight; others share the remaining 0.5
W_LSTM, W_Z, W_IF = 0.50, 0.25, 0.25
ensemble_score = W_LSTM * lstm_norm + W_Z * z_norm + W_IF * if_norm

# Dynamic threshold: 97th percentile of ensemble scores
ens_threshold = np.percentile(ensemble_score, 97)
ensemble_pred = (ensemble_score >= ens_threshold).astype(int)

# ── 7. EVALUATE ───────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("EVALUATION METRICS")
print("="*60)
for name, pred in [("Z-Score", z_pred), ("IForest", if_pred),
                   ("LSTM", lstm_pred), ("Ensemble", ensemble_pred)]:
    p = precision_score(y_true, pred, zero_division=0)
    r = recall_score(y_true, pred, zero_division=0)
    f1 = f1_score(y_true, pred, zero_division=0)
    print(f"{name:10s} | P={p:.3f}  R={r:.3f}  F1={f1:.3f}")

# ── 8. GENERATE JSON ANOMALY RECORDS ──────────────────────────────────────────
output_dir = base_dir / "anomalies_output"
output_dir.mkdir(exist_ok=True)

base_ts = 1712839200
generated = 0

# Get training per-channel percentiles for affected sensor detection
train_per_ch, train_max = reconstruction_errors(X_train)
ch_thresh = np.percentile(train_per_ch, 90, axis=0)     # (N_FEATURES,)

for i in range(len(test_data)):
    if ensemble_pred[i] != 1:
        continue

    # Affected sensors: per-channel LSTM error > 90th percentile of that channel
    ch_errors = test_per_ch_full[i]                         # (N_FEATURES,)
    lstm_affected = set(np.where(ch_errors > ch_thresh)[0].tolist())

    # Also add z-score affected sensors
    z_affected = set(np.where(z_scores[i] > 3.0)[0].tolist())

    # Union → priority sort: lstm first, then z
    affected_idx = list(lstm_affected) + [s for s in z_affected if s not in lstm_affected]
    if not affected_idx:
        affected_idx = [int(np.argmax(ch_errors))]
    affected_sensors = [f"sensor_{j}" for j in affected_idx[:10]]

    # Votes and consensus
    votes = int(z_pred[i]) + int(if_pred[i]) + int(lstm_pred[i])
    consensus_type = {3: "unanimous", 2: "majority", 1: "solo"}.get(votes, "solo")
    solo_detector = None
    if votes == 1:
        solo_detector = "zscore" if z_pred[i] else ("iforest" if if_pred[i] else "lstm")

    # Severity from ensemble score
    es = float(ensemble_score[i])
    severity = "low"
    if es > 0.80:
        severity = "critical"
    elif es > 0.60:
        severity = "high"
    elif es > 0.40:
        severity = "medium"

    record = {
        "timestamp": base_ts + i,
        "ensemble_score": round(es, 4),
        "confidence": round(votes / 3.0, 2),
        "severity": severity,
        "anomaly_type": anomaly_type,
        "affected_sensors": affected_sensors,

        "model_outputs": {
            "zscore": {"score": round(float(overall_z[i]), 4),
                       "score_norm": round(float(z_norm[i]), 4),
                       "is_anomaly": int(z_pred[i])},
            "iforest": {"score": round(float(if_scores_raw[i]), 4),
                        "score_norm": round(float(if_norm[i]), 4),
                        "is_anomaly": int(if_pred[i])},
            "lstm": {"score": round(float(lstm_scores_full[i]), 6),
                     "score_norm": round(float(lstm_norm[i]), 4),
                     "rolling_zscore": round(float(lstm_max_z_full[i]), 3),
                     "is_anomaly": int(lstm_pred[i])}
        },

        "consensus": {
            "type": consensus_type,
            "votes": votes,
            "solo_detector": solo_detector,
            "agreement": {
                "zscore_lstm": int(z_pred[i] == lstm_pred[i]),
                "lstm_iforest": int(lstm_pred[i] == if_pred[i]),
                "zscore_iforest": int(z_pred[i] == if_pred[i])
            }
        },

        "detection_driver": (
            "lstm" if lstm_norm[i] >= z_norm[i] and lstm_norm[i] >= if_norm[i]
            else "zscore" if z_norm[i] >= if_norm[i]
            else "iforest"
        )
    }

    with open(output_dir / f"{base_ts + i}.json", "w") as f:
        json.dump(record, f, indent=2)
    generated += 1

print(f"\nGenerated {generated} JSON anomaly records → {output_dir}")
print("="*60)

