import React, { useState } from 'react';
import { X, UserPlus, ArrowRight, Check } from 'lucide-react';
import api from '../services/api.js';

export function JoinGroupModal({ isOpen, onClose, onGroupJoined }) {
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setIsLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const data = await api.joinGroup({ invite_code: inviteCode.trim().toUpperCase() });
      setSuccessMessage(data.message || 'Joined group successfully!');
      if (onGroupJoined) onGroupJoined(data.group);
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err) {
      setError(err.message || 'Invalid invite code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setInviteCode('');
    setError('');
    setSuccessMessage('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#202124]/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white border border-[#dadce0] rounded-3xl p-6 shadow-2xl">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-full text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-[#e6f4ea] flex items-center justify-center text-[#1e8e3e]">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#202124]">Join Travel Group</h3>
            <p className="text-xs text-[#5f6368]">Enter the invite code shared by your friend</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-[#fce8e6] border border-[#fad2cf] text-[#c5221f] text-xs">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 rounded-2xl bg-[#e6f4ea] border border-[#ceead6] text-[#137333] text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#3c4043] mb-1.5">Invite Code</label>
            <input
              type="text"
              required
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="e.g. MANALI26"
              className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#dadce0] text-[#202124] placeholder-[#80868b] text-sm font-mono tracking-wider uppercase focus:outline-none focus:border-[#1a73e8] transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !inviteCode.trim()}
            className="w-full py-2.5 rounded-full bg-[#1a73e8] hover:bg-[#1557d0] text-white font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>{isLoading ? 'Validating Code...' : 'Join Group'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

export default JoinGroupModal;
