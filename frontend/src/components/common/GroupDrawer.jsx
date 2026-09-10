import React, { useState } from 'react';
import { Users, Clock, MessageCircle, ChevronDown, ChevronUp, X, ChevronsUp, ChevronsDown, GripVertical, GripHorizontal } from 'lucide-react';
import useTripStore, { selectTravelers } from '../../store/tripStore.js';
import useAuthStore from '../../store/authStore.js';
import MemberList from '../members/MemberList.jsx';
import TripTimeline from '../timeline/TripTimeline.jsx';
import ChatPanel from './ChatPanel.jsx';

export function GroupDrawer() {
  const {
    isDrawerOpen,
    setDrawerOpen,
    activeDrawerTab,
    setActiveDrawerTab,
    members,
    events,
    liveLocations,
    trip
  } = useTripStore();

  const { user } = useAuthStore();
  // 3 Mobile sheet states: 'COLLAPSED', 'PARTIAL', 'FULL'
  const [mobileSheetState, setMobileSheetState] = useState('COLLAPSED');
  const [drawerSize, setDrawerSize] = useState({ width: 380, height: null });
  const resizeStart = React.useRef(null);

  const travelers = selectTravelers(members, liveLocations, user?.id, trip?.destination);
  const leaderTraveler = travelers.find(t => t.isLeader);
  const movingCount = travelers.filter(t => t.status === 'MOVING' || t.status === 'REJOINED').length;
  const stoppedCount = travelers.filter(t => t.status === 'STOPPED' || t.status === 'POSSIBLE_STOP').length;
  const splitCount = travelers.filter(t => t.status === 'SPLIT' || t.status === 'FALLING_BEHIND').length;
  const arrivedCount = travelers.filter(t => t.status === 'ARRIVED').length;

  const cycleMobileSheet = () => {
    if (mobileSheetState === 'COLLAPSED') setMobileSheetState('PARTIAL');
    else if (mobileSheetState === 'PARTIAL') setMobileSheetState('FULL');
    else setMobileSheetState('COLLAPSED');
  };

  const startResize = (event, direction) => {
    event.preventDefault();
    event.stopPropagation();
    resizeStart.current = {
      direction,
      x: event.clientX,
      y: event.clientY,
      width: drawerSize.width,
      height: drawerSize.height || window.innerHeight - 106
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const resizeDrawer = (event) => {
    const start = resizeStart.current;
    if (!start) return;
    const nextSize = { ...drawerSize };
    if (start.direction === 'width') {
      nextSize.width = Math.min(560, Math.max(320, start.width + start.x - event.clientX));
    } else {
      nextSize.height = Math.min(window.innerHeight - 106, Math.max(260, start.height + event.clientY - start.y));
    }
    setDrawerSize(nextSize);
  };

  const stopResize = () => {
    resizeStart.current = null;
  };

  const renderContent = () => {
    if (activeDrawerTab === 'TIMELINE') return <TripTimeline />;
    if (activeDrawerTab === 'CHAT') return <ChatPanel />;
    return <MemberList />;
  };

  return (
    <>
      {/* 1. DESKTOP FLOATING DRAWER (Right side of screen over the map) */}
      {isDrawerOpen && (
        <div style={{ width: `${drawerSize.width}px`, ...(drawerSize.height ? { height: `${drawerSize.height}px`, bottom: 'auto' } : {}) }} className="hidden md:flex absolute top-[90px] right-4 bottom-4 z-40 max-w-[calc(100vw-2rem)] min-w-[320px] min-h-[260px] flex-col bg-white border border-[#dadce0] rounded-3xl shadow-xl overflow-visible pointer-events-auto animate-in fade-in slide-in-from-right-4 duration-200">
          <button type="button" onPointerDown={(event) => startResize(event, 'width')} onPointerMove={resizeDrawer} onPointerUp={stopResize} className="absolute top-1/2 -left-3 z-10 w-6 h-12 -translate-y-1/2 rounded-full bg-white border border-[#dadce0] shadow-sm text-[#9aa0a6] hover:text-[#1a73e8] flex items-center justify-center cursor-ew-resize" title="Resize panel width" aria-label="Resize panel width">
            <GripVertical className="w-3.5 h-3.5" />
          </button>
          <button type="button" onPointerDown={(event) => startResize(event, 'height')} onPointerMove={resizeDrawer} onPointerUp={stopResize} className="absolute -top-3 left-1/2 z-10 w-12 h-6 -translate-x-1/2 rounded-full bg-white border border-[#dadce0] shadow-sm text-[#9aa0a6] hover:text-[#1a73e8] flex items-center justify-center cursor-ns-resize" title="Resize panel height" aria-label="Resize panel height">
            <GripHorizontal className="w-3.5 h-3.5" />
          </button>
          {/* Navigation Tabs Header */}
          <div className="p-3 border-b border-[#dadce0] bg-[#f8f9fa] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 bg-[#f1f3f4] p-0.5 rounded-full text-[11px]">
                <button
                  onClick={() => setActiveDrawerTab('MEMBERS')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold transition-all ${
                    activeDrawerTab === 'MEMBERS'
                      ? 'bg-white text-[#1a73e8] shadow-sm'
                      : 'text-[#5f6368] hover:text-[#202124]'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Travelers ({travelers.length})</span>
                </button>

                <button
                  onClick={() => setActiveDrawerTab('CHAT')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold transition-all ${
                    activeDrawerTab === 'CHAT' ? 'bg-white text-[#1a73e8] shadow-sm' : 'text-[#5f6368] hover:text-[#202124]'
                  }`}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Chat</span>
                </button>

                <button
                  onClick={() => setActiveDrawerTab('TIMELINE')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold transition-all ${
                    activeDrawerTab === 'TIMELINE'
                      ? 'bg-white text-[#1a73e8] shadow-sm'
                      : 'text-[#5f6368] hover:text-[#202124]'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Timeline ({events.length})</span>
                </button>
              </div>

              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-full text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4] transition-colors"
                title="Close Panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold text-[#5f6368]">
                {movingCount} Moving · {stoppedCount} Stopped
              </span>
              <span className="text-[10px] font-bold text-[#1e8e3e]">
                Sharing ON
              </span>
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden relative">
            {renderContent()}
          </div>
        </div>
      )}

      {/* 2. MOBILE 3-STATE EXPANDABLE BOTTOM SHEET */}
      <div
        className={`md:hidden fixed inset-x-0 bottom-0 z-40 bg-white border-t border-[#dadce0] rounded-t-3xl shadow-2xl transition-all duration-300 pointer-events-auto flex flex-col ${
          mobileSheetState === 'FULL'
            ? 'h-[65vh]'
            : mobileSheetState === 'PARTIAL'
            ? 'h-[40vh]'
            : 'h-14'
        }`}
      >
        {/* Sheet Drag Handle & Peek Bar */}
        <div
          onClick={cycleMobileSheet}
          className="p-3 px-4 flex items-center justify-between cursor-pointer border-b border-[#f1f3f4] shrink-0 bg-white rounded-t-3xl relative"
        >
          {/* Top Pill Handle Indicator */}
          <div className="w-9 h-1 bg-[#dadce0] rounded-full absolute top-1.5 left-1/2 transform -translate-x-1/2" />

          {/* Left Summary Info */}
          <div className="flex items-center gap-2 pt-1 min-w-0">
            <span className="font-bold text-xs text-[#202124] truncate">
              {travelers.length} Travelers
            </span>
            <div className="flex items-center gap-2 shrink-0 text-[10px]">
              {movingCount > 0 && (
                <span className="text-[#137333] font-bold">
                  🟢 {movingCount}
                </span>
              )}
              {stoppedCount > 0 && (
                <span className="text-[#c5221f] font-bold">
                  🔴 {stoppedCount}
                </span>
              )}
            </div>
          </div>

          {/* Right Action & Tab Selectors */}
          <div className="flex items-center gap-1.5 shrink-0 pt-1">
            {mobileSheetState !== 'COLLAPSED' && (
              <div className="flex items-center gap-0.5 bg-[#f1f3f4] p-0.5 rounded-full text-[10px]">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveDrawerTab('MEMBERS');
                  }}
                  className={`px-2 py-0.5 rounded-full font-bold ${
                    activeDrawerTab === 'MEMBERS' ? 'bg-[#1a73e8] text-white' : 'text-[#5f6368]'
                  }`}
                >
                  Travelers
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveDrawerTab('CHAT');
                  }}
                  className={`px-2 py-0.5 rounded-full font-bold ${activeDrawerTab === 'CHAT' ? 'bg-[#1a73e8] text-white' : 'text-[#5f6368]'}`}
                >
                  Chat
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveDrawerTab('TIMELINE');
                  }}
                  className={`px-2 py-0.5 rounded-full font-bold ${
                    activeDrawerTab === 'TIMELINE' ? 'bg-[#1a73e8] text-white' : 'text-[#5f6368]'
                  }`}
                >
                  Timeline
                </button>
              </div>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                cycleMobileSheet();
              }}
              className="p-1 rounded-full text-[#5f6368] hover:bg-[#f1f3f4]"
              title={mobileSheetState === 'FULL' ? 'Collapse' : 'Expand'}
            >
              {mobileSheetState === 'FULL' ? (
                <ChevronDown className="w-4 h-4" />
              ) : mobileSheetState === 'PARTIAL' ? (
                <ChevronsUp className="w-4 h-4 text-[#1a73e8]" />
              ) : (
                <ChevronUp className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Sheet Content when Partial or Full */}
        {mobileSheetState !== 'COLLAPSED' && (
          <div className="flex-1 overflow-y-auto">
            {renderContent()}
          </div>
        )}
      </div>
    </>
  );
}

export default GroupDrawer;
