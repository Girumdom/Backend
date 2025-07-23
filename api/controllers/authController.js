const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getUserByEmail, getUserByUsername, createUser } = require('../connections/users');
const router = express.Router();

router.use(express.json());

// USER SIGNUP - CREATE A NEW USER ACCOUNT - /api/auth/signup
router.post('/signup', async (req, res) => {
    try {
        const { email, password, user_type, fullname, role } = req.body;

        // Validate required fields
        if (!email || !password || !user_type || !fullname || !role) {
            return res.status(400).json({
                error: "Email, Password, User Type, Fullname, and Role are required",
                received_data: req.body
            });
        }

        // Password strength validation
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long' });
        }

        // Check if user already exists by email or username
        const existingUserEmail = await getUserByEmail(email);
        if (existingUserEmail) {
            return res.status(409).json({ error: 'User with this email already exists' });
        } 

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await createUser(email, passwordHash, user_type, fullname, role);
        if (!user) {
            throw new Error("User creation returned null");
        }
        res.status(201).json({
            user_id: user.user_id || user.id,
            email: user.email,
            user_type: user.user_type,
            fullname: user.fullname,
            role: user.role
        });
    } catch (error) {
        console.error("User creation error:", {
            message: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Failed to create user account' });
    }
});

// USER LOGIN - /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and Password are required' });
        }

        // Find the user in the database
        const user = await getUserByEmail(email);
        // check if user exists
        if (!user) { 
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Compare the provided password with the stored password hash
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) { 
            // password does not match
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const payload = { //
            user_id: user.user_id || user.id,
            email: user.email,
        }

        // Generate a JWT token
        const token = jwt.sign(
            payload,
            process.env.JWT_SECRET_KEY, 
            { expiresIn: '1h' } // Token expiration time
        );

        // Respond with the token and user information
        res.status(200).json({
            message: 'Login successful',
            token: token,
            user: {
                user_id: user.user_id || user.id,
                email: user.email,
                username: user.username,
                user_type: user.user_type
            }
        });

    } catch (error) {
        console.error("Login error:", {
            message: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Failed to login' });
    }
});

module.exports = router;