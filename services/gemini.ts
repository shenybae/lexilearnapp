import { GoogleGenAI, Type } from "@google/genai";
import { PronunciationResult } from '../types';
import { Platform } from 'react-native';

// Access the API key. 
// In Expo, variables must start with EXPO_PUBLIC_ to be visible in the client.
const API_KEY = process.env.EXPO_PUBLIC_API_KEY || process.env.API_KEY;

// Initialize Gemini Client
const getAiClient = () => {
  if (!API_KEY) {
    console.error("Gemini API Key is missing. Please ensure EXPO_PUBLIC_API_KEY is set in your .env file.");
  }
  return new GoogleGenAI({ apiKey: API_KEY });
};

// Helper to convert audio URI to Base64
// Updated to use fetch/blob/FileReader which works on both Web and Native (Expo)
// This avoids the deprecated expo-file-system readAsStringAsync method
const uriToBase64 = async (uri: string): Promise<string> => {
    try {
        const response = await fetch(uri);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64data = reader.result as string;
                // Remove data url prefix if present (e.g. "data:audio/m4a;base64,")
                const parts = base64data.split(',');
                resolve(parts.length > 1 ? parts[1] : base64data);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("Error converting audio to base64:", error);
        throw error;
    }
};

// --- GEMINI SERVICES ---

export const checkPronunciation = async (audioUri: string, targetWord: string): Promise<PronunciationResult> => {
  try {
    const ai = getAiClient();
    const base64Audio = await uriToBase64(audioUri);

    console.log(`[Gemini] Checking pronunciation for: "${targetWord}"`);

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [
                {
                    inlineData: {
                        mimeType: 'audio/m4a', // Hints to Gemini that this is AAC/M4A audio
                        data: base64Audio
                    }
                },
                {
                    text: `You are a friendly reading tutor. Listen to the audio. The student is trying to say the word "${targetWord}". 
                    
                    Analyze the pronunciation and return a JSON object with:
                    - score (integer 0-100): Rate the pronunciation quality. 100 is perfect.
                    - isCorrect (boolean): true if the score is > 70.
                    - feedback (string): Short, encouraging feedback (max 10 words).
                    - phoneticBreakdown (string): A simple phonetic representation of what the student said vs target (e.g. "You said 'Cat', target 'Bat'").
                    - transcript (string): Transcribe exactly what you heard.`
                }
            ]
        },
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    score: { type: Type.INTEGER },
                    isCorrect: { type: Type.BOOLEAN },
                    feedback: { type: Type.STRING },
                    phoneticBreakdown: { type: Type.STRING },
                    transcript: { type: Type.STRING },
                }
            }
        }
    });

    if (response.text) {
        const result = JSON.parse(response.text);
        console.log("[Gemini] Analysis result:", result);
        return result;
    }
    
    throw new Error("No response from AI");

  } catch (error) {
    console.error("Analysis Error:", error);
    return {
      score: 0,
      isCorrect: false,
      feedback: "Could not analyze audio. Please try again.",
      transcript: "",
      phoneticBreakdown: ""
    };
  }
};

export const analyzeReadingAssessment = async (audioUri: string, targetText: string, durationSeconds: number): Promise<{ wpm: number, accuracy: number, transcript: string }> => {
  try {
    const ai = getAiClient();
    const base64Audio = await uriToBase64(audioUri);

    console.log(`[Gemini] Analyzing reading assessment...`);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
                mimeType: 'audio/m4a',
                data: base64Audio
            }
          },
          {
            text: `You are a reading assessment tool. 
            Target Text: "${targetText}"
            
            Task:
            1. Transcribe the audio provided.
            2. Compare the transcription to the Target Text.
            3. Calculate accuracy (percentage of words read correctly).
            4. Count the number of correct words.
            
            Return JSON.`
          }
        ]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            accuracy: { type: Type.INTEGER },
            correctWordCount: { type: Type.INTEGER },
            transcript: { type: Type.STRING }
          }
        }
      }
    });

    const analysis = JSON.parse(response.text || "{}");
    console.log("[Gemini] Assessment Result:", analysis);

    const minutes = durationSeconds / 60;
    // Calculate WPM based on correct words over time
    const wpm = minutes > 0 ? Math.round((analysis.correctWordCount || 0) / minutes) : 0;

    return { 
      wpm: wpm, 
      accuracy: analysis.accuracy || 0, 
      transcript: analysis.transcript || "" 
    };

  } catch (error) {
    console.error("Reading Assessment Error:", error);
    return { wpm: 0, accuracy: 0, transcript: "Error analyzing assessment audio." };
  }
};