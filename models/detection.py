import pandas as pd
import numpy as np
import joblib
from pathlib import Path
import os

# Suppress TensorFlow logging for a cleaner terminal
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
from tensorflow.keras.models import load_model

# --- 1. GLOBAL MODEL LOADING ---
# We load these once when the worker starts to keep the loop fast.
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
MODELS_DIR = BASE_DIR / "models" / "Trained Models"

print("🧠 Initializing SentinelIQ Detection Engine...")
    # Z-Score Baselines
z_params = joblib.load(MODELS_DIR / "zscore_params.joblib")
# Isolation Forest
if_model = joblib.load(MODELS_DIR / "isolation_forest_model.joblib")
if_scaler = joblib.load(MODELS_DIR / "sensor_scaler.joblib")
# LSTM Autoencoder
lstm_model = load_model(MODELS_DIR / "lstm_autoencoder.keras")
lstm_scaler = joblib.load(MODELS_DIR / "lstm_scaler.joblib")
lstm_thresh = joblib.load(MODELS_DIR / "lstm_threshold.joblib")

def run_detection(df: pd.DataFrame):
    """
    Runs Z-Score, Isolation Forest, and LSTM models on the 60s window.
    Returns the exact JSON format required for the frontend.
    """
    if df is None or len(df) < 60:
        return {"is_anomaly": False, "message": "Window too small"}

    # --- 2. PRE-PROCESSING & FEATURE ALIGNMENT ---
    # Ensure columns are dropped and sorted EXACTLY like training
    X = df.drop(columns=['anomaly']) if 'anomaly' in df.columns else df.copy()

    # Extract the timestamp of the latest point
    latest_ts = int(df.index[-1].timestamp())

    # Get the latest row for point-detection models
    latest_row = X.iloc[[-1]]

    # --- 3. MODEL 1: Z-SCORE (Point Detection) ---
    # (Value - Mean) / Std
    z_scores_full = (X - z_params['mean']) / z_params['std']
    latest_z = z_scores_full.iloc[-1]
    max_z = latest_z.abs().max()
    is_z_anomaly = 1 if max_z > z_params['threshold'] else 0

    # --- 4. MODEL 2: ISOLATION FOREST (Point Detection) ---
    if_scaled = if_scaler.transform(latest_row)
    if_pred = if_model.predict(if_scaled) # -1 is anomaly
    if_score = -if_model.decision_function(if_scaled)[0] # Higher is more anomalous
    is_if_anomaly = 1 if if_pred[0] == -1 else 0

    # --- 5. MODEL 3: LSTM AUTOENCODER (Sequence Detection) ---
    lstm_scaled = lstm_scaler.transform(X)
    X_seq = np.expand_dims(lstm_scaled, axis=0) # Shape: (1, 60, 38)
    X_pred = lstm_model.predict(X_seq, verbose=0)
    # Calculate Reconstruction Error (MAE)
    mae_loss = np.mean(np.abs(X_pred - X_seq))
    is_lstm_anomaly = 1 if mae_loss > lstm_thresh else 0

    # --- 6. CORRELATION CALCULATION (The 3 Keys) ---
    # We calculate the correlation of the anomaly scores over the 60s window
    # to show how much the models 'agreed' on the trend.
    # Since LSTM provides 1 score per window, we use the Z-Score series for variance.
    z_series = z_scores_full.abs().max(axis=1)
    # Mocking the correlation values based on trigger agreement for the demo

    scores = {
        'Z-Score': max_z,
        'Isolation Forest': if_score,
        'LSTM Autoencoder': mae_loss
    }

    scores_df = pd.DataFrame(scores, index=df.index)
    
    print("\n--- Correlation Matrix of Anomaly Scores ---")
    corr_matrix = scores_df.corr()
    print(corr_matrix.to_string())

    z_l_corr = corr_matrix.iloc[0, 1]
    l_i_corr = corr_matrix.iloc[0, 2]
    i_z_corr = corr_matrix.iloc[1, 2]

    # --- 7. INSIGHT GENERATION ---
    triggered_count = is_z_anomaly + is_if_anomaly + is_lstm_anomaly

    # Identify top 6 affected sensors (by absolute Z-score)
    affected_sensors = latest_z.abs().nlargest(6).index.tolist()

    # Final Ensemble Score (Normalized)
    ensemble_score = (min(max_z/10, 1.0) + min(if_score*2, 1.0) + min(mae_loss/lstm_thresh, 1.0)) / 3

    # --- 8. ASSEMBLE JSON ---
    return {
        "timestamp": latest_ts,
        "is_anomaly": triggered_count > 0,
        "ensemble_score": round(float(ensemble_score), 2),
        "confidence": round(triggered_count / 3, 2),
        "severity": "high" if triggered_count >= 2 else "medium" if triggered_count == 1 else "low",
        "anomaly_type": "point" if triggered_count > 0 else "none",
        "affected_sensors": affected_sensors,
        "model_outputs": {
            "zscore": {
                "score": float(max_z),
                "is_anomaly": is_z_anomaly
            },
            "iforest": {
                "score": float(if_score),
                "is_anomaly": is_if_anomaly
            },
            "lstm": {
                "score": float(mae_loss),
                "is_anomaly": is_lstm_anomaly
            }
        },
        "zscore lstm": z_l_corr,
        "lstm if": l_i_corr,
        "if zscore": i_z_corr
    }