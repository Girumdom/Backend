const { getAllRemindersByUserID, getReminderByID, createReminder, updateReminder, deleteReminder, toggleReminderStatus } = require('../connections/reminder');
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

// POST /api/reminders - CREATE A NEW REMINDER
router.post('/', verifyToken, async (req, res) => {
    try {
        const { title, description, reminder_date } = req.body;
        const repeat_interval = req.body.repeat_interval || 'never';
        
        // 1. Identify the Author
        const author_id = req.user.user_id; 

        // 2. Identify the Target
        // If 'assigned_to_id' is sent (from Web), use it. 
        // Otherwise, default to the author (Self-assignment for Mobile).
        const target_id = req.body.assigned_to_id || author_id;

        // Validation for repeat interval
        const allowedIntervals = ['never', 'daily', 'weekly'];
        if (!allowedIntervals.includes(repeat_interval)) {
            return res.status(400).json({ error: `Invalid repeat_interval. Must be one of: ${allowedIntervals.join(', ')}` });
        }

        if (!title || !reminder_date) {
            return res.status(400).json({
                error: "title and reminder_date are required",
                received_data: req.body
            });
        }

        // 3. Call the updated function with BOTH IDs
        const reminder = await createReminder(
            title, 
            description, 
            reminder_date, 
            author_id,      // Created By
            repeat_interval,
            target_id       // User ID (Target)
        );

        if (!reminder) {
            throw new Error("Reminder creation returned null");
        }

        res.status(201).json(reminder);
        
    } catch (error) {
        console.error("Reminder creation error:", {
            error: error.message,
            stack: error.stack,
            body: req.body
        });
        res.status(500).json({ error: 'Failed to create reminder' });
    }
});

// PUT /reminders/:reminder_id - UPDATE A USER'S REMINDER
router.put('/:reminder_id', verifyToken, async (req, res) => {
    try {
        const { reminder_id } = req.params;
        // Extract all fields, defaulting repeat_interval if missing
        const { title, description, reminder_date } = req.body;
        const repeat_interval = req.body.repeat_interval || 'never'; 

        const loggedInUserID = req.user.user_id; 

        // Call the updated function
        const updatedReminder = await updateReminder(
            reminder_id, 
            title, 
            description, 
            reminder_date, 
            repeat_interval, 
            loggedInUserID // Pass this as 'accessing_user_id'
        );

        if (!updatedReminder) {
            return res.status(403).json({ error: 'Reminder not found or permission denied.' });
        }

        res.status(200).json(updatedReminder);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /reminders/:reminder_id - DELETE A USER'S REMINDER
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
});

// PATCH - api/reminders/:reminder_id/toggle - Toggle the repeat interval of a reminder
router.patch('/:reminder_id/toggle', verifyToken, async (req, res) => {
    const reminderId = req.params.reminder_id;
    const { is_active, notification_id } = req.body;
    const accessingUserId = req.user.user_id;

    // validation
    if (typeof is_active === 'undefined') {
        return res.status(400).json({ error: 'is_active field is required' });
    }

    try {
        // Pass accessing_user_id instead of created_by_user_id
        const result = await toggleReminderStatus(reminderId, accessingUserId, is_active, notification_id);

        if (!result) {
            return res.status(404).json({ error: 'Reminder not found or does not belong to the user' });
        }

        res.json({
            message: 'Reminder status updated successfully',
            updateFields: { is_active, notification_id }
        });

    } catch (error) {
        console.error('Toggle API Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

module.exports = router;