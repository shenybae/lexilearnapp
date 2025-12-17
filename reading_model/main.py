from fastapi import FastAPI, UploadFile, File
from transformers import WhisperForConditionalGeneration, WhisperProcessor, BitsAndBytesConfig
import torch
import tempfile
import os
import torchaudio

app = FastAPI(title="Lexi Whisper INT8 API")

# ==========================
# CONFIG: Load model from Hugging Face
# ==========================
MODEL_HF_REPO = "sesefi/lexi-reading-pronunciation"  # Your Hugging Face model

# Use INT8 quantization to reduce memory usage
bnb_config = BitsAndBytesConfig(load_in_8bit=True)
model = WhisperForConditionalGeneration.from_pretrained(
    MODEL_HF_REPO,
    device_map="auto",
    quantization_config=bnb_config
)
processor = WhisperProcessor.from_pretrained(MODEL_HF_REPO)

print("✅ Model loaded successfully!")

# ==========================
# ROUTES
# ==========================
@app.get("/")
async def root():
    return {"message": "Lexi Whisper API is running!"}

@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    """
    Accepts audio file upload and returns transcription.
    """
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        tmp.write(await audio.read())
        audio_path = tmp.name

    # Load audio and process
    waveform, sample_rate = torchaudio.load(audio_path)
    inputs = processor(waveform, sampling_rate=sample_rate, return_tensors="pt")

    # Move inputs to same device as model
    device = next(model.parameters()).device
    inputs = {k: v.to(device) for k, v in inputs.items()}

    # Generate transcription
    with torch.no_grad():
        generated_ids = model.generate(**inputs)

    transcription = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]

    # Cleanup temp file
    os.remove(audio_path)

    return {"transcription": transcription}
