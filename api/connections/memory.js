const pool = require('./pool');

//START OF MEMORY FUNCTIONS

//GET ALL USER'S CREATED MEMORY
async function getMemoryByUserID(user_id) {
    const [result] = await pool.query(
        'SELECT * FROM MEMORY WHERE user_id = ?',
        [user_id]
    );
    return result;
}

//GET ALL MEMORY
async function getMemory() {
    const [result] = await pool.query('SELECT * FROM MEMORY');
    return result;
}
//GET A SINGLE MEMORY BY ID
async function getMemoryByID(memory_id) {
    const [result] = await pool.query(`SELECT * FROM MEMORY WHERE memory_id = ?`, [memory_id]);
    return result[0] || null;
}
//CREATE a new MEMORY
async function createMemory(title, content, user_id, creator_id, date_of_event) {
    const [result] = await pool.query(
        'INSERT INTO MEMORY (title, content, user_id, creator_id, date_of_event) VALUES (?, ?, ?, ?, ?)',
        [title, content, user_id, creator_id, date_of_event]
    );
    return getMemoryByID(result.insertId);
}
// UPDATE a MEMORY
async function updateMemory(memory_id, title, content, date_of_event) {
    const [result] = await pool.query(
        `UPDATE MEMORY 
         SET title = ?, 
             content = ?, 
             updated_at = CURRENT_TIMESTAMP,
             date_of_event = ? 
         WHERE memory_id = ?`,
        [title, content, date_of_event, memory_id]
    );
    return getMemoryByID(memory_id);
}
//DELETE a MEMORY
async function deleteMemory(memory_id) {
    await pool.query(
        'DELETE FROM MEMORY WHERE memory_id = ?', [memory_id])
    return { message: 'Memory deleted successfully' };
}

// END OF MEMORY FUNCTIONS

module.exports = {
    getMemory,
    getMemoryByUserID,
    getMemoryByID,
    createMemory,
    updateMemory,
    deleteMemory
}