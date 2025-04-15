const express = require('express');
const router = express.Router();
const { createMemoryTTS, getTTSByMemoryID } = require('../connections/tts');

// POST /api/tts - Generate TTS
router.post('/', async (req, res) => {
  console.log("POST /api/tts triggered");
  try {
    const { text, memory_id, user_id } = req.body;
    const audioUrl = await createMemoryTTS(memory_id, text, user_id);
    // res.status(200).json({ url: audioUrl });
    res.send(audioUrl); // this avoids returning JSON so the frontend can easily fetch the URL string
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

module.exports = router;
