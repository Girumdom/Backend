const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

async function processImageUpload({ file, uploadDir, maxWidth = 1200, quality = 80 }) {
    try {
        // Ensure upload directory exists
        await fs.mkdir(uploadDir, { recursive: true });

        // Generate unique filename
        const ext = path.extname(file.originalname).toLowerCase();
        const filename = `${uuidv4()}${ext}`;
        const filePath = path.join(uploadDir, filename);

        // Process image with sharp
        const processor = sharp(file.path)
            .rotate() // Auto-orient based on EXIF
            .resize(maxWidth, maxWidth, {
                fit: 'inside',
                withoutEnlargement: true
            });

        // Convert to appropriate format
        if (ext === '.png') {
            await processor.png({ quality }).toFile(filePath);
        } else {
            await processor.jpeg({ quality }).toFile(filePath);
        }

        // Get image metadata
        const metadata = await sharp(filePath).metadata();

        return {
            filename,
            filePath,
            width: metadata.width,
            height: metadata.height,
            size: (await fs.stat(filePath)).size
        };
    } catch (error) {
        // Cleanup if processing fails
        await fs.unlink(file.path).catch(console.error);
        throw error;
    }
}

module.exports = {
    processImageUpload
};