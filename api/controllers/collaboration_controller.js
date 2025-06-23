const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const { getUserRoleInCollaboration, createCollaboration, getCollaborationByUserID, getCollaborationByID, updateCollaboration, deleteCollaboration, addMemberToCollaboration, removeMemberFromCollaboration, addMemoryToCollaboration, removeMemoryFromCollaboration, } = require('../connections/collaboration_functions');

router.use(verifyToken); // Ensures that all routes in this file are protected by token verification

/* ROUTES FOR COLLABORATION */

// POST /api/collaborations - Create a new collaboration
router.post('/', async (req, res) => {
    try {
        const { name, description } = req.body;
        const mainUserID = req.user.user_id; 

        if (!name) return res.status(400).json({ message: 'Collaboration name is required' });

        const newCollaboration = await createCollaboration(name, description, mainUserID);
        res.status(201).json(newCollaboration);
    } catch (error) {
        res.status(500).json({ message: error.message || 'Failed to create collaboration' });
    }
});

// GET /api/collaborations - Get all collaborations for logged-in user
router.get('/', async (req, res) => {
    try {
        const loggedInUserID = req.user.user_id; 
        const collaborations = await getCollaborationByUserID(loggedInUserID);
        res.status(200).json(collaborations);
    } catch (error) {
        res.status(500).json({ message: error.message || 'Failed to fetch collaborations' });
    }
});

// GET /api/collaborations/:id - Get a specific collaboration by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const loggedInUserID = req.user.user_id;

        // Check if the user is a member of the collaboration
        const role = await getUserRoleInCollaboration(loggedInUserID, id);
        if(!role) return res.status(403).json({ message: 'Access denied. You are not a member of this collaboration.' });

        const collaboration = await getCollaborationByID(id);
        if(!collaboration) return res.status(404).json({ message: 'Collaboration not found' });

        res.status(200).json(collaboration)
    } catch (error) {
        res.status(500).json({ message: error.message || 'Failed to fetch collaboration' });
    }
});

// PUT /api/collaborations/:id - Update an existing collaboration
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;
        const loggedInUserID = req.user.user_id;

        // only the owner / main user id can update the collaboration details
        const collaboration = await getCollaborationByID(id);
        if (!collaboration) {
            return res.status(404).json({ error: 'Collaboration not found' });
        }
        if (collaboration.main_user_id !== loggedInUserID) {
            return res.status(403).json({ error: 'Only the owner can update the collaboration' });
        }
        if(!name) {
            return res.status(400).json({ error: 'Collaboration name is required' });
        }
        
        const updatedCollaboration = await updateCollaboration(id, name, description, loggedInUserID);
        res.status(200).json(updatedCollaboration);
    } catch (error) {
        res.status(500).json({ error: error.message || 'Failed to update collaboration' });
    }
})

// DELETE /api/collaborations/:id - Delete an existing collaboration
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const loggedInUserID = req.user.user_id;

        // only the owner / main user id can delete the collaboration
        const collaboration = await getCollaborationByID(id);
        if (!collaboration) {
            return res.status(404).json({ error: 'Collaboration not found' });
        }
        if (collaboration.main_user_id !== loggedInUserID) {
            return res.status(403).json({ error: 'Only the main owner can delete the collaboration' });
        }

        await deleteCollaboration(id, loggedInUserID);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message || 'Failed to delete collaboration' });
    }
});

/* ROUTES FOR MANAGING MEMBERS */
// POST /api/collaborations/:id/members - Add a user to a collaboration
router.post('/:id/members', async (req, res) => {
    try {
        const { id: collaborationID } = req.params;
        const { userID, role } = req.body;
        const loggedInUserID = req.user.user_id;

        // Authorization: Only the main user / owner can add new members
        const loggedInUserRole = getUserRoleInCollaboration(loggedInUserID, collaborationID);
        if (loggedInUserRole !== 'owner') {
            return res.status(403).json({ error: 'Only the owner can add members to the collaboration' });
        }
        if (!userID || !role) {
            return res.status(400).json({ error: 'User ID and role are required' });
        }

        const result = await addMemberToCollaboration(collaborationID, userID, role);
        res.status(201).json(result);
    } catch (error) {
        // send a 409 conflict error if the user is already a member
        if (error.message.includes('already a member')) {
            return res.status(409).json({ error: error.message });
        }

        res.status(500).json({ error: error.message || 'Failed to add member to collaboration' });
    }
});

/* ROUTES FOR MANAGING MEMORIES */
// POST /api/collaborations/:id/memories - add a memory to a collaboration
router.post('/:id/memories', async (req, res) => {
    try {
        const { id: collaborationID } = req.params;
        const { memoryID } = req.body;
        const loggedInUserID = req.user.user_id;

        // Authorization: Only 'owner' or 'editor' roles can add memories
        const loggedInUserRole = await getUserRoleInCollaboration(loggedInUserID, collaborationID);
        if (loggedInUserRole !== 'owner' && loggedInUserRole !== 'editor') {
            return res.status(403).json({ error: 'Only owners or editors can add memories to the collaboration' });
        }
        if (!memoryID) {
            return res.status(400).json({ error: 'Memory ID is required' });
        }

        const result = await addMemoryToCollaboration(collaborationID, memoryID, loggedInUserID);
        res.status(201).json(result);
    } catch (error) {
        // handle a case where the memory is already added to the collaboration
        if (error.message.includes('already in the collaboration')) {
            return res.status(409).json({ error: error.message });
        }

        res.status(500).json({ error: error.message || 'Failed to add memory to collaboration' });
    }
});

module.exports = router;