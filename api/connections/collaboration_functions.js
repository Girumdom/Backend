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
async function createCollaborationInvite(collaborationID, email, role, invitedBy) {
    try {
        // check for existing pending user invite
        const sql =  ' SELECT * FROM COLLABORATION_INVITE WHERE collaboration_id = ? AND email = ? AND status = ? ';
        const [existingInvite] = await pool.query(sql, [collaborationID, email, 'pending']);
        
        if (existingInvite.length > 0) {
            throw new Error('An invitation is already pending for this user.');
        }

        // insert a new invite
        await pool.query(
            'INSERT INTO COLLABORATION_INVITE (collaboration_id, email, role, invited_by) VALUES (?, ?, ?, ?)',
            [collaborationID, email, role, invitedBy]
        );

        return { message: 'Invitation sent successfully!' };
    } catch (error) {
        console.error('Error in createCollaborationInvite function:', error);
        throw error;
    }
}

// Invite a user to a collaboration function

async function createCollaboration(name, description, mainUserID) {
    const connection = await pool.getConnection();
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

// check if an existing collaboration already exists
async function collaborationExists(collaborationID) {
    try{
        const [result] = await pool.query('SELECT collaboration_id FROM COLLABORATION WHERE collaboration_id = ?', [collaborationID]);
        return result.length > 0;
    } catch (error) {
        console.error('Error checking collaboration existence:', error);
        throw new Error('Failed to check collaboration existence');
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

// ADD / INVITE  A USER TO A COLLABORATION WITH A SPECIFIC ROLE
async function addMemberToCollaboration(collaborationID, email, role) {
    try {
        // Find the user by their email
        const userQuery = 'SELECT user_id from USER WHERE email = ?';
        const [users] = await pool.query(userQuery, [email]);

        if (users.length === 0) {
            throw new Error('User with this email does not exists');
        }

        const userID = users[0].user_id;

        // add the user to the collaboration once found in the database
        const sql = `INSERT INTO USER_COLLABORATION (collaboration_id, user_id, role) VALUES (?, ?, ?)`;
        await pool.query(sql, [collaborationID, userID, role])

        return { message: 'User invited successfully' };

    } catch (error) {
        // handle a case where the user is already a member (dublicate primary key)
        if (error.code === 'ER_DUP_ENTRY') {
            throw new Error('User is already a member of this collaboration.');
        }
        console.error('Error in addMemberToCollaboration:', error);
        throw error;
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

// EDIT A USER'S ROLE IN THE COLLABORATION
async function editMemberRoleInCollaboration(collaborationID, userID, newRole) {
    try {
        const sql = `UPDATE USER_COLLABORATION SET role= ? WHERE collaboration_id = ? AND user_id = ?`; 
        const [result] = await pool.query(sql, [newRole, collaborationID, userID]);
        if (result.affectedRows === 0) {
            throw new Error('User not found in this collaboration');
        }
        return { message: 'User role updated successfully' };
    } catch (error) {
        console.error('Error in editMemberRoleInCollaboration:', error);
        throw new Error('Failed to update member role');
    }
}

// GET MEMBERS IN A COLLABORATION
async function getCollaborationMembers(collaborationID) {
    try {
        const sql = `
            SELECT
                u.user_id,
                u.fullname,
                u.email,
                uc.role,
                uc.joined_at
            FROM USER_COLLABORATION uc
            JOIN USER u ON uc.user_id = u.user_id
            WHERE uc.collaboration_id = ?
            ORDER BY uc.joined_at ASC;`;
        const [rows] = await pool.query(sql, [collaborationID]);
        return rows;
    } catch (error) {
        console.error('Error in getCollaborationMembers:', error);
        throw new Error('Failed to fetch collaboration members');
    }
}

async function isEmailMemberOfCollaboration(collaborationId, email) {
  const normalizedEmail = String(email).trim().toLowerCase();

  const sql = `
    SELECT 1
    FROM \`USER_COLLABORATION\` uc
    INNER JOIN \`USER\` u ON u.user_id = uc.user_id
    WHERE uc.collaboration_id = ?
      AND LOWER(TRIM(u.email)) = ?
    LIMIT 1
  `;

  const params = [Number(collaborationId), normalizedEmail];

  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(sql, params);
    return rows.length > 0;
  } finally {
    connection.release();
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

// GET THE MEMORIES OF A COLLABORATION
async function getCollaborationMemories(collaborationID) {
    try {
        const sql = `
            SELECT
                m.memory_id, m.title, m.content, m.date_of_event,
                cm.added_at, cm.added_by_user_id,
                u.fullname as added_by_username,
                p.photo_id, p.file_path as image_path,
                a.file_path as audio_url -- 1. Select the audio URL
            FROM COLLABORATION_MEMORY cm
            JOIN MEMORY m ON cm.memory_id = m.memory_id
            JOIN USER u ON cm.added_by_user_id = u.user_id
            LEFT JOIN PHOTO_IMAGE p ON m.memory_id = p.memory_id
            LEFT JOIN AUDIO a ON m.memory_id = a.memory_id -- 2. Add the LEFT JOIN for AUDIO
            WHERE cm.collaboration_id = ?
            ORDER BY cm.added_at DESC`;
        
        const [rows] = await pool.query(sql, [collaborationID]);

        const memoriesMap = new Map();

        rows.forEach(row => {
            if (!memoriesMap.has(row.memory_id)) {
                memoriesMap.set(row.memory_id, {
                    memory_id: row.memory_id,
                    title: row.title,
                    content: row.content,
                    date_of_event: row.date_of_event,
                    added_at: row.added_at,
                    added_by_user_id: row.added_by_user_id,
                    added_by_username: row.added_by_username,
                    audio_url: row.audio_url, 
                    images: []
                });
            }

            if (row.photo_id) {
                memoriesMap.get(row.memory_id).images.push({
                    photo_id: row.photo_id,
                    file_path: row.image_path 
                });
            }
        });

        return Array.from(memoriesMap.values());
    } catch (error) {
        console.error('Error in getCollaborationMemories:', error);
        throw new Error('Failed to fetch collaboration memories');
    }
}

async function isUserInCollaboration(user_id, collaboration_id) {
    const sql = `SELECT 1 FROM USER_COLLABORATION WHERE user_id = ? AND collaboration_id = ?`;
    const [rows] = await pool.query(sql, [user_id, collaboration_id]);
    return rows.length > 0;
}


// used web functions
async function getSeniorsByCaretakerID(caretakerId) {
    try {
        const sql = `
            SELECT 
                c.collaboration_id,
                c.name as collaboration_name,
                c.created_at as connection_date,
                uc.role as my_role,
                u.user_id as senior_id,
                u.fullname as senior_name,
                u.email as senior_email,
                u.profile_picture as senior_pfp,
                (SELECT COUNT(*) FROM MEMORY m WHERE m.user_id = u.user_id) as memory_count
            FROM USER_COLLABORATION uc
            JOIN COLLABORATION c ON uc.collaboration_id = c.collaboration_id
            JOIN USER u ON c.main_user_id = u.user_id
            WHERE uc.user_id = ? 
            AND u.role = 'Elderly'
        `;

        const [rows] = await pool.query(sql, [caretakerId]);
        return rows;
    } catch (error) {
        console.error('Error in getSeniorsByCaretakerID:', error);
        throw error;
    }
}

async function getSeniorDetails(caretakerId, seniorId) {
    try {
        // 1. Verify Permission & Get Basic Info (Unchanged)
        const infoSql = `
            SELECT 
                u.user_id, u.fullname, u.email, u.profile_picture,
                c.collaboration_id, c.name as collaboration_name
            FROM USER_COLLABORATION uc
            JOIN COLLABORATION c ON uc.collaboration_id = c.collaboration_id
            JOIN USER u ON c.main_user_id = u.user_id
            WHERE uc.user_id = ? 
            AND u.user_id = ?
            AND u.role = 'Elderly'
        `;
        
        const [infoRows] = await pool.query(infoSql, [caretakerId, seniorId]);
        
        if (infoRows.length === 0) return null;
        const senior = infoRows[0];

        // 2. Get Senior's Memories (Unchanged)
        const memorySql = `
            SELECT m.*, a.file_path as audio_url 
            FROM MEMORY m
            LEFT JOIN AUDIO a ON m.memory_id = a.memory_id
            WHERE m.user_id = ? 
            ORDER BY m.date_of_event DESC
        `;
        const [memories] = await pool.query(memorySql, [seniorId]);

        // 3. Enrich Memories with Images
        // We loop through each memory and fetch its photos
        for (let memory of memories) {
            const [images] = await pool.query(
                'SELECT file_path FROM PHOTO_IMAGE WHERE memory_id = ?', 
                [memory.memory_id]
            );
            memory.images = images; // Attach the array of images to the memory object
        }

        // 4. Get Senior's Reminders (Updated for correct column name)
        const reminderSql = `
            SELECT * FROM REMINDER 
            WHERE created_by_user_id = ? 
            AND reminder_date >= NOW()
            ORDER BY reminder_date ASC
        `;
        const [reminders] = await pool.query(reminderSql, [seniorId]);

        return { ...senior, memories, reminders };

    } catch (error) {
        console.error('Error in getSeniorDetails:', error);
        throw error;
    }
}

async function createMemoryInCollaboration(collaborationId, memoryData, creatorId) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Create Memory (Owned by Creator/Caretaker)
        const [memResult] = await connection.query(
            'INSERT INTO MEMORY (title, content, date_of_event, user_id, creator_id) VALUES (?, ?, ?, ?, ?)',
            [memoryData.title, memoryData.content, memoryData.date_of_event, creatorId, creatorId]
        );
        const newMemoryId = memResult.insertId;

        // 2. LINK IT TO THE SENIOR'S COLLABORATION
        await connection.query(
            'INSERT INTO COLLABORATION_MEMORY (collaboration_id, memory_id, added_by_user_id) VALUES (?, ?, ?)',
            [collaborationId, newMemoryId, creatorId]
        );

        await connection.commit();
        return newMemoryId;

    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function createReminderForSenior(collaborationId, reminderData, creatorId) {
    // 1. Get the Senior ID from the Collaboration
    const [rows] = await pool.query(
        'SELECT main_user_id FROM COLLABORATION WHERE collaboration_id = ?', 
        [collaborationId]
    );
    
    if (rows.length === 0) throw new Error("Collaboration not found");
    const seniorId = rows[0].main_user_id;

    // 2. Create the Reminder linked to that Senior
    const sql = `
        INSERT INTO REMINDER 
        (title, description, reminder_date, repeat_interval, user_id, created_by_user_id) 
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    const [result] = await pool.query(sql, [
        reminderData.title,
        reminderData.description,
        reminderData.reminder_date,
        reminderData.repeat_interval,
        seniorId,  
        creatorId 
    ]);

    return result.insertId;
}

// AUTO CREATE COLLABORATION FOR THE SENIOR WHEN THEY REGISTER
async function createDefaultCollaboration(userId, fullname) {
    try {
        // Create a friendly name like "Juan Cruz's Care Team"
        const defaultName = `${fullname}'s Collaboration`;
        
        const sql = `INSERT INTO COLLABORATION (collaboration_name, main_user_id) VALUES (?, ?)`;
        
        const [result] = await pool.query(sql, [defaultName, userId]);
        
        console.log(`Auto-created collaboration for user ${userId}: ${defaultName}`);
        return result.insertId;
    } catch (error) {
        console.error("Error creating default collaboration:", error);
        // We don't want to break the signup if this fails, so we just log it
        return null; 
    }
}

// CARETAKER REQUEST TO CONNECT TO A SENIOR
async function requestConnectionToSenior(caretakerEmail, seniorEmail, caretakerId) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Find the Senior's User ID
        const [users] = await connection.query(
            'SELECT user_id, role FROM USER WHERE email = ?', 
            [seniorEmail]
        );

        if (users.length === 0) {
            throw new Error("Senior not found. Please check the email address.");
        }
        
        const senior = users[0];
        // Ensure they are actually a Senior
        if (senior.role !== 'Elderly') {
             throw new Error("This user is not registered as a Senior.");
        }

        // 2. Find the Senior's Collaboration ID
        const [collabs] = await connection.query(
            'SELECT collaboration_id FROM COLLABORATION WHERE main_user_id = ?',
            [senior.user_id]
        );

        if (collabs.length === 0) {
            throw new Error("This senior has not set up their collaboration space yet.");
        }
        const seniorCollabId = collabs[0].collaboration_id;

        // 3. Check if you are already connected
        const [existing] = await connection.query(
            'SELECT * FROM USER_COLLABORATION WHERE collaboration_id = ? AND user_id = (SELECT user_id FROM USER WHERE email = ?)',
            [seniorCollabId, caretakerEmail]
        );
        if (existing.length > 0) {
            throw new Error("You are already connected to this senior.");
        }

        // 4. Create the Invitation
        await connection.query(
            `INSERT INTO COLLABORATION_INVITE 
            (collaboration_id, email, role, status, invited_by) 
            VALUES (?, ?, ?, ?, ?)`,
            [seniorCollabId, seniorEmail, 'editor', 'pending', caretakerId] 
        );

        await connection.commit();
        return { message: "Request sent! Ask the senior to accept it on their app." };

    } catch (error) {
        await connection.rollback();
        console.error("Error requesting connection:", error);
        throw error;
    } finally {
        connection.release();
    }
}

// end of web functions

module.exports = {
    getUserRoleInCollaboration,
    getCollaborationByUserID,
    getCollaborationByID,
    updateCollaboration,
    deleteCollaboration,
    addMemberToCollaboration,
    removeMemberFromCollaboration,
    editMemberRoleInCollaboration,
    addMemoryToCollaboration,
    removeMemoryFromCollaboration,
    getCollaborationMembers,
    getCollaborationMemories,
    collaborationExists,
    createCollaborationInvite,
    createCollaboration,
    isEmailMemberOfCollaboration,
    isUserInCollaboration,
    getSeniorsByCaretakerID,
    getSeniorDetails,
    createMemoryInCollaboration,
    createReminderForSenior,
    createDefaultCollaboration,
    requestConnectionToSenior
};