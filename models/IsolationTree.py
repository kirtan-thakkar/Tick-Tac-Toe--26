import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import joblib
from pathlib import Path
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, confusion_matrix

# -----------------------------
# STEP 1: LOAD FULL DATA
# -----------------------------
print("Loading data...")
df_train = pd.read_csv("data/smd_train.csv", header=0, parse_dates=['timestamp'], index_col='timestamp')
df_test = pd.read_csv("data/smd_test.csv", header=0, parse_dates=['timestamp'], index_col='timestamp')

# Removed the .iloc[:5000] limits to see the whole picture!

# -----------------------------
# STEP 2: SCALE THE DATA (Crucial!)
# -----------------------------
print("Scaling features...")
# We fit the scaler ONLY on the training data, then transform both train and test
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(df_train)

# Separate the anomaly label from the test set if it exists
if 'anomaly' in df_test.columns:
    X_test_raw = df_test.drop(columns=['anomaly'])
else:
    X_test_raw = df_test.copy()

X_test_scaled = scaler.transform(X_test_raw)

# -----------------------------
# STEP 3: TRAIN MODEL
# -----------------------------
print("Training Isolation Forest...")
model = IsolationForest(
    n_estimators=100,
    contamination=0.01,  # Lowered to 1% to be less aggressive with false alarms
    random_state=42,
    n_jobs=-1
)

model.fit(X_train_scaled)

# -----------------------------
# STEP 4: PREDICT ON TEST DATA
# -----------------------------
print("Predicting on test data...")
preds = model.predict(X_test_scaled)

df_test["predicted_anomaly"] = np.where(preds == -1, 1, 0)
df_test["anomaly_score"] = model.decision_function(X_test_scaled)

# -----------------------------
# STEP 5: VISUALIZE RESULTS
# -----------------------------
print("Generating plots...")
fig, axes = plt.subplots(2, 1, figsize=(14, 8), sharex=True)

# Plot 1: Anomaly Score
axes[0].plot(df_test.index, -df_test["anomaly_score"], color='purple')
axes[0].axhline(0, color='red', linestyle='--', alpha=0.5)
axes[0].set_title("Multivariate Anomaly Score (Scaled)")
axes[0].set_ylabel("Anomaly Severity")
axes[0].grid(True, alpha=0.3)

# Plot 2: Sensor View
sensor_to_plot = "sensor_0"
axes[1].plot(df_test.index, df_test[sensor_to_plot], color='steelblue', alpha=0.7)

# Model Predictions
model_anomalies = df_test[df_test["predicted_anomaly"] == 1]
axes[1].scatter(model_anomalies.index, model_anomalies[sensor_to_plot], color='red', label="Model Prediction", zorder=5, s=15)

axes[1].set_title(f"Raw Data View: {sensor_to_plot}")
axes[1].set_xlabel("Timestamp")
axes[1].legend()
axes[1].grid(True, alpha=0.3)

plt.tight_layout()
plt.show()

# --- FINAL REPORT ---
print("--- SUMMARY ---")
print(f"Total rows in test set: {len(df_test)}")
print(f"Total anomalies predicted by model: {df_test['predicted_anomaly'].sum()}")
if 'anomaly' in df_test.columns:
    print(f"Total ACTUAL anomalies in dataset: {df_test['anomaly'].sum()}")
else:
    print("WARNING: No 'anomaly' column found in the test dataset.")





# --- 1. SAVE THE TRAINED MODEL ---
output_dir = Path("Trained Models")
output_dir.mkdir(parents=True, exist_ok=True)
model_filename = output_dir / "isolation_forest_model.joblib"
joblib.dump(model, model_filename)
print(f"\nModel successfully saved as: {model_filename}")
# Add this to your training script to save the scaler too!
scaler_filename = output_dir / "sensor_scaler.joblib"
joblib.dump(scaler, scaler_filename)
print(f"Scaler successfully saved as: {scaler_filename}")

# --- 2. EVALUATE THE MODEL (If labels exist) ---
if 'anomaly' in df_test.columns:
    print("\n--- PERFORMANCE METRICS ---")
    
    # Generate a classification report (Precision, Recall, F1-Score)
    report = classification_report(
        df_test['anomaly'], 
        df_test['predicted_anomaly'], 
        target_names=['Normal (0)', 'Anomaly (1)']
    )
    print(report)
    
    # Generate a Confusion Matrix
    cm = confusion_matrix(df_test['anomaly'], df_test['predicted_anomaly'])
    print("\n--- CONFUSION MATRIX ---")
    print(f"True Negatives (Correctly identified normal): {cm[0][0]}")
    print(f"False Positives (False alarms):               {cm[0][1]}")
    print(f"False Negatives (Missed anomalies):           {cm[1][0]}")
    print(f"True Positives  (Correctly caught anomalies): {cm[1][1]}")