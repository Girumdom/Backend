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

async function createMemory(memory_id, title, content, created_at, updated_at, user_id, creator_id) {
    const [result] = await pool.query(
        'INSERT INTO MEMORY (memory_id, title, content, created_at, updated_at, user_id, creator_id) VALUES (?,?,?,?,?,?,?)',
        [memory_id, title, content, created_at, updated_at, user_id, creator_id]
    );
    const id = result.insertId;
    return getMemoryByID(id);
}

async function updateMemory(memory_id, title, content, created_at, updated_at, user_id, creator_id) {
    const [result] = await pool.query(
        'UPDATE MEMORY SET title = ?, content = ?, created_at = ?, updated_at = ?, user_id = ?, creator_id = ? WHERE memory_id = ?',
        [title, content, created_at, updated_at, user_id, creator_id, memory_id]
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