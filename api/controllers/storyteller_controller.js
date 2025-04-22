const { getStory, getStorytellersByUserID, getStoryByID, createStory, updateStory, deleteStory } = require('../connections/storyteller');
const express = require('express');
const router = express.Router();

router.use(express.json());

router.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// GET /storyteller/user/:user_id - GET ALL STORYTELLERS FOR A USER
router.get('/user/:user_id', async (req, res) => {
    try {
        const storyteller = await getStorytellersByUserID(req.params.user_id);
        res.status(200).json(storyteller);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /storyteller - GET ALL STORYTELLER FOR ALL USER
router.get('/', async (req, res) => {
    const storyteller = await getStory();
    res.send(storyteller);
});

//GET /storyteller/:id - GET A SINGLE STORYTELLER
router.get('/:id', async (req, res) => {
    try {  
        const storyteller = await getStoryByID(req.params.id);
        if(!storyteller) return res.status(404).json({ error: 'Storyteller not found' });
        res.status(200).json(storyteller);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /storyteller - CREATE or ADD a new storyteller
router.post('/', async(req, res) => {
    try {
        const { name, description, user_id } = req.body;
        
        // Validate required fields
        if (!user_id) {
            return res.status(400).json({ 
                error: "user_id is required",
                received_data: req.body 
            });
        }

        const storyteller = await createStory(name, description, user_id);
        
        if (!storyteller) {
            throw new Error("Storyteller creation returned null");
        }

        res.status(200).json({
            storyteller_id: storyteller.storyteller_id || storyteller.id,
            name: storyteller.name,
            user_id: storyteller.user_id
        });
    } catch (error) {
        console.error("Storyteller creation error:", {
            message: error.message,
            stack: error.stack,
            body: req.body
        });
        res.status(500).json({ 
            error: error.message,
            details: "Failed to create storyteller",
            sqlError: error.sqlMessage // If using SQL
        });
    }
});

//PUT /storyteller/:id - UPDATE A STORYTELLER
router.put('/:id', async (req, res) => {
    try {
        const { name, description } =  req.body;
        const updated = await updateStory(req.params.id, name, description);
        res.status(200).json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

//DELETE /storyteller/:id - DELETE a storyteller
router.delete('/:id', async(req, res) => {
    try {
        await deleteStory(req.params.id);
        res.status(200).json({ message: 'Storyteller deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;