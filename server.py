import os
import sys
import warnings
import io
import tempfile

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
warnings.filterwarnings('ignore', category=UserWarning)
warnings.filterwarnings('ignore', category=FutureWarning)

import numpy as np
import torch
import librosa
import tensorflow as tf
from transformers import HubertModel, Wav2Vec2FeatureExtractor

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# ==========================================
# CONFIGURATION
# ==========================================
WEIGHTS_PATH = "best_hubert_emotion.weights.h5"
TARGET_SR = 16000
MAX_FRAMES = 199

INV_EMOTION_MAP = {
    0: "Neutral", 1: "Calm", 2: "Happy", 3: "Sad",
    4: "Angry", 5: "Fearful", 6: "Disgust", 7: "Surprised"
}

class HubertEmotionClassifier(tf.keras.Model):
    def __init__(self, num_classes=8):
        super(HubertEmotionClassifier, self).__init__()
        reg = tf.keras.regularizers.l2(1e-4)
        self.input_norm = tf.keras.layers.LayerNormalization()
        self.conv1d = tf.keras.layers.Conv1D(64, kernel_size=5, padding='same', activation='relu', kernel_regularizer=reg)
        self.bn1 = tf.keras.layers.BatchNormalization()
        self.spatial_dropout = tf.keras.layers.SpatialDropout1D(0.3)
        self.pool1 = tf.keras.layers.MaxPooling1D(pool_size=4)
        self.bilstm = tf.keras.layers.Bidirectional(tf.keras.layers.LSTM(64, return_sequences=True, dropout=0.3))
        self.global_pool = tf.keras.layers.GlobalAveragePooling1D()
        self.dense1 = tf.keras.layers.Dense(64, activation='relu', kernel_regularizer=reg)
        self.final_dropout = tf.keras.layers.Dropout(0.4)
        self.classifier = tf.keras.layers.Dense(num_classes)

    def call(self, inputs, training=False):
        x = self.input_norm(inputs)
        x = self.conv1d(x)
        x = self.bn1(x, training=training)
        x = self.spatial_dropout(x, training=training)
        x = self.pool1(x)
        x = self.bilstm(x, training=training)
        x = self.global_pool(x)
        x = self.dense1(x)
        x = self.final_dropout(x, training=training)
        return self.classifier(x)

# ==========================================
# APP + MODEL LOADING (runs once at startup)
# ==========================================
app = FastAPI(title="Emotion Recognition API")

# Allow requests from a frontend (adjust origins for production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

print("Loading models... this may take a moment.")
feature_extractor = Wav2Vec2FeatureExtractor.from_pretrained("facebook/hubert-base-ls960")
hubert_model = HubertModel.from_pretrained("facebook/hubert-base-ls960")
hubert_model.eval()

classifier = HubertEmotionClassifier(num_classes=8)
classifier(tf.zeros((1, 199, 768)))
classifier.load_weights(WEIGHTS_PATH)
print("Models loaded. Server ready.")

# ==========================================
# INFERENCE LOGIC (reused from your script)
# ==========================================
def predict_emotion(audio_path: str) -> dict:
    speech, sr = librosa.load(audio_path, sr=TARGET_SR)
    speech = librosa.util.normalize(speech)

    input_values = feature_extractor(
        speech, return_tensors="pt", sampling_rate=TARGET_SR
    ).input_values

    with torch.no_grad():
        outputs = hubert_model(input_values, output_hidden_states=True)
        layer_features = outputs.hidden_states[7].squeeze(0).numpy()

    num_frames = layer_features.shape[0]
    if num_frames >= MAX_FRAMES:
        final_features = layer_features[:MAX_FRAMES, :]
    else:
        pad_width = MAX_FRAMES - num_frames
        final_features = np.pad(layer_features, ((0, pad_width), (0, 0)), mode='constant')

    final_features = np.expand_dims(final_features, axis=0)

    logits = classifier(final_features, training=False)
    probabilities = tf.nn.softmax(logits).numpy()[0]
    predicted_class = int(np.argmax(probabilities))

    return {
        "emotion": INV_EMOTION_MAP[predicted_class],
        "confidence": float(probabilities[predicted_class]),
        "all_probabilities": {
            INV_EMOTION_MAP[i]: float(p) for i, p in enumerate(probabilities)
        }
    }

# ==========================================
# ROUTES
# ==========================================
@app.get("/")
def root():
    return {"message": "Emotion Recognition API is running"}

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if not file.filename.lower().endswith((".wav", ".mp3", ".flac", ".ogg", ".m4a")):
        raise HTTPException(status_code=400, detail="Unsupported audio format")

    # Save uploaded file to a temp file so librosa can read it
    suffix = os.path.splitext(file.filename)[1]
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            contents = await file.read()
            tmp.write(contents)
            tmp_path = tmp.name

        result = predict_emotion(tmp_path)
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference failed: {str(e)}")

    finally:
        # Clean up temp file
        if os.path.exists(tmp_path):
            os.remove(tmp_path)