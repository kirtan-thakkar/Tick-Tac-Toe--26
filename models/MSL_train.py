import numpy as np
import os
from pathlib import Path
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import IsolationForest
import joblib
from keras.models import Sequential
from keras.layers import LSTM, Dense, Dropout, RepeatVector, TimeDistributed

def main():
    base_dir = Path(__file__).parent
    train_dir = base_dir / "data" / "MSL data" / "train"

    print(f"Loading all train files from {train_dir}...")
    train_files = list(train_dir.glob("*.npy"))
    if not train_files:
        print("No .npy files found in the training directory.")
        return

    # First pass: find the maximum number of dimensions (features)
    max_dim = 0
    for f in train_files:
        data = np.load(f)
        if data.shape[1] > max_dim:
            max_dim = data.shape[1]
            
    print(f"Maximum feature dimension found: {max_dim}")

    # Second pass: load and pad data to max_dim
    all_train_data = []
    for f in train_files:
        data = np.load(f)
        current_dim = data.shape[1]
        if current_dim < max_dim:
            # Pad with zeros on the feature axis
            padding = ((0, 0), (0, max_dim - current_dim))
            data = np.pad(data, padding, mode='constant', constant_values=0)
        all_train_data.append(data)

    # For Z-Score and Isolation Forest, we can just concatenate all data
    train_data_concat = np.vstack(all_train_data)
    print(f"Total training data points across {len(train_files)} files: {train_data_concat.shape}")

    # 1. Z-SCORE MODEL
    print("Training Z-Score Model...")
    train_mean = np.mean(train_data_concat, axis=0)
    train_std = np.std(train_data_concat, axis=0)
    # Prevent divide by zero for padded features
    train_std[train_std < 1e-2] = 1e-2

    # 2. ISOLATION FOREST MODEL
    print("Training Isolation Forest Model...")
    scaler_if = StandardScaler()
    train_scaled_if = scaler_if.fit_transform(train_data_concat)

    if_model = IsolationForest(n_estimators=100, contamination=0.01, random_state=42, n_jobs=-1)
    if_model.fit(train_scaled_if)

    # 3. LSTM AUTOENCODER MODEL
    print("Training LSTM Autoencoder Model...")
    scaler_lstm = StandardScaler()
    # Fit scaler on concatenated data
    scaler_lstm.fit(train_data_concat)

    TIME_STEPS = 60
    def create_sequences(X, time_steps=TIME_STEPS):
        Xs = []
        for i in range(len(X) - time_steps):
            Xs.append(X[i:(i + time_steps)])
        if not Xs:
            return np.empty((0, time_steps, X.shape[1]))
        return np.array(Xs)

    X_train_seq_list = []
    # CRITICAL: To avoid sequence conflicts across different files, create sequences per file
    for data in all_train_data:
        # Scale individual padded file data
        scaled_data = scaler_lstm.transform(data)
        # Create sequences
        seq = create_sequences(scaled_data, TIME_STEPS)
        if seq.shape[0] > 0:
            X_train_seq_list.append(seq)

    X_train_seq = np.vstack(X_train_seq_list)
    print(f"Total LSTM training sequences: {X_train_seq.shape}")

    lstm_model = Sequential()
    lstm_model.add(LSTM(32, activation='relu', input_shape=(X_train_seq.shape[1], X_train_seq.shape[2]), return_sequences=False))
    lstm_model.add(Dropout(0.2))
    lstm_model.add(RepeatVector(X_train_seq.shape[1]))
    lstm_model.add(LSTM(32, activation='relu', return_sequences=True))
    lstm_model.add(Dropout(0.2))
    lstm_model.add(TimeDistributed(Dense(X_train_seq.shape[2])))

    lstm_model.compile(optimizer='adam', loss='mse')
    # Train LSTM Autoencoder
    lstm_model.fit(X_train_seq, X_train_seq, epochs=10, batch_size=128, validation_split=0.1, verbose=1)

    print("Calculating LSTM Threshold...")
    # Calculate threshold on training data
    X_train_pred = lstm_model.predict(X_train_seq, batch_size=256, verbose=1)
    train_mae_loss = np.mean(np.abs(X_train_pred - X_train_seq), axis=(1, 2))
    lstm_threshold = np.percentile(train_mae_loss, 99)
    print(f"LSTM Anomaly Threshold: {lstm_threshold}")

    # 4. SAVE THE TRAINED MODELS
    print("\nSaving trained models...")
    # Save the trained models in a new folder inside models
    models_dir = base_dir / "Trained_MSL_Models"
    models_dir.mkdir(parents=True, exist_ok=True)

    # Save Z-Score parameters
    zscore_params = {'mean': train_mean, 'std': train_std, 'threshold': 3.0}
    joblib.dump(zscore_params, models_dir / "msl_zscore_params.joblib")
    print(f"Saved Z-Score parameters to {models_dir / 'msl_zscore_params.joblib'}")

    # Save Isolation Forest and Scaler
    joblib.dump(if_model, models_dir / "msl_isolation_forest_model.joblib")
    joblib.dump(scaler_if, models_dir / "msl_sensor_scaler.joblib")
    print(f"Saved Isolation Forest to {models_dir / 'msl_isolation_forest_model.joblib'}")

    # Save LSTM Scaler, Threshold, and Model
    joblib.dump(scaler_lstm, models_dir / "msl_lstm_scaler.joblib")
    joblib.dump(lstm_threshold, models_dir / "msl_lstm_threshold.joblib")
    lstm_model.save(models_dir / "msl_lstm_autoencoder.keras")
    
    print(f"Saved LSTM Autoencoder assets to {models_dir}")
    print("All models successfully trained and stored.")

if __name__ == "__main__":
    main()