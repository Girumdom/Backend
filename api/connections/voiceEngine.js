const { Client } = require('@gradio/client');

// Your Cloning Space
const CLONING_SPACE_ID = "cuhgrel/Girumdom-Voice-Cloning";

// MAP: Your App Codes -> What Hugging Face Expects
const LANGUAGE_MAP = {
    'en': 'English',
    'tgl': 'English',   // Fallback: XTTS doesn't support Tagalog, so we use English to process phonemes
    'bikol': 'English', // Fallback: XTTS doesn't support Bikol
    'default': 'English'
};

async function generateClonedAudio(text, referenceAudioUrl, languageCode = "en") {
    try {
        console.log(`[VoiceEngine] Connecting to Space: ${CLONING_SPACE_ID}...`);
        
        // 1. Convert Code to Full Name (e.g., 'en' -> 'English')
        const targetLanguage = LANGUAGE_MAP[languageCode] || LANGUAGE_MAP['default'];
        console.log(`[VoiceEngine] Mapping '${languageCode}' -> '${targetLanguage}'`);

        const client = await Client.connect(CLONING_SPACE_ID);

        console.log(`[VoiceEngine] Cloning voice using ref: ${referenceAudioUrl}`);

        const result = await client.predict("/voice_clone_synthesis", {         
            text: text,         
            reference_audio_url: referenceAudioUrl, 
            
            // 2. Send the CORRECTED Language Name
            language: targetLanguage, 

            // Static Parameters
            example_audio_name: null,
            temperature: 0.75,
            speed: 0.9,
            do_sample: true,
            repetition_penalty: 2.0,
            length_penalty: 1.0,
            gpt_cond_len: 24,
            top_k: 50,
            top_p: 0.85,
            remove_silence_enabled: true,
            silence_threshold: -60,
            min_silence_len: 300,
            keep_silence: 100,
            text_splitting_method: "Native XTTS splitting",
            max_chars_per_segment: 400,
            enable_preprocessing: true, 
        });

        const audioData = result.data[0];
        let audioUrl = (typeof audioData === 'object' && audioData.url) ? audioData.url : audioData;
        
        return audioUrl;

    } catch (error) {
        // Log the specific error message from HF for easier debugging
        console.error("Voice Engine Error Details:", error?.data || error.message);
        throw new Error("Failed to generate cloned voice audio.");
    }
}

module.exports = { generateClonedAudio };