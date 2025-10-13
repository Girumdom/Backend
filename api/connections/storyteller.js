const pool = require('./pool');

//START OF STORYTELLER FUNCTIONS

//GET ALL STORYTELLER FOR A USER
async function getStorytellersByUserID(user_id) {
    try {
        const [result] = await pool.query(
            'SELECT * FROM STORYTELLER WHERE user_id = ?',
            [user_id]
            );
        return result;
    } catch (error) {
        console.error('Error in the function getStorytellersByUserID:', error);
        throw new Error('Failed to fetch storytellers for user');
    }
}

//GET A SINGLE STORYTELLER BY ID
async function getStoryByID(storyteller_id, user_id) {
    try {
        let query = 'SELECT * FROM STORYTELLER WHERE storyteller_id = ?';
        const params = [storyteller_id];

        // If a user_id is provided, add it to the query for security
        if (user_id) {
            query += ' AND user_id = ?';
            params.push(user_id);
        }

        const [result] = await pool.query(query, params);
        return result[0] || null;

    } catch (error) {
        console.error('Error in the function getStoryByID:', error);
        throw new Error('Failed to fetch storyteller by ID');
    }
}

// CREATE a new STORYTELLER for a specific user
async function createStory(name, user_id) {
    try {
        const [result] = await pool.query(
            'INSERT INTO STORYTELLER (name, user_id) VALUES (?, ?)',
            [name, user_id]
        );
        return getStoryByID(result.insertId, user_id);
    } catch (error) {
        console.error('Error in the function createStory:', error);
        throw new Error('Failed to create a new storyteller');
    }
}

// UPDATE a USER'S STORYTELLER
async function updateStory(storyteller_id, name, description, user_id) {
    try {
        const [result] = await pool.query(
            `UPDATE STORYTELLER 
            SET name = ?, description = ? 
            WHERE storyteller_id = ? AND user_id = ?`,
            [name, description, storyteller_id, user_id]
        );

        // Check if any rows were actually updated
        if (result.affectedRows === 0) {
            return null; // No rows updated, possibly storyteller not found or does not belong to the user
        }

        return getStoryByID(storyteller_id, user_id);
    } catch (error) {
        console.error('Error in the function updateStory:', error);
        throw new Error('Failed to update storyteller');
    }
}

// DELETE a USER'S STORYTELLER
async function deleteStory(storyteller_id, user_id) {
    try {
        const storyteller = await getStoryByID(storyteller_id, user_id);
        if (!storyteller) {
            throw new Error('Storyteller not found or does not belong to the user');
        } else if (storyteller.user_id !== user_id) {
            throw new Error('You do not have permission to delete this storyteller');
        }

        await pool.query(
            'DELETE FROM STORYTELLER WHERE storyteller_id = ? and user_id = ?', 
            [storyteller_id, user_id]
        );

        return { message: 'Storyteller was deleted successfully' };
    } catch (error) {
        console.error('Error in the function deleteStory:', error);
        throw new Error('Failed to delete storyteller');
    }
}

// END OF STORYTELLER FUNCTIONS

module.exports = {
    getStoryByID,
    createStory,
    updateStory,
    deleteStory,
    getStorytellersByUserID
}