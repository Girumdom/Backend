const { getStorytellersByUserID, getStoryByID, createStory, updateStory, deleteStory } = require('../connections/storyteller');
const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');

router.use(express.json());

router.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// GET /storyteller - FETCH ALL STORYTELLERS FOR A LOGGED-IN USER
router.get('/', verifyToken, async (req, res) => {
    try {
        const loggedInUserID = req.user.user_id; // Get the user ID from the token
        const storyteller = await getStorytellersByUserID(loggedInUserID);
        res.status(200).json(storyteller);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve storytellers.' });
    }
});

//GET /storyteller/:storyteller_id - FETCH A SINGLE STORYTELLER BY ID 
router.get('/:storyteller_id', verifyToken, async (req, res) => {
    try {
        const { storyteller_id } = req.params; // Extract storyteller_id from request parameters
        const loggedInUserID = req.user.user_id; // Get the user ID from the token
        
        const storyteller = await getStoryByID(storyteller_id, loggedInUserID);

        // check if storyteller exists and belongs to the logged-in user
        if (!storyteller || storyteller.user_id !== loggedInUserID) {
            return res.status(404).json({ error: 'Storyteller not found or you do not have permission to view it.' });
        }
        
        res.status(200).json(storyteller);

    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve storyteller' });
    }
});

// POST /storyteller - CREATE or ADD a new storyteller
router.post('/', verifyToken, async(req, res) => {
    try {
        const { name } = req.body;

        const user_id = req.user.user_id; // Get the user ID from the token

        // Validate required fields
        if (!name) {
            return res.status(400).json({ 
                error: "Name is required",
                received_data: req.body 
            });
        }

        const storyteller = await createStory(name, user_id);
        
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
        res.status(500).json({ error: 'Failed to create storyteller' });
    }
});

//PUT /storyteller/:storyteller_id - UPDATE A STORYTELLER
router.put('/:storyteller_id', verifyToken, async (req, res) => {
    try {
        const { name, description } =  req.body;
        const { storyteller_id } = req.params; // Extract storyteller_id from request parameters
        const loggedInUserID = req.user.user_id; // Get the user ID from the token

        // Validate required fields
        if (!name) {
            return res.status(400).json({ 
                error: "Name is required",
                received_data: req.body 
            });
        }

        const updatedStoryteller = await updateStory(storyteller_id, name, description, loggedInUserID);
        if (!updatedStoryteller) {
            return res.status(404).json({ error: 'Storyteller not found or does not belong to the user' });
        }

        res.status(200).json(updatedStoryteller);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

//DELETE /storyteller/:storyteller_id - DELETE a storyteller
router.delete('/:storyteller_id', verifyToken, async(req, res) => {
    try {
        const { storyteller_id } = req.params; // Extract storyteller_id from request parameters
        const loggedInUserID = req.user.user_id; // Get the user ID from the token

        const result = await deleteStory(storyteller_id, loggedInUserID);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Storyteller not found or you do not have the permission to delete it.' });
        }

        res.status(204).json({ message: 'Storyteller was deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete reminder.'});
    }
});

module.exports = router;