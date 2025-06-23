const pool = require('./pool');

// helper function for permissions
async function getUserRoleInCollaboration(userID, collaborationID) {
    try {
        const sql = `SELECT role FROM USER_COLLABORATION WHERE user_id = ? AND collaboration_id = ?`;
        const [rows] = await pool.query(sql, [userID, collaborationID]);
        return rows[0] ? rows[0].role : null;
    } catch (error) {
        console.error('Error in getUserRoleInCollaboration:', error);
        throw error;
    }
}

// Collaboration entity functions
async function createCollaboration(name, description, mainUserID) {
    const connection = await pool.getConnection;
    try {
        await connection.beginTransaction();

        // Create the collaboration
        const collaborationSQL = `INSERT INTO COLLABORATION (name, description, main_user_id) VALUES (?, ?, ?)`;
        const [collaborationResult] = await connection.query(collaborationSQL, [name, description, mainUserID]);
        const collaborationID = collaborationResult.insertId;

        // Add the creator to the USER_COLLABORATION table as the 'owner'
        const memberSQL = `INSERT INTO USER_COLLABORATION (user_id, collaboration_id, role) VALUES (?, ?, 'owner')`;
        await connection.query(memberSQL, [mainUserID, collaborationID]);

        await connection.commit();

        // return the full details of the newly created collaboration
        return getCollaborationByID(collaborationID);
    } catch (error) {
        await connection.rollback();
        console.error('Error in createCollaboration:', error);
        throw new Error('Failed to create collaboration');
    } finally {
        connection.release();   
    }
}

// GET ALL COLLABORATIONS A SPECIFIC USER IS MEMBER OF.
async function getCollaborationByUserID(userID) {
    try {
        const sql = `SELECT c.*, uc.role
        FROM COLLABORATION c
        JOIN USER_COLLABORATION uc ON c.collaboration_id = uc.collaboration_id
        WHERE uc.user_id = ?`;

        const [rows] = await pool.query(sql, [userID]);
        return rows;
    } catch (error) {
        console.error('Error in getCollaborationByUserID:', error);
        throw new Error('Failed to fetch collaborations');
    }
}

// GET A SINGLE COLLABORATION BY ITS ID
async function getCollaborationByID(collaborationID) {
    try {
        const sql = 'SELECT * FROM COLLABORATION WHERE collaboration_id = ?';
        const [rows] = await pool.query(sql, [collaborationID]);
        return rows[0] || null;
    } catch (error) {
        console.error('Error in getCollaborationByID:', error);
        throw new Error('Failed to fetch collaboration');
    }
}

// UPDATE A COLLABORATION's NAME and DESCRIPTION
async function updateCollaboration(collaborationID, name, description, mainUserID) {
    try {
        const sql = 'UPDATE COLLABORATION SET name = ?, description = ? WHERE collaboration_id = ? AND main_user_id = ?';
        const [result] = await pool.query(sql, [name, description, collaborationID, mainUserID]);
        if (result.affectedRows === 0) return null;
        return getCollaborationByID(collaborationID);
    } catch (error) {
        console.error('Error in updateCollaboration', error);
        throw new Error('Failed to update collaboration.');
    }
}

// DELETE A COLLABORATION
async function deleteCollaboration(collaborationID, mainUserID) {
    try {
        const sql = 'DELETE FROM COLLABORATION WHERE collaboration_id = ? AND main_user_id = ?';
        const [result] = await pool.query(sql, [collaborationID, mainUserID]);
        return result;
    } catch (error) {
        console.error('Error in deleteCollaboration:', error);
        throw new Error('Failed to delete the collaboration.');
    }
}

/*
COLLABORATION MEMBERS FUNCTIONS
*/

// ADD A USER TO A COLLABORATION WITH A SPECIFIC ROLE
async function addMemberToCollaboration(collaborationID, userID, role) {
    try {
        const sql = 'INSERT INTO USER_COLLABORATION (collaboration_id, user_id, role) VALUES (?, ?, ?)';
        await pool.query(sql, [collaborationID, userID, role]);
        return { message: 'User added successfully' };
    } catch (error) {
        // handle a case where the user is already a member (dublicate primary key)
        if (error.code === 'ER_DUP_ENTRY') {
            throw new Error('User is already a member of this collaboration.');
        }
        console.error('Error in addMemberToCollaboration:', error);
        throw new Error('Failed to add member');
    }
}

// REMOVE A USER FROM THE COLLABORATION
async function removeMemberFromCollaboration(collaborationID, userID) {
    try {
        const sql = 'DELETE FROM USER_COLLABORATION WHERE collaboration_id = ? AND user_id = ?';
        const [result] = await pool.query(sql, [collaborationID, userID]);
        return result;
    } catch (error) {
        console.error('Error in removeMemberFromCollaboration:', error);
        throw new Error('Failed to remove member');
    }
}

/*
COLLABORATION MEMORIES FUNCTIONS
*/

// ADD A MEMORY TO A COLLABORATION
async function addMemoryToCollaboration(collaborationID, memoryID, addedByUserID) {
    try {
        const sql = 'INSERT INTO COLLABORATION_MEMORY (collaboration_id, memory_id, added_by_user_id) VALUES (?, ?, ?)';
        await pool.query(sql, [collaborationID, memoryID, addedByUserID]);
        return { message: 'Memory added to collaboration successfully' };
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            throw new Error('This memory is already in the collaboration');
        }
        console.error('Error in addMemoryToCollaboration:', error);
        throw new Error('Failed to add memory to collaboration');
    }
}

// REMOVE A MEMORY FROM A COLLABORATION
async function removeMemoryFromCollaboration(collaborationID, memoryID) {
    try {
        const sql = 'DELETE FROM COLLABORATION_MEMORY WHERE collaboration_id = ? and memory_id = ?';
        const [result] = await pool.query(sql, [collaborationID, memoryID]);
        return result;
    } catch (error) {
        console.error('Error in removeMemoryFromCollaboration:', error);
        throw new Error('Failed to remove memory from collaboration.');
    }
}

module.exports = {
    getUserRoleInCollaboration,
    createCollaboration,
    getCollaborationByUserID,
    getCollaborationByID,
    updateCollaboration,
    deleteCollaboration,
    addMemberToCollaboration,
    removeMemberFromCollaboration,
    addMemoryToCollaboration,
    removeMemoryFromCollaboration,
};