const express = require('express');
const router = express.Router();
const pool = require('../connections/pool');
const { getMemoryByID } = require('../connections/memory');
const { getStoryByID } = require('../connections/storyteller');
const { getImagesByMemoryID } = require('../connections/photoImage');
const { getTTSByMemoryID } = require('../connections/tts');

const verifyToken = require('../middleware/auth');

router.use(express.json());

router.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Helper function to enrich memory with images and audio
async function enrichMemoryWithMediaData(memory) {
    if (!memory) return null;
    
    // Get images
    memory.images = await getImagesByMemoryID(memory.memory_id);
    
    // Get audio/TTS
    const audioUrl = await getTTSByMemoryID(memory.memory_id);
    memory.audio_url = audioUrl;
    
    return memory;
}

// GET all memories for a storyteller
router.get('/storyteller/:storyteller_id', verifyToken, async (req, res) => {
    try {
        const storyteller_id = req.params.storyteller_id;
        
        // First verify storyteller exists
        const storyteller = await getStoryByID(storyteller_id);
        if (!storyteller) {
            return res.status(404).json({ error: 'Storyteller not found' });
        }
        
        // Get all memories associated with this storyteller
        const [memories] = await pool.query(
            `SELECT m.* FROM MEMORY m
             JOIN STORYTELLER_MEMORY sm ON m.memory_id = sm.memory_id
             WHERE sm.storyteller_id = ?
             ORDER BY sm.used_at DESC`,
            [storyteller_id]
        );
        
        // Enrich each memory with images and audio
        const enrichedMemories = [];
        for (const memory of memories) {
            const enriched = await enrichMemoryWithMediaData(memory);
            enrichedMemories.push(enriched);
        }
        
        res.status(200).json({
            storyteller_id,
            storyteller_name: storyteller.name,
            memories: enrichedMemories
        });
    } catch (error) {
        console.error('Failed to fetch storyteller memories:', error);
        res.status(500).json({ error: error.message });
    }
});

// Associate a memory with a storyteller
router.post('/', verifyToken, async (req, res) => {
    try {
      console.log('Incoming association request:', req.body);
      const { storyteller_id, memory_id } = req.body;
      const loggedInUserID = req.user.user_id;
      
      if (!storyteller_id || !memory_id) {
        return res.status(400).json({ error: 'storyteller_id and memory_id are required' });
      }
      
      // Verify if both exist
      console.log('Verifying storyteller exists...');
      const storyteller = await getStoryByID(storyteller_id, loggedInUserID);
      if (!storyteller) {
        console.log('Storyteller not found');
        return res.status(404).json({ error: 'Storyteller not found' });
      }
      
      console.log('Verifying memory exists...');
      const memory = await getMemoryByID(memory_id, loggedInUserID);
      if (!memory) {
        console.log('Memory not found');
        return res.status(404).json({ error: 'Memory not found' });
      }
      
      // Check if association exists
      console.log('Checking for existing association...');
      const [existing] = await pool.query(
        'SELECT * FROM STORYTELLER_MEMORY WHERE storyteller_id = ? AND memory_id = ?',
        [storyteller_id, memory_id]
      );
      
      if (existing.length > 0) {
        console.log('Association exists, updating timestamp...');
        await pool.query(
          'UPDATE STORYTELLER_MEMORY SET used_at = CURRENT_TIMESTAMP WHERE storyteller_id = ? AND memory_id = ?',
          [storyteller_id, memory_id]
        );
        
        return res.status(200).json({ 
          message: 'Association already exists',
          storyteller_id,
          memory_id 
        });
      }
      
      // Create new association
      console.log('Creating new association...');
      const [result] = await pool.query(
        'INSERT INTO STORYTELLER_MEMORY (storyteller_id, memory_id) VALUES (?, ?)',
        [storyteller_id, memory_id]
      );
      
      console.log('Insert result:', result);
      res.status(201).json({
        message: 'Memory associated successfully',
        storyteller_id,
        memory_id,
        association_id: result.insertId
      });
    } catch (error) {
      console.error('Association error:', {
        message: error.message,
        stack: error.stack,
        sqlMessage: error.sqlMessage,
        body: req.body
      });
      res.status(500).json({ 
        error: 'Failed to create association',
        details: error.message 
      });
    }
  });

// GET a specific memory associated with a storyteller
router.get('/:storyteller_id/:memory_id', verifyToken, async (req, res) => {
    try {
        const { storyteller_id, memory_id } = req.params;
        
        // Check if the association exists
        const [association] = await pool.query(
            'SELECT * FROM STORYTELLER_MEMORY WHERE storyteller_id = ? AND memory_id = ?',
            [storyteller_id, memory_id]
        );
        
        if (association.length === 0) {
            return res.status(404).json({ error: 'Memory not associated with this storyteller' });
        }
        
        // Get memory details
        const memory = await getMemoryByID(memory_id);
        if (!memory) {
            return res.status(404).json({ error: 'Memory not found' });
        }
        
        // Enrich memory with media data
        const enrichedMemory = await enrichMemoryWithMediaData(memory);
        
        // Update usage timestamp
        await pool.query(
            'UPDATE STORYTELLER_MEMORY SET used_at = CURRENT_TIMESTAMP WHERE storyteller_id = ? AND memory_id = ?',
            [storyteller_id, memory_id]
        );
        
        res.status(200).json(enrichedMemory);
    } catch (error) {
        console.error('Failed to fetch memory details:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE association between storyteller and memory
router.delete('/:storyteller_id/:memory_id', verifyToken, async (req, res) => {
    try {
        const { storyteller_id, memory_id } = req.params;
        
        const [result] = await pool.query(
            'DELETE FROM STORYTELLER_MEMORY WHERE storyteller_id = ? AND memory_id = ?',
            [storyteller_id, memory_id]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Memory not associated with this storyteller' });
        }
        
        res.status(200).json({ message: 'Memory disassociated from storyteller successfully' });
    } catch (error) {
        console.error('Failed to disassociate memory from storyteller:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET all storytellers associated with a memory
router.get('/memory/:memory_id', verifyToken, async (req, res) => {
    try {
        const memory_id = req.params.memory_id;
        
        // Verify memory exists
        const memory = await getMemoryByID(memory_id);
        if (!memory) {
            return res.status(404).json({ error: 'Memory not found' });
        }
        
        // Get all storytellers associated with this memory
        const [storytellers] = await pool.query(
            `SELECT s.*, sm.used_at FROM STORYTELLER s
             JOIN STORYTELLER_MEMORY sm ON s.storyteller_id = sm.storyteller_id
             WHERE sm.memory_id = ?
             ORDER BY sm.used_at DESC`,
            [memory_id]
        );
        
        res.status(200).json({
            memory_id,
            memory_title: memory.title,
            storytellers
        });
    } catch (error) {
        console.error('Failed to fetch memory storytellers:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;