const pool = require('./pool');

// START OF USER FUNCTIONS

async function getAllUsers() { // Function to get all users
    try {
        const [result] = await pool.query('SELECT * FROM USER');
        return result;
    } catch (error) {
        console.error('Error in the function getAllUsers:', error);
        throw new Error('Failed to fetch users');
    }
}

async function getUserByID(user_id) { // Function to get a user by ID
    if (!user_id) {
        throw new Error('User ID is required to fetch user');
    }
    try {
        const [result] = await pool.query('SELECT * FROM USER WHERE user_id = ?', [user_id]);
        return result[0] || null;
    } catch (error) {
        console.error('Error in the function getUserByID:', error);
        throw new Error('Failed to fetch user by ID');
    }
}

async function getUserByEmail(email){ // Function to get a user by email
    if (!email) {
        throw new Error('Email is required to fetch user');
    }
    try {
        const [result] = await pool.query('SELECT * FROM USER WHERE email = ?', [email]);
        return result[0] || null;
    } catch (error) {
        console.error('Error in the function getUserByEmail:', error);
        throw new Error('Failed to fetch user by email');
    }
}

async function getUserByUsername(username) { // Function to get a user by username
    if (!username) {
        throw new Error('Username is required to fetch user');
    }
    try {
        const [result] = await pool.query('SELECT * FROM USER WHERE username = ?', [username]);
        return result[0] || null;
    } catch (error) {
        console.error('Error in the function getUserByUsername:', error);
        throw new Error('Failed to fetch user by username');
    }
}

async function createUser(email, password_hash, fullname, role) { // Function to create a new user
    if (!email || !password_hash || !fullname || !role) {
        throw new Error('Email, password, name, and role are required to create a user');
    }
    try {
        const [result] = await pool.query(
            'INSERT INTO USER (email, password_hash, fullname, role) VALUES (?, ?, ?, ?)',
            [email, password_hash, fullname, role]
        );
        return getUserByID(result.insertId);
    } catch (error) {
        console.error('Error in the function createUser:', error);
        throw new Error('Failed to create a new user');
    }
}

async function updateUser(user_id, email, password_hash, fullname, role) { // Function to update an existing user
    if (!user_id) {
        throw new Error('User ID is required to update user');
    }

    try {
        const [result] = await pool.query(
            'UPDATE USER SET email = ?, password_hash = ? = ?, fullname = ?, role = ? WHERE user_id = ?',
            [email, password_hash, user_id, fullname, role]
        );

        if (result.affectedRows === 0) { // Check if any rows were actually updated
            throw new Error('User not found or no changes made');
        }
        // Return the updated user
        return getUserByID(user_id);
    } catch (error) {
        console.error('Error in the function updateUser:', error);
        throw new Error('Failed to update user');
    }
}

async function deleteUser(user_id) { // Function to delete a user
    if (!user_id) {
        throw new Error('User ID is required to delete user');
    }
    try {
        const user = await getUserByID(user_id);
        if (!user) {
            throw new Error('User not found');
        }

        await pool.query('DELETE FROM USER WHERE user_id = ?', [user_id]);
        return { message: 'User was deleted successfully' };
    } catch (error) {
        console.error('Error in the function deleteUser:', error);
        throw new Error('Failed to delete user');
    }
}

// END OF USER FUNCTIONS
module.exports = {
    getAllUsers,
    getUserByID,
    getUserByEmail,
    getUserByUsername,
    createUser,
    updateUser,
    deleteUser
};