const multer = require('multer');
const { storage } = require('../connections/cloudinary'); // Cloudinary storage

const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit (in bytes)
    files: 1, // Limit to 1 file per upload
    // You can add other limits as needed:
    // fieldNameSize: 100, // Max field name size (bytes)
    // fieldSize: 1000000, // Max field value size (bytes)
    // fields: 10, // Max number of non-file fields
    // parts: 20, // For multipart forms, max total parts
    // headerPairs: 2000 // Max number of header key=>value pairs
  }
});

module.exports = upload;