const { getMemoryByUserID, getMemoryByID, createMemory, updateMemory, deleteMemory } = require('../connections/memory');
const { getImagesByMemoryID } = require('../connections/photoImage');
const express = require('express');
const router = express.Router(); 
const verifyToken = require('../middleware/auth');

router.use(express.json());

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
        const { memory_id } = req.params; // extract the memory id from request parameters
        const loggedInUserID = req.user.user_id; // get the user ID from the token

        const memory = await getMemoryByID(memory_id, loggedInUserID);

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

router.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

module.exports = router;