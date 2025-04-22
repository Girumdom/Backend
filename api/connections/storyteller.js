const pool = require('./pool');

//START OF STORYTELLER FUNCTIONS

// GET ALL STORYTELLER FOR ALL USER
async function getStory() {
    const [result] = await pool.query('SELECT * FROM STORYTELLER');
    return result;
}

//GET ALL STORYTELLER FOR A USER
async function getStorytellersByUserID(user_id) {
    const [rows] = await pool.query(
        'SELECT * FROM STORYTELLER WHERE user_id = ?',
        [user_id]
    );
    return rows;
}
//GET A SINGLE STORYTELLER BY ID
async function getStoryByID(storyteller_id) {
    const [result] = await pool.query(`SELECT * FROM STORYTELLER WHERE storyteller_id = ?`, [storyteller_id]);
    return result[0] || null;
}
//CREATE a new STORYTELLER
async function createStory(name, user_id) {
    const [result] = await pool.query(
        'INSERT INTO STORYTELLER (name, user_id) VALUES (?, ?)',
        [name, user_id]
    );
    return getStoryByID(result.insertId);
}
// UPDATE a STORYTELLER
async function updateStory(storyteller_id, name, description) {
    await pool.query(
        `UPDATE STORYTELLER SET name = ?, description = ? WHERE storyteller_id = ?`,
        [name, description, storyteller_id]
    );
    return getStoryByID(storyteller_id);
}
// DELETE a STORYTELLER
async function deleteStory(storyteller_id) {
    await pool.query(
        'DELETE FROM STORYTELLER WHERE storyteller_id = ?', 
        [storyteller_id]
    );
    return { message: 'Storyteller was deleted successfully' };
}

// END OF STORYTELLER FUNCTIONS

module.exports = {
    getStory,
    getStoryByID,
    createStory,
    updateStory,
    deleteStory,
    getStorytellersByUserID
}