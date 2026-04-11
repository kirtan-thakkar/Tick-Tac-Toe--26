import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import joblib
from pathlib import Path

# -----------------------------
# STEP 1: LOAD THE SAVED ASSETS
# -----------------------------
print("Loading model and scaler...")
model = joblib.load("Trained Models/isolation_forest_model.joblib")
scaler = joblib.load("Trained Models/sensor_scaler.joblib")

# -----------------------------
# STEP 2: LOAD NEW DATA
# -----------------------------
print("Loading new CSV file...")
# Replace with the name of your new file
new_file_name = "data/machine-1-3.txt" 
df_new = pd.read_csv(new_file_name, header=0, parse_dates=['timestamp'], index_col='timestamp')

# Ensure we only pass the sensor columns (drop 'anomaly' if it accidentally exists)
if 'anomaly' in df_new.columns:
    X_new_raw = df_new.drop(columns=['anomaly'])
else:
    X_new_raw = df_new.copy()

# -----------------------------
# STEP 3: SCALE & PREDICT
# -----------------------------
print("Analyzing data...")
# CRITICAL: We use transform(), NOT fit_transform()
X_new_scaled = scaler.transform(X_new_raw)

# Get predictions and scores
preds = model.predict(X_new_scaled)
df_new["predicted_anomaly"] = np.where(preds == -1, 1, 0)
df_new["anomaly_score"] = model.decision_function(X_new_scaled)

# -----------------------------
# STEP 4: SAVE OR PLOT RESULTS
# -----------------------------
print(f"Analysis complete! Found {df_new['predicted_anomaly'].sum()} anomalies.")

# Let's save the results to a new CSV file so you can review them later
output_dir = Path("results")
output_dir.mkdir(parents=True, exist_ok=True)
output_filename = output_dir / "new_data_analyzed.csv"
df_new.to_csv(output_filename)
print(f"Results saved to: {output_filename}")

# (Optional) You can paste the plotting code from the previous script here 
# if you want a visual pop-up of the new data.