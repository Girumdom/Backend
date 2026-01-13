const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Ensure the upload directory exists
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

// Configure local disk storage (Not Cloudinary yet)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir); 
    },
    filename: function (req, file, cb) {
        // Save as: audio-timestamp.wav
        cb(null, 'audio-' + Date.now() + path.extname(file.originalname));
    }
});

// Create the uploader
const uploadAudio = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

module.exports = { uploadAudio };