
import { GoogleGenAI, Type } from "@google/genai";
import { PronunciationResult } from '../types';
import * as FileSystem from 'expo-file-system';

// --- CONFIGURATION ---
const HF_ACCESS_TOKEN = process.env.HF_ACCESS_TOKEN;

// Primary Model (User Preferred)
const HF_MODEL_URL = "https://api-inference.huggingface.co/models/sesefi/LexiReading-pronunciation";

// Use the user-provided key as fallback if process.env isn't set
const GEMINI_API_KEY = process.env.API_KEY;

// Initialize Gemini Client
const getAiClient = () => {
  return new GoogleGenAI({ apiKey: GEMINI_API_KEY });
};

// --- HUGGING FACE SERVICE ---

const fetchWithRetry = async (url: string, audioBlob: Blob, attempt = 1): Promise<any> => {
    console.log(`[HF] Attempt ${attempt} connecting to: ${url}`);
    
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${HF_ACCESS_TOKEN}`,
                "Content-Type": audioBlob.type || "audio/m4a", // Ensure matches recording format (m4a)
            },
            body: audioBlob,
        });

        // Handle Model Loading (503)
        if (response.status === 503) {
            const errorData = await response.json();
            const waitTime = errorData.estimated_time || 5;
            console.log(`[HF] Model loading. Waiting ${waitTime}s...`);
            if (attempt < 3) {
                await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
                return fetchWithRetry(url, audioBlob, attempt + 1);
            }
        }

        return response;
    } catch (error) {
        console.warn(`[HF] Network/Fetch Error on attempt ${attempt}:`, error);
        return null;
    }
};

/**
 * Sends audio to Hugging Face Inference API for transcription.
 */
const transcribeWithHuggingFace = async (audioUri: string): Promise<string | null> => {
  try {
    console.log(`\n--- [HF] Transcription Request ---`);
    console.log(`[HF] Audio URI: ${audioUri}`);
    
    // Fetch file from local FS
    const fileResponse = await fetch(audioUri);
    const audioBlob = await fileResponse.blob();
    console.log(`[HF] Audio Blob Size: ${audioBlob.size} bytes`);
    console.log(`[HF] Audio Blob Type: ${audioBlob.type}`);

    // Try Primary Model ONLY
    const hfResponse = await fetchWithRetry(HF_MODEL_URL, audioBlob);

    if (!hfResponse || !hfResponse.ok) {
        const status = hfResponse ? hfResponse.status : "Network Error";
        console.error(`[HF] Model Failed. Status: ${status}`);
        return null;
    }

    const result = await hfResponse.json();
    console.log("[HF] Result received:", JSON.stringify(result).substring(0, 100));
    
    if (result && result.text) {
      return result.text;
    }
    
    return null;
  } catch (error) {
    console.error("[HF] Transcription Failed Exception:", error);
    return null;
  }
};

// --- GEMINI SERVICES ---

export const checkPronunciation = async (audioUri: string, targetWord: string): Promise<PronunciationResult> => {
  try {
    const ai = getAiClient();
    
    // STEP 1: Transcription
    const transcript = await transcribeWithHuggingFace(audioUri);

    if (!transcript) {
      console.log("[Service] Transcription failed.");
      return {
          score: 0,
          isCorrect: false,
          feedback: "Could not hear audio clearly. Please try again.",
          transcript: ""
      };
    }

    console.log(`[Service] Transcript: "${transcript}" -> Analysis...`);

    // STEP 2: Gemini Analysis
    const geminiResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [
                {
                    text: `You are a reading tutor for children with dyslexia.
                    Target Word: "${targetWord}"
                    Student said (Transcript): "${transcript}"
                    
                    Task:
                    1. Compare the student's transcript to the target word.
                    2. If they match closely (ignoring small case/punctuation), give a high score (90-100).
                    3. If they are different, explain the phonetic difference simply.
                    4. Return a JSON object.`
                }
            ]
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.NUMBER },
              feedback: { type: Type.STRING },
              phoneticBreakdown: { type: Type.STRING }
            }
          }
        }
    });

    const resultText = geminiResponse.text || "{}";
    const result = JSON.parse(resultText);
    
    let feedback = result.feedback || "";
    const score = result.score || 0;

    if (!feedback) {
        if (score >= 90) feedback = "Perfect pronunciation!";
        else if (score >= 70) feedback = "Good job!";
        else feedback = "Let's try that again.";
    }

    return {
      score: score,
      isCorrect: score >= 70,
      feedback: feedback,
      transcript: transcript,
      phoneticBreakdown: result.phoneticBreakdown || targetWord
    };

  } catch (error) {
    console.error("Analysis Error:", error);
    return {
      score: 0,
      isCorrect: false,
      feedback: "Could not analyze audio. Please check connection.",
      transcript: ""
    };
  }
};

export const analyzeReadingAssessment = async (audioUri: string, targetText: string, durationSeconds: number): Promise<{ wpm: number, accuracy: number, transcript: string }> => {
  try {
    const ai = getAiClient();
    
    const transcript = await transcribeWithHuggingFace(audioUri);
    
    if (!transcript) {
        return { wpm: 0, accuracy: 0, transcript: "" };
    }

    const analysisResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            text: `Assessment Analysis:
            Target Text: "${targetText}"
            Student Read (Transcript): "${transcript}"
            
            Task:
            1. Calculate reading accuracy (0-100) based on how many words matched the target.
            2. Count the number of words read correctly.
            3. Return JSON.`
          }
        ]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            accuracy: { type: Type.NUMBER },
            correctWordCount: { type: Type.NUMBER }
          }
        }
      }
    });

    const analysis = JSON.parse(analysisResponse.text || "{}");
    const minutes = durationSeconds / 60;
    const wpm = minutes > 0 ? Math.round((analysis.correctWordCount || 0) / minutes) : 0;

    return { 
      wpm: wpm, 
      accuracy: analysis.accuracy || 0, 
      transcript: transcript 
    };

  } catch (error) {
    console.error("Reading Assessment Error:", error);
    return { wpm: 0, accuracy: 0, transcript: "Error analyzing audio" };
  }
};
