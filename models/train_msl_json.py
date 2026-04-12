import numpy as np
import pandas as pd
import json
import ast
import os
from pathlib import Path
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import IsolationForest
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from keras.models import Sequential
from keras.layers import LSTM, Dense, Dropout, RepeatVector, TimeDistributed

# 1. LOAD DATA
base_dir = Path(__file__).parent
train_data = np.load(base_dir / "data" / "MSL" / "MSL_train.npy")
test_data = np.load(base_dir / "data" / "MSL" / "MSL_test.npy")

# 2. LOAD LABELS
labels_df = pd.read_csv(base_dir / "data" / "MSL" / "labeled_anomalies.csv")
a1_label = labels_df[labels_df['chan_id'] == 'A-1'].iloc[0]
anomaly_sequences = ast.literal_eval(a1_label['anomaly_sequences'])
anomaly_type = str(a1_label['class']).strip("[]").split(", ")[0].strip("'\"") if 'class' in a1_label else "point"

y_true = np.zeros(len(test_data))
for start, end in anomaly_sequences:
    y_true[start:end] = 1

# 3. Z-SCORE MODEL
print("Training Z-Score Model...")
train_mean = np.mean(train_data, axis=0)
train_std = np.std(train_data, axis=0)
train_std[train_std < 1e-2] = 1e-2
z_scores = (test_data - train_mean) / train_std
overall_z_score = np.max(np.abs(z_scores), axis=1)
z_pred = (overall_z_score > 3.0).astype(int)

# 4. ISOLATION FOREST MODEL
print("Training Isolation Forest Model...")
scaler_if = StandardScaler()
train_scaled_if = scaler_if.fit_transform(train_data)
test_scaled_if = scaler_if.transform(test_data)

if_model = IsolationForest(n_estimators=100, contamination=0.01, random_state=42, n_jobs=-1)
if_model.fit(train_scaled_if)

if_preds_raw = if_model.predict(test_scaled_if)
if_pred = (if_preds_raw == -1).astype(int)
if_scores = -if_model.decision_function(test_scaled_if)

# 5. LSTM AUTOENCODER MODEL
print("Training LSTM Autoencoder Model...")
scaler_lstm = StandardScaler()
train_scaled_lstm = scaler_lstm.fit_transform(train_data)
test_scaled_lstm = scaler_lstm.transform(test_data)

TIME_STEPS = 60
def create_sequences(X, time_steps=TIME_STEPS):
    Xs = []
    for i in range(len(X) - time_steps):
        Xs.append(X[i:(i + time_steps)])
    return np.array(Xs)

X_train_seq = create_sequences(train_scaled_lstm, TIME_STEPS)
X_test_seq = create_sequences(test_scaled_lstm, TIME_STEPS)

lstm_model = Sequential()
lstm_model.add(LSTM(32, activation='relu', input_shape=(X_train_seq.shape[1], X_train_seq.shape[2]), return_sequences=False))
lstm_model.add(Dropout(0.2))
lstm_model.add(RepeatVector(X_train_seq.shape[1]))
lstm_model.add(LSTM(32, activation='relu', return_sequences=True))
lstm_model.add(Dropout(0.2))
lstm_model.add(TimeDistributed(Dense(X_train_seq.shape[2])))

lstm_model.compile(optimizer='adam', loss='mse')
lstm_model.fit(X_train_seq, X_train_seq, epochs=10, batch_size=128, validation_split=0.1, verbose=1)

X_train_pred = lstm_model.predict(X_train_seq, verbose=0)
train_mae_loss = np.mean(np.abs(X_train_pred - X_train_seq), axis=(1, 2))
lstm_threshold = np.percentile(train_mae_loss, 99)

X_test_pred = lstm_model.predict(X_test_seq, verbose=0)
test_mae_loss = np.mean(np.abs(X_test_pred - X_test_seq), axis=(1, 2))
lstm_pred_seq = (test_mae_loss > lstm_threshold).astype(int)

pad = [0] * TIME_STEPS
lstm_pred = np.array(pad + lstm_pred_seq.tolist())
lstm_scores_full = np.array(pad + test_mae_loss.tolist())

# 6. ENSEMBLE AND EVALUATION
ensemble_votes = z_pred + if_pred + lstm_pred
ensemble_pred = (ensemble_votes >= 1).astype(int) # any model detects -> output anomaly

print("--- EVALUATION ON A-1 LABELS ---")
print(f"Z-Score Accuracy: {accuracy_score(y_true, z_pred):.4f}")
print(f"IForest Accuracy: {accuracy_score(y_true, if_pred):.4f}")
print(f"LSTM Accuracy: {accuracy_score(y_true, lstm_pred):.4f}")
print(f"Ensemble Accuracy: {accuracy_score(y_true, ensemble_pred):.4f}")

# Normalize scores to 0-1 for ensemble_score
def norm_score(s):
    min_s = np.min(s)
    max_s = np.max(s)
    if max_s == min_s:
        return np.zeros_like(s)
    return (s - min_s) / (max_s - min_s)

z_scores_norm = norm_score(overall_z_score)
if_scores_norm = norm_score(if_scores)
lstm_scores_norm = norm_score(lstm_scores_full)

# 7. GENERATE JSON
output_dir = base_dir / "anomalies_output"
if output_dir.exists():
    import shutil
    shutil.rmtree(output_dir)
output_dir.mkdir(exist_ok=True)

base_timestamp = 1712839200
generated_count = 0

