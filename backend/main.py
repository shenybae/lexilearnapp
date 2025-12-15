import os
import pickle
import numpy as np
from fastapi import FastAPI, UploadFile, Form
from pydantic import BaseModel
from dotenv import load_dotenv
import requests

load_dotenv()

HF_ACCESS_TOKEN = os.getenv("HF_ACCESS_TOKEN")
HF_MODEL_URL = "https://api-inference.huggingface.co/models/sesefi/LexiReading-pronunciation"

# Load local ML model
with open("models/best_dyslexia_focus_model.pkl", "rb") as f:
    difficulty_model = pickle.load(f)
with open("models/best_dyslexia_focus_model_scaler.pkl", "rb") as f:
    scaler = pickle.load(f)
with open("models/best_dyslexia_focus_model_labels.pkl", "rb") as f:
    label_encoder = pickle.load(f)

app = FastAPI(title="Lexi Reading + Difficulty Prediction API")


# -------- Hugging Face Transcription --------
def transcribe_with_hf(audio_bytes: bytes) -> str:
    headers = {"Authorization": f"Bearer {HF_ACCESS_TOKEN}"}
    response = requests.post(HF_MODEL_URL, headers=headers, data=audio_bytes)
    
    if response.status_code != 200:
        return ""
    
    result = response.json()
    return result.get("text", "")


# -------- Pydantic Models --------
class PronunciationRequest(BaseModel):
    target_word: str


class AssessmentRequest(BaseModel):
    duration_seconds: float
    target_text: str


# -------- Endpoints --------
@app.post("/pronunciation")
async def check_pronunciation(audio: UploadFile, target_word: str = Form(...)):
    audio_bytes = await audio.read()
    transcript = transcribe_with_hf(audio_bytes)
    if not transcript:
        return {"score": 0, "isCorrect": False, "feedback": "Audio could not be transcribed", "transcript": ""}

    # Simple scoring: exact match percentage
    score = 100 if transcript.strip().lower() == target_word.lower() else 70
    feedback = "Perfect pronunciation!" if score == 100 else "Try again."
    
    return {"score": score, "isCorrect": score >= 70, "feedback": feedback, "transcript": transcript}


@app.post("/reading-assessment")
async def reading_assessment(audio: UploadFile, target_text: str = Form(...), duration_seconds: float = Form(...)):
    audio_bytes = await audio.read()
    transcript = transcribe_with_hf(audio_bytes)
    if not transcript:
        return {"wpm": 0, "accuracy": 0, "transcript": ""}

    # Simple accuracy: percent of correct words
    target_words = target_text.lower().split()
    transcript_words = transcript.lower().split()
    correct = sum(t1 == t2 for t1, t2 in zip(target_words, transcript_words))
    accuracy = round(correct / len(target_words) * 100, 2) if target_words else 0
    wpm = round(len(transcript_words) / (duration_seconds / 60)) if duration_seconds > 0 else 0
    
    return {"wpm": wpm, "accuracy": accuracy, "transcript": transcript}


@app.post("/predict-difficulty")
async def predict_difficulty(
    age: float = Form(...),
    reading_speed: float = Form(...),
    reading_accuracy: float = Form(...),
    reading_comprehension: float = Form(...),
    writing_speed: float = Form(...),
    writing_quality: float = Form(...),
    grammar_sentence: float = Form(...),
    phonetic_spelling: float = Form(...),
    irregular_word_spelling: float = Form(...),
    spelling_accuracy: float = Form(...)
):
    features = np.array([[
        age, reading_speed, reading_accuracy, reading_comprehension,
        writing_speed, writing_quality, grammar_sentence,
        phonetic_spelling, irregular_word_spelling, spelling_accuracy
    ]])
    
    features_scaled = scaler.transform(features)
    prediction = difficulty_model.predict(features_scaled)[0]
    predicted_label = label_encoder.inverse_transform([prediction])[0]
    
    return {"predicted_difficulty": predicted_label}
