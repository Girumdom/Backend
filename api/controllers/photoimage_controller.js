const express = require('express');
const router = express.Router();
const pool = require('../connections/pool');
const fs = require('fs').promises;
const path = require('path');
const { getImagesByMemoryID, createImage, createImages, deleteImage } = require('../connections/photoImage');
const { upload, uploadArray } = require('../middleware/upload');
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
        file_path: result.secure_url, // Cloudinary URL
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

router.post('/base64/bulk', async (req, res) => {
  try {
    const { memory_id, images } = req.body;
    
    if (!memory_id || !images || !Array.isArray(images)) {
      return res.status(400).json({ error: 'Invalid request format' });
    }

    // Process images with rate limiting (3 at a time)
    const batchSize = 3;
    const results = [];
    
    for (let i = 0; i < images.length; i += batchSize) {
      const batch = images.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (imageData) => {
          try {
            const result = await cloudinary.uploader.upload(imageData, {
              folder: 'girumdom_memories',
              transformation: [
                { width: 1200, height: 800, crop: "limit" },
                { quality: "auto" }
              ]
            });

            const image = await createImage({
              filename: `memory-${memory_id}-${Date.now()}`,
              file_path: result.secure_url,
              file_size: result.bytes,
              memory_id,
              user_id: req.user?.id || 1
            });

            return {
              success: true,
              image
            };
          } catch (error) {
            return {
              success: false,
              error: error.message
            };
          }
        })
      );
      
      results.push(...batchResults);
    }

    const failedUploads = results.filter(r => !r.success);
    if (failedUploads.length > 0) {
      return res.status(207).json({
        message: `${failedUploads.length} images failed to upload`,
        total: images.length,
        failedUploads,
        successfulUploads: results.filter(r => r.success)
      });
    }

    res.status(201).json({
      message: 'All images uploaded successfully',
      images: results.map(r => r.image)
    });

  } catch (error) {
    console.error('Bulk base64 upload error:', error);
    res.status(500).json({ 
      error: 'Image upload failed',
      details: error.message 
    });
  }
});

// POST /api/images/url/bulk - Save Cloudinary URLs directly to DB
router.post('/url/bulk', async (req, res) => {
  try {
    const { memory_id, image_urls } = req.body;
    
    if (!memory_id || !image_urls || !Array.isArray(image_urls)) {
      return res.status(400).json({ error: 'Invalid format' });
    }

    const createdImages = [];
    
    // We just insert the URLs. No uploading needed! Super fast.
    for (const url of image_urls) {
      const image = await createImage({
        filename: `mobile-upload-${Date.now()}`,
        file_path: url, 
        file_size: 0, // We don't know the size, but it doesn't matter for display
        memory_id: memory_id,
        user_id: req.user?.id || 1
      });
      createdImages.push(image);
    }

    res.status(201).json({ message: 'Images linked successfully', images: createdImages });

  } catch (error) {
    console.error('URL Bulk error:', error);
    res.status(500).json({ error: 'Failed to link images' });
  }
});

router.post('/multiple', uploadArray, async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No images provided' });
      }

      const { memory_id } = req.body;
      if (!memory_id) {
        // Clean up uploaded files if validation fails
        await Promise.all(req.files.map(file => 
          fs.unlink(file.path).catch(console.error)
        ));
        return res.status(400).json({ error: 'Memory ID is required' });
      }

      // Process all images in parallel
      const uploadResults = await Promise.all(
        req.files.map(async (file) => {
          try {
            // Upload to Cloudinary
            const result = await cloudinary.uploader.upload(file.path, {
              folder: 'girumdom_memories'
            });

            // Create DB record
            const image = await createImage({
              filename: file.originalname,
              file_path: result.secure_url,
              file_size: file.size,
              memory_id,
              user_id: req.user?.id || 1
            });

            // Clean up temp file
            await fs.unlink(file.path);

            return {
              success: true,
              image
            };
          } catch (error) {
            console.error(`Failed to upload ${file.originalname}:`, error);
            return {
              success: false,
              filename: file.originalname,
              error: error.message
            };
          }
        })
      );

      // Check for failures
      const failedUploads = uploadResults.filter(r => !r.success);
      if (failedUploads.length > 0) {
        return res.status(207).json({ // 207 Multi-Status
          message: `${failedUploads.length} images failed to upload`,
          total: req.files.length,
          failedUploads,
          successfulUploads: uploadResults.filter(r => r.success)
        });
      }

      res.status(201).json({
        message: 'All images uploaded successfully',
        images: uploadResults.map(r => r.image)
      });

    } catch (error) {
      // Clean up any remaining files
      if (req.files) {
        await Promise.all(req.files.map(file => 
          fs.unlink(file.path).catch(console.error)
        ));
      }
      
      console.error('Multiple upload error:', error);
      res.status(500).json({ 
        error: 'Image upload failed',
        details: error.message 
      });
    }
  }
);

module.exports = router;
