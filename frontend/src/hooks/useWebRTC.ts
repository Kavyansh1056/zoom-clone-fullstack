"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { PeerInfo, SignalingMessage, ChatMessage } from "@/lib/types";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

interface UseWebRTCOptions {
  meetingId: string;
  displayName: string;
  initialAudioEnabled?: boolean;
  initialVideoEnabled?: boolean;
  isHost?: boolean;
  initialStream?: MediaStream | null;
  onKicked?: (reason?: string) => void;
}

export function useWebRTC({
  meetingId,
  displayName,
  initialAudioEnabled = true,
  initialVideoEnabled = true,
  isHost = false,
  initialStream = null,
  onKicked,
}: UseWebRTCOptions) {
  const [peerId] = useState<string>(() => "peer-" + Math.random().toString(36).substring(2, 10));
  const [localStream, setLocalStream] = useState<MediaStream | null>(initialStream);
  const [isAudioMuted, setIsAudioMuted] = useState(!initialAudioEnabled);
  const [isVideoOff, setIsVideoOff] = useState(!initialVideoEnabled);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [peers, setPeers] = useState<Map<string, PeerInfo>>(new Map());
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [deviceError, setDeviceError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(initialStream);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const originalVideoTrackRef = useRef<MediaStreamTrack | null>(null);

  // Send message over WebSocket signaling channel
  const sendSignalingMessage = useCallback((msg: SignalingMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // Drain queued ICE candidates once remote description is set
  const drainPendingIceCandidates = useCallback(async (remotePeerId: string, pc: RTCPeerConnection) => {
    const queue = pendingIceCandidates.current.get(remotePeerId);
    if (queue && queue.length > 0) {
      console.log(`[WebRTC] Draining ${queue.length} buffered ICE candidates for ${remotePeerId}`);
      while (queue.length > 0) {
        const candidate = queue.shift();
        if (candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.warn(`[WebRTC] Failed to add buffered ICE candidate for ${remotePeerId}:`, err);
          }
        }
      }
    }
  }, []);

  // Initialize local audio/video media stream
  const initLocalStream = useCallback(async (): Promise<MediaStream | null> => {
    // 1. If we already have a stream passed in from MeetingPreview, use it!
    if (localStreamRef.current) {
      const activeVideo = localStreamRef.current.getVideoTracks().find((t) => t.readyState === "live");
      if (activeVideo) {
        originalVideoTrackRef.current = activeVideo;
        activeVideo.enabled = initialVideoEnabled;
      }
      const activeAudio = localStreamRef.current.getAudioTracks().find((t) => t.readyState === "live");
      if (activeAudio) {
        activeAudio.enabled = initialAudioEnabled;
      }
      setLocalStream(localStreamRef.current);
      return localStreamRef.current;
    }

    // 2. Otherwise request media from browser
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    } catch (fullErr: any) {
      console.warn("[WebRTC] Combined getUserMedia failed, attempting separate device acquisition:", fullErr);

      let videoTrack: MediaStreamTrack | null = null;
      let audioTrack: MediaStreamTrack | null = null;

      try {
        const vStream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoTrack = vStream.getVideoTracks()[0] || null;
      } catch (vErr) {
        console.warn("[WebRTC] Video device unavailable:", vErr);
      }

      try {
        const aStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioTrack = aStream.getAudioTracks()[0] || null;
      } catch (aErr) {
        console.warn("[WebRTC] Audio device unavailable:", aErr);
      }

      if (videoTrack || audioTrack) {
        stream = new MediaStream();
        if (videoTrack) stream.addTrack(videoTrack);
        if (audioTrack) stream.addTrack(audioTrack);
      } else {
        // Both unavailable or denied
        setDeviceError(
          fullErr?.name === "NotAllowedError" || fullErr?.name === "PermissionDeniedError"
            ? "Camera or microphone permission was denied."
            : "No camera or microphone detected."
        );
        setIsVideoOff(true);
        setIsAudioMuted(true);
        return null;
      }
    }

    if (stream) {
      const vTrack = stream.getVideoTracks()[0];
      if (vTrack) {
        originalVideoTrackRef.current = vTrack;
        vTrack.enabled = initialVideoEnabled;
        setIsVideoOff(!initialVideoEnabled);
      } else {
        setIsVideoOff(true);
      }

      const aTrack = stream.getAudioTracks()[0];
      if (aTrack) {
        aTrack.enabled = initialAudioEnabled;
        setIsAudioMuted(!initialAudioEnabled);
      } else {
        setIsAudioMuted(true);
      }

      localStreamRef.current = stream;
      setLocalStream(stream);
    }

    return stream;
  }, [initialAudioEnabled, initialVideoEnabled]);

  // Create an RTCPeerConnection for a remote peer
  const createPeerConnection = useCallback((remotePeerId: string, remoteDisplayName: string, isInitiator: boolean) => {
    if (peerConnections.current.has(remotePeerId)) {
      return peerConnections.current.get(remotePeerId)!;
    }

    console.log(`[WebRTC] Creating RTCPeerConnection for peer ${remotePeerId} (initiator=${isInitiator})`);
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Attach local stream tracks to this peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle incoming ICE candidates and send to remote peer via signaling
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignalingMessage({
          type: "ice-candidate",
          sender_id: peerId,
          target_id: remotePeerId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Handle incoming remote media tracks
    pc.ontrack = (event) => {
      console.log(`[WebRTC] Received remote track from ${remotePeerId}:`, event.track.kind);
      const [remoteStream] = event.streams;
      if (remoteStream) {
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.set(remotePeerId, remoteStream);
          return next;
        });
      } else {
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          let currentStream = next.get(remotePeerId);
          if (!currentStream) {
            currentStream = new MediaStream();
          }
          currentStream.addTrack(event.track);
          next.set(remotePeerId, currentStream);
          return next;
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE state with ${remotePeerId}:`, pc.iceConnectionState);
    };

    peerConnections.current.set(remotePeerId, pc);

    // If initiator, send offer
    if (isInitiator) {
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          sendSignalingMessage({
            type: "offer",
            sender_id: peerId,
            target_id: remotePeerId,
            sdp: pc.localDescription?.toJSON() as RTCSessionDescriptionInit,
          });
        })
        .catch((err) => console.error("Error creating WebRTC offer:", err));
    }

    return pc;
  }, [peerId, sendSignalingMessage]);

  // Handle incoming SDP Offer
  const handleOffer = useCallback(async (senderId: string, sdp: RTCSessionDescriptionInit) => {
    let pc = peerConnections.current.get(senderId);
    if (!pc) {
      pc = createPeerConnection(senderId, "Participant", false);
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await drainPendingIceCandidates(senderId, pc);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      sendSignalingMessage({
        type: "answer",
        sender_id: peerId,
        target_id: senderId,
        sdp: pc.localDescription?.toJSON() as RTCSessionDescriptionInit,
      });
    } catch (err) {
      console.error("Error handling WebRTC offer:", err);
    }
  }, [createPeerConnection, drainPendingIceCandidates, peerId, sendSignalingMessage]);

  // Handle incoming SDP Answer
  const handleAnswer = useCallback(async (senderId: string, sdp: RTCSessionDescriptionInit) => {
    const pc = peerConnections.current.get(senderId);
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await drainPendingIceCandidates(senderId, pc);
      } catch (err) {
        console.error("Error setting remote description from answer:", err);
      }
    }
  }, [drainPendingIceCandidates]);

  // Handle incoming ICE Candidate
  const handleIceCandidate = useCallback(async (senderId: string, candidate: RTCIceCandidateInit) => {
    const pc = peerConnections.current.get(senderId);
    if (!pc || !pc.remoteDescription || !pc.remoteDescription.type) {
      if (!pendingIceCandidates.current.has(senderId)) {
        pendingIceCandidates.current.set(senderId, []);
      }
      pendingIceCandidates.current.get(senderId)!.push(candidate);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error("Error adding received ICE candidate:", err);
    }
  }, []);

  // Connect to WebSocket signaling server
  useEffect(() => {
    let isSubscribed = true;

    async function startConference() {
      await initLocalStream();
      if (!isSubscribed) return;

      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      let wsHost = "";
      if (process.env.NEXT_PUBLIC_WS_URL) {
        wsHost = process.env.NEXT_PUBLIC_WS_URL.replace(/^http/i, "ws").replace(/\/$/, "");
      } else if (process.env.NEXT_PUBLIC_API_URL) {
        wsHost = process.env.NEXT_PUBLIC_API_URL.replace(/^http/i, "ws").replace(/\/$/, "");
      } else {
        wsHost = `${wsProtocol}//${window.location.hostname || "localhost"}:8000`;
      }

      const wsUrl = `${wsHost}/ws/meeting/${encodeURIComponent(meetingId)}?peer_id=${peerId}&display_name=${encodeURIComponent(displayName)}&is_host=${isHost}`;

      console.log(`[WebSocket] Connecting to signaling gateway: ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isSubscribed) return;
        setConnectionStatus("connected");
      };

      ws.onclose = () => {
        if (!isSubscribed) return;
        setConnectionStatus("disconnected");
      };

      ws.onerror = (err) => {
        console.error("[WebSocket] Signaling error:", err);
      };

      ws.onmessage = async (event) => {
        try {
          const data: SignalingMessage = JSON.parse(event.data);

          switch (data.type) {
            case "room-info": {
              const existingPeers = new Map<string, PeerInfo>();
              if (data.peers) {
                data.peers.forEach((p) => {
                  existingPeers.set(p.peer_id, p);
                  createPeerConnection(p.peer_id, p.display_name, true);
                });
              }
              setPeers(existingPeers);
              break;
            }

            case "user-joined": {
              if (data.peer_id && data.peer_id !== peerId) {
                setPeers((prev) => {
                  const next = new Map(prev);
                  next.set(data.peer_id!, {
                    peer_id: data.peer_id!,
                    display_name: data.display_name || "Participant",
                    is_host: !!data.is_host,
                    audio_enabled: data.audio_enabled ?? true,
                    video_enabled: data.video_enabled ?? true,
                  });
                  return next;
                });
                createPeerConnection(data.peer_id, data.display_name || "Participant", false);
              }
              break;
            }

            case "user-left": {
              if (data.peer_id) {
                const targetId = data.peer_id;
                if (peerConnections.current.has(targetId)) {
                  peerConnections.current.get(targetId)?.close();
                  peerConnections.current.delete(targetId);
                }
                pendingIceCandidates.current.delete(targetId);
                setRemoteStreams((prev) => {
                  const next = new Map(prev);
                  next.delete(targetId);
                  return next;
                });
                setPeers((prev) => {
                  const next = new Map(prev);
                  next.delete(targetId);
                  return next;
                });
              }
              break;
            }

            case "offer": {
              if (data.sender_id && data.sdp) {
                await handleOffer(data.sender_id, data.sdp);
              }
              break;
            }

            case "answer": {
              if (data.sender_id && data.sdp) {
                await handleAnswer(data.sender_id, data.sdp);
              }
              break;
            }

            case "ice-candidate": {
              if (data.sender_id && data.candidate) {
                await handleIceCandidate(data.sender_id, data.candidate);
              }
              break;
            }

            case "media-state": {
              if (data.sender_id) {
                setPeers((prev) => {
                  const next = new Map(prev);
                  const p = next.get(data.sender_id!);
                  if (p) {
                    next.set(data.sender_id!, {
                      ...p,
                      audio_enabled: data.audio_enabled,
                      video_enabled: data.video_enabled,
                    });
                  }
                  return next;
                });
              }
              break;
            }

            case "host-mute-all": {
              if (!isHost) {
                if (localStreamRef.current) {
                  localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = false));
                  setIsAudioMuted(true);
                }
              }
              break;
            }

            case "removed-by-host": {
              if (onKicked) {
                onKicked(data.reason || "You have been removed from the meeting by the host.");
              }
              break;
            }

            case "chat-message": {
              if (data.message) {
                const newMsg: ChatMessage = {
                  id: Math.random().toString(36).substring(2, 9),
                  sender_id: data.sender_id || "unknown",
                  sender_name: data.sender_name || "Participant",
                  message: data.message,
                  timestamp: data.timestamp || new Date().toISOString(),
                  is_self: data.sender_id === peerId,
                };
                setChatMessages((prev) => [...prev, newMsg]);
              }
              break;
            }
          }
        } catch (err) {
          console.error("Failed to parse signaling message:", err);
        }
      };
    }

    const activePeerConnections = peerConnections.current;
    const activePendingCandidates = pendingIceCandidates.current;

    startConference();

    return () => {
      isSubscribed = false;
      activePeerConnections.forEach((pc) => pc.close());
      activePeerConnections.clear();
      activePendingCandidates.clear();

      if (screenTrackRef.current) {
        screenTrackRef.current.stop();
        screenTrackRef.current = null;
      }

      if (wsRef.current) {
        wsRef.current.close();
      }

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
    };
  }, [
    meetingId,
    displayName,
    peerId,
    isHost,
    initLocalStream,
    createPeerConnection,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    onKicked,
  ]);

  // Toggle Audio (Mute / Unmute)
  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      const nextMuted = !isAudioMuted;
      audioTracks.forEach((track) => {
        track.enabled = !nextMuted;
      });
      setIsAudioMuted(nextMuted);

      sendSignalingMessage({
        type: "media-state",
        sender_id: peerId,
        audio_enabled: !nextMuted,
        video_enabled: !isVideoOff,
      });
    }
  }, [isAudioMuted, isVideoOff, peerId, sendSignalingMessage]);

  // Toggle Video (Camera On / Off)
  const toggleVideo = useCallback(async () => {
    if (localStreamRef.current) {
      let videoTrack = localStreamRef.current.getVideoTracks()[0];
      const willBeOff = !isVideoOff;

      if (willBeOff) {
        // Turning video OFF
        if (videoTrack) {
          videoTrack.enabled = false;
        }
        setIsVideoOff(true);
        sendSignalingMessage({
          type: "media-state",
          sender_id: peerId,
          audio_enabled: !isAudioMuted,
          video_enabled: false,
        });
      } else {
        // Turning video ON
        if (videoTrack && videoTrack.readyState === "live") {
          videoTrack.enabled = true;
          setIsVideoOff(false);
          sendSignalingMessage({
            type: "media-state",
            sender_id: peerId,
            audio_enabled: !isAudioMuted,
            video_enabled: true,
          });
        } else {
          // Re-acquire fresh camera track if original ended
          try {
            const vStream = await navigator.mediaDevices.getUserMedia({
              video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
            });
            const newTrack = vStream.getVideoTracks()[0];
            if (newTrack) {
              if (videoTrack) {
                localStreamRef.current.removeTrack(videoTrack);
              }
              localStreamRef.current.addTrack(newTrack);
              originalVideoTrackRef.current = newTrack;

              // Update peer connection senders
              peerConnections.current.forEach((pc) => {
                const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
                if (sender) sender.replaceTrack(newTrack);
              });

              setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
              setIsVideoOff(false);
              sendSignalingMessage({
                type: "media-state",
                sender_id: peerId,
                audio_enabled: !isAudioMuted,
                video_enabled: true,
              });
            }
          } catch (err) {
            console.warn("Could not re-enable video track:", err);
            setDeviceError("Camera unavailable");
          }
        }
      }
    }
  }, [isAudioMuted, isVideoOff, peerId, sendSignalingMessage]);

  // Stop screen sharing and restore camera
  const stopScreenShare = useCallback(() => {
    if (screenTrackRef.current) {
      screenTrackRef.current.onended = null;
      screenTrackRef.current.stop();
      screenTrackRef.current = null;
    }

    const originalTrack = originalVideoTrackRef.current;
    if (localStreamRef.current) {
      // Remove screen track from local stream
      const currentTracks = localStreamRef.current.getVideoTracks();
      currentTracks.forEach((t) => {
        if (t !== originalTrack) {
          localStreamRef.current!.removeTrack(t);
        }
      });

      // Restore camera track to local stream
      if (originalTrack && originalTrack.readyState === "live") {
        if (!localStreamRef.current.getVideoTracks().includes(originalTrack)) {
          localStreamRef.current.addTrack(originalTrack);
        }
        peerConnections.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
          if (sender) {
            sender.replaceTrack(originalTrack);
          }
        });
      }

      // CRITICAL: Update local stream so local participant tile immediately switches back to camera!
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
    }

    setIsScreenSharing(false);
  }, []);

  // Toggle Screen Sharing
  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });

        const screenTrack = screenStream.getVideoTracks()[0];
        if (!screenTrack) return;
        screenTrackRef.current = screenTrack;

        // Remember existing camera track before replacing
        if (localStreamRef.current) {
          const currentCam = localStreamRef.current.getVideoTracks()[0];
          if (currentCam && currentCam !== screenTrack) {
            originalVideoTrackRef.current = currentCam;
            localStreamRef.current.removeTrack(currentCam);
          }
          localStreamRef.current.addTrack(screenTrack);
          // CRITICAL: Update local stream so local tile renders the shared screen!
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        }

        // Replace track across all remote peer connections
        peerConnections.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
          if (sender) {
            sender.replaceTrack(screenTrack);
          }
        });

        // Listen for browser's native "Stop sharing" button
        screenTrack.onended = () => {
          stopScreenShare();
        };

        setIsScreenSharing(true);
      } catch (err: any) {
        console.warn("Screen share cancelled or failed:", err);
      }
    }
  }, [isScreenSharing, stopScreenShare]);

  // Send In-Meeting Chat Message
  const sendChatMessage = useCallback((text: string) => {
    if (!text.trim()) return;
    const timestamp = new Date().toISOString();

    sendSignalingMessage({
      type: "chat-message",
      sender_id: peerId,
      sender_name: displayName,
      message: text.trim(),
      timestamp,
    });

    setChatMessages((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        sender_id: peerId,
        sender_name: `${displayName.replace(/\s*\((You|Host)\)/gi, "").trim()} (You)`,
        message: text.trim(),
        timestamp,
        is_self: true,
      },
    ]);
  }, [displayName, peerId, sendSignalingMessage]);

  // Host Control: Mute All
  const hostMuteAll = useCallback(() => {
    if (!isHost) return;
    sendSignalingMessage({
      type: "host-mute-all",
      sender_id: peerId,
    });
  }, [isHost, peerId, sendSignalingMessage]);

  // Host Control: Remove Participant
  const removeParticipant = useCallback((targetPeerId: string) => {
    if (!isHost) return;
    sendSignalingMessage({
      type: "remove-participant",
      sender_id: peerId,
      target_id: targetPeerId,
      reason: "You were removed from the meeting by the host.",
    });

    if (peerConnections.current.has(targetPeerId)) {
      peerConnections.current.get(targetPeerId)?.close();
      peerConnections.current.delete(targetPeerId);
    }
    setPeers((prev) => {
      const next = new Map(prev);
      next.delete(targetPeerId);
      return next;
    });
  }, [isHost, peerId, sendSignalingMessage]);

  return {
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
    deviceError,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    sendChatMessage,
    hostMuteAll,
    removeParticipant,
  };
}