for i in range(len(test_data)):
    if ensemble_pred[i] == 1:
        # Determine affected sensors (Z-score > 3)
        sensor_z = np.abs(z_scores[i])
        affected_indices = np.where(sensor_z > 3.0)[0]
        affected = [f"sensor_{j}" for j in affected_indices]
        if not affected:
            affected = [f"sensor_{np.argmax(sensor_z)}"] # fallback to max
            
        ens_score = float((z_scores_norm[i] + if_scores_norm[i] + lstm_scores_norm[i]) / 3)
        confidence = float(ensemble_votes[i] / 3.0)
        
        severity = "low"
        if ens_score > 0.8: severity = "critical"
        elif ens_score > 0.6: severity = "high"
        elif ens_score > 0.4: severity = "medium"

        votes = int(z_pred[i] + if_pred[i] + lstm_pred[i])
        if votes == 1:
            if lstm_pred[i]: driver = "lstm"
            elif if_pred[i]: driver = "iforest"
            else: driver = "zscore"
        elif votes > 1:
            max_score = max(z_scores_norm[i], if_scores_norm[i], lstm_scores_norm[i])
            if max_score == lstm_scores_norm[i]: driver = "lstm"
            elif max_score == if_scores_norm[i]: driver = "iforest"
            else: driver = "zscore"
        else:
            driver = "none"

        data = {
            "timestamp": base_timestamp + i,
            "ensemble_score": round(ens_score, 2),
            "confidence": round(confidence, 2),
            "severity": severity,
            "anomaly_type": anomaly_type,
            "affected_sensors": affected,
            "detection_driver": driver,
            "model_outputs": {
                "zscore": {"score": float(overall_z_score[i]), "is_anomaly": int(z_pred[i]), "score_norm": float(z_scores_norm[i])},
                "iforest": {"score": float(if_scores[i]), "is_anomaly": int(if_pred[i]), "score_norm": float(if_scores_norm[i])},
                "lstm": {"score": float(lstm_scores_full[i]), "is_anomaly": int(lstm_pred[i]), "score_norm": float(lstm_scores_norm[i])}
            },
            "consensus": {
                "votes": votes,
                "agreement": {
                    "zscore_lstm": int(np.abs(overall_z_score[i] - lstm_scores_full[i]) * 10),
                    "lstm_iforest": int(np.abs(lstm_scores_full[i] - if_scores[i]) * 10),
                    "zscore_iforest": int(np.abs(if_scores[i] - overall_z_score[i]) * 10)
                }
            }
        }
        
        with open(output_dir / f"{base_timestamp + i}.json", "w") as f:
            json.dump(data, f, indent=2)
        generated_count += 1

print(f"Generated {generated_count} JSON files in {output_dir}")

# 8. SAVE THE TRAINED MODELS
import joblib
print("\nSaving trained models...")
models_dir = base_dir / "Trained Models"
models_dir.mkdir(exist_ok=True)

# Save Z-Score parameters as Joblib
zscore_params = {'mean': train_mean, 'std': train_std, 'threshold': 3.0}
joblib.dump(zscore_params, models_dir / "msl_zscore_params.joblib")
print(f"Saved Z-Score parameters to {models_dir / 'msl_zscore_params.joblib'}")

# Save Isolation Forest and its Scaler as Joblib
joblib.dump(if_model, models_dir / "msl_isolation_forest_model.joblib")
joblib.dump(scaler_if, models_dir / "msl_sensor_scaler.joblib")
print(f"Saved Isolation Forest to {models_dir / 'msl_isolation_forest_model.joblib'}")

# Save LSTM Autoencoder Scaler and Threshold as Joblib
joblib.dump(scaler_lstm, models_dir / "msl_lstm_scaler.joblib")
joblib.dump(lstm_threshold, models_dir / "msl_lstm_threshold.joblib")

# Save LSTM Autoencoder as .keras file
lstm_model.save(models_dir / "msl_lstm_autoencoder.keras")
print(f"Saved LSTM Autoencoder assets to {models_dir}")
print("All models successfully stored.")

from sklearn.ensemble import GradientBoostingClassifier
import joblib

def train_disagreement_classifier(anomalies_dir: Path):
    X, y = [], []
    type_map = {"point": 0, "contextual": 1, "collective": 2}

    for f in anomalies_dir.glob("*.json"):
        d = json.loads(f.read_text())
        mo = d["model_outputs"]
        cs = d["consensus"]

        features = [
            mo["zscore"]["score_norm"],
            mo["iforest"]["score_norm"],
            mo["lstm"]["score_norm"],
            cs["agreement"]["zscore_lstm"],
            cs["agreement"]["lstm_iforest"],
            cs["agreement"]["zscore_iforest"],
            cs["votes"] / 3.0,
            1 if d["detection_driver"] == "lstm" else 0,
        ]

        # Label heuristic (refine with ground truth labels later):
        # lstm-solo = contextual, unanimous = point, majority with lstm-driver = collective
        if cs["votes"] == 1 and mo["lstm"]["is_anomaly"]:
            label = "contextual"
        elif cs["votes"] == 3:
            label = "point"
        else:
            label = "collective"

        X.append(features)
        y.append(label)

    clf = GradientBoostingClassifier(n_estimators=100, random_state=42)
    clf.fit(X, y)
    joblib.dump(clf, "artifacts/disagreement_clf.pkl")
    print("Disagreement classifier trained.")

# Create artifacts directory to match the function's output path
Path("artifacts").mkdir(exist_ok=True)
train_disagreement_classifier(output_dir)