import pandas as pd
import numpy as np
import joblib
from pathlib import Path
import json
import zipfile
import tempfile
from keras.models import load_model
from keras.models import model_from_json
from keras.layers import InputLayer, LSTM

# --- 1. GLOBAL MODEL LOADING ---
BASE_DIR = Path(__file__).resolve().parent.parent
# POINT TO THE NEW MSL MODELS DIRECTORY
MODELS_DIR = BASE_DIR / "models" / "Trained_MSL_Models"

print(f"Initializing SentinelIQ Detection Engine (MSL) from {MODELS_DIR}...")

# Z-Score Baselines
z_params = joblib.load(MODELS_DIR / "msl_zscore_params.joblib")
# Isolation Forest
if_model = joblib.load(MODELS_DIR / "msl_isolation_forest_model.joblib")
if_scaler = joblib.load(MODELS_DIR / "msl_sensor_scaler.joblib")


class CompatInputLayer(InputLayer):
    """Compatibility shim for legacy InputLayer configs."""

    @classmethod
    def from_config(cls, config):
        cfg = dict(config or {})
        # Remove keys that cause issues in some Keras versions
        cfg.pop("batch_shape", None)
        cfg.pop("batch_input_shape", None)
        cfg.pop("optional", None)
        # Ensure we don't pass unknown arguments to the parent constructor
        return cls(**cfg)


class CompatLSTM(LSTM):
    """Compatibility shim for legacy LSTM configs."""

    @classmethod
    def from_config(cls, config):
        cfg = dict(config or {})
        cfg.pop('batch_input_shape', None)
        cfg.pop("time_major", None)
        # Some versions of Keras might have added other keys
        # Let's try to be as safe as possible
        return super().from_config(cfg)


def load_lstm_model(model_path: Path):
    """
    Load LSTM autoencoder with compatibility fallbacks for Keras 3.
    """
    custom_objects = {
        "InputLayer": CompatInputLayer,
        "LSTM": CompatLSTM,
    }

    try:
        # Try loading with custom objects
        return load_model(model_path, custom_objects=custom_objects, compile=False)
    except Exception as e:
        print(f"Standard loading failed: {e}. Trying secondary fallback...")
        try:
            # Try loading without custom objects but with compile=False
            return load_model(model_path, compile=False)
        except Exception as e2:
            print(f"Secondary fallback failed: {e2}. Trying manual rebuild...")
            # If all else fails, the model might be very broken or incompatible.
            # In a real scenario, we might want to use a more complex rebuild logic,
            # but let's try one more thing: loading just the weights if possible.
            # However, for now, let's try to use the most successful one from detection.py
            raise e2


# LSTM Autoencoder
lstm_model = load_lstm_model(MODELS_DIR / "msl_lstm_autoencoder.keras")
lstm_scaler = joblib.load(MODELS_DIR / "msl_lstm_scaler.joblib")
lstm_thresh = joblib.load(MODELS_DIR / "msl_lstm_threshold.joblib")

