import { z } from 'zod';
import db from '../models/db.js';

export const createGroupSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Group name must be at least 2 characters')
  })
});

export const joinGroupSchema = z.object({
  body: z.object({
    invite_code: z.string().min(3, 'Invite code is required').max(32)
  })
});

function generateInviteCode(groupName) {
  const prefix = groupName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
  const randomSuffix = Math.floor(10 + Math.random() * 90);
  const code = `${prefix || 'GRP'}${randomSuffix}`;
  
  // Ensure uniqueness
  const existing = db.tables.get('groups').find(g => g.invite_code === code);
  if (existing) {
    return `${prefix || 'GRP'}${Math.floor(100 + Math.random() * 900)}`;
  }
  return code;
}

export const groupController = {
  async createGroup(req, res) {
    try {
      const { name } = req.body;
      const invite_code = generateInviteCode(name);

      const group = db.tables.insert('groups', {
        name: name.trim(),
        invite_code,
        created_by: req.user.id
      });

      // Add creator as OWNER
      db.tables.insert('group_members', {
        group_id: group.id,
        user_id: req.user.id,
        role: 'OWNER'
      });

      return res.status(201).json({
        message: 'Group created successfully',
        group: {
          ...group,
          isOwner: true,
          memberCount: 1
        }
      });
    } catch (err) {
      console.error('[Group] Create error:', err);
      return res.status(500).json({ error: 'Failed to create group.' });
    }
  },

  async joinGroup(req, res) {
    try {
      const { invite_code } = req.body;
      const cleanCode = invite_code.trim().toUpperCase();

      const group = db.tables.get('groups').find(g => g.invite_code.toUpperCase() === cleanCode);
      if (!group) {
        return res.status(404).json({ error: 'Invalid invite code. No group found.' });
      }

      // Check if already member
      const existingMember = db.tables.get('group_members').find(
        m => m.group_id === group.id && m.user_id === req.user.id
      );

      if (existingMember) {
        return res.json({
          message: 'You are already a member of this group',
          group
        });
      }

      db.tables.insert('group_members', {
        group_id: group.id,
        user_id: req.user.id,
        role: 'MEMBER'
      });

      return res.status(200).json({
        message: `Successfully joined ${group.name}!`,
        group
      });
    } catch (err) {
      console.error('[Group] Join error:', err);
      return res.status(500).json({ error: 'Failed to join group.' });
    }
  },

  async getUserGroups(req, res) {
    try {
      const memberships = db.tables.get('group_members').filter(m => m.user_id === req.user.id);
      const groupIds = memberships.map(m => m.group_id);

      const allGroups = db.tables.get('groups').filter(g => groupIds.includes(g.id));
      const allMembers = db.tables.get('group_members');
      const allTrips = db.tables.get('trips');

      const enrichedGroups = allGroups.map(group => {
        const memRecord = memberships.find(m => m.group_id === group.id);
        const memberCount = allMembers.filter(m => m.group_id === group.id).length;
        const activeTrip = allTrips.find(t => t.group_id === group.id && t.status === 'ACTIVE');
        const tripsCount = allTrips.filter(t => t.group_id === group.id).length;

        return {
          ...group,
          role: memRecord ? memRecord.role : 'MEMBER',
          isOwner: memRecord ? memRecord.role === 'OWNER' : false,
          memberCount,
          activeTrip: activeTrip || null,
          tripsCount
        };
      });

      return res.json({ groups: enrichedGroups });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch groups.' });
    }
  },

  async getGroupDetails(req, res) {
    try {
      const { groupId } = req.params;
      const group = db.tables.get('groups').find(g => g.id === groupId);

      if (!group) {
        return res.status(404).json({ error: 'Group not found.' });
      }

      // Check membership
      const membership = db.tables.get('group_members').find(
        m => m.group_id === groupId && m.user_id === req.user.id
      );

      if (!membership) {
        return res.status(403).json({ error: 'You are not a member of this group.' });
      }

      // Get members with user details
      const groupMembers = db.tables.get('group_members').filter(m => m.group_id === groupId);
      const allUsers = db.tables.get('users');

      const members = groupMembers.map(gm => {
        const user = allUsers.find(u => u.id === gm.user_id);
        return {
          id: gm.user_id,
          name: user ? user.name : 'Unknown User',
          email: user ? user.email : '',
          profile_image: user ? user.profile_image : '',
          role: gm.role,
          joined_at: gm.joined_at,
          isOnline: true // Active in group
        };
      });

      // Get trips for this group
      const trips = db.tables.get('trips').filter(t => t.group_id === groupId);

      return res.json({
        group: {
          ...group,
          isOwner: membership.role === 'OWNER',
          myRole: membership.role
        },
        members,
        trips
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to load group details.' });
    }
  },

  async removeMember(req, res) {
    try {
      const { groupId, userId } = req.params;

      // Check if current user is owner
      const requesterMembership = db.tables.get('group_members').find(
        m => m.group_id === groupId && m.user_id === req.user.id
      );

      if (!requesterMembership || requesterMembership.role !== 'OWNER') {
        return res.status(403).json({ error: 'Only group owners can remove members.' });
      }

      if (userId === req.user.id) {
        return res.status(400).json({ error: 'Owners cannot remove themselves from the group.' });
      }

      db.tables.delete('group_members', m => m.group_id === groupId && m.user_id === userId);

      return res.json({ message: 'Member removed successfully.' });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to remove member.' });
    }
  }
};

export default groupController;
