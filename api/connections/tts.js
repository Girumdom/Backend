const pool = require('./pool');
const { generateTTS } = require('../utils/ttsService');

//Generate and upload TTS
async function createMemoryTTS(memory_id, text, user_id = 1) {
    const audioUrl = await generateTTS(memory_id, text, user_id);
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

module.exports = {
    createMemoryTTS,
    getTTSByMemoryID
}