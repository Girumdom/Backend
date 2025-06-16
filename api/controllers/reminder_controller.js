const { getAllReminders, getAllRemindersByUserID, getReminderByID, createReminder, updateReminder, deleteReminder } = require('../connections/reminder');
const express = require('express');
const router = express.Router();

router.use(express.json());

router.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// GET /reminder/user/:user_id - GET ALL REMINDERS FOR A USER
router.get('/user/:user_id', async (req, res) => {
    try {
        const reminders = await getAllRemindersByUserID(req.params.user_id);
        res.status(200).json(reminders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /reminder/:reminder_id/user/:user_id - GET A SINGLE REMINDER BY ID USING USER ID
router.get('/:reminder_id/user/:user_id', async (req, res) => {
    try {
        const reminder = await getReminderByID(req.params.reminder_id, req.params.user_id);
        if (!reminder) {
            return res.status(404).json({ error: 'Reminder not found' })
        } else {
            res.status(200).json(reminder);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /reminder - CREATE A NEW REMINDER for a specific user
router.post('/', async (req, res) => {
    try {
        const { title, description, reminder_date, created_by_user_id } = req.body;

        // Validate required fields
        if (!created_by_user_id) {
            return res.status(400).json({
                error: "created_by_user_id is required",
                received_data: req.body
            });
        }
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
    }
});

// PUT /reminder/:reminder_id - UPDATE A USER'S REMINDER
router.put('/:reminder_id', async (req, res) => {
    try {
        const { title, description, reminder_date } = req.body; // Extract title, description, and reminder_date from request body
        const { reminder_id } = req.params; // Extract reminder_id from request parameters
        const { created_by_user_id } = req.user.id; //
        const updatedReminder = await updateReminder(reminder_id, title, description, reminder_date, created_by_user_id);

        if (!updateReminder) {
            return res.status(404).json({ error: 'Reminder not found or does not belong to the user' });
        }

        res.status(200).json(updatedReminder);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;