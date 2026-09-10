import jwt from 'jsonwebtoken';
import db from '../models/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'grouproute_production_secret_jwt_key_2026_super_secure';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.query.token;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Find user in database
    const user = db.tables.get('users').find(u => u.id === decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User associated with token no longer exists.' });
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      profile_image: user.profile_image
    };

    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired authentication token.' });
  }
}

export function generateToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export default authenticateToken;
