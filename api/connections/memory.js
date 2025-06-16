const pool = require('./pool');

//START OF MEMORY FUNCTIONS

//GET ALL USER'S CREATED MEMORY
async function getMemoryByUserID(user_id) {
    try {
        const [result] = await pool.query(
            'SELECT * FROM MEMORY WHERE user_id = ?',
            [user_id]
        );
        return result;
    } catch (error) {
        console.error('Error in the function getMemoryByUserID:', error);
        throw new Error(`Failed to fetch user's memories.`)
    }
}

// GET A SINGLE MEMORY BY ID USING USER"S ID
async function getMemoryByID(memory_id, user_id) {
    try {
        const [result] = await pool.query(`
            SELECT * FROM MEMORY 
            WHERE memory_id = ? AND user_id = ?`, 
            [memory_id, user_id]
        );
        return result[0] || null;
    } catch (error) {
        console.error('Error in the function getMemoryByID:', error);
        throw new Error('Failed to fetch memory by ID');
    }
}

// CREATE a new MEMORY for a specific user
async function createMemory(title, content, user_id, creator_id, date_of_event) {
    try {
        const [result] = await pool.query(
            'INSERT INTO MEMORY (title, content, user_id, creator_id, date_of_event) VALUES (?, ?, ?, ?, ?)',
            [title, content, user_id, creator_id, date_of_event]
        );
        return getMemoryByID(result.insertId, user_id);
    } catch (error) {
        console.error('Error in the function createMemory:', error);
        throw new Error('Failed to create a new memory')
    }
}

// UPDATE a MEMORY
async function updateMemory(memory_id, title, content, date_of_event, loggedInUserID) {
    try {
        const [result] = await pool.query(
            `UPDATE MEMORY 
            SET title = ?, content = ?, date_of_event = ? 
            WHERE memory_id = ? 
            AND (user_id = ? OR creator_id = ?)`,
            [title, content, date_of_event, memory_id, loggedInUserID, loggedInUserID]
        );

        // Check if any rows was actually updated
        if (result.affectedRows === 0) {
            return null; // No rows updated, possibly memory not found or does not belong to the user
        }

        return getMemoryByID(memory_id);
    } catch (error) {
        console.error('Error in the function updateMemory:', error);
        throw new Error('Failed to update memory');
    }
}

// DELETE a MEMORY
async function deleteMemory(memory_id, user_id) {
    try {
        const [result] = await pool.query(
            'DELETE FROM MEMORY WHERE memory_id = ? AND user_id = ?', 
            [memory_id, user_id]
        );

        return result;
    } catch (error) {
        console.error('Error in the function deleteMemory:', error);
        throw new Error('Failed to delete memory');
    }
}

// END OF MEMORY FUNCTIONS

module.exports = {
    getMemoryByUserID,
    getMemoryByID,
    createMemory,
    updateMemory,
    deleteMemory
}