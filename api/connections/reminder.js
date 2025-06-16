const pool = require('./pool');

// START OF REMINDER FUNCTIONS

// GET ALL REMINDERS FOR A USER
async function getAllRemindersByUserID(created_by_user_id){
    try {
        const [result] = await pool.query(
            'SELECT * FROM REMINDER WHERE created_by_user_id = ?',
            [created_by_user_id]
        );
        return result;
    } catch (error) {
        console.error('Error in the function getAllRemindersByUserID:', error);
        throw new Error('Failed to fetch reminders for user');
    }
}

// GET A SINGLE REMINDER BY ID USING USER ID
async function getReminderByID(reminder_id, created_by_user_id){
    try{
        const [result] = await pool.query(
            `SELECT * FROM REMINDER WHERE reminder_id = ? AND created_by_user_id = ?`,
            [reminder_id, created_by_user_id]
        );
        return result[0] || null;
    } catch (error) {
        console.error('Error in the function getReminderByID:', error);
        throw new Error('Failed to fetch reminder by ID');
    }
}

// CREATE A NEW REMINDER for a specific user id
async function createReminder(title, description, reminder_date, created_by_user_id){
    try {
        const [result] = await pool.query(
            `INSERT INTO REMINDER (title, description, reminder_date, created_by_user_id)
            VALUES (?, ?, ?, ?)`, [title, description, reminder_date, created_by_user_id]
        );
        return getReminderByID(result.insertId, created_by_user_id);
    } catch (error) {
        console.error('Error in the function createReminder:', error);
        throw new Error('Failed to create a new reminder');
    }
}

// UPDATE A USER'S REMINDER
async function updateReminder(reminder_id, title, description, reminder_date, created_by_user_id) {
    try {
        const [result] = await pool.query(
            `UPDATE REMINDER 
            SET title = ?, description = ?, reminder_date = ?
            WHERE reminder_id = ? AND created_by_user_id = ?`,
            [title, description, reminder_date, reminder_id, created_by_user_id]
        );
        // Check if any rows was actually updated
        if (result.affectedRows === 0) {
            return null; // No rows updated, possibly reminder not found or does not belong to the user
        }

        return getReminderByID(reminder_id, created_by_user_id);
    } catch (error) {
        console.error('Error in the function updateReminder:', error);
        throw new Error('Failed to update reminder');
    }
}

// DELETE A USER'S REMINDER
async function deleteReminder(reminder_id, created_by_user_id) {
    try {

        const [result] = await pool.query(
            'DELETE FROM REMINDER WHERE reminder_id = ? AND created_by_user_id = ?',
            [reminder_id, created_by_user_id]
        );
        return result;

    } catch (error) {
        console.error('Error in the function deleteReminder:', error);
        throw new Error('Failed to delete reminder');
    }
}

// END OF REMINDER FUNCTIONS
module.exports = {
    getAllRemindersByUserID,
    getReminderByID,
    createReminder,
    updateReminder,
    deleteReminder
}