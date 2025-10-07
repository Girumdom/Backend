const pool = require('./pool');
const { generateTTS } = require('../utils/ttsService');

//Generate and upload TTS
async function createMemoryTTS(memory_id, text, user_id = 1) {
    const audioUrl = await generateTTS(text, memory_id, user_id);
    return audioUrl;
}

// Get TTS URL from DB 
async function getTTSByMemoryID(memory_id) {
    const [result] = await pool.query(
        'SELECT file_path FROM AUDIO WHERE memory_id = ?',
        [memory_id]
    );
    return result[0]?.file_path || null;
}

// create audio record in the database
async function createAudio({ filename, file_path, file_size, duration, memory_id, uploaded_by_user_id }) {
    try { 
        const [result] = await pool.query(
            `INSERT INTO AUDIO (filename, file_path, file_size, duration, memory_id, uploaded_by_user_id)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [filename, file_path, file_size, duration, memory_id, uploaded_by_user_id]
        );

        return {
            audio_id: result.insertId,
            filename, 
            file_path,
            file_size, 
            duration, 
            memory_id,
            uploaded_by_user_id
        };
    } catch (error) {
        console.error('Error creating audio record:', error);
        throw error;
    }
}

module.exports = {
    createMemoryTTS,
    getTTSByMemoryID,
    createAudio
}