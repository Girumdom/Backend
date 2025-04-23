const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

async function processMultipleImageUploads({ files, uploadDir, maxWidth = 1200, quality = 80 }) {
    try {
      // Ensure upload directory exists
      await fs.mkdir(uploadDir, { recursive: true });
  
      // Process all images in parallel
      const results = await Promise.all(
        files.map(async (file) => {
          try {
            const ext = path.extname(file.originalname).toLowerCase();
            const filename = `${uuidv4()}${ext}`;
            const filePath = path.join(uploadDir, filename);
  
            const processor = sharp(file.path)
              .rotate()
              .resize(maxWidth, maxWidth, {
                fit: 'inside',
                withoutEnlargement: true
              });
  
            if (ext === '.png') {
              await processor.png({ quality }).toFile(filePath);
            } else {
              await processor.jpeg({ quality }).toFile(filePath);
            }
  
            const metadata = await sharp(filePath).metadata();
  
            return {
              success: true,
              originalname: file.originalname,
              filename,
              filePath,
              width: metadata.width,
              height: metadata.height,
              size: (await fs.stat(filePath)).size
            };
          } catch (error) {
            await fs.unlink(file.path).catch(console.error);
            return {
              success: false,
              originalname: file.originalname,
              error: error.message
            };
          }
        })
      );
  
      return results;
    } catch (error) {
      // Cleanup all files if something went wrong
      await Promise.all(files.map(file => 
        fs.unlink(file.path).catch(console.error)
      ));
      throw error;
    }
  }
  
  module.exports = {
    processImageUpload,
    processMultipleImageUploads
  };