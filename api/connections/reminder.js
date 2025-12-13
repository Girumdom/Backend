const pool = require('./pool');

// START OF REMINDER FUNCTIONS

// GET ALL REMINDERS INVOLVING A USER (As Target OR Creator)
async function getAllRemindersByUserID(userID) {
  try {
    const sql = `
      SELECT reminder_id, title, description, reminder_date, repeat_interval, is_active, notification_id 
      FROM REMINDER 
      WHERE (user_id = ? OR created_by_user_id = ?) 
      AND (reminder_date >= NOW() OR repeat_interval != 'never')
      ORDER BY reminder_date ASC
    `;
    const [result] = await pool.query(sql, [userID, userID]);

    const normalized = result.map((r) => ({
      ...r,
      reminder_date: new Date(`${r.reminder_date}Z`).toISOString(),
    }));
    return normalized;
  } catch (error) {
    console.error('Error in getAllRemindersByUserID:', error);
    throw new Error('Failed to fetch reminders for user');
  }
}

// GET A SINGLE REMINDER
async function getReminderByID(reminder_id, accessing_user_id) {
  try {
    const sql = `
      SELECT r.* FROM REMINDER r
      LEFT JOIN COLLABORATION c ON c.main_user_id = r.user_id
      LEFT JOIN USER_COLLABORATION uc ON uc.collaboration_id = c.collaboration_id
      WHERE r.reminder_id = ? 
      AND (
        r.created_by_user_id = ? 
        OR r.user_id = ?
        OR uc.user_id = ?
      )
      LIMIT 1
    `;
    const [result] = await pool.query(sql, [
      reminder_id,
      accessing_user_id,
      accessing_user_id,
      accessing_user_id,
    ]);

    if (!result[0]) return null;

    const row = {
      ...result[0],
      reminder_date: new Date(`${result[0].reminder_date}Z`).toISOString(),
    };
    return row;
  } catch (error) {
    console.error('Error in the function getReminderByID:', error);
    throw new Error('Failed to fetch reminder by ID');
  }
}

// CREATE A NEW REMINDER for a specific user id
async function createReminder(title, description, reminder_date, created_by_user_id, repeat_interval, target_user_id) {
  try {
    const utcIso = new Date(reminder_date).toISOString();          // true UTC
    const storeValue = utcIso.slice(0, 19).replace('T', ' ');      // DATETIME in UTC
    const [result] = await pool.query(
      `INSERT INTO REMINDER 
       (title, description, reminder_date, created_by_user_id, user_id, memory_id, repeat_interval)
       VALUES (?, ?, ?, ?, ?, NULL, ?)`,
      [title, description, storeValue, created_by_user_id, target_user_id, repeat_interval]
    );
    return getReminderByID(result.insertId, created_by_user_id);
  } catch (error) {
    console.error('Error in the function createReminder:', error);
    throw new Error('Failed to create a new reminder');
  }
}

// UPDATE A USER'S REMINDER
async function updateReminder(reminder_id, title, description, reminder_date, repeat_interval, accessing_user_id) {
  try {
    const formattedDate = new Date(reminder_date).toISOString().slice(0, 19).replace('T', ' ');
    const sql = `
      UPDATE REMINDER r
      LEFT JOIN COLLABORATION c ON c.main_user_id = r.user_id
      LEFT JOIN USER_COLLABORATION uc ON uc.collaboration_id = c.collaboration_id
      SET r.title = ?, r.description = ?, r.reminder_date = ?, r.repeat_interval = ?
      WHERE r.reminder_id = ? 
      AND (
        r.created_by_user_id = ? 
        OR r.user_id = ?
        OR uc.user_id = ? 
      )
    `;
    const [result] = await pool.query(sql, [
      title,
      description,
      formattedDate,
      repeat_interval,
      reminder_id,
      accessing_user_id,
      accessing_user_id,
      accessing_user_id,
    ]);

    if (result.affectedRows === 0) return null;
    return getReminderByID(reminder_id, accessing_user_id);
  } catch (error) {
    console.error('Error in the function updateReminder:', error);
    throw new Error('Failed to update reminder');
  }
}

// DELETE A USER'S REMINDER
// DELETE A REMINDER
// Updated to allow Creator, Target, OR Collaborator to delete
async function deleteReminder(reminder_id, accessing_user_id) {
    try {
        const sql = `
            DELETE r
            FROM REMINDER r
            LEFT JOIN COLLABORATION c ON c.main_user_id = r.user_id
            LEFT JOIN USER_COLLABORATION uc ON uc.collaboration_id = c.collaboration_id
            WHERE r.reminder_id = ? 
            AND (
                r.created_by_user_id = ? 
                OR r.user_id = ?
                OR uc.user_id = ? 
            )
        `;
        
        const [result] = await pool.query(sql, [
            reminder_id, 
            accessing_user_id, 
            accessing_user_id, 
            accessing_user_id
        ]);
        
        return result;
    } catch (error) {
        console.error('Error in deleteReminder:', error);
        throw new Error('Failed to delete reminder');
    }
}

async function toggleReminderStatus(reminder_id, accessing_user_id, is_active, notification_id) {
    try {
        // Allow update if user is the creator OR the target (owner) of the reminder
        const [result] = await pool.query(
            `UPDATE REMINDER 
             SET is_active = ?, notification_id = ? 
             WHERE reminder_id = ? 
             AND (created_by_user_id = ? OR user_id = ?)`,
            [is_active, notification_id, reminder_id, accessing_user_id, accessing_user_id]
        );

        if (result.affectedRows === 0) {
            return null; // Reminder not found or doesn't belong to user
        }

        return { success: true, reminder_id, is_active };
    } catch (error) {
        console.error('Error in toggleReminderStatus:', error);
        throw new Error('Failed to toggle reminder status');
    }
}

// END OF REMINDER FUNCTIONS
module.exports = {
    getAllRemindersByUserID,
    getReminderByID,
    createReminder,
    updateReminder,
    deleteReminder,
    toggleReminderStatus
}