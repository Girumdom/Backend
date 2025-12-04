const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const { getUserRoleInCollaboration, createCollaboration, getCollaborationByUserID, 
    getCollaborationByID, updateCollaboration, deleteCollaboration, 
    addMemberToCollaboration, removeMemberFromCollaboration, addMemoryToCollaboration, 
    removeMemoryFromCollaboration, editMemberRoleInCollaboration, getCollaborationMembers,
    getCollaborationMemories, collaborationExists, createCollaborationInvite, isEmailMemberOfCollaboration, isUserInCollaboration
} = require('../connections/collaboration_functions');
const pool = require('../connections/pool');

const { getUserByEmail } = require('../connections/users')

const inviteRateLimit = new Map();

router.use(verifyToken);

// helper functions

function checkRateLimit(userEmail) {
    const now = Date.now();
    const userLimit = inviteRateLimit.get(userEmail);

    // reset if 1 hour has already passed
    if (!userLimit || now > userLimit.resetTime) {
        inviteRateLimit.set(userEmail, { count: 1, resetTime: now + (60 * 60 * 1000) }); // 1 hour
        return true;
    }

    // check if the user exceeded the rate limit
    if (userLimit.count >= 10) {
        return false;
    }

    // increment count
    userLimit.count++;
    return true;
}

// validate email
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// check if user is trying to invite themselves
function isInvitingSelf(inviterEmail, inviteeEmail) {
    return inviterEmail.toLowerCase() === inviteeEmail.toLowerCase();
}

// validate role
function isValidRole(role) {
    const validRoles = ['owner', 'editor', 'viewer'];
    return validRoles.includes(role);
}

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

// GET /api/collaboration/:collaboration_id - Fetch full details of a single collaboration
router.get('/:collaboration_id', verifyToken, async (req, res) => {
    try {
        const { collaboration_id } = req.params;
        const loggedInUserID = req.user.user_id;

        // Security check 
        const isMember = await isUserInCollaboration(loggedInUserID, collaboration_id);
        if (!isMember) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const collaborationDetails = await getCollaborationByID(collaboration_id);
        if (!collaborationDetails) {
            return res.status(404).json({ error: 'Collaboration not found.' });
        }

        // Fetch members and memories in parallel
        const [members, memories] = await Promise.all([
            getCollaborationMembers(collaboration_id),
            getCollaborationMemories(collaboration_id) 
        ]);

        // Assemble and send the response
        res.status(200).json({
            ...collaborationDetails,
            members,
            memories
        });

    } catch (error) {
        console.error('Failed to fetch collaboration details:', error);
        res.status(500).json({ error: 'Internal server error.' });
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

// POST /api/collaborations/:id/members - Add / Invite a user to a collaboration
router.post('/:id/members', async (req, res) => {
    try {
        const { id: collaborationID } = req.params;
        const { email, role } = req.body;
        const loggedInUserID = req.user.user_id;
        const loggedInUserEmail = req.user.email;

        // validate require fields
        if (!email || !role) {
            return res.status(400).json({ error: 'Emal and role are required '});
        }

        // validate email format
        if(!isValidEmail(email)) {;
            return res.status(400).json({ error: 'Invalid email format' })
        }

        // check rate limit
        if (!checkRateLimit(loggedInUserEmail)) {
            return res.status(429).json({ error: 'Rate limit exceeded. You can send up to 10 invites per hour.'})
        }

        // check if collaboration already exists
        const exists = await collaborationExists(collaborationID);
        if (!exists) {
            return res.status(404).json({ error: 'Collaboration not found' });
        }

        // Authorization: Only the main user / owner can add new members
        const loggedInUserRole = await getUserRoleInCollaboration(loggedInUserID, collaborationID);
        if (loggedInUserRole !== 'owner' && loggedInUserRole !== 'editor') {
            return res.status(403).json({ error: 'Only the owner or editor can add invite to the collaboration' });
        }

        // get the logged-in user's email to check if it is a self-invite
        if(isInvitingSelf(loggedInUserEmail, email)) {
            return res.status(400).json({ error: 'You cannot invite yourself' });
        }

        // validate role
        if(!isValidRole(role)) {
            return res.status(400).json({ error: 'Invalid role. Must be one of: Owner, Editor, Viewer' });
        }
        
        // invite user to the collaboration
        const result = await createCollaborationInvite(collaborationID, email, role, loggedInUserID);
        res.status(201).json(result);
    } catch (error) {
        if (error.message.includes('does not exists')) {
            return res.status(404).json({ error: error.message });
        }
        if (error.message.includes('already a member')) {
            return res.status(409).json({ error: error.message });
        }
        res.status(500).json({ error: error.message || 'Failed to add member to collaboration' });
    }
});

// POST /api/collaboration/invites/:invite_id/accept - Accept the invitation from the user
router.post('/invites/:invite_id/accept', async (req, res) => {
    try {
        const { invite_id } = req.params;
        const user = req.user;
        
        // find/check the invite
        const [invites] = await pool.query(
            'SELECT * FROM COLLABORATION_INVITE WHERE invite_id = ? AND status = "pending" ',
            [invite_id]
        );
        const invite = invites[0];
        if (!invite) {
            return res.status(404).json({ error: 'Invite not found or already handled' });
        }

        // validate if the invitation is for the user
        if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
            return res.status(403).json({ error: 'You are not authorized to accept this invitation.' });
        }

        // add the invited user to USER_COLLABORATION table
        await pool.query(
            'INSERT INTO USER_COLLABORATION (collaboration_id, user_id, role) VALUES (?, ?, ?)',
            [invite.collaboration_id, user.user_id, invite.role]
        );

        // update the invite status
        await pool.query(
            'UPDATE COLLABORATION_INVITE SET status = "accepted" WHERE invite_id = ?',
            [invite_id]
        );

        res.json({ message: 'Invitaion accepted '});

    } catch (error) {
        // handle duplicate entry
        if (error.code === 'ER_DUP_ENTRY') { 
            await pool.query(
                'UPDATE COLLABORATION_INVITE SET status = "accepted" WHERE invite_id = ?',
                [req.params.invite_id]
            );
            return res.status(200).json({ message: 'Already a member, invite marked as accepted ' });
        }
        console.error('Error accepting the invitation:', error);
        res.status(500).json({ error: error.message || 'Failed to accept invitation' });
    }
});

// POST - /api/collaborations/invites/:invite_id/decline - Decline the invitation from a user
router.post('/invites/:invite_id/decline', async (req, res) => {
    try {
        const { invite_id } = req.params;
        const user = req.user;

        // find the invitation to the collaboration
        const [invites] = await pool.query(
            'SELECT * FROM COLLABORATION_INVITE WHERE invite_id = ? AND status = "pending" ',
            [invite_id]
        );
        const invite = invites[0];
        if(!invite) {
            return res.status(404).json({ error: 'Invite not found or already handled' });
        }
        if(invite.email.toLowerCase() !== user.email.toLowerCase()) {
            return res.status(403).json({ error: 'You are not authorized to decline this invite' });
        }

        // update the user's invite status
        await pool.query(
            'UPDATE COLLABORATION_INVITE SET status = "declined" WHERE invite_id = ?',
            [invite_id]
        );

        res.json({ message: 'Invitation successfully declined' });
    } catch (error) {
        res.status(500).json({ error: error.message || 'Faield to deline the invitation' });
    }
});

// GET /api/collaborations/invites/pending - GET pending invites for a user
router.get('/invites/pending', async (req, res) => {
    try {
        const user = req.user;
        const [invites] = await pool.query(
            'SELECT * FROM COLLABORATION_INVITE WHERE email = ? AND status = ?',
            [user.email, 'pending'] 
        );

        res.json(invites);
    } catch (error) {
        res.status(500).json({ error: error.message || 'Failed to fetch invites' });
    }
});

// DELETE /api/collaborations/:id/members/:user_id - Remove a user from a collaboration
router.delete('/:id/members/:userID', async (req, res) => {
    try {
        const { id: collaborationID, userID } = req.params;
        const loggedInUserID = req.user.user_id;
        // Authorization: Only the main user / owner can remove members
        const loggedInUserRole = await getUserRoleInCollaboration(loggedInUserID, collaborationID);
        if (loggedInUserRole !== 'owner') {
            return res.status(403).json({ error: 'Only the owner of the collaboration can remover a member' });  
        }
        // if (!userID) {
        //     return res.status(400).json({ error: 'User ID is required' });
        // }
        const result = await removeMemberFromCollaboration(collaborationID, userID);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found in this collaboration' });
        }
        res.status(204).send();
    } catch (error) {
        console.error('Error in removeMemberFromCollaboration:', error);
        res.status(500).json({ error: error.message || 'Failed to remove a member in collaboration' });
    }
});

// PATCH /api/collaborations/:id/members/:user_id - Edit a user's role in a collaboration
router.patch('/:id/members/:userID', async (req, res) => {
    try {
        const { id: collaborationID, userID } = req.params;
        const { newRole } = req.body;
        const loggedInUserID = req.user.user_id;

        // Authorization: Only the main user / owner of the collaboration can edit member roles
        const loggedInUserRole = await getUserRoleInCollaboration(loggedInUserID, collaborationID);
        if (loggedInUserRole !== 'owner') {
            return res.status(403).json({ error: 'Only the owner can edit member roles in the collaboration' });
        }
        if (!newRole) {
            return res.status(400).json({ error: 'New role is required' });
        }
        const result = await editMemberRoleInCollaboration(collaborationID, userID, newRole);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error in editMemberRoleInCollaboration:', error);

        // handle a case where the user is not found in the collaboration
        if (error.message.includes('not found in this collaboration')) {
            return res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: error.message || 'Failed to edit member role in collaboration' });
    }
});

// GET /api/collaborations/:id/members - Fetch the members currently included in the collaboration
router.get('/:id/members', async (req, res) => {
    try {
        const { id: collaborationID } = req.params;
        const loggedInUserID = req.user?.user_id;

        // Check if user is a members of the collaboration
        const role = await getUserRoleInCollaboration(loggedInUserID, collaborationID);
        if(!role) {
            return res.status(403).json({ error: 'Access denied. You are not a member of this collaboration.' });
        }

        const members = await getCollaborationMembers(collaborationID);
        res.status(200).json(members);

    } catch (error) {
        res.status(500).json({ error: error.message || 'Failed to fetch collaboration members' });
    }
});

// GET /api/collaborations/:id/members/exists=
router.get('/:id/members/exists', async (req, res) => {
    try {
        const { id: collaborationID } = req.params;
        const { email } = req.query;
        const loggedInUserID = req.user?.user_id;

        if (!loggedInUserID) return res.status(401).json({ error: 'Unauthorized' });
        if (!/^\d+$/.test(String(collaborationID))) {
            return res.status(400).json({ error: 'Invalid collaboration id' });
        };
        if (typeof email !== 'string' || !/\S+@\S+\.\S+/.test(email.trim())) {
            return res.status(400).json({ error: 'Invalid email' });
        };

        const role = await getUserRoleInCollaboration(loggedInUserID, collaborationID);
        if (!role) {
            return res.status(404).json({ error: 'Access denied. You are not a member of this collaboration.' });
        }

        const exists = await isEmailMemberOfCollaboration(collaborationID, email.trim());
        return res.status(200).json({ exists });
    } catch (error) {
        return res.status(500).json({ error: error.message || 'Failed to check member existence' });
    }
});

/* ROUTES FOR MANAGING MEMORIES */

// GET /api/collaboration/:id/memories - fetch the memories inside a collaboration
router.get('/:id/memories', async (req, res) => {
    try {
        const { id: collaborationID } = req.params;
        const loggedInUserID = req.user.user_id;

        // Check if the user requesting the fetch is a member of the collaboration
        const role = await getUserRoleInCollaboration(loggedInUserID, collaborationID);
        if(!role) {
            return res.status(403).json({ error: 'Access denied. Your are not a member of the collaboration' });
        }
        const collaborationMemories = await getCollaborationMemories(collaborationID)
        res.status(200).json(collaborationMemories);
    } catch (error) {
        res.status(500).json({ error: error.message || 'Failed to fetch collaboration memories' });
    }
});

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

        const [memoryRows] = await pool.query('SELECT user_id FROM MEMORY WHERE memory_id = ?', [memoryID]);
        const memory = memoryRows[0];

        if (!memory) {
            return res.status(404).json({ error: 'Memory not found.' });
        }
        if (memory.user_id !== loggedInUserID) {
            return res.status(403).json({ error: 'Forbidden: You can only add your own memories.' });
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