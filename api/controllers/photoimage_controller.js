const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { 
  getImagesByMemoryID,
  createImage,
  deleteImage
} = require('../connections/photoImage');
const upload = require('../middleware/upload');

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
    const images = await getImagesByMemoryID(req.params.memory_id);
    res.status(200).json(images);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch images',
      details: error.message 
    });
  }
});

// POST upload new image
router.post('/', 
  upload.single('image'), 
  validateImage,
  async (req, res) => {
    try {
      const image = await createImage({
        filename: req.file.originalname,
        file_path: `/uploads/${req.file.filename}`,
        file_size: req.file.size,
        memory_id: req.body.memory_id,
        user_id: req.user?.id || 1 // Temp hardcoded (replace with auth later)
      });

      res.status(201).json(image);
    } catch (error) {
      // Cleanup uploaded file if DB operation fails
      await fs.unlink(req.file.path).catch(console.error);
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

module.exports = router;