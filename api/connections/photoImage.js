const pool = require('./pool');

async function getImagesByMemoryID(memory_id) {
  const [result] = await pool.query(
    `SELECT * FROM PHOTO_IMAGE WHERE memory_id = ?`,
    [memory_id]
  );
  return result;
}

async function createImage({ filename, file_path, file_size, memory_id, user_id }) {
  const [result] = await pool.query(
    `INSERT INTO PHOTO_IMAGE 
     (filename, file_path, file_size, memory_id, uploaded_by_user_id)
     VALUES (?, ?, ?, ?, ?)`,
    [filename, file_path, file_size, memory_id, user_id]
  );
  return { photo_id: result.insertId, file_path };
}

async function deleteImage(photo_id) {
  const [result] = await pool.query(
    `DELETE FROM PHOTO_IMAGE WHERE photo_id = ?`,
    [photo_id]
  );
  return result.affectedRows > 0;
}

module.exports = {
  getImagesByMemoryID,
  createImage,
  deleteImage
};