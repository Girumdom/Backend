// middleware/upload.js
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const safeName = Date.now() + '_' + 
      file.originalname.replace(/[^a-z0-9.]/gi, '_');
    cb(null, safeName.toLowerCase());
  }
});

module.exports = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});