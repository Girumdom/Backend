const axios = require('axios'); 
const pool = require('./pool');
const { generateClonedAudio } = require('../connections/voiceEngine'); 
const { cloudinary } = require('../connections/cloudinary');

// YOUR CUSTOM API URL
const CUSTOM_TTS_API_URL = "https://cuhgrel-girumdom-tts-api.hf.space/synthesize/";

// 1. HELPER: Create Audio Record in DB
async function createAudio({ filename, file_path, file_size, duration, memory_id, uploaded_by_user_id }) {
    const [result] = await pool.query(
        `INSERT INTO AUDIO (filename, file_path, file_size, duration, memory_id, uploaded_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [filename, file_path, file_size, duration, memory_id, uploaded_by_user_id]
    );
    return { audio_id: result.insertId, file_path };
}

// generate standard TTS
async function generateStandardTTS(text, language, memory_id) {
    console.log(`[TTS] Requesting ${language} audio from your custom API...`);
    
    // call the huggingface space URL
    const response = await axios.post(
        CUSTOM_TTS_API_URL, 
        { 
            text: text,       
            language: language 
        },
        { responseType: "arraybuffer" } // We need raw audio data to upload
    );

    // upload the audio to Cloudinary
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            { 
                resource_type: "video", // using video since audio is under video in Cloudinary
                folder: "girumdom_audio", 
                public_id: `tts_standard_${memory_id}_${Date.now()}`,
                format: "wav" 
            },
            (error, result) => { if (error) reject(error); else resolve(result); }
        );
        uploadStream.end(Buffer.from(response.data));
    });
}

async function createMemoryTTS(memory_id, text, user_id, targetVoiceUrl = null, language = 'tgl') {
    try {
        let cloudResult;
        let filename;

        if (targetVoiceUrl) {
            console.log(`TTS Cloning Voice...`);
            const tempUrl = await generateClonedAudio(text, targetVoiceUrl, language);
            
            // Upload the result
            cloudResult = await cloudinary.uploader.upload(tempUrl, {
                resource_type: "video", folder: "girumdom_audio", format: "wav"
            });
            filename = `cloned_tts_${memory_id}.wav`;

        } else {
            console.log(`[TTS] Using Standard Voice (${language})...`);
            cloudResult = await generateStandardTTS(text, language, memory_id);
            filename = `standard_tts_${memory_id}.wav`;
        }

        // save to the database
        await createAudio({
            filename: filename,
            file_path: cloudResult.secure_url,
            file_size: cloudResult.bytes,
            duration: Math.round(cloudResult.bytes / 16000), // Approx duration
            memory_id: memory_id,
            uploaded_by_user_id: user_id
        });

        return cloudResult.secure_url;

    } catch (error) {
        console.error("TTS Failed:", error.message);
        throw error;
    }
}

async function getTTSByMemoryID(memory_id) {
    const [result] = await pool.query('SELECT file_path FROM AUDIO WHERE memory_id = ?', [memory_id]);
    return result[0]?.file_path || null;
}

module.exports = { createMemoryTTS, getTTSByMemoryID, createAudio };