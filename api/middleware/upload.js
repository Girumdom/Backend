const multer = require('multer');
const { storage } = require('../connections/cloudinary');

const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
    files: 5, // Limit to 5 files
  }
});

const uploadArray = upload.array('images'); // 'images' is the field name

module.exports = {
  upload,
  uploadArray,
};