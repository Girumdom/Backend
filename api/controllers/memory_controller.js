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
router.post('/', async(req, res) => {
    const { memory_id, title, content, created_at, updated_at, user_id, creator_id } = req.body;
    const memory = await createMemory(memory_id, title, content, created_at, updated_at, user_id, creator_id);
    res.send(memory);
});

//UPDATE AN EXISTING MEMORY
router.put('/:id', async(req, res) => {
    const id = req.params.id;
    const { title, content, created_at, updated_at, user_id, creator_id } = req.body;
    const memory = await updateMemory(id, title, content, created_at, updated_at, user_id, creator_id);
    res.send(memory);
});

//DELETE or REMOVE AN EXISTING MEMORY
router.delete('/:id', async(req, res) => {
    const id = req.params.id;
    await deleteMemory(id);
    res.send('Memory successfully deleted.');
});

module.exports = router;