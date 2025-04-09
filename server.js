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
app.use(express.json());

const uploadsDir = path.join(__dirname, 'api', 'uploads'); // Define the uploads directory path
fs.mkdirSync(uploadsDir, { recursive: true }); // Ensure the directory exists

app.use('/uploads', express.static(uploadsDir)); // Serve static files from the uploads directory

app.get('/', (req, res) => {
    res.send('The app is up and running.')
});

// ALL CONTROLLERS
const memoryController = require('./api/controllers/memory_controller');
const storytellerController = require('./api/controllers/storyteller_controller');
const photoImageController = require('./api/controllers/photoimage_controller');

app.use('/api/memory', memoryController);
app.use('/api/storyteller', storytellerController);
app.use('/api/images', photoImageController);

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
