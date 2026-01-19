const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getUserByEmail, getUserByUsername, createUser, deleteResetTokens, saveResetToken, getResetToken, updateUserPassword } = require('../connections/users');
const { createDefaultCollaboration } = require('../connections/collaboration_functions');
const sendEmail = require('../utils/sendEmail');
const router = express.Router();

router.use(express.json());

// USER SIGNUP - CREATE A NEW USER ACCOUNT - /api/auth/signup
router.post('/signup', async (req, res) => {
    try {
        const { email, password, fullname, role } = req.body;

        // Validate required fields
        if (!email || !password || !fullname || !role) {
            return res.status(400).json({ error: "All fields are required" });
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
        const user = await createUser(email, passwordHash, fullname, role);
        if (!user) {
            throw new Error("User creation returned null");
        }

        // If the new user is a Senior, give them a collaboration immediately
        if (role === 'Elderly') {
            console.log("Senior role detected. Creating default collaboration...");
            
            // Ensure we use the correct ID. 
            // Check if your createUser returns 'user_id' or 'id' or 'insertId'
            const userIdToUse = user.user_id || user.id || user.insertId;
            
            await createDefaultCollaboration(userIdToUse, fullname);
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
            { expiresIn: '15m' } // Token expiration time
        );

        // Respond with the token and user information
        res.status(200).json({
            message: 'Login successful',
            token: token,
            user: {
                user_id: user.user_id || user.id,
                email: user.email,
                profile_picture: user.profile_picture,
                fullname: user.fullname,
                role: user.role,
                memory_count: user.memory_count || 0,
                collaboration_count: user.collaboration_count || 0,
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

// FORGOT PASSWORD - /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required.' });
        }

        // check if user exists
        const user = await getUserByEmail(email);

        if (!user) {
            return res.status(404).json({ message: 'If that email exists, a code has been sent.' });
        }

        const userId = user.user_id;

        // clean up the old tokens for the user
        await deleteResetTokens(userId);

        // generate a 6-digit code and expiration time
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now

        // save the reset token to the database
        await saveResetToken(userId, resetCode, expiresAt);

        // send an email to the user with the reset code
        const message = `Your password reset code is: ${resetCode}. This code will expire in 15 minutes.`;
        await sendEmail(user.email, 'Girumdom Password Reset Code', message);

        res.status(200).json({ message: 'If that email exists, a code has been sent.' });

    } catch (error) {
        console.error("Forgot Password error:", {
            message: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Failed to process the request. Please try again later.' });
    }
});

// RESET PASSWORD - /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;

        if (!email || !code || !newPassword) {
            return res.status(400).json({ error: 'All fields are required.' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'Password must atleast be 8 characters long' });
        }

        // find the user by email ot get the id
        const user = await getUserByEmail(email);
        if (!user) {
            return res.status(400).json({ error: 'Invalid request' });
        }

        const userId = user.user_id;

        // validate the reset token, check if it matches and is not expired
        const validToken = await getResetToken(userId, code);

        if (!validToken) {
            return res.status(400).json({ error: 'Invalid or expired code.' });
        }

        // hash the new password
        const passwordHash = await bcrypt.hash(newPassword, 10);

        // update the user's password
        await updateUserPassword(userId, passwordHash);

        // delete the used reset tokens
        await deleteResetTokens(userId);

        res.status(200).json({ message: 'Password reset successfully!' });

    } catch (error) {
        console.error("Reset Password error:", {
            message: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Failed to reset password. Please try again later.' });
    }
});

module.exports = router;