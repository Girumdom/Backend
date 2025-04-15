const { AutoProcessor, VitsModel } = require('@xenova/transformers');
const { v2: cloudinary } = require('cloudinary');
const fs = require('fs');
const path = require('path');
const pool = require('../connections/pool');

// Initialize TTS model (lazy-loaded)
let processor, model;
async function initializeTTS() {
  if (!processor || !model) {
    processor = await AutoProcessor.from_pretrained("facebook/mms-tts-tgl");
    model = await VitsModel.from_pretrained("facebook/mms-tts-tgl");
    console.log("TTS model loaded");
  }
}

// Generate TTS and save to DB (AUDIO table)
async function generateTTS(text, memory_id, user_id = 1) {
  await initializeTTS();

  // Check if audio exists for this memory_id
  const [existing] = await pool.query(
    'SELECT file_path FROM AUDIO WHERE memory_id = ?',
    [memory_id]
  );

  if (existing.length > 0) {
    return existing[0].file_path; // Return cached Cloudinary URL
  }

  // Generate new audio
  const inputs = await processor(text, return_tensors="pt");
  const output = await model(inputs);
  const waveform = output.waveform.squeeze().numpy();

  // Save temporarily (required for Cloudinary upload)
  const tempFilePath = path.join(__dirname, `../../temp_uploads/tts_${memory_id}_${Date.now()}.wav`);
  fs.mkdirSync(path.dirname(tempFilePath), { recursive: true });
  fs.writeFileSync(tempFilePath, Buffer.from(waveform));

  // delete the temporary files
  fs.unlinkSync(tempFilePath);

  // Store in AUDIO table
  const duration = Math.ceil(waveform.length / model.config.sampling_rate);

  await pool.query(
    `INSERT INTO AUDIO 
     (filename, file_path, file_size, duration, memory_id, uploaded_by_user_id) 
     VALUES (?, ?, ?, ?, ?, ?)`,
     [
        `tts_${memory_id}.wav`,
        cloudinaryResult.secure_url, //Store Cloudinary URL
        cloudinaryResult.bytes,
        duration,
        memory_id,
        user_id
     ]
  );

  return cloudinaryResult.secure_url;
}

module.exports = { generateTTS };