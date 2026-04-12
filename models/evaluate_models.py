import argparse
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import joblib 
from pathlib import Path
from sklearn.metrics import classification_report, confusion_matrix
import os

# Suppress tensorflow warnings
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
from keras.models import load_model

def create_sequences(X, time_steps):
    Xs = []
    for i in range(len(X) - time_steps + 1):
        Xs.append(X[i:(i + time_steps)])
    return np.array(Xs)

def main():
    data_path = Path("data/smd_test.csv")
    print(f"Loading data from {data_path}...")
    try:
        df = pd.read_csv(data_path, header=0, parse_dates=['timestamp'], index_col='timestamp')
    except Exception as e:
        df = pd.read_csv(data_path, header=0)
        
    y_true = None
    if 'anomaly' in df.columns:
        y_true = df['anomaly']
        X = df.drop(columns=['anomaly'])
    else:
        X = df.copy()

    script_dir = Path(__file__).resolve().parent
    models_dir = script_dir / "Trained Models"
    if not models_dir.exists():
        print(f"Error: 'Trained Models' directory not found at {models_dir}.")
        return

    predictions = {}
    scores = {}

    # -----------------------------
    # 1. Z-SCORE MODEL
    # -----------------------------
    print("\n--- Evaluating Z-Score Model ---")
    zscore_params_path = models_dir / "zscore_params.joblib"
    if zscore_params_path.exists():
        zscore_params = joblib.load(zscore_params_path)
        z_mean = zscore_params['mean']
        z_std = zscore_params['std']
        z_thresh = zscore_params['threshold']
        
        # Ensure we only use columns present in training
        cols = z_mean.index.intersection(X.columns)
        z_scores = (X[cols] - z_mean[cols]) / z_std[cols]
        z_overall = z_scores.abs().max(axis=1)
        z_pred = (z_overall > z_thresh).astype(int)
        
        scores['Z-Score'] = z_overall
        predictions['Z-Score'] = z_pred
        print("Z-Score evaluation complete.")
    else:
        print("Z-Score parameters not found.")

    # -----------------------------
    # 2. ISOLATION FOREST MODEL
    # -----------------------------
    print("\n--- Evaluating Isolation Forest Model ---")
    if_model_path = models_dir / "isolation_forest_model.joblib"
    if_scaler_path = models_dir / "sensor_scaler.joblib"
    
    if if_model_path.exists() and if_scaler_path.exists():
        if_model = joblib.load(if_model_path)
        if_scaler = joblib.load(if_scaler_path)

        X_if = X
        if hasattr(if_scaler, 'feature_names_in_'):
            expected_cols = list(if_scaler.feature_names_in_)
            missing_cols = [c for c in expected_cols if c not in X.columns]
            if missing_cols:
                print(f"Isolation Forest skipped: missing required columns {missing_cols}")
                X_if = None
            else:
                X_if = X.loc[:, expected_cols]

        if X_if is not None:
            X_scaled_if = if_scaler.transform(X_if)
            if_preds = if_model.predict(X_scaled_if)
        
            if_pred_binary = np.where(if_preds == -1, 1, 0)
            # decision_function: lower is more anomalous. We negate it so higher is more anomalous.
            if_anomaly_scores = -if_model.decision_function(X_scaled_if)

            scores['Isolation Forest'] = if_anomaly_scores
            predictions['Isolation Forest'] = if_pred_binary
            print("Isolation Forest evaluation complete.")
        else:
            print("Isolation Forest evaluation skipped due to missing or invalid feature alignment.")
    else:
        print("Isolation Forest model or scaler not found.")

    # -----------------------------
    # 3. LSTM AUTOENCODER MODEL
    # -----------------------------
    print("\n--- Evaluating LSTM Autoencoder Model ---")
    lstm_model_path = models_dir / "lstm_autoencoder.keras"
    lstm_scaler_path = models_dir / "lstm_scaler.joblib"
    lstm_thresh_path = models_dir / "lstm_threshold.joblib"
    
    TIME_STEPS = 60
    
    if lstm_model_path.exists() and lstm_scaler_path.exists() and lstm_thresh_path.exists():
        lstm_model = load_model(lstm_model_path)
        lstm_scaler = joblib.load(lstm_scaler_path)
        lstm_thresh = joblib.load(lstm_thresh_path)

        X_lstm = X
        if hasattr(lstm_scaler, 'feature_names_in_'):
            expected_cols = list(lstm_scaler.feature_names_in_)
            missing_cols = [c for c in expected_cols if c not in X.columns]
            if missing_cols:
                print(f"LSTM Autoencoder skipped: missing required columns {missing_cols}")
                X_lstm = None
            else:
                X_lstm = X.loc[:, expected_cols]

        if X_lstm is not None:
            X_scaled_lstm = lstm_scaler.transform(X_lstm)

            if len(X_scaled_lstm) > TIME_STEPS:
                X_seq = create_sequences(X_scaled_lstm, TIME_STEPS)
                X_pred = lstm_model.predict(X_seq, verbose=0)
                
                lstm_errors = np.mean(np.abs(X_pred - X_seq), axis=(1, 2))
                lstm_preds_seq = (lstm_errors > lstm_thresh).astype(int)
                
                # Pad the beginning to match original length. For N rows and window size T,
                # the first T-1 rows cannot be scored because the first full sequence ends at row T-1.
                pad = [0] * (TIME_STEPS - 1)
                full_lstm_errors = pad + lstm_errors.tolist()
                full_lstm_preds = pad + lstm_preds_seq.tolist()
                
                scores['LSTM Autoencoder'] = full_lstm_errors
                predictions['LSTM Autoencoder'] = full_lstm_preds
                print("LSTM Autoencoder evaluation complete.")
            else:
                print(f"Data is too short (<= {TIME_STEPS} rows) for LSTM evaluation.")
        else:
            print("LSTM Autoencoder evaluation skipped due to missing or invalid feature alignment.")
    else:
        print("LSTM model, scaler, or threshold not found.")

    # -----------------------------
    # CORRELATION AND REPORTING
    # -----------------------------
    print("\n" + "="*50)
    print("ANALYSIS RESULTS")
    print("="*50)

    if not scores:
        print("No models were successfully evaluated.")
        return

    scores_df = pd.DataFrame(scores, index=df.index)
    
    print("\n--- Correlation Matrix of Anomaly Scores ---")
    corr_matrix = scores_df.corr()
    print(corr_matrix.to_string())
    
    if y_true is not None:
        for model_name, preds in predictions.items():
            print(f"\n--- Performance Metrics: {model_name} ---")
            print(classification_report(y_true, preds, target_names=['Normal (0)', 'Anomaly (1)'], zero_division=0))
            cm = confusion_matrix(y_true, preds)
            print("Confusion Matrix:")
            print(f"TN: {cm[0][0]:<5} | FP: {cm[0][1]}")
            print(f"FN: {cm[1][0]:<5} | TP: {cm[1][1]}")
    else:
        print("\nNote: Ground truth 'anomaly' column not found in data. Performance metrics cannot be calculated.")
        print("\nPredicted Anomaly Counts:")
        for model_name, preds in predictions.items():
            print(f"{model_name}: {sum(preds)} anomalies detected out of {len(preds)} samples.")

    # -----------------------------
    # VISUALIZATION
    # -----------------------------
    print("\nGenerating visualizations...")
    
    # 1. Correlation Heatmap
    try:
        plt.figure(figsize=(8, 6))
        sns.heatmap(corr_matrix, annot=True, cmap='coolwarm', vmin=-1, vmax=1)
        plt.title("Correlation Matrix of Anomaly Scores")
        plt.tight_layout()
        plt.show()
    except Exception as e:
        print(f"Could not generate correlation heatmap: {e}")

    # 2. Anomaly Scores Over Time
    try:
        num_models = len(scores)
        fig, axes = plt.subplots(num_models, 1, figsize=(14, 4 * num_models), sharex=True)
        if num_models == 1:
            axes = [axes]
        
        palette = sns.color_palette("husl", num_models)
        for i, (model_name, score_series) in enumerate(scores.items()):
            ax = axes[i]
            ax.plot(df.index, score_series, label=f"{model_name} Score", color=palette[i])
            ax.set_title(f"{model_name} Anomaly Score Over Time")
            ax.set_ylabel("Score")
            ax.grid(True, alpha=0.3)
            ax.legend()
        
        plt.xlabel("Timestamp" if isinstance(df.index, pd.DatetimeIndex) else "Index")
        plt.tight_layout()
        plt.show()
    except Exception as e:
        print(f"Could not generate anomaly score plot: {e}")

if __name__ == "__main__":
    main()
