const { getAllUsers, getUserByID, getUserByEmail, getUserByUsername, createUser, updateUser } = require('../connections/users');
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const verifyToken = require('../middleware/auth');

router.use(express.json());
router.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// GET /user - GET ALL USERS
router.get('/', async (req, res) => {
    try {
        const users = await getAllUsers();
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /user/:user_id - GET A SINGLE USER BY THEIR ID
router.get('/:user_id', verifyToken, async (req, res) => {
    try {
        const user = await getUserByID(req.params.user_id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /user - CREATE A NEW USER ACCOUNT
router.post('/', async (req, res) => {
    try {
        const { email, password, username, user_type } = req.body;

        // Validate required fields
        if (!email || !password || !username || !user_type) {
            return res.status(400).json({
                error: "Email, Password, Username, and User Type are required",
                received_data: req.body
            });
        }

        // password strength validation
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long' });
        }

        // Check if user already exists by email or username
        const existingUserEmail = await getUserByEmail(email);
        const existingUsername = await getUserByUsername(username);

        if (existingUserEmail) {
            return res.status(409).json({ error: 'User with this email already exists' });
        }
        else if (existingUsername) {
            return res.status(409).json({ error: 'User with this username already exists' });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const user = await createUser(email, passwordHash, username, user_type);
        if (!user) {
            throw new Error("User creation returned null");
        }
        res.status(201).json({
            user_id: user.user_id || user.id,
            email: user.email,
            username: user.username,
            user_type: user.user_type
        });

    } catch (error) {
        console.error("User creation error:", {
            message: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Failed to create user account' });
    }
});

// PUT /user/:user_id - UPDATE AN EXISTING USER ACCOUNT
router.put('/:user_id', verifyToken, async (req, res) => {
    try {
        const { email, password_hash, username } = req.body;
        const updatedUser = await updateUser(req.params.user_id, email, password_hash, username);

        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found or no changes made' });
        }

        res.status(200).json({
            user_id: updatedUser.user_id || updatedUser.id,
            email: updatedUser.email,
            username: updatedUser.username,
            user_type: updatedUser.user_type
        });

    } catch (error) {
        console.error("User update error:", {
            message: error.message,
            stack: error.stack,
            body: req.body
        });
        res.status(500).json({ error: error.message });
    }
});

// DELETE /user/:user_id - DELETE A USER ACCOUNT
router.delete('/:user_id', verifyToken, async (req, res) => {
    try {
        const user = await getUserByID(req.params.user_id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        await deleteUser(req.params.user_id);
        res.status(200).json({ message: 'User was deleted successfully' });

    } catch (error) {
        console.error("User deletion error:", {
            message: error.message,
            stack: error.stack,
            body: req.body
        });
        res.status(500).json({ error: error.message });
    }
})

module.exports = router;