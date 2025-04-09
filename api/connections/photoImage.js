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

async function getImageWithDetails(photo_id) {
  const [result] = await pool.query(
    `SELECT 
      p.*, 
      m.title AS memory_title
     FROM PHOTO_IMAGE p
     JOIN MEMORY m ON p.memory_id = m.memory_id
     WHERE p.photo_id = ?`,
    [photo_id]
  );
  return result[0] || null;
}

async function getImagesPaginated(memory_id, limit = 10, offset = 0) {
  const [result] = await pool.query(
    `SELECT * FROM PHOTO_IMAGE 
     WHERE memory_id = ?
     LIMIT ? OFFSET ?`,
    [memory_id, limit, offset]
  );
  return result;
}

module.exports = {
  getImagesByMemoryID,
  createImage,
  deleteImage,
  getImageWithDetails,
  getImagesPaginated
};