const { getMemoryByUserID, getMemoryByID, createMemory, updateMemory, deleteMemory, getMemoryByIdShared } = require('../connections/memory');
const { getImagesByMemoryID } = require('../connections/photoImage');
const express = require('express');
const router = express.Router(); 
const { createImage } = require('../connections/photoImage');
const verifyToken = require('../middleware/auth');
const { createMemoryTTS } = require('../connections/tts');
const { getVoiceByID, getUserByID } = require('../connections/users');
const { transcribeAudio } = require('../connections/voiceEngine');
const { uploadAudio } = require('../middleware/uploadAudio');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

router.use(express.json());

// POST - /api/memory/transcribe
router.post('/transcribe', verifyToken, uploadAudio.single('audio_file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No audio file provided" });

        // 1. Upload temp file to Cloudinary (Whisper needs a URL)
        // We use resource_type: "video" because Cloudinary treats audio as video
        const result = await cloudinary.uploader.upload(req.file.path, {
            resource_type: "video", 
            folder: "temp_transcription",
        });

        // 2. Call the AI Model
        const text = await transcribeAudio(result.secure_url);

        // 3. Cleanup (Delete temp files)
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        // Optional: Delete from Cloudinary to save space, or keep as a log
        await cloudinary.uploader.destroy(result.public_id, { resource_type: 'video' });

        // 4. Send text back to Frontend
        res.json({ text: text });

    } catch (error) {
        // Cleanup local file on error
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: "Transcription failed" });
    }
});

async function enrichMemoryWithImages(memory) {
    if (!memory) return null;

    if (Array.isArray(memory)) {
        for (const m of memory) {
            m.images = await getImagesByMemoryID(m.memory_id);
        }
    } else {
        memory.images = await getImagesByMemoryID(memory.memory_id);
    }
    return memory;
}

//GET /memory - FETCH ALL USER'S EXISTING MEMORY
router.get('/', verifyToken, async(req, res) => {
    try {
        const loggedInUserID = req.user.user_id; // get the user ID from the token
        const memories = await getMemoryByUserID(loggedInUserID);

        const memoryWithImages = await enrichMemoryWithImages(memories);
        res.status(200).json(memoryWithImages);
    } catch (error) {
        console.error("Failed to fetch user's memories:", error);
        res.status(500).json({ message: error.message });
    }
});

//GET /memory/:memory_id - FETCH A SINGLE MEMORY
router.get('/:memory_id', verifyToken, async (req, res) => {
    try {
        const { memory_id } = req.params; 
        const loggedInUserID = req.user.user_id; // get the user ID from the token

        const memory = await getMemoryByIdShared(memory_id, loggedInUserID);

        if (!memory) {
            return res.status(404).json({ error: 'Memory not found or you do not have the permission to view it.' });
        }

        const memoryWithImages = await enrichMemoryWithImages(memory);
    
        res.status(200).json(memoryWithImages)
    } catch (error) {
        res.status(500).json({ message: 'Failed to retrieve memory.' });
    }
});

// POST /memory - CREATE or ADD A NEW MEMORY
router.post('/', verifyToken, async (req, res) => {
    try {
        const { title, content, date_of_event } = req.body; 
        const creator_id = req.user.user_id;
        const user_id = req.body.user_id || creator_id

        if (!title || !content || !date_of_event) {
            return res.status(400).json({
                error: "Title, Content, and Date of Event are required",
                received_data: req.body
            });
        }

        const memory = await createMemory(title, content, user_id, creator_id, date_of_event);
        if (!memory) {
            throw new Error("Memory creation returned null");
        }

        res.status(201).json({
            memory_id : memory.memory_id || memory.id,
            title : memory.title,
            date_of_event : memory.date_of_event,
            user_id : memory.user_id,
            creator_id : memory.creator_id
        });
    } catch (error) {
        console.error("Error creating memory:", error);
        res.status(500).send({ error: "Failed to create memory" });
    }
});

