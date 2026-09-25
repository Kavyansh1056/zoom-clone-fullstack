"use client";

import React, { useEffect, useRef } from "react";
import { Mic, MicOff, Pin } from "lucide-react";
import { getInitials } from "@/lib/utils";

interface ParticipantTileProps {
  stream?: MediaStream | null;
  displayName: string;
  isLocal?: boolean;
  isHost?: boolean;
  isAudioMuted?: boolean;
  isVideoOff?: boolean;
  isSpeaking?: boolean;
  onPin?: () => void;
  isPinned?: boolean;
}

export function ParticipantTile({
  stream,
  displayName,
  isLocal = false,
  isHost = false,
  isAudioMuted = false,
  isVideoOff = false,
  isSpeaking = false,
  onPin,
  isPinned = false,
}: ParticipantTileProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Check if stream actually contains a live video track
  const hasLiveVideoTrack =
    stream &&
    stream.getVideoTracks().length > 0 &&
    stream.getVideoTracks().some((t) => t.readyState === "live");

  const showVideo = !isVideoOff && Boolean(hasLiveVideoTrack);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!stream) {
      video.srcObject = null;
      return;
    }

    // Set DOM property srcObject
    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    // CRITICAL: Imperatively set muted on the DOM property for local video
    // to bypass Chrome's unmuted-autoplay restriction
    if (isLocal) {
      video.muted = true;
      video.defaultMuted = true;
    }

    const startPlayback = () => {
      if (video.paused) {
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            if (err.name !== "AbortError") {
              console.warn(`[ParticipantTile] Video play() error for ${displayName}:`, err);
            }
          });
        }
      }
    };

    video.addEventListener("loadedmetadata", startPlayback);
    startPlayback();

    return () => {
      video.removeEventListener("loadedmetadata", startPlayback);
    };
  }, [stream, isLocal, displayName, showVideo]);

  return (
    <div
      className={`relative w-full h-full bg-[#121316] rounded-xl overflow-hidden border transition-all duration-200 flex items-center justify-center group ${
        isSpeaking
          ? "border-emerald-500 ring-2 ring-emerald-500/40"
          : isPinned
          ? "border-[#2D8CFF] ring-2 ring-[#2D8CFF]/30"
          : "border-zinc-800 hover:border-zinc-700"
      }`}
    >
      {/* Video Element - shown when video is on and track is live */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full object-cover transition-opacity duration-200 ${
          isLocal ? "transform -scale-x-100" : ""
        } ${showVideo ? "block" : "hidden"}`}
      />

      {/* Avatar Display when Video is Off or Unavailable */}
      {!showVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1A1D24] select-none">
          <div
            className={`w-18 h-18 sm:w-24 sm:h-24 rounded-full bg-[#2D8CFF] text-white font-bold text-xl sm:text-3xl flex items-center justify-center shadow-md transition-transform ${
              isSpeaking ? "scale-105 ring-4 ring-emerald-500/50" : ""
            }`}
          >
            {getInitials(displayName)}
          </div>
          <span className="mt-2 text-xs font-medium text-slate-300">
            {displayName.replace(/\s*\((You|Host)\)/gi, "").trim()}
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5">
            {!hasLiveVideoTrack ? "Camera unavailable" : "Camera is off"}
          </span>
        </div>
      )}

      {/* Pin Video Button */}
      {onPin && (
        <button
          onClick={onPin}
          title={isPinned ? "Unpin video" : "Pin video"}
          className={`absolute top-2.5 right-2.5 p-1 rounded-md backdrop-blur-md transition-opacity duration-150 cursor-pointer ${
            isPinned
              ? "bg-[#2D8CFF] text-white opacity-100"
              : "bg-black/60 text-slate-300 hover:text-white opacity-0 group-hover:opacity-100"
          }`}
        >
          <Pin className="w-3 h-3" />
        </button>
      )}

      {/* Zoom Name Pill Badge (Bottom Left) */}
      <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 bg-black/75 backdrop-blur-xs px-2 py-0.5 rounded text-xs font-normal text-white max-w-[85%] select-none z-10">
        {/* Audio Mute Icon */}
        {isAudioMuted ? (
          <span className="text-red-400" title="Muted">
            <MicOff className="w-3 h-3" />
          </span>
        ) : (
          <span
            className={isSpeaking ? "text-emerald-400" : "text-slate-300"}
            title="Unmuted"
          >
            <Mic className="w-3 h-3" />
          </span>
        )}

        {/* Display Name */}
        <span className="truncate text-[11px]">
          {displayName.replace(/\s*\((You|Host)\)/gi, "").trim()}
          {isLocal && " (You)"}
        </span>

        {/* Host Badge */}
        {isHost && (
          <span className="text-[9px] uppercase font-bold tracking-wider px-1 py-0.2 bg-[#2D8CFF] text-white rounded">
            Host
          </span>
        )}
      </div>
    </div>
  );
}
