const { getAllRemindersByUserID, getReminderByID, createReminder, updateReminder, deleteReminder } = require('../connections/reminder');
const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');

router.use(express.json());

// GET /reminders - Fetch all reminders for the logged-in user
router.get('/', verifyToken, async (req, res) => {
    try {
        const loggedInUserID = req.user.user_id; // Get the user ID from the token

        const reminders = await getAllRemindersByUserID(loggedInUserID);
        res.status(200).json(reminders);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve reminders.' });
    }
});

// GET /reminders/:reminder_id - GET A SINGLE REMINDER BY ID
router.get('/:reminder_id', verifyToken, async (req, res) => {
    try {
        const { reminder_id } = req.params; // Extract reminder_id from request parameters
        const loggedInUserID = req.user.user_id; // Get the user ID from the token

        const reminder = await getReminderByID(reminder_id, loggedInUserID);

        if (!reminder) {
            return res.status(404).json({ error: 'Reminder not found or you do not have the permission to view it.' });
        }

        res.status(200).json(reminder);

    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve reminder.' });
    }
});

// POST /reminders - CREATE A NEW REMINDER for a specific user
router.post('/', verifyToken, async (req, res) => {
    try {
        const { title, description, reminder_date } = req.body;

        const created_by_user_id = req.user.user_id; // Get the user ID from the token


        if (!title || !reminder_date) {
            return res.status(400).json({
                error: "title and reminder_date are required",
                received_data: req.body
            });
        }
        const reminder = await createReminder(title, description, reminder_date, created_by_user_id);

        if (!reminder) {
            throw new Error("Reminder creation returned null");
        }

        res.status(201).json({
            reminder_id: reminder.reminder_id || reminder.id,
            title: reminder.title,
            description: reminder.description,
            reminder_date: reminder.reminder_date,
            created_by_user_id: reminder.created_by_user_id
        });
    } catch (error) {
        console.error("Reminder creation error:", {
            error: error.message,
            stack: error.stack,
            body: req.body
        });
        res.status(500).json({ error: 'Failed to create reminder' });
    }
});

// PUT /reminder/:reminder_id - UPDATE A USER'S REMINDER
router.put('/:reminder_id',  verifyToken, async (req, res) => {
    try {
        const { title, description, reminder_date } = req.body; // Extract title, description, and reminder_date from request body
        const { reminder_id } = req.params; // Extract reminder_id from request parameters

        const created_by_user_id = req.user.user_id; //
        const updatedReminder = await updateReminder(reminder_id, title, description, reminder_date, created_by_user_id);

        if (!updatedReminder) {
            return res.status(404).json({ error: 'Reminder not found or does not belong to the user' });
        }

        res.status(200).json(updatedReminder);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /reminder/:reminder_id - DELETE A USER'S REMINDER
router.delete('/:reminder_id', verifyToken, async (req, res) => {
    try {
        const { reminder_id } = req.params; // Extract reminder_id from request parameters
        const loggedInUserID = req.user.user_id; // Get the user ID from the token

        const result = await deleteReminder(reminder_id, loggedInUserID);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Reminder not found or you do not have the permission to delete it.' });
        }

        res.status(204).send();

    } catch (error) {
        res.status(500).json({ error: 'Failed to delete reminder.' });
    }
})

router.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

module.exports = router;