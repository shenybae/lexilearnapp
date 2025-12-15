from fastapi import FastAPI
from pydantic import BaseModel
import pickle
import numpy as np

# -------------------------------
# Load the saved model, scaler, and label encoder
# -------------------------------
with open('best_dyslexia_focus_model.pkl', 'rb') as f:
    model = pickle.load(f)
with open('best_dyslexia_focus_model_scaler.pkl', 'rb') as f:
    scaler = pickle.load(f)
with open('best_dyslexia_focus_model_labels.pkl', 'rb') as f:
    label_encoder = pickle.load(f)

# -------------------------------
# Define FastAPI app
# -------------------------------
app = FastAPI(title="Dyslexia Focus Prediction API")

# -------------------------------
# Define request body structure
# -------------------------------
class StudentFeatures(BaseModel):
    age: float
    reading_speed: float
    reading_accuracy: float
    reading_comprehension: float
    writing_speed: float
    writing_quality: float
    grammar_sentence: float
    phonetic_spelling: float
    irregular_word_spelling: float
    spelling_accuracy: float

# -------------------------------
# Prediction endpoint
# -------------------------------
@app.post("/predict")
def predict(student: StudentFeatures):
    # Convert input to numpy array
    features = np.array([[
        student.age,
        student.reading_speed,
        student.reading_accuracy,
        student.reading_comprehension,
        student.writing_speed,
        student.writing_quality,
        student.grammar_sentence,
        student.phonetic_spelling,
        student.irregular_word_spelling,
        student.spelling_accuracy
    ]])

    # Scale features
    features_scaled = scaler.transform(features)

    # Predict
    pred_class_idx = model.predict(features_scaled)[0]
    pred_class = label_encoder.inverse_transform([pred_class_idx])[0]

    # Probabilities
    if hasattr(model, 'predict_proba'):
        probs = model.predict_proba(features_scaled)[0]
        prob_dict = {cls: float(probs[i]) for i, cls in enumerate(label_encoder.classes_)}
    else:
        prob_dict = None

    return {
        "predicted_class": pred_class,
        "probabilities": prob_dict
    }
