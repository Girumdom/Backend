const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

exports.uploadMemoryImage = async (req, res) => {
  try {
    const { memory_id } = req.params;
    const uploaded_by_user_id = req.user.id; // From auth
    
    if (!req.file) {
      return res.status(400).json({ error: "No image provided" });
    }

    // Process file
    const fileExt = path.extname(req.file.originalname);
    const filename = `memory_${memory_id}_${Date.now()}${fileExt}`;
    const filePath = path.join(__dirname, '../../uploads', filename);
    
    // Move from temp to permanent location
    await fs.rename(req.file.path, filePath);
    
    // Insert into PHOTO_IMAGE table
    const [result] = await pool.query(
      `INSERT INTO PHOTO_IMAGE 
       (filename, file_path, file_size, memory_id, uploaded_by_user_id)
       VALUES (?, ?, ?, ?, ?)`,
      [
        filename,
        `/uploads/${filename}`,
        req.file.size,
        memory_id,
        uploaded_by_user_id
      ]
    );

    res.status(201).json({
      photo_id: result.insertId,
      file_path: `/uploads/${filename}`
    });
    
  } catch (error) {
    await fs.unlink(req.file.path).catch(console.error); // Cleanup
    res.status(500).json({ error: "Image upload failed" });
  }
};