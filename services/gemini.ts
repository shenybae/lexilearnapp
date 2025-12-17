
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

// Helper for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to convert audio URI to Base64
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
  const ai = getAiClient();
  let base64Audio = '';
  
  try {
    base64Audio = await uriToBase64(audioUri);
  } catch (e) {
    return { score: 0, isCorrect: false, feedback: "Audio error", transcript: "" };
  }

  let attempt = 0;
  const maxAttempts = 3;

  while (attempt < maxAttempts) {
    try {
        console.log(`Checking pronunciation for: "${targetWord}" (Attempt ${attempt + 1})`);

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
            console.log("Analysis result:", result);
            return result;
        }
        throw new Error("No response text from AI");

    } catch (error: any) {
        // Check for 503 Service Unavailable or Overloaded
        if (error?.status === 503 || error?.code === 503 || error?.message?.includes('overloaded')) {
            attempt++;
            if (attempt < maxAttempts) {
                const waitTime = attempt * 2000; // 2s, 4s
                console.log(`Model overloaded. Retrying in ${waitTime}ms...`);
                await delay(waitTime);
                continue;
            }
        }
        
        console.error("Analysis Error:", error);
        // Return empty transcript to signal UI handling if needed
        return {
            score: 0,
            isCorrect: false,
            feedback: "Service busy. Please try again.",
            transcript: "",
            phoneticBreakdown: ""
        };
    }
  }
  
  return { score: 0, isCorrect: false, feedback: "Failed after retries.", transcript: "" };
};

export const analyzeReadingAssessment = async (audioUri: string, targetText: string, durationSeconds: number): Promise<{ wpm: number, accuracy: number, transcript: string }> => {
  const ai = getAiClient();
  let base64Audio = '';

  try {
    base64Audio = await uriToBase64(audioUri);
  } catch (e) {
    return { wpm: 0, accuracy: 0, transcript: "" };
  }

  let attempt = 0;
  const maxAttempts = 3;

  while (attempt < maxAttempts) {
    try {
        console.log(`Analyzing reading assessment... (Attempt ${attempt + 1})`);

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
        console.log("Assessment Result:", analysis);

        const minutes = durationSeconds / 60;
        const wpm = minutes > 0 ? Math.round((analysis.correctWordCount || 0) / minutes) : 0;

        return { 
          wpm: wpm, 
          accuracy: analysis.accuracy || 0, 
          transcript: analysis.transcript || "" 
        };

    } catch (error: any) {
        if (error?.status === 503 || error?.code === 503 || error?.message?.includes('overloaded')) {
            attempt++;
            if (attempt < maxAttempts) {
                const waitTime = attempt * 2000;
                console.log(`Assessment overloaded. Retrying in ${waitTime}ms...`);
                await delay(waitTime);
                continue;
            }
        }

        console.error("Reading Assessment Error:", error);
        // IMPORTANT: Return empty string for transcript so the UI knows to use fallback logic
        return { wpm: 0, accuracy: 0, transcript: "" };
    }
  }

  return { wpm: 0, accuracy: 0, transcript: "" };
};
