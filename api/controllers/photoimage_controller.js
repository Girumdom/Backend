const express = require('express');
const router = express.Router();
const pool = require('../connections/pool');
const fs = require('fs').promises;
const path = require('path');
const { getImagesByMemoryID, createImage, deleteImage } = require('../connections/photoImage');
const upload = require('../middleware/upload');
const { cloudinary } = require('../connections/cloudinary');

// ======================
// MIDDLEWARE
// ======================
const validateImage = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image provided' });
  }

  const validTypes = ['image/jpeg', 'image/png'];
  if (!validTypes.includes(req.file.mimetype)) {
    await fs.unlink(req.file.path).catch(console.error);
    return res.status(400).json({ error: 'Only JPEG/PNG images allowed' });
  }
  next();
};

// ======================
// ROUTES
// ======================

// GET all images for a memory
router.get('/memory/:memory_id', async (req, res) => {
  try {
    const [images] = await getImagesByMemoryID(req.params.memory_id);
    
    res.status(200).json({
      memory_id: req.params.memory_id,
      images
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch images',
      details: error.message 
    });
  }
});

// router.get('/memory/:memory_id', async (req, res) => {
//   try {
//     const [images] = await pool.query(`
//       SELECT photo_id, file_path, file_size, filename
//       FROM PHOTO_IMAGE
//       WHERE memory_id = ?
//     `, [req.params.memory_id]);

//     res.json({ memory_id: req.params.memory_id, images });
//   } catch (error) {
//     res.status(500).json({ 
//       error: 'Failed to fetch images',
//       details: error.message 
//     });
//   }
// });

// POST upload new image
router.post('/', 
  upload.single('image'), 
  validateImage,
  async (req, res) => {
    try {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'girumdom_memories' // optional folder name in Cloudinary
      });
      
      const image = await createImage({
        filename: req.file.originalname,
        file_path: result.secure_url, // ✅ cloud-based image URL
        file_size: req.file.size,
        memory_id: req.body.memory_id,
        user_id: req.user?.id || 1
      });
      

      res.status(201).json(image);
    } catch (error) {
      console.error('UPLOAD FAILED:', error);
      res.status(500).json({ 
        error: 'Image upload failed',
        details: error.message 
      });
    }
  }
);


// DELETE image
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await deleteImage(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Image not found' });
    }
    res.status(200).json({ message: 'Image deleted successfully' });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to delete image',
      details: error.message 
    });
  }
});

// Add this new route for base64 uploads
router.post('/base64', async (req, res) => {
  try {
    const { image_data, memory_id, filename } = req.body;
    
    // Validate required fields
    if (!image_data || !memory_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Extract base64 data
    const matches = image_data.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: 'Invalid base64 image data' });
    }

    const fileExt = matches[1] || 'jpg';
    const fileBuffer = Buffer.from(matches[2], 'base64');
    const fileSize = fileBuffer.length;
    const finalFilename = filename || `memory-${memory_id}-${Date.now()}.${fileExt}`;
    const filePath = `/uploads/${finalFilename}`;
    const fullPath = path.join(__dirname, '..', 'uploads', finalFilename);

    // Save file
    await fs.writeFile(fullPath, fileBuffer);

    // Create DB record
    const image = await createImage({
      filename: finalFilename,
      file_path: filePath,
      file_size: fileSize,
      memory_id,
      user_id: req.user?.id || 1
    });

    res.status(201).json(image);
  } catch (error) {
    console.error('Base64 upload error:', error);
    res.status(500).json({ 
      error: 'Image upload failed',
      details: error.message 
    });
  }
});

module.exports = router;
