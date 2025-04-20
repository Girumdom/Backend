const multer = require('multer');
const { storage } = require('../connections/cloudinary'); // Cloudinary storage

const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
    files: 1,
  }
});

module.exports = upload;