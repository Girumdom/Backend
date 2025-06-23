const express = require('express');
const cors = require('cors');
const app = express();
const pool = require('./api/connections/pool');
const path = require('path');
const fs = require('fs');

const dotenv = require('dotenv');

dotenv.config();

app.use(cors({
    exposedHeaders: ['Content-Type'],
}));

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

const uploadsDir = path.join(__dirname, 'api', 'uploads'); // Define the uploads directory path
fs.mkdirSync(uploadsDir, { recursive: true }); // Ensure the directory exists

app.use('/uploads', express.static(path.join(__dirname, 'api', 'uploads'), {
    setHeaders: (res) => {
      res.set("Access-Control-Allow-Origin", "*");
    }
  }));

app.get('/', (req, res) => {
    res.send('The app is up and running.')
});

// ALL ROUTERS
const memoryRouter = require('./api/controllers/memory_controller');
const storytellerRouter = require('./api/controllers/storyteller_controller');
const photoImageRouter = require('./api/controllers/photoimage_controller');
const ttsRouter = require('./api/controllers/tts_controller');
const storytellerMemoryRouter = require('./api/controllers/storyteller_memory_controller');
const reminderRouter = require('./api/controllers/reminder_controller');
const userRouter = require('./api/controllers/user_controller');
const authRouter = require('./api/controllers/authController');
const collaborationRouter = require('./api/controllers/collaboration_controller')

app.use('/api/user', userRouter);
app.use('/api/memory', memoryRouter);
app.use('/api/storyteller', storytellerRouter);
app.use('/api/images', photoImageRouter);
app.use('/api/tts', ttsRouter);
app.use('/api/storyteller-memory', storytellerMemoryRouter);
app.use('/api/reminders', reminderRouter);
app.use('/api/auth', authRouter);
app.use('/api/collaborations', collaborationRouter);

const PORT = 3000;

async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('Database connection successful');
        connection.release();
    } catch (error) {
        console.error('Database connection failed:', error);
    }
}
testConnection();

const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

const shutdown = () => {
    console.log('Shutting down server...');
    server.close(() => {
        console.log('Server closed.');
        pool.end(() => {
            console.log('Database connection pool closed.');
            process.exit(0);
        });
    });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);