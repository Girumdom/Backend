const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// set up the storage
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'girumdom_uploads', // Cloudinary folder name
        allowed_formats: ['jpg', 'png', 'jpeg'],
        public_id: (req, file) => {
            return `memory_${Date.now()}`; // Custom file name
        }
    }
});

module.exports = {
    cloudinary,
    storage
};