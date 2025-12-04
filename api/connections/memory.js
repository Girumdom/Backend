const pool = require('./pool');

//START OF MEMORY FUNCTIONS

//GET ALL USER'S CREATED MEMORY
async function getMemoryByUserID(user_id) {
    try {
        const sql = `
            SELECT 
                m.*,
                a.file_path AS audio_url 
            FROM 
                MEMORY m 
            LEFT JOIN 
                AUDIO a ON m.memory_id = a.memory_id 
            WHERE 
                m.user_id = ?`;
        const [result] = await pool.query(sql, [user_id]);
        return result;
    } catch (error) {
        console.error('Error in the function getMemoryByUserID:', error);
        throw new Error(`Failed to fetch user's memories.`)
    }
}

// GET A SINGLE MEMORY BY ID USING USER"S ID
async function getMemoryByID(memory_id, user_id) {
    try {
        const sql = `
            SELECT 
                m.*,
                a.file_path AS audio_url
            FROM 
                MEMORY m
            LEFT JOIN
                AUDIO a ON m.memory_id = a.memory_id
            WHERE m.memory_id = ? AND m.user_id = ?`;

        const [result] = await pool.query(sql, [memory_id, user_id]);
        return result[0] || null; // return the first row or return null if not found
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

        return getMemoryByID(memory_id, loggedInUserID);
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

// fetch a memory by ID that is either owned by the user or shared with them via collaborations
async function getMemoryByIdShared(memory_id, user_id) {
    try {
        const sql = `
            SELECT 
                m.*, 
                a.file_path as audio_url
            FROM MEMORY m
            
            LEFT JOIN AUDIO a ON m.memory_id = a.memory_id 
            
            WHERE m.memory_id = ?
            AND (
                m.user_id = ?
                OR
                EXISTS (
                    SELECT 1
                    FROM USER_COLLABORATION uc
                    JOIN COLLABORATION_MEMORY cm ON uc.collaboration_id = cm.collaboration_id
                    WHERE uc.user_id = ?
                    AND cm.memory_id = ?)
            )
        `;

        const [result] = await pool.query(sql, [memory_id, user_id, user_id, memory_id]);
        return result[0] || null;
    } catch (error) {
        console.error('Error in getMemoryByIdShared:', error);
        throw new Error('Failed to fetch shared memory');
    }
}

// END OF MEMORY FUNCTIONS

module.exports = {
    getMemoryByUserID,
    getMemoryByID,
    createMemory,
    updateMemory,
    deleteMemory,
    getMemoryByIdShared
}