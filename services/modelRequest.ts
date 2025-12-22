import { PronunciationResult } from '../types';

// Convert URI to base64 (same as before)
const uriToBase64 = async (uri: string): Promise<string> => {
    try {
        const response = await fetch(uri);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64data = reader.result as string;
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

export const checkPronunciation = async (
    audioUri: string, 
    targetWord: string
): Promise<PronunciationResult> => {
    try {
        console.log('Audio URI:', audioUri);
        console.log('Target word:', targetWord);
        
        const base64Audio = await uriToBase64(audioUri);
        console.log('Base64 length:', base64Audio.length);
        console.log('Base64 first 100 chars:', base64Audio.substring(0, 100));
        
        const res = await fetch('https://sesefi-lexi-reading-pronunciation-api.hf.space/pronunciation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                audio_base64: base64Audio,
                target_word: targetWord,
            }),
        });

        console.log('Response status:', res.status);
        const responseText = await res.text();
        console.log('Response:', responseText);
        
        if (!res.ok) {
            console.error('Backend error:', responseText);
            throw new Error(`Backend error: ${res.status}`);
        }

        const data = JSON.parse(responseText);
        return data as PronunciationResult;
    } catch (error) {
        console.error('Pronunciation API error:', error);
        return {
            score: 0,
            isCorrect: false,
            feedback: 'Backend error',
            transcript: '',
            phoneticBreakdown: '',
        };
    }
};

export const analyzeReadingAssessment = async (
    audioUri: string, 
    targetText: string, 
    durationSeconds: number
): Promise<{ wpm: number, accuracy: number, transcript: string }> => {
    try {
        console.log('Reading Assessment - Audio URI:', audioUri);
        console.log('Target text:', targetText);
        
        const base64Audio = await uriToBase64(audioUri);
        console.log('Base64 length:', base64Audio.length);
        
        const res = await fetch('https://sesefi-lexi-reading-pronunciation-api.hf.space/reading', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                audio_base64: base64Audio,
                target_text: targetText,
            }),
        });

        console.log('Response status:', res.status);
        const responseText = await res.text();
        console.log('Response:', responseText);
        
        if (!res.ok) {
            console.error('Backend error:', responseText);
            throw new Error(`Backend error: ${res.status}`);
        }

        const result = JSON.parse(responseText);
        const minutes = durationSeconds / 60;
        const wpm = minutes > 0 ? Math.round((result.correctWordCount || 0) / minutes) : 0;

        console.log("📖 Reading Assessment Result:");
        console.log("✅ Accuracy:", result.accuracy);
        console.log("📝 Correct Word Count:", result.correctWordCount);
        console.log("🎧 Transcript:", result.transcript);
        console.log("⏱️ WPM:", wpm);

        return {
            wpm: wpm,
            accuracy: result.accuracy || 0,
            transcript: result.transcript || '',
        };
    } catch (error) {
        console.error('Reading API error:', error);
        return { wpm: 0, accuracy: 0, transcript: '' };
    }
};