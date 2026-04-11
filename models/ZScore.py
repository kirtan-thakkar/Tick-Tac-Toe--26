import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import joblib
from pathlib import Path
from sklearn.metrics import classification_report, confusion_matrix

# -----------------------------
# STEP 1: LOAD THE DATA
# -----------------------------
print("Loading data...")
df_train = pd.read_csv("data/smd_train.csv", header=0, parse_dates=['timestamp'], index_col='timestamp')
df_test = pd.read_csv("data/smd_test.csv", header=0, parse_dates=['timestamp'], index_col='timestamp')

# Separate the answer key if it exists
if 'anomaly' in df_test.columns:
    df_test_labels = df_test['anomaly']
    X_test = df_test.drop(columns=['anomaly'])
else:
    X_test = df_test.copy()

# -----------------------------
# STEP 2: CALCULATE NORMAL BASELINE (From Train)
# -----------------------------
print("Calculating statistical baselines...")
train_mean = df_train.mean()
train_std = df_train.std()

# Handle edge cases: If a sensor never changes, its std is 0. 
# We replace 0s with a tiny number to avoid "divide by zero" errors later.
train_std = train_std.replace(0, 1e-6)

# -----------------------------
# STEP 3: CALCULATE Z-SCORES (On Test)
# -----------------------------
print("Calculating Z-scores for test data...")
# Pandas makes this incredibly easy: it applies the math across all 38 columns automatically
z_scores = (X_test - train_mean) / train_std

# To get an "Overall" anomaly score across all 38 sensors, 
# we find the sensor with the highest absolute Z-score at any given second.
X_test["overall_z_score"] = z_scores.abs().max(axis=1)

# Set our threshold (3 is standard, 4 is conservative, 2 is highly sensitive)
THRESHOLD = 3.0

# Flag anomaly if the highest Z-score crosses the threshold
X_test["predicted_anomaly"] = np.where(X_test["overall_z_score"] > THRESHOLD, 1, 0)

# -----------------------------
# STEP 4: VISUALIZE RESULTS
# -----------------------------
print("Generating visualization...")
fig, axes = plt.subplots(2, 1, figsize=(14, 8), sharex=True)

# Plot 1: Overall Z-Score
axes[0].plot(X_test.index, X_test["overall_z_score"], color='purple', label="Max Z-Score across all sensors")
axes[0].axhline(THRESHOLD, color='red', linestyle='--', alpha=0.8, label=f"Threshold (Z={THRESHOLD})")
axes[0].set_title("Statistical Anomaly Score (Z-Score)")
axes[0].set_ylabel("Standard Deviations from Mean")
axes[0].legend()
axes[0].grid(True, alpha=0.3)

# Plot 2: Sensor View
sensor_to_plot = X_test.columns[0]
axes[1].plot(X_test.index, X_test[sensor_to_plot], color='steelblue', alpha=0.7, label=f"Raw {sensor_to_plot}")

# Highlight anomalies
model_anomalies = X_test[X_test["predicted_anomaly"] == 1]
axes[1].scatter(model_anomalies.index, model_anomalies[sensor_to_plot], color='red', label="Z-Score Anomaly", zorder=5, s=15)

axes[1].set_title(f"Raw Data View: {sensor_to_plot}")
axes[1].set_xlabel("Timestamp")
axes[1].legend()
axes[1].grid(True, alpha=0.3)

plt.tight_layout()
plt.show()

print(f"Total anomalies detected by Z-Score: {X_test['predicted_anomaly'].sum()}")

# --- 1. SAVE THE Z-SCORE PARAMETERS ---
# We save the mean and std so we can apply the exact same math to future data
zscore_params = {
    'mean': train_mean,
    'std': train_std,
    'threshold': THRESHOLD
}
output_dir = Path("Trained Models")
output_dir.mkdir(parents=True, exist_ok=True)
model_filename = output_dir / "zscore_params.joblib"
joblib.dump(zscore_params, model_filename)
print(f"\n[+] Z-Score parameters successfully saved as: {model_filename}")

# --- 2. EVALUATE THE MODEL ---
if 'anomaly' in df_test.columns:
    print("\n--- Z-SCORE PERFORMANCE METRICS ---")
    
    # Generate a classification report (Precision, Recall, F1-Score)
    report = classification_report(
        df_test['anomaly'], 
        X_test['predicted_anomaly'], 
        target_names=['Normal (0)', 'Anomaly (1)']
    )
    print(report)
    
    # Generate a Confusion Matrix
    cm = confusion_matrix(df_test['anomaly'], X_test['predicted_anomaly'])
    print("\n--- CONFUSION MATRIX ---")
    print(f"True Negatives (Correctly identified normal): {cm[0][0]}")
    print(f"False Positives (False alarms):               {cm[0][1]}")
    print(f"False Negatives (Missed anomalies):           {cm[1][0]}")
    print(f"True Positives  (Correctly caught anomalies): {cm[1][1]}")