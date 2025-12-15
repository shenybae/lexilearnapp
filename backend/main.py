# main.py
import os
from fastapi import FastAPI, UploadFile, HTTPException
import torch, librosa
import pickle
import numpy as np

from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor  # Use WhisperProcessor/WhisperForCTC if your model is Whisper

# ========================
# 1️⃣ FastAPI app
# ========================
app = FastAPI(title="Dyslexia Focus + Pronunciation API")

# ========================
# 2️⃣ Load Hugging Face Wav2Vec2 model
# ========================
HF_MODEL_NAME = "sesefi/LexiReading-pronunciation"
print("Loading Hugging Face model...")
processor = Wav2Vec2Processor.from_pretrained(HF_MODEL_NAME)
model = Wav2Vec2ForCTC.from_pretrained(HF_MODEL_NAME)
model.eval()
print("✅ Hugging Face model loaded.")

# ========================
# 3️⃣ Load Dyslexia ML model
# ========================
print("Loading Dyslexia focus model...")
with open("best_dyslexia_focus_model.pkl", "rb") as f:
    dyslexia_model = pickle.load(f)
with open("best_dyslexia_focus_model_scaler.pkl", "rb") as f:
    scaler = pickle.load(f)
with open("best_dyslexia_focus_model_labels.pkl", "rb") as f:
    label_encoder = pickle.load(f)
print("✅ Dyslexia ML model loaded.")

# ========================
# 4️⃣ Helper functions
# ========================
def transcribe_audio(file: UploadFile):
    """Transcribe audio with Hugging Face Wav2Vec2"""
    try:
        audio, _ = librosa.load(file.file, sr=16000)
        inputs = processor(audio, return_tensors="pt", sampling_rate=16000)
        with torch.no_grad():
            logits = model(**inputs).logits
        ids = torch.argmax(logits, dim=-1)
        text = processor.decode(ids[0])
        return text
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audio transcription failed: {e}")

def predict_difficulty(features: list):
    """Predict difficulty with Dyslexia ML model"""
    X = scaler.transform([features])
    pred = dyslexia_model.predict(X)[0]
    pred_label = label_encoder.inverse_transform([pred])[0]
    if hasattr(dyslexia_model, "predict_proba"):
        probas = dyslexia_model.predict_proba(X)[0]
        probabilities = dict(zip(label_encoder.classes_, probas.tolist()))
    else:
        probabilities = None
    return pred_label, probabilities

# ========================
# 5️⃣ API Endpoints
# ========================
@app.get("/")
def home():
    return {"message": "Dyslexia Focus + Pronunciation API is running!"}

@app.post("/transcribe")
async def transcribe(file: UploadFile):
    transcript = transcribe_audio(file)
    return {"transcript": transcript}

@app.post("/predict")
async def predict(file: UploadFile, 
                  age: float,
                  reading_speed: float,
                  reading_accuracy: float,
                  reading_comprehension: float,
                  writing_speed: float,
                  writing_quality: float,
                  grammar_sentence: float,
                  phonetic_spelling: float,
                  irregular_word_spelling: float,
                  spelling_accuracy: float):
    # Step 1: Transcribe audio
    transcript = transcribe_audio(file)
    
    # Step 2: Prepare features
    features = [
        age, reading_speed, reading_accuracy, reading_comprehension,
        writing_speed, writing_quality, grammar_sentence,
        phonetic_spelling, irregular_word_spelling, spelling_accuracy
    ]
    
    # Step 3: Predict difficulty
    pred_label, probabilities = predict_difficulty(features)
    
    return {
        "transcript": transcript,
        "predicted_difficulty": pred_label,
        "probabilities": probabilities
    }

# ========================
# 6️⃣ Run on Render
# ========================
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
