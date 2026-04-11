import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import joblib
from pathlib import Path
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.preprocessing import StandardScaler
from keras.models import Sequential
from keras.layers import LSTM, Dense, Dropout, RepeatVector, TimeDistributed

# -----------------------------
# STEP 1: LOAD & SCALE DATA
# -----------------------------
print("Loading data...")
df_train = pd.read_csv("data\smd_train.csv", header=0, parse_dates=['timestamp'], index_col='timestamp')
df_test = pd.read_csv("data\smd_test.csv", header=0, parse_dates=['timestamp'], index_col='timestamp')

# Separate labels from test set if they exist
if 'anomaly' in df_test.columns:
    df_test_labels = df_test['anomaly']
    df_test = df_test.drop(columns=['anomaly'])

print("Scaling data...")
scaler = StandardScaler()
train_scaled = scaler.fit_transform(df_train)
test_scaled = scaler.transform(df_test)

# -----------------------------
# STEP 2: CREATE SEQUENCES (The 3D Shift)
# -----------------------------
# We will look at chunks of 10 time steps at a time
TIME_STEPS = 60

def create_sequences(X, time_steps=TIME_STEPS):
    Xs = []
    for i in range(len(X) - time_steps):
        Xs.append(X[i:(i + time_steps)])
    return np.array(Xs)

print(f"Reshaping data into sequences of length {TIME_STEPS}...")
X_train = create_sequences(train_scaled)
X_test = create_sequences(test_scaled)

print(f"New Training Shape: {X_train.shape} (Samples, Time Steps, Features)")

# -----------------------------
# STEP 3: BUILD THE LSTM AUTOENCODER
# -----------------------------
print("Building model architecture...")
model = Sequential()

# Encoder
model.add(LSTM(32, activation='relu', input_shape=(X_train.shape[1], X_train.shape[2]), return_sequences=False))
model.add(Dropout(0.2))

# The Bridge
model.add(RepeatVector(X_train.shape[1]))

# Decoder
model.add(LSTM(32, activation='relu', return_sequences=True))
model.add(Dropout(0.2))
model.add(TimeDistributed(Dense(X_train.shape[2])))

model.compile(optimizer='adam', loss='mse')
model.summary()

# -----------------------------
# STEP 4: TRAIN THE MODEL
# -----------------------------
print("Training the LSTM (This will take a while!)...")
# We use X_train as both input and target because it's an autoencoder trying to copy itself
history = model.fit(
    X_train, X_train,
    epochs=20,          # Adjust depending on how long you want to wait
    batch_size=128,
    validation_split=0.1,
    verbose=1
)

# -----------------------------
# STEP 5: FIND THE ANOMALY THRESHOLD
# -----------------------------
print("Calculating reconstruction error on training data...")
X_train_pred = model.predict(X_train)

# Calculate Mean Absolute Error (MAE) across the sensors and time steps for each sample
train_mae_loss = np.mean(np.abs(X_train_pred - X_train), axis=(1, 2))

# Set the threshold. A common rule is the 99th percentile of training error
THRESHOLD = np.percentile(train_mae_loss, 99)
print(f"Anomaly Threshold set to: {THRESHOLD:.4f}")

# -----------------------------
# STEP 6: PREDICT ON TEST DATA
# -----------------------------
print("Predicting on test data...")
X_test_pred = model.predict(X_test)
test_mae_loss = np.mean(np.abs(X_test_pred - X_test), axis=(1, 2))

# Flag anomalies where the error exceeds our threshold
anomalies_detected = test_mae_loss > THRESHOLD

# -----------------------------
# STEP 7: VISUALIZE RESULTS
# -----------------------------
print("Generating visualization...")
# Pad the beginning of our results to match the original dataframe length (since we lost TIME_STEPS rows creating sequences)
padding = [0] * TIME_STEPS
full_predictions = padding + anomalies_detected.tolist()
full_errors = padding + test_mae_loss.tolist()

fig, axes = plt.subplots(2, 1, figsize=(14, 8), sharex=True)

# Plot 1: Reconstruction Error vs Threshold
axes[0].plot(df_test.index, full_errors, color='purple', label="Reconstruction Error (MAE)")
axes[0].axhline(THRESHOLD, color='red', linestyle='--', alpha=0.8, label="Anomaly Threshold")
axes[0].set_title("LSTM Autoencoder Reconstruction Error")
axes[0].set_ylabel("Error Margin")
axes[0].legend()
axes[0].grid(True, alpha=0.3)

# Plot 2: Sensor View
sensor_to_plot = df_test.columns[0]
axes[1].plot(df_test.index, df_test[sensor_to_plot], color='steelblue', alpha=0.7, label=f"Raw {sensor_to_plot}")

# Highlight Anomalies
anomaly_timestamps = df_test.index[np.array(full_predictions) == 1]
anomaly_values = df_test[sensor_to_plot][np.array(full_predictions) == 1]
axes[1].scatter(anomaly_timestamps, anomaly_values, color='red', label="LSTM Prediction", zorder=5, s=15)

axes[1].set_title(f"Raw Data View: {sensor_to_plot}")
axes[1].set_xlabel("Timestamp")
axes[1].legend()
axes[1].grid(True, alpha=0.3)

plt.tight_layout()
plt.show()

print(f"Total anomalies detected by LSTM: {sum(full_predictions)}")


# --- 1. SAVE THE LSTM ASSETS ---
print("\nSaving model assets...")

output_dir = Path("Trained Models")
output_dir.mkdir(parents=True, exist_ok=True)
# A. Save the Neural Network
model.save(output_dir / "lstm_autoencoder.keras")
print(f"[+] Model saved as: {output_dir / 'lstm_autoencoder.keras'}")

# B. Save the Scaler
joblib.dump(scaler, output_dir / "lstm_scaler.joblib")
print(f"[+] Scaler saved as: {output_dir / 'lstm_scaler.joblib'}")

# C. Save the Threshold (Crucial for testing new data later)
joblib.dump(THRESHOLD, output_dir / "lstm_threshold.joblib")
print(f"[+] Threshold saved as: {output_dir / 'lstm_threshold.joblib'}")

# --- 2. EVALUATE THE MODEL ---
if 'anomaly' in df_test.columns:
    print("\n--- LSTM PERFORMANCE METRICS ---")
    
    # Convert our list of boolean predictions into 1s and 0s
    final_preds_numeric = [int(p) for p in full_predictions]
    
    # Generate a classification report
    report = classification_report(
        df_test['anomaly'], 
        final_preds_numeric, 
        target_names=['Normal (0)', 'Anomaly (1)']
    )
    print(report)
    
    # Generate a Confusion Matrix
    cm = confusion_matrix(df_test['anomaly'], final_preds_numeric)
    print("\n--- CONFUSION MATRIX ---")
    print(f"True Negatives (Correctly identified normal): {cm[0][0]}")
    print(f"False Positives (False alarms):               {cm[0][1]}")
    print(f"False Negatives (Missed anomalies):           {cm[1][0]}")
    print(f"True Positives  (Correctly caught anomalies): {cm[1][1]}")