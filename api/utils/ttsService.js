const { AutoProcessor, VitsModel } = require('@xenova/transformers');
const { v2: cloudinary } = require('cloudinary');
const fs = require('fs');
const path = require('path');
const pool = require('../connections/pool');
const WavEncoder = require('wav-encoder');

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
  console.log("generateTTS called with:", text, memory_id, user_id);
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
  const inputs = await processor(text, { return_tensors: "pt" });
  const output = await model(inputs);
  const waveform = output.waveform.squeeze().numpy();
  const samplingRate = model.config.sampling_rate;

  // Encode to valid WAV format
  const audioData = {
    sampleRate: samplingRate,
    channelData: [waveform], // mono audio
  };
  const wavBuffer = await WavEncoder.encode(audioData);

  // Save to temp file
  const tempFilePath = path.join(__dirname, `../../temp_uploads/tts_${memory_id}_${Date.now()}.wav`);
  fs.mkdirSync(path.dirname(tempFilePath), { recursive: true });
  fs.writeFileSync(tempFilePath, Buffer.from(wavBuffer));

  // Upload to Cloudinary
  const cloudinaryResult = await cloudinary.uploader.upload(tempFilePath, {
    resource_type: "video", // treat audio as video
    folder: "tts_audio",
  });

  // Delete temp file
  fs.unlinkSync(tempFilePath);

  // Store in DB
  const duration = Math.ceil(waveform.length / samplingRate);

  await pool.query(
    `INSERT INTO AUDIO 
     (filename, file_path, file_size, duration, memory_id, uploaded_by_user_id) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      `tts_${memory_id}.wav`,
      cloudinaryResult.secure_url,
      cloudinaryResult.bytes,
      duration,
      memory_id,
      user_id
    ]
  );

  return cloudinaryResult.secure_url;
}

module.exports = { generateTTS };
