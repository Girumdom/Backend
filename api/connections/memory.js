const pool = require('./pool');

//START OF MEMORY FUNCTIONS

async function getMemory() {
    const [result] = await pool.query('SELECT * FROM MEMORY');
    return result;
}

async function getMemoryByID(memory_id) {
    const [result] = await pool.query(`SELECT * FROM MEMORY WHERE memory_id = ?`, [memory_id]);
    return result;
}

async function createMemory(title, content, user_id, creator_id) {
    const [result] = await pool.query(
        'INSERT INTO MEMORY (title, content, user_id, creator_id) VALUES (?, ?, ?, ?)',
        [title, content, user_id, creator_id]
    );
    return getMemoryByID(result.insertId);
}

async function updateMemory(memory_id, title, content, user_id, creator_id) {
    const [result] = await pool.query(
        `UPDATE MEMORY 
         SET title = ?, 
             content = ?, 
             user_id = ?, 
             creator_id = ?, 
             updated_at = CURRENT_TIMESTAMP 
         WHERE memory_id = ?`,
        [title, content, user_id, creator_id, memory_id]
    );
    return getMemoryByID(memory_id);
}

async function deleteMemory(memory_id) {
    const [result] = await pool.query('DELETE FROM MEMORY WHERE memory_id = ?', [memory_id])
    return result;
}

// END OF MEMORY FUNCTIONS

module.exports = {
    getMemory,
    getMemoryByID,
    createMemory,
    updateMemory,
    deleteMemory
}