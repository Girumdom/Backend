const { Client } = require('@gradio/client');
const axios = require('axios');

// Your Cloning Space
const CLONING_SPACE_ID = "cuhgrel/Girumdom-Voice-Cloning";
const TRANSCRIPTION_SPACE_ID = "hf-audio/whisper-large-v3";

// MAP: Your App Codes -> What Hugging Face Expects
const LANGUAGE_MAP = {
    'en': 'English',
    'tgl': 'English',   // Fallback: XTTS doesn't support Tagalog
    'bikol': 'English', // Fallback: XTTS doesn't support Bikol
    'default': 'English'
};

async function generateClonedAudio(text, referenceAudioUrl, languageCode = "en") {
    try {
        console.log(`[VoiceEngine] Connecting to Space: ${CLONING_SPACE_ID}...`);
        
        // 1. Convert Code to Full Name
        const targetLanguage = LANGUAGE_MAP[languageCode] || LANGUAGE_MAP['default'];
        console.log(`[VoiceEngine] Mapping '${languageCode}' -> '${targetLanguage}'`);

        // FIX 1: Add Token here too (Prevents rate limits on cloning)
        const client = await Client.connect(CLONING_SPACE_ID, { 
            hf_token: process.env.HF_API_KEY 
        });

        console.log(`[VoiceEngine] Cloning voice using ref: ${referenceAudioUrl}`);

        const result = await client.predict("/voice_clone_synthesis", {         
            text: text,         
            reference_audio_url: referenceAudioUrl, 
            language: targetLanguage, 
            
            // Static Parameters
            example_audio_name: null, temperature: 0.75, speed: 0.9, do_sample: true, repetition_penalty: 2.0, length_penalty: 1.0, gpt_cond_len: 24, top_k: 50, top_p: 0.85, remove_silence_enabled: true, silence_threshold: -60, min_silence_len: 300, keep_silence: 100, text_splitting_method: "Native XTTS splitting", max_chars_per_segment: 400, enable_preprocessing: true, 
        });

        const audioData = result.data[0];
        let audioUrl = (typeof audioData === 'object' && audioData.url) ? audioData.url : audioData;
        
        return audioUrl;

    } catch (error) {
        console.error("Voice Engine Error Details:", error?.data || error.message);
        throw new Error("Failed to generate cloned voice audio.");
    }
}

async function transcribeAudio(audioUrl) {
    try {
        console.log(`[ASR] Connecting to Whisper Space (${TRANSCRIPTION_SPACE_ID})...`);
        
        // A. Fetch the file as a Blob 
        const response = await fetch(audioUrl);
        const audioBlob = await response.blob();

        // FIX 2: Add Token here! (Solves the "GPU Quota" error)
        const client = await Client.connect(TRANSCRIPTION_SPACE_ID, { 
            hf_token: process.env.HF_API_KEY 
        });
        
        // C. Send to /predict
        const result = await client.predict("/predict", { 
            inputs: audioBlob, 
            task: "transcribe" 
        });

        const transcribedText = result.data[0];
        console.log(`[ASR] Success: "${transcribedText.substring(0, 20)}..."`);
        
        return transcribedText;

    } catch (error) {
        console.error("ASR Error:", error?.message || error);
        throw new Error("Failed to transcribe audio");
    }
}

module.exports = { generateClonedAudio, transcribeAudio };