// PUT /memory/:memory_id - UPDATE A USER'S EXISTING MEMORY
router.put('/:memory_id', verifyToken, async (req, res) => {
    try {
        const { title, content, date_of_event } = req.body; // extract title, content, and date of event from request body
        const { memory_id } = req.params; // extract memory_id from request parameters
        const loggedInUserID = req.user.user_id; 

        if (!title || !content || !date_of_event) {
            return res.status(400).json({ error: 'All fields (title, content, date_of_event) are required for update.' });
        }

        const updatedMemory = await updateMemory(memory_id, title, content, date_of_event, loggedInUserID);
        
        if (!updatedMemory) {
            return res.status(404).json({ error: 'Memory not found or does not beling to the user' });
        }

        res.status(200).send(updatedMemory);
    } catch (error) {
        console.error("Error updating memory:", error);
        res.status(500).send({ error: "Failed to update memory" });
    }
});

// DELETE /memory/:memory_id - DELETE or REMOVE AN EXISTING MEMORY
router.delete('/:memory_id', verifyToken, async(req, res) => {
    try {
        const { memory_id } = req.params;
        const loggedInUserID = req.user.user_id;

        const result = await deleteMemory(memory_id, loggedInUserID);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Memory not found or you do not have the permission to delete it.' });
        }

        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete memory.' });
    }
});

// POST /memory/create-with-audio
router.post('/create-with-audio', verifyToken, async (req, res) => {
    try {
        // 1. FIX: Extract image_urls from req.body
        const { title, content, date_of_event, voice_settings, image_urls } = req.body; 
        const creator_id = req.user.user_id;
        const user_id = req.body.user_id || creator_id; 

        if (!title || !content || !date_of_event) {
            return res.status(400).json({ error: "Title, Content, and Date are required" });
        }

        // 2. Create the Memory Record
        const memory = await createMemory(title, content, user_id, creator_id, date_of_event);
        
        if (!memory) {
            throw new Error("Memory creation failed in database");
        }

        const memoryId = memory.memory_id || memory.id;

        // 3. Save the Image URLs to the Database
        if (image_urls && Array.isArray(image_urls) && image_urls.length > 0) {
            try {
                // Map the array of URL strings into the objects createImages expects
                const imageDataArray = image_urls.map(url => {
                    return {
                        filename: url.split('/').pop() || 'cloudinary_image.jpg', // Extract the file name from the end of the URL
                        file_path: url,
                        file_size: 0, // Since it's stored on Cloudinary, you can default this to 0
                        memory_id: memoryId,
                        user_id: user_id // The variable you declared at the top of your route
                    };
                });
                
                // Execute the bulk insert
                await createImages(imageDataArray);
                console.log(`Successfully saved ${image_urls.length} images for Memory ${memoryId}`);
                
            } catch (imageError) {
                console.error("Failed to save image URLs to database:", imageError);
                // Depending on your app's needs, you might want to return a 500 error here 
                // if image saving is strictly mandatory.
            }
        }

        // 4. Handle Audio / Voice Cloning (Fire and Forget)
        if (content && voice_settings) {
            (async () => {
                try {
                    let targetVoiceUrl = null;

                    if (voice_settings.use_cloned_voice) {
                         if (voice_settings.voice_id) {
                             const voiceRecord = await getVoiceByID(voice_settings.voice_id);
                             if (voiceRecord) {
                                 targetVoiceUrl = voiceRecord.sample_url;
                                 console.log(`[TTS] Using library voice: ${voiceRecord.voice_name}`);
                             }
                         } 
                         
                         if (!targetVoiceUrl) {
                             const user = await getUserByID(creator_id);
                             if (user && user.voice_sample_url) {
                                 console.log(`[TTS] Using fallback profile voice for User ${creator_id}`);
                                 targetVoiceUrl = user.voice_sample_url;
                             } else {
                                 console.warn(`[TTS] No voice found for User ${creator_id}. Cloning impossible.`);
                             }
                         }
                    } 
                    
                    await createMemoryTTS(
                        memoryId, 
                        content, 
                        creator_id,
                        targetVoiceUrl, 
                        voice_settings.language_code
                    );
                    console.log(`Audio generation started for Memory ${memoryId}`);

                } catch (bgError) {
                    console.error(`Background Audio Error for Memory ${memoryId}:`, bgError);
                }
            })();
        }

        res.status(201).json({ 
            message: "Memory created successfully", 
            memory_id: memoryId 
        });

    } catch (error) {
        console.error("Create With Audio Error:", error);
        res.status(500).json({ error: "Failed to create memory" });
    }
});

router.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

module.exports = router;