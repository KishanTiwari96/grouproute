import bcrypt from 'bcryptjs';
import { z } from 'zod';
import db from '../models/db.js';
import { generateToken } from '../middleware/auth.js';

export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    profile_image: z.string().optional()
  })
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required')
  })
});

// Default avatar generator based on name
function getInitialAvatar(name) {
  const clean = encodeURIComponent(name.trim());
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${clean}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

export const authController = {
  async register(req, res) {
    try {
      const { name, email, password, profile_image } = req.body;
      const normalizedEmail = email.toLowerCase().trim();

      // Check if user already exists
      const existingUser = db.tables.get('users').find(u => u.email.toLowerCase() === normalizedEmail);
      if (existingUser) {
        return res.status(409).json({ error: 'An account with this email already exists.' });
      }

      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);

      const avatar = profile_image || getInitialAvatar(name);

      const newUser = db.tables.insert('users', {
        name: name.trim(),
        email: normalizedEmail,
        password_hash,
        profile_image: avatar
      });

      const token = generateToken(newUser);

      return res.status(201).json({
        message: 'Account created successfully',
        token,
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          profile_image: newUser.profile_image
        }
      });
    } catch (err) {
      console.error('[Auth] Register error:', err);
      return res.status(500).json({ error: 'Internal server error during registration.' });
    }
  },

  async login(req, res) {
    try {
      const { email, password } = req.body;
      const normalizedEmail = email.toLowerCase().trim();

      const user = db.tables.get('users').find(u => u.email.toLowerCase() === normalizedEmail);
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const token = generateToken(user);

      return res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          profile_image: user.profile_image
        }
      });
    } catch (err) {
      console.error('[Auth] Login error:', err);
      return res.status(500).json({ error: 'Internal server error during login.' });
    }
  },

  async getMe(req, res) {
    return res.json({
      user: req.user
    });
  },

  async updateProfile(req, res) {
    try {
      const { name, profile_image } = req.body;
      const updated = db.tables.update('users', u => u.id === req.user.id, {
        ...(name && { name: name.trim() }),
        ...(profile_image && { profile_image })
      });

      return res.json({
        message: 'Profile updated successfully',
        user: {
          id: updated.id,
          name: updated.name,
          email: updated.email,
          profile_image: updated.profile_image
        }
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update profile.' });
    }
  }
};

export default authController;
