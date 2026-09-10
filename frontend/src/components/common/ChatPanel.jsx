import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { getSocket } from '../../services/socket.js';
import useTripStore from '../../store/tripStore.js';
import useAuthStore from '../../store/authStore.js';

export function ChatPanel() {
  const { trip, chatMessages } = useTripStore();
  const { user } = useAuthStore();
  const [draft, setDraft] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length]);

  const sendMessage = (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !trip?.id) return;
    getSocket().emit('chat:send', { tripId: trip.id, text });
    setDraft('');
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="px-4 py-3 border-b border-[#f1f3f4] flex items-center gap-2 shrink-0">
        <MessageCircle className="w-4 h-4 text-[#1a73e8]" />
        <div>
          <p className="text-xs font-bold text-[#202124]">Live group chat</p>
          <p className="text-[10px] text-[#5f6368]">Messages are visible to this trip</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {chatMessages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center text-[#9aa0a6] px-8">
            <MessageCircle className="w-8 h-8 mb-2 text-[#dadce0]" />
            <p className="text-xs font-semibold">Start the conversation</p>
            <p className="text-[10px] mt-1">Coordinate your next stop with the group.</p>
          </div>
        )}
        {chatMessages.map((message) => {
          const isMine = message.userId === user?.id;
          return (
            <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[82%] rounded-2xl px-3 py-2 ${isMine ? 'bg-[#1a73e8] text-white rounded-br-sm' : 'bg-[#f1f3f4] text-[#202124] rounded-bl-sm'}`}>
                {!isMine && <p className="text-[10px] font-bold text-[#1a73e8] mb-0.5">{message.userName}</p>}
                <p className="text-xs leading-5 break-words">{message.text}</p>
                <p className={`text-[9px] mt-1 ${isMine ? 'text-blue-100' : 'text-[#80868b]'}`}>
                  {new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form onSubmit={sendMessage} className="p-3 border-t border-[#f1f3f4] flex gap-2 shrink-0">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={500}
          placeholder="Write a message..."
          aria-label="Write a message"
          className="min-w-0 flex-1 rounded-full border border-[#dadce0] px-3 py-2 text-xs text-[#202124] outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8]"
        />
        <button type="submit" disabled={!draft.trim()} title="Send message" aria-label="Send message" className="w-9 h-9 shrink-0 rounded-full bg-[#1a73e8] text-white flex items-center justify-center disabled:bg-[#dadce0] disabled:text-[#80868b]">
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

export default ChatPanel;
