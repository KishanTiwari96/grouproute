import React, { useState } from 'react';
import { X, Users, Copy, Check, ArrowRight } from 'lucide-react';
import api from '../services/api.js';

export function CreateGroupModal({ isOpen, onClose, onGroupCreated }) {
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [createdGroup, setCreatedGroup] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsLoading(true);
    setError('');

    try {
      const data = await api.createGroup({ name: name.trim() });
      setCreatedGroup(data.group);
      if (onGroupCreated) onGroupCreated(data.group);
    } catch (err) {
      setError(err.message || 'Failed to create group.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!createdGroup?.invite_code) return;
    navigator.clipboard.writeText(createdGroup.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleClose = () => {
    setName('');
    setCreatedGroup(null);
    setError('');
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

        {!createdGroup ? (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-[#e8f0fe] flex items-center justify-center text-[#1a73e8]">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#202124]">Create Travel Group</h3>
                <p className="text-xs text-[#5f6368]">Plan and track trips with your friends</p>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-2xl bg-[#fce8e6] border border-[#fad2cf] text-[#c5221f] text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#3c4043] mb-1.5">Group Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Manali Road Trip, Ladakh Riders"
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#dadce0] text-[#202124] placeholder-[#80868b] text-sm focus:outline-none focus:border-[#1a73e8] transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !name.trim()}
                className="w-full py-2.5 rounded-full bg-[#1a73e8] hover:bg-[#1557d0] text-white font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>{isLoading ? 'Creating Group...' : 'Create Group'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          <div className="text-center py-2 animate-in fade-in">
            <div className="w-14 h-14 rounded-full bg-[#e6f4ea] border border-[#ceead6] text-[#1e8e3e] flex items-center justify-center mx-auto mb-4">
              <Check className="w-7 h-7" />
            </div>

            <h3 className="text-xl font-bold text-[#202124] mb-1">Group Created!</h3>
            <p className="text-sm text-[#5f6368] mb-6">
              Share this invite code with your friends to let them join <span className="text-[#202124] font-semibold">{createdGroup.name}</span>.
            </p>

            <div className="p-4 rounded-2xl bg-[#f8f9fa] border border-[#dadce0] mb-6">
              <span className="text-[11px] text-[#5f6368] uppercase tracking-wider font-bold block mb-1">
                Unique Group Invite Code
              </span>
              <div className="flex items-center justify-center gap-3">
                <span className="text-2xl font-mono font-extrabold tracking-widest text-[#1a73e8]">
                  {createdGroup.invite_code}
                </span>
                <button
                  onClick={handleCopy}
                  className="p-2 rounded-full bg-white hover:bg-[#f1f3f4] text-[#5f6368] border border-[#dadce0] transition-colors"
                  title="Copy Invite Code"
                >
                  {copied ? <Check className="w-4 h-4 text-[#1e8e3e]" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              {copied && <span className="text-[11px] text-[#1e8e3e] font-bold mt-1 block">Copied to clipboard!</span>}
            </div>

            <button
              onClick={handleClose}
              className="w-full py-2.5 rounded-full bg-[#1a73e8] hover:bg-[#1557d0] text-white font-bold text-sm transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default CreateGroupModal;
