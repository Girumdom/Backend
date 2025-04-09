const express = require('express');
const router = express.Router();
const { 
  getImagesByMemoryID,
  createImage,
  deleteImage
} = require('../connections/photoImage');
const upload = require('../middleware/upload');

// GET all images for a memory
router.get('/memory/:memory_id', async (req, res) => {
  try {
    const images = await getImagesByMemoryID(req.params.memory_id);
    res.status(200).json(images);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST upload new image
router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image provided' });
    }
    
    const image = await createImage({
      filename: req.file.originalname,
      file_path: `/uploads/${req.file.filename}`,
      file_size: req.file.size,
      memory_id: req.body.memory_id,
      user_id: 1 // Hardcoded for now (remove later)
    });
    
    res.status(201).json(image);
  } catch (error) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

// DELETE image
router.delete('/:id', async (req, res) => {
  try {
    await deleteImage(req.params.id);
    res.status(200).json({ message: 'Image deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Deletion failed' });
  }
});

module.exports = router;