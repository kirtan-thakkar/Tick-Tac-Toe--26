import argparse
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import joblib 
from pathlib import Path
from sklearn.metrics import classification_report, confusion_matrix, f1_score
import os
import ast

# Suppress tensorflow warnings
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
from keras.models import load_model

def create_sequences(X, time_steps):
    Xs = []
    for i in range(len(X) - time_steps + 1):
        Xs.append(X[i:(i + time_steps)])
    return np.array(Xs)

def apply_point_adjust(y_pred, anomaly_sequences):
    adjusted_pred = y_pred.copy()
    for seq in anomaly_sequences:
        start, end = seq
        # If there's at least one prediction of 1 in this true anomaly segment
        if np.any(adjusted_pred[start:end+1] == 1):
            adjusted_pred[start:end+1] = 1
    return adjusted_pred

def main():
    script_dir = Path(__file__).resolve().parent
    models_dir = script_dir / "Trained_MSL_Models"
    
    if not models_dir.exists():
        print(f"Error: 'Trained_MSL_Models' directory not found at {models_dir}.")
        return

    # Load labels
    labels_path = script_dir / "data" / "MSL data" / "labeled_anomalies.csv"
    if not labels_path.exists():
        print(f"Error: Labels file not found at {labels_path}")
        return
        
    df_labels = pd.read_csv(labels_path)
    
    # Determine max_dim from zscore params
    zscore_params_path = models_dir / "msl_zscore_params.joblib"
    if zscore_params_path.exists():
        zscore_params = joblib.load(zscore_params_path)
        train_mean = zscore_params['mean']
        z_mean = zscore_params['mean']
        z_std = zscore_params['std']
        z_thresh = zscore_params['threshold']
        max_dim = len(train_mean)
    else:
        print("Error: Z-Score params not found.")
        return

    # Load Isolation Forest
    if_model_path = models_dir / "msl_isolation_forest_model.joblib"
    if_scaler_path = models_dir / "msl_sensor_scaler.joblib"
    if_model = joblib.load(if_model_path) if if_model_path.exists() else None
    if_scaler = joblib.load(if_scaler_path) if if_scaler_path.exists() else None

    # Load LSTM Autoencoder
    lstm_model_path = models_dir / "msl_lstm_autoencoder.keras"
    lstm_scaler_path = models_dir / "msl_lstm_scaler.joblib"
    lstm_thresh_path = models_dir / "msl_lstm_threshold.joblib"
    lstm_model = load_model(lstm_model_path) if lstm_model_path.exists() else None
    lstm_scaler = joblib.load(lstm_scaler_path) if lstm_scaler_path.exists() else None
    lstm_thresh = joblib.load(lstm_thresh_path) if lstm_thresh_path.exists() else None

    TIME_STEPS = 60

    print(f"Starting batch evaluation for MSL dataset (models expect {max_dim} features)...")
    
    all_y_true = []
    all_preds = {'Z-Score': [], 'Isolation Forest': [], 'LSTM Autoencoder': []}
    all_scores = {'Z-Score': [], 'Isolation Forest': [], 'LSTM Autoencoder': []}
    channel_f1 = {'Z-Score': {}, 'Isolation Forest': {}, 'LSTM Autoencoder': {}}
    
    test_dir = script_dir / "data" / "MSL data" / "test"
    if not test_dir.exists():
        print(f"Error: Test directory not found at {test_dir}.")
        return
        
    test_files = list(test_dir.glob("*.npy"))
    total_files = len(test_files)
    
    for i, test_file in enumerate(test_files):
        chan_id = test_file.stem
        label_row = df_labels[df_labels['chan_id'] == chan_id]
        if label_row.empty:
            continue
            
        anomaly_sequences = ast.literal_eval(label_row.iloc[0]['anomaly_sequences'])
        X = np.load(test_file)
        
        if X.shape[1] < max_dim:
            padding = ((0, 0), (0, max_dim - X.shape[1]))
            X_padded = np.pad(X, padding, mode='constant', constant_values=0)
        elif X.shape[1] > max_dim:
            print(f"\nSkipping {chan_id}: Too many features ({X.shape[1]}).")
            continue
        else:
            X_padded = X
            
        num_values = X.shape[0]
        y_true = np.zeros(num_values, dtype=int)
        for seq in anomaly_sequences:
            start, end = seq
            y_true[start:end+1] = 1
            
        all_y_true.extend(y_true)
        
        # Z-Score
        z_scores_val = (X_padded - z_mean) / z_std
        z_overall = np.abs(z_scores_val).max(axis=1)
        z_pred = (z_overall > z_thresh).astype(int)
        z_pred_adj = apply_point_adjust(z_pred, anomaly_sequences)
        
        all_scores['Z-Score'].extend(z_overall)
        all_preds['Z-Score'].extend(z_pred_adj)
        channel_f1['Z-Score'][chan_id] = f1_score(y_true, z_pred_adj, zero_division=0)
        
        # IF
        if if_model and if_scaler:
            X_scaled_if = if_scaler.transform(X_padded)
            if_preds = if_model.predict(X_scaled_if)
            if_pred_binary = np.where(if_preds == -1, 1, 0)
            if_anomaly_scores = -if_model.decision_function(X_scaled_if)
            
            if_pred_adj = apply_point_adjust(if_pred_binary, anomaly_sequences)
            
            all_scores['Isolation Forest'].extend(if_anomaly_scores)
            all_preds['Isolation Forest'].extend(if_pred_adj)
            channel_f1['Isolation Forest'][chan_id] = f1_score(y_true, if_pred_adj, zero_division=0)
            
        # LSTM
        if lstm_model and lstm_scaler and lstm_thresh:
            X_scaled_lstm = lstm_scaler.transform(X_padded)
            if len(X_scaled_lstm) > TIME_STEPS:
                X_seq = create_sequences(X_scaled_lstm, TIME_STEPS)
                X_pred = lstm_model.predict(X_seq, verbose=0)
                lstm_errors = np.mean(np.abs(X_pred - X_seq), axis=(1, 2))
                lstm_preds_seq = (lstm_errors > lstm_thresh).astype(int)
                
                pad = [0] * (TIME_STEPS - 1)
                full_lstm_errors = pad + lstm_errors.tolist()
                full_lstm_preds = pad + lstm_preds_seq.tolist()
            else:
                full_lstm_errors = [0] * num_values
                full_lstm_preds = [0] * num_values
                
            lstm_pred_adj = apply_point_adjust(np.array(full_lstm_preds), anomaly_sequences)
            
            all_scores['LSTM Autoencoder'].extend(full_lstm_errors)
            all_preds['LSTM Autoencoder'].extend(lstm_pred_adj)
            channel_f1['LSTM Autoencoder'][chan_id] = f1_score(y_true, lstm_pred_adj, zero_division=0)

        print(f"Processed {chan_id} ({i+1}/{total_files})", end='\r')
        
    print("\n\n" + "="*50)
    print("OVERALL BATCH ANALYSIS RESULTS (Point-Adjusted)")
    print("="*50)
    
    scores_df = pd.DataFrame(all_scores)
    print("\n--- Correlation Matrix of Anomaly Scores (All Data) ---")
    corr_matrix = scores_df.corr()
    print(corr_matrix.to_string())
    
    for model_name in all_preds.keys():
        if not all_preds[model_name]:
            continue
        print(f"\n--- Performance Metrics: {model_name} ---")
        print(classification_report(all_y_true, all_preds[model_name], target_names=['Normal (0)', 'Anomaly (1)'], zero_division=0))
        
        cm = confusion_matrix(all_y_true, all_preds[model_name])
        print("Confusion Matrix:")
        print(f"TN: {cm[0][0]:<5} | FP: {cm[0][1]}")
        print(f"FN: {cm[1][0]:<5} | TP: {cm[1][1]}")
        
        # Best and worst channels based on F1-Score
        if channel_f1[model_name]:
            sorted_channels = sorted(channel_f1[model_name].items(), key=lambda item: item[1])
            worst_3 = sorted_channels[:3]
            best_3 = sorted_channels[-3:]
            best_3.reverse() # Sort best from highest to lowest
            
            print(f"\nTop 3 Best Channels (F1-Score):")
            for ch, score in best_3:
                print(f"  {ch}: {score:.4f}")
            print(f"Top 3 Worst Channels (F1-Score):")
            for ch, score in worst_3:
                print(f"  {ch}: {score:.4f}")

    print("\nGenerating visualizations...")
    
    # Plot 1: Correlation Matrix
    try:
        plt.figure(figsize=(8, 6))
        sns.heatmap(corr_matrix, annot=True, cmap='coolwarm', vmin=-1, vmax=1)
        plt.title("Correlation Matrix of Anomaly Scores (All Test Data)")
        plt.tight_layout()
        plt.show()
    except Exception as e:
        print(f"Could not generate correlation heatmap: {e}")

    # Plot 2: Boxplot of F1 Scores per Model
    try:
        f1_data = []
        for model, scores in channel_f1.items():
            for ch, f1 in scores.items():
                f1_data.append({'Model': model, 'Channel': ch, 'F1-Score': f1})
        f1_df = pd.DataFrame(f1_data)

        if not f1_df.empty:
            plt.figure(figsize=(10, 6))
            sns.boxplot(x='Model', y='F1-Score', data=f1_df)
            sns.stripplot(x='Model', y='F1-Score', data=f1_df, color='black', alpha=0.3)
            plt.title("Distribution of F1-Scores across all Channels (Point-Adjusted)")
            plt.ylabel("F1-Score")
            plt.tight_layout()
            plt.show()
    except Exception as e:
        print(f"Could not generate F1-score plot: {e}")

if __name__ == "__main__":
    main()