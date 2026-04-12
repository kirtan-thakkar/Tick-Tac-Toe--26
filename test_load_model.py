import keras
from keras.layers import LSTM
import joblib
from pathlib import Path

class FixedLSTM(LSTM):
    @classmethod
    def from_config(cls, config):
        # Remove keys that cause issues in Keras 3
        config.pop('batch_input_shape', None)
        config.pop('time_major', None)
        return super().from_config(config)

MODELS_DIR = Path("models/Trained Models")
model_path = MODELS_DIR / "msl_lstm_autoencoder.keras"

try:
    print(f"Attempting to load {model_path} with FixedLSTM...")
    model = keras.models.load_model(model_path, custom_objects={'LSTM': FixedLSTM})
    print("Successfully loaded model!")
    model.summary()
except Exception as e:
    print(f"Failed to load model: {e}")
