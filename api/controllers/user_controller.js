const { 
    getAllUsers, getUserByID, 
    getUserByEmail, createUser, 
    updateUser, updateUserPFP,
    updateUserVoiceUrl, addUserVoice, getUserVoices
} = require('../connections/users');

const { uploadAudio } = require('../middleware/uploadAudio');
const { cloudinary } = require('../connections/cloudinary');
const fs = require('fs');
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

// GET /user/voices - FETCH ALL VOICES FOR THE LOGGED IN USER
router.get('/voices', verifyToken, async (req, res) => {
    try {
        const voices = await getUserVoices(req.user.user_id);
        res.status(200).json(voices);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch voices" });
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
        const { email, password, user_type, fullname, role } = req.body;

        // Validate required fields
        if (!email || !password || !user_type || !fullname || !role) {
            console.error("Missing required fields:", req.body);
            return res.status(400).json({
                error: "Email, Password, User Type, Fullname, and Role are required",
                received_data: req.body
            });
        }

        // password strength validation
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

// PUT /user/:user_id - UPDATE AN EXISTING USER ACCOUNT
router.put('/:user_id', verifyToken, async (req, res) => {
    try {
        const { email, password_hash, fullname } = req.body;
        const updatedUser = await updateUser(req.params.user_id, email, password_hash, fullname);

        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found or no changes made' });
        }

        res.status(200).json({
            user_id: updatedUser.user_id || updatedUser.id,
            email: updatedUser.email,
            fullname: updatedUser.fullname,
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

// PATCH /user/:user_id/profile-picture - UPDATE USER PROFILE PICTURE
router.patch('/:user_id/profile-picture', verifyToken, async (req, res) => {
    try {
        const { user_id } = req.params;
        const { profile_picture } = req.body;

        if (req.user.user_id !== parseInt(user_id)) {
            return res.status(403).json({ error: 'Unauthorized Access. You can only update your own profile.' });
        }
        if (!profile_picture) {
            return res.status(400).json({ error: 'Profile picture URL is required' });
        }

        await updateUserPFP(user_id, profile_picture);

        res.status(200).json({ message: 'Profile picture updated successfully' });
    } catch (error) {
        console.error("Error updating profile picture:", error);
        res.status(500).json({ error: 'Failed to update profile picture' });
    }
})

// POST /user/voice-sample - UPLOAD A NEW NAMED VOICE
router.post('/voice-sample', verifyToken, uploadAudio.single('voice_file'), async (req, res) => {
    try {
        const userId = req.user.user_id;
        // Default to "My Voice" if frontend sends nothing
        const voiceName = req.body.voice_name || "My Voice"; 

        if (!req.file) {
            return res.status(400).json({ error: "No voice file provided" });
        }

        console.log(`[Voice Upload] User ${userId} is uploading "${voiceName}"...`);

        // 1. Upload to Cloudinary
        const result = await cloudinary.uploader.upload(req.file.path, {
            resource_type: "video", 
            folder: "girumdom_voices",
            public_id: `voice_${userId}_${Date.now()}`,
            format: "wav"
        });

        const voiceUrl = result.secure_url;
        console.log(`[Voice Upload] Cloudinary URL: ${voiceUrl}`);

        // 2. Save to USER_VOICES Table (The Library)
        // We use try/catch so if this fails, we still try to update the main profile
        try {
            await addUserVoice(userId, voiceName, voiceUrl);
            console.log(`[Voice Upload] Saved to USER_VOICES table.`);
        } catch (dbError) {
            console.error(`[Voice Upload] WARNING: Failed to save to USER_VOICES:`, dbError.message);
        }

        // 3. Save to USERS Table (The Primary Voice)
        // This ensures compatibility with older parts of your app
        await updateUserVoiceUrl(userId, voiceUrl);
        console.log(`[Voice Upload] Updated USERS table profile.`);

        // 4. Cleanup
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

        res.status(200).json({ 
            message: "Voice sample saved successfully", 
            voice_sample_url: voiceUrl 
        });

    } catch (error) {
        console.error("[Voice Upload] CRITICAL ERROR:", error);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: "Failed to save voice sample" });
    }
});

module.exports = router;