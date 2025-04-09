const multer = require('multer');
const path = require('path');
const fs = require('fs').promises; // Add this at the top

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads');
    try {
      await fs.mkdir(uploadPath, { recursive: true }); // Creates if missing
      cb(null, uploadPath);
    } catch (err) {
      cb(err);
    }
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