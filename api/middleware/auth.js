const jwt = require('jsonwebtoken');
require('dotenv').config();

function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) { // No token provided
        return res.status(401).json({ error: 'No token provided' }); // Unauthorized
    }

    // Verify the token
    jwt.verify(token, process.env.JWT_SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' }); // Forbidden
        }
        req.user = user; // Attach user info to request object
        next(); // Proceed to the next middleware or route handler
    });
}

module.exports = verifyToken;