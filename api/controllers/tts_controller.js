const express = require('express');
const router = express.Router();
const { cloudinary } = require('../connections/cloudinary');
const { createMemoryTTS, getTTSByMemoryID, createAudio } = require('../connections/tts');

// POST /api/tts - Generate TTS
router.post('/', async (req, res) => {
  try {
    const { text, memory_id, user_id } = req.body;

    if (!text || !memory_id) {
      return res.status(400).json({ error: "text and memory_id are required" });
    }

    // 1. Check if audio already exists
    const existingUrl = await getTTSByMemoryID(memory_id);
    if (existingUrl) {
      console.log("TTS already exists. Returning cached URL.");
      return res.send(existingUrl); // send early
    }

    // 2. Otherwise, generate via Django
    const audioUrl = await createMemoryTTS(memory_id, text, user_id || 1);
    res.send(audioUrl);

  } catch (error) {
    console.error("TTS generation failed:", error);
    res.status(500).json({ error: "Failed to generate TTS" });
  }
});


// GET /api/tts/:memory_id - Fetch TTS URL
router.get('/:memory_id', async (req, res) => {
  try {
    const audioUrl = await getTTSByMemoryID(req.params.memory_id);
    if (!audioUrl) return res.status(404).json({ error: "TTS not found" });
    res.status(200).json({ url: audioUrl });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch TTS" });
  }
});

// POST /api/audio - Save audio metadata
router.post('/audio', async (req, res) => {
  const { filename, file_path, file_size, duration, memory_id, uploaded_by_user_id } = req.body;

  try {
    await pool.query(
      `INSERT INTO AUDIO (filename, file_path, file_size, duration, memory_id, uploaded_by_user_id) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [filename, file_path, file_size, duration, memory_id, uploaded_by_user_id]
    );
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error saving audio metadata:", error);
    res.status(500).json({ error: "Failed to save audio metadata" });
  }
});

router.post('/audio/base64', async (req, res) => {
  try {
    const { memory_id, audio_data, user_id } = req.body;

    if (!memory_id || !audio_data) {
      return res.status(400).json({ error: 'Invalid request format' });
    }

    // Upload audio to Cloudinary
    const result = await cloudinary.uploader.upload(audio_data, {
      resource_type: 'video', // cloudinary treats audio files as 'video' type
      folder: 'girumdom_audio',
      public_id: `tts_${memory_id}_${Date.now()}`
    });

    // calculate audio duration (estimate for now)
    const estimatedDuration = Math.round(result.bytes / 16000); // rough estimate: 16KB per second

    // save audio metadata to database using the new function
    const audio = await createAudio({
      filename: `tts_${memory_id}.wav`,
      file_path: result.secure_url,
      file_size: result.bytes,
      duration: estimatedDuration,
      memory_id,
      uploaded_by_user_id: user_id || 1
    });

    res.status(201).json({
      message: 'Audio uploaded successfully',
      audio_url: result.secure_url,
      audio_id: audio.audio_id
    });

  } catch (error) {
    console.error('Audio upload error:', error);
    res.status(500).json({
      error: 'Audio upload failed',
      details: error.message
    });
  }
});


module.exports = router;