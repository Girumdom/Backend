const fs = require('fs').promises;
const path = require('path');

async function cleanTempFiles() {
    const tempDir = path.join(__dirname, '../temp_uploads');
    try {
        const files = await fs.readdir(tempDir);
        await Promise.all(files.map(file => 
            fs.unlink(path.join(tempDir, file)).catch(console.error)
        ));
        console.log('Cleaned up temp files');
    } catch (err) {
        if (err.code !== 'ENOENT') {
            console.error('Temp file cleanup error:', err);
        }
    }
}

module.exports = { cleanTempFiles };