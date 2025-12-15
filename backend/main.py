from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel
import numpy as np
import pickle
import torch
import librosa
import tempfile
import os

from transformers import Wav2Vec2Processor, Wav2Vec2ForCTC

# ==========================================================
# APP INIT
# ==========================================================
app = FastAPI(title="LexiLearn ML API")

# ==========================================================
# LOAD DYSLEXIA CLASSIFICATION MODEL
# ==========================================================
with open("best_dyslexia_focus_model.pkl", "rb") as f:
    dyslexia_model = pickle.load(f)

with open("best_dyslexia_focus_model_scaler.pkl", "rb") as f:
    scaler = pickle.load(f)

with open("best_dyslexia_focus_model_labels.pkl", "rb") as f:
    label_encoder = pickle.load(f)

# ==========================================================
# LOAD HUGGING FACE PRONUNCIATION / ASR MODEL
# ==========================================================
HF_MODEL_NAME = "sesefi/LexiReading-pronunciation"

processor = Wav2Vec2Processor.from_pretrained(HF_MODEL_NAME)
asr_model = Wav2Vec2ForCTC.from_pretrained(HF_MODEL_NAME)
asr_model.eval()

# ==========================================================
# REQUEST SCHEMA
# ==========================================================
class DyslexiaInput(BaseModel):
    age: int
    reading_speed: float
    reading_accuracy: float
    reading_comprehension: float
    writing_speed: float
    writing_quality: float
    grammar_sentence: float
    phonetic_spelling: float
    irregular_word_spelling: float
    spelling_accuracy: float

# ==========================================================
# ENDPOINT 1: DYSLEXIA DIFFICULTY PREDICTION
# ==========================================================
@app.post("/predict-difficulty")
def predict_difficulty(data: DyslexiaInput):
    features = np.array([[
        data.age,
        data.reading_speed,
        data.reading_accuracy,
        data.reading_comprehension,
        data.writing_speed,
        data.writing_quality,
        data.grammar_sentence,
        data.phonetic_spelling,
        data.irregular_word_spelling,
        data.spelling_accuracy
    ]])

    features_scaled = scaler.transform(features)

    prediction = dyslexia_model.predict(features_scaled)[0]
    difficulty = label_encoder.inverse_transform([prediction])[0]

    response = {
        "predicted_difficulty": difficulty
    }

    if hasattr(dyslexia_model, "predict_proba"):
        probs = dyslexia_model.predict_proba(features_scaled)[0]
        response["probabilities"] = {
            label_encoder.classes_[i]: float(probs[i])
            for i in range(len(probs))
        }

    return response

# ==========================================================
# ENDPOINT 2: AUDIO TRANSCRIPTION (YOUR HF MODEL)
# ==========================================================
@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    # Save audio temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    # Load audio
    audio, _ = librosa.load(tmp_path, sr=16000)
    os.remove(tmp_path)

    # Process
    inputs = processor(
        audio,
        sampling_rate=16000,
        return_tensors="pt",
        padding=True
    )

    with torch.no_grad():
        logits = asr_model(**inputs).logits

    predicted_ids = torch.argmax(logits, dim=-1)
    transcript = processor.decode(predicted_ids[0])

    return {
        "transcript": transcript
    }

# ==========================================================
# HEALTH CHECK
# ==========================================================
@app.get("/")
def root():
    return {
        "status": "LexiLearn API running",
        "endpoints": ["/predict-difficulty", "/transcribe"]
    }
