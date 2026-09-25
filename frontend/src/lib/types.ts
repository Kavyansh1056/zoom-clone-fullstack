export interface Participant {
  id?: number;
  meeting_id?: string;
  display_name: string;
  peer_id?: string;
  is_host: boolean;
  joined_at?: string;
  left_at?: string | null;
}

export interface Meeting {
  id: number;
  meeting_id: string;
  title: string;
  description?: string | null;
  host_name: string;
  scheduled_at: string | null;
  duration: number; // minutes
  invite_link: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  created_at: string;
  ended_at?: string | null;
  participants: Participant[];
  active_participant_count?: number;
}

export interface CreateMeetingInput {
  title: string;
  description?: string;
  host_name?: string;
  scheduled_at?: string;
  duration?: number;
  is_instant?: boolean;
}

export interface PeerInfo {
  peer_id: string;
  display_name: string;
  is_host: boolean;
  audio_enabled?: boolean;
  video_enabled?: boolean;
  stream?: MediaStream;
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  message: string;
  timestamp: string;
  is_self?: boolean;
}

export type SignalingMessageType =
  | "room-info"
  | "user-joined"
  | "user-left"
  | "offer"
  | "answer"
  | "ice-candidate"
  | "media-state"
  | "host-mute-all"
  | "remove-participant"
  | "removed-by-host"
  | "chat-message";

export interface SignalingMessage {
  type: SignalingMessageType;
  peer_id?: string;
  sender_id?: string;
  sender_name?: string;
  target_id?: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  audio_enabled?: boolean;
  video_enabled?: boolean;
  peers?: PeerInfo[];
  display_name?: string;
  is_host?: boolean;
  message?: string;
  timestamp?: string;
  reason?: string;
  meeting?: {
    meeting_id: string;
    title: string;
    host_name: string;
  };
}