def run_detection(df: pd.DataFrame):
    """
    Runs Z-Score, Isolation Forest, and LSTM models on the 60s window.
    Returns the exact JSON format required for the frontend as shown in detection.py.
    """
    if df is None or len(df) < 60:
        return {"is_anomaly": False, "message": "Window too small"}

    # --- 2. PRE-PROCESSING & FEATURE ALIGNMENT ---
    # Ensure columns are dropped and sorted EXACTLY like training
    X = df.drop(columns=['anomaly']) if 'anomaly' in df.columns else df.copy()
    
    # Feature Padding (MSL specific: ensure we have 55 features)
    expected_features = z_params['mean'].shape[0]
    current_features = X.shape[1]
    if current_features < expected_features:
        # Pad with zeros
        padding_cols = [f"sensor_{i}" for i in range(current_features, expected_features)]
        padding_df = pd.DataFrame(0, index=X.index, columns=padding_cols)
        X = pd.concat([X, padding_df], axis=1)
    elif current_features > expected_features:
        # Truncate
        X = X.iloc[:, :expected_features]

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
    X_seq = np.expand_dims(lstm_scaled, axis=0) # Shape: (1, 60, N_FEATURES)
    X_pred = lstm_model.predict(X_seq, verbose=0)
    # Calculate Reconstruction Error (MAE)
    mae_loss = np.mean(np.abs(X_pred - X_seq))
    is_lstm_anomaly = 1 if mae_loss > lstm_thresh else 0

    # --- 6. CORRELATION CALCULATION (The 3 Keys) ---
    z_series = z_scores_full.abs().max(axis=1)
    
    # Calculate IF scores for the full window
    if_scaled_full = if_scaler.transform(X)
    if_scores_full = -if_model.decision_function(if_scaled_full)
    
    # Calculate LSTM MAE per timestep for the full window
    # We need to calculate MAE per timestep. X_pred and X_seq are (1, 60, N_FEATURES)
    mae_loss_per_step = np.mean(np.abs(X_pred[0] - X_seq[0]), axis=1) # Shape: (60,)

    scores = {
        'Z-Score': z_series.values,
        'Isolation Forest': if_scores_full,
        'LSTM Autoencoder': mae_loss_per_step
    }

    scores_df = pd.DataFrame(scores, index=df.index)
    
    # Fill NaN with 0 if variance is perfectly 0
    corr_matrix = scores_df.corr().fillna(0)

    z_l_corr = float(corr_matrix.loc['Z-Score', 'LSTM Autoencoder'])
    l_i_corr = float(corr_matrix.loc['LSTM Autoencoder', 'Isolation Forest'])
    i_z_corr = float(corr_matrix.loc['Isolation Forest', 'Z-Score'])

    # --- 7. INSIGHT GENERATION ---
    triggered_count = is_z_anomaly + is_if_anomaly + is_lstm_anomaly
    is_anomaly = triggered_count > 0

    # Identify top 6 affected sensors (by absolute Z-score)
    affected_sensors = latest_z.abs().nlargest(6).index.tolist()

    # Final Ensemble Score (Normalized)
    # Using thresholds for normalization
    z_score_norm = min(max_z / 10.0, 1.0)
    if_score_norm = min(max_z / 0.5, 1.0) # Heuristic
    lstm_score_norm = min(mae_loss / lstm_thresh, 1.0)
    
    ensemble_score = (z_score_norm + if_score_norm + lstm_score_norm) / 3.0

    # --- 8. ASSEMBLE JSON ---
    return {
        "timestamp": latest_ts,
        "is_anomaly": is_anomaly,
        "ensemble_score": round(float(ensemble_score), 2),
        "confidence": round(triggered_count / 3, 2),
        "severity": "critical" if triggered_count >= 2 else "warning" if triggered_count == 1 else "info",
        "anomaly_type": "point" if is_z_anomaly else "collective" if is_if_anomaly else "contextual" if is_lstm_anomaly else "none",
        "affected_sensors": affected_sensors,
        "model_outputs": {
            "zscore": {
                "score": float(max_z),
                "is_anomaly": bool(is_z_anomaly)
            },
            "iforest": {
                "score": float(if_score),
                "is_anomaly": bool(is_if_anomaly)
            },
            "lstm": {
                "score": float(mae_loss),
                "is_anomaly": bool(is_lstm_anomaly)
            }
        },
        "zscore_lstm_corr": float(z_l_corr),
        "lstm_if_corr": float(l_i_corr),
        "if_zscore_corr": float(i_z_corr)
    }

if __name__ == "__main__":
    # Test with MSL data
    test_file = Path(__file__).resolve().parent / "data" / "MSL data" / "test" / "A-1.npy"
    if test_file.exists():
        print(f"Loading test data from {test_file}")
        msl_data = np.load(test_file)
        
        # Take a 60-row window
        window_data = msl_data[:60, :]
        num_features = window_data.shape[1]

        columns = [f"sensor_{i}" for i in range(num_features)]
        df = pd.DataFrame(window_data, columns=columns)
        
        # Create a mock timestamp index
        timestamps = pd.date_range(end=pd.Timestamp.now(), periods=60, freq='s')
        df.index = timestamps

        print("\nInput DataFrame shape:", df.shape)
        
        # Run detection
        result = run_detection(df)
        print("\nDetection Result:")
        print(json.dumps(result, indent=2))
    else:
        print(f"File not found: {test_file}")
