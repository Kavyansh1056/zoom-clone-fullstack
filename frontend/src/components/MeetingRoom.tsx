"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Video,
} from "lucide-react";
import { Meeting } from "@/lib/types";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useConnectionQuality } from "@/hooks/useConnectionQuality";
import { ConnectionQualityIndicator } from "@/components/ConnectionQualityIndicator";
import { ParticipantTile } from "@/components/ParticipantTile";
import { MeetingControls } from "@/components/MeetingControls";
import { ParticipantsPanel } from "@/components/ParticipantsPanel";
import { ChatPanel } from "@/components/ChatPanel";
import { leaveMeeting } from "@/lib/api";
import { copyToClipboard, formatMeetingId } from "@/lib/utils";
import { useToast } from "@/components/Toast";

interface MeetingRoomProps {
  meeting: Meeting;
  displayName: string;
  initialAudioEnabled?: boolean;
  initialVideoEnabled?: boolean;
  isHost?: boolean;
  initialStream?: MediaStream | null;
}

export function MeetingRoom({
  meeting,
  displayName,
  initialAudioEnabled = true,
  initialVideoEnabled = true,
  isHost = false,
  initialStream = null,
}: MeetingRoomProps) {
  const router = useRouter();
  const { showToast } = useToast();

  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pinnedPeerId, setPinnedPeerId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [kickedMessage, setKickedMessage] = useState<string | null>(null);

  // Setup WebRTC hook
  const {
    peerId,
    localStream,
    isAudioMuted,
    isVideoOff,
    isScreenSharing,
    peers,
    remoteStreams,
    chatMessages,
    connectionStatus,
    peerConnections,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    sendChatMessage,
    hostMuteAll,
    removeParticipant,
  } = useWebRTC({
    meetingId: meeting.meeting_id,
    displayName,
    initialAudioEnabled,
    initialVideoEnabled,
    isHost,
    initialStream,
    onKicked: (reason) => {
      setKickedMessage(reason || "You have been removed from the meeting by the host.");
    },
  });

  // Call timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Leave meeting handler
  const handleLeaveMeeting = async () => {
    try {
      await leaveMeeting(meeting.meeting_id, displayName, peerId);
    } catch (e) {
      console.warn("Error recording leave in backend:", e);
    }
    router.push("/");
  };

  const handleCopyMeetingId = async () => {
    const success = await copyToClipboard(meeting.meeting_id);
    if (success) {
      setCopiedId(true);
      showToast("Meeting ID copied!", "success");
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  // Participant array for grid
  const peerList = Array.from(peers.values());
  const totalParticipantCount = 1 + peerList.length;

  // Real-time WebRTC connection quality monitor
  const connectionQualityStats = useConnectionQuality({
    peerConnections,
    connectionStatus,
    peerCount: peerList.length,
  });

  // Grid layout classes based on participant count
  const getGridClasses = () => {
    if (pinnedPeerId) {
      return "grid-cols-1 md:grid-cols-4";
    }
    switch (totalParticipantCount) {
      case 1:
        return "grid-cols-1 max-w-4xl mx-auto h-[78vh]";
      case 2:
        return "grid-cols-1 md:grid-cols-2 max-w-6xl mx-auto h-[78vh]";
      case 3:
      case 4:
        return "grid-cols-1 sm:grid-cols-2 max-w-6xl mx-auto h-[78vh]";
      case 5:
      case 6:
        return "grid-cols-2 md:grid-cols-3 max-w-7xl mx-auto h-[78vh]";
      default:
        return "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 max-w-7xl mx-auto h-[78vh]";
    }
  };

  return (
    <div className="relative h-screen w-screen bg-[#121316] text-white flex flex-col justify-between overflow-hidden select-none font-sans">
      {/* Top Header Bar */}
      <header className="h-12 sm:h-13 bg-[#18181B] border-b border-zinc-800 px-4 sm:px-6 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#2D8CFF] flex items-center justify-center text-white">
              <Video className="w-3.5 h-3.5 fill-white stroke-none" />
            </div>
            <h1 className="font-semibold text-xs sm:text-sm text-slate-100 truncate max-w-[200px] sm:max-w-md">
              {meeting.title}
            </h1>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-700/60">
            <span className="font-mono text-[11px]">{formatMeetingId(meeting.meeting_id)}</span>
            <button
              onClick={handleCopyMeetingId}
              title="Copy ID"
              className="hover:text-white transition-colors cursor-pointer"
            >
              {copiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Center: Live Timer Badge & Quality Indicator */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-medium text-slate-300 bg-zinc-800/60 px-2.5 py-0.5 rounded-full border border-zinc-700/50">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{formatTimer(callDuration)}</span>
          </div>
          <ConnectionQualityIndicator stats={connectionQualityStats} />
        </div>

        {/* Right: Fullscreen Action */}
        <div className="flex items-center gap-1">
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Conference Area: Grid + Drawers */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Video Grid Container */}
        <main className="flex-1 p-3 sm:p-4 flex items-center justify-center overflow-y-auto">
          <div className={`w-full grid gap-2.5 sm:gap-3 transition-all duration-200 ${getGridClasses()}`}>
            {/* Local Participant Tile */}
            <div className="w-full h-full min-h-[200px]">
              <ParticipantTile
                stream={localStream}
                displayName={displayName}
                isLocal={true}
                isHost={isHost}
                isAudioMuted={isAudioMuted}
                isVideoOff={isVideoOff}
                onPin={() => setPinnedPeerId(pinnedPeerId === "local" ? null : "local")}
                isPinned={pinnedPeerId === "local"}
              />
            </div>

            {/* Remote Participants Tiles */}
            {peerList.map((peer) => {
              const remoteStream = remoteStreams.get(peer.peer_id) || null;
              return (
                <div key={peer.peer_id} className="w-full h-full min-h-[200px]">
                  <ParticipantTile
                    stream={remoteStream}
                    displayName={peer.display_name}
                    isLocal={false}
                    isHost={peer.is_host}
                    isAudioMuted={!peer.audio_enabled}
                    isVideoOff={!peer.video_enabled}
                    onPin={() => setPinnedPeerId(pinnedPeerId === peer.peer_id ? null : peer.peer_id)}
                    isPinned={pinnedPeerId === peer.peer_id}
                  />
                </div>
              );
            })}
          </div>
        </main>

        {/* Participants Side Drawer */}
        <ParticipantsPanel
          isOpen={isParticipantsOpen}
          onClose={() => setIsParticipantsOpen(false)}
          localName={displayName}
          isHost={isHost}
          localAudioMuted={isAudioMuted}
          localVideoOff={isVideoOff}
          peers={peerList}
          onHostMuteAll={hostMuteAll}
          onRemoveParticipant={removeParticipant}
        />

        {/* Chat Side Drawer */}
        <ChatPanel
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          messages={chatMessages}
          onSendMessage={sendChatMessage}
        />
      </div>

      {/* Bottom Meeting Control Toolbar */}
      <MeetingControls
        isAudioMuted={isAudioMuted}
        isVideoOff={isVideoOff}
        isScreenSharing={isScreenSharing}
        isHost={isHost}
        participantCount={totalParticipantCount}
        unreadChatCount={0}
        inviteLink={meeting.invite_link}
        isParticipantsOpen={isParticipantsOpen}
        isChatOpen={isChatOpen}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onToggleScreenShare={toggleScreenShare}
        onToggleParticipants={() => {
          setIsParticipantsOpen(!isParticipantsOpen);
          if (!isParticipantsOpen) setIsChatOpen(false);
        }}
        onToggleChat={() => {
          setIsChatOpen(!isChatOpen);
          if (!isChatOpen) setIsParticipantsOpen(false);
        }}
        onLeaveMeeting={handleLeaveMeeting}
        onHostMuteAll={isHost ? hostMuteAll : undefined}
      />

      {/* Kicked Modal */}
      {kickedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#242731] border border-zinc-700 rounded-2xl max-w-sm w-full p-6 text-center text-white shadow-2xl">
            <h3 className="text-base font-bold text-red-400 mb-1.5">Meeting Notice</h3>
            <p className="text-xs text-slate-300 mb-5">{kickedMessage}</p>
            <button
              onClick={() => router.push("/")}
              className="w-full py-2 bg-[#2D8CFF] hover:bg-[#1A73E8] text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
