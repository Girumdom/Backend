const { getMemory, getMemoryByUserID, getMemoryByID, createMemory, updateMemory, deleteMemory } = require('../connections/memory');
const { getImagesByMemoryID } = require('../connections/photoImage');
const express = require('express');
const router = express.Router(); 

router.use(express.json());

router.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

async function enrichMemoryWithImages(memory) {
    if (Array.isArray(memory)) {
        for (const m of memory) {
            m.images = await getImagesByMemoryID(m.memory_id);
        }
    } else {
        memory.images = await getImagesByMemoryID(memory.memory_id);
    }
    return memory;
}

//GET /memory/user/:user_id - GET ALL USER'S EXISTING MEMORY
router.get('/user/:user_id', async(req, res) => {
    try {
        const user_id = req.params.user_id;
        const memories = await getMemoryByUserID(user_id);

        const memoryWithImages = await enrichMemoryWithImages(memories);
        res.status(200).json(memoryWithImages);
    } catch (error) {
        console.error("Failed to fetch user's memories:", error);
        res.status(500).json({ message: error.message });
    }
});

// GET /memory - GET ALL MEMORY
router.get('/', async (req, res) => {
    const memories = await getMemory();
    const memoryWithImages = await enrichMemoryWithImages(memories);
    res.send(memoryWithImages);
});

//GET /memory/:id - GET A SINGLE MEMORY
router.get('/:id', async (req, res) => {
    try {
        const memory = await getMemoryByID(req.params.id);
        if (!memory) return res.status(404).json({ error: 'Memory not found' });

        const memoryWithImages = await enrichMemoryWithImages(memory);
        res.status(200).json(memoryWithImages)
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST /memory - CREATE or ADD A NEW MEMORY
router.post('/', async (req, res) => {
    try {
        const { title, content, user_id, creator_id, date_of_event } = req.body; 
        const memory = await createMemory(title, content, user_id, creator_id, date_of_event);
        res.status(200).send(memory);
    } catch (error) {
        console.error("Error creating memory:", error);
        res.status(500).send({ error: "Failed to create memory" });
    }
});

// PUT /memory/:id - UPDATE AN EXISTING MEMORY
router.put('/:id', async (req, res) => {
    try {
        const { title, content, date_of_event } = req.body; 
        const memory = await updateMemory(req.params.id, title, content, date_of_event);
        res.status(200).send(memory);
    } catch (error) {
        console.error("Error updating memory:", error);
        res.status(500).send({ error: "Failed to update memory" });
    }
});

// DELETE /memory/:id - DELETE or REMOVE AN EXISTING MEMORY
router.delete('/:id', async(req, res) => {
    try {
        await deleteMemory(req.params.id);
        res.status(200).json({ message: 'Memory deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;