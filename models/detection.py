import pandas as pd
import numpy as np
import joblib
from pathlib import Path
from keras.models import load_model

# --- 1. GLOBAL MODEL LOADING ---
# We load these once when the worker starts to keep the loop fast.
BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "models" / "Trained Models"

print("Initializing SentinelIQ Detection Engine...")
    # Z-Score Baselines
z_params = joblib.load(MODELS_DIR / "msl_zscore_params.joblib")
# Isolation Forest
if_model = joblib.load(MODELS_DIR / "msl_isolation_forest_model.joblib")
if_scaler = joblib.load(MODELS_DIR / "msl_sensor_scaler.joblib")
# LSTM Autoencoder
lstm_model = load_model(MODELS_DIR / "msl_lstm_autoencoder.keras")
lstm_scaler = joblib.load(MODELS_DIR / "msl_lstm_scaler.joblib")
lstm_thresh = joblib.load(MODELS_DIR / "msl_lstm_threshold.joblib")

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
    z_series = z_scores_full.abs().max(axis=1)
    
    # Calculate IF scores for the full window
    if_scaled_full = if_scaler.transform(X)
    if_scores_full = -if_model.decision_function(if_scaled_full)
    
    # Calculate LSTM MAE per timestep for the full window
    mae_loss_full = np.mean(np.abs(X_pred[0] - X_seq[0]), axis=1)

    scores = {
        'Z-Score': z_series.values,
        'Isolation Forest': if_scores_full,
        'LSTM Autoencoder': mae_loss_full
    }

    scores_df = pd.DataFrame(scores, index=df.index)
    
    print("\n--- Correlation Matrix of Anomaly Scores ---")
    corr_matrix = scores_df.corr().fillna(0) # Fill NaN with 0 if variance is perfectly 0
    print(corr_matrix.to_string())

    z_l_corr = float(corr_matrix.loc['Z-Score', 'LSTM Autoencoder'])
    l_i_corr = float(corr_matrix.loc['LSTM Autoencoder', 'Isolation Forest'])
    i_z_corr = float(corr_matrix.loc['Isolation Forest', 'Z-Score'])

    # --- 7. INSIGHT GENERATION ---
    triggered_count = is_z_anomaly + is_if_anomaly + is_lstm_anomaly
    is_anomaly = triggered_count > 0

    if not is_anomaly:
        return None

    # Identify top 6 affected sensors (by absolute Z-score)
    affected_sensors = latest_z.abs().nlargest(6).index.tolist()

    # Final Ensemble Score (Normalized)
    ensemble_score = (min(max_z/10, 1.0) + min(if_score*2, 1.0) + min(mae_loss/lstm_thresh, 1.0)) / 3

    # --- 8. ASSEMBLE JSON ---
    return {
        "timestamp": latest_ts,
        "is_anomaly": is_anomaly,
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

if __name__ == "__main__":
    # Load the .npy file
    npy_path = Path(__file__).resolve().parent / "data" / "MSL" / "MSL_test.npy"
    if npy_path.exists():
        print(f"Loading data from {npy_path}")
        msl_data = np.load(npy_path)
        
        # Take a 60-row window (required by run_detection)
        window_data = msl_data[:60, :]
        num_features = window_data.shape[1]

        # Convert to a DataFrame resembling processing.py output
        columns = [f"sensor_{i}" for i in range(num_features)]
        df = pd.DataFrame(window_data, columns=columns)
        
        # Create a mock timestamp index
        timestamps = pd.date_range(end=pd.Timestamp.now(), periods=60, freq='s')
        df.index = timestamps

        print("\nInput DataFrame shape:", df.shape)
        
        # Run detection
        result = run_detection(df)
        import json
        print("\nDetection Result:")
        print(json.dumps(result, indent=2))
    else:
        print(f"File not found: {npy_path}")