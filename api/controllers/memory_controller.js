const { getMemory, getMemoryByID, createMemory, updateMemory, deleteMemory } = require('../connections/memory');
const express = require('express');
const router = express.Router(); 

router.use(express.json());

router.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

//GET ALL MEMORY
router.get('/', async (req, res) => {
    const memories = await getMemory();
    res.send(memories);
});

//GET SINGLE MEMORY
router.get('/:id', async (req, res) => {
    const id = req.params.id;
    const memory = await getMemoryByID(id);
    res.send(memory);
});

// CREATE or ADD A NEW MEMORY
router.post('/', async (req, res) => {
    const { title, content, user_id, creator_id } = req.body; 
    try {
        const memory = await createMemory(title, content, user_id, creator_id);
        res.status(201).send(memory); // HTTP 201 for "Created"
    } catch (error) {
        console.error("Error creating memory:", error);
        res.status(500).send({ error: "Failed to create memory" });
    }
});

//UPDATE AN EXISTING MEMORY
router.put('/:id', async (req, res) => {
    const id = req.params.id;
    const { title, content, user_id, creator_id } = req.body; 
    try {
        const memory = await updateMemory(id, title, content, user_id, creator_id);
        res.status(200).send(memory);
    } catch (error) {
        console.error("Error updating memory:", error);
        res.status(500).send({ error: "Failed to update memory" });
    }
});

//DELETE or REMOVE AN EXISTING MEMORY
router.delete('/:id', async(req, res) => {
    const id = req.params.id;
    await deleteMemory(id);
    res.send('Memory successfully deleted.');
});

module.exports = router;