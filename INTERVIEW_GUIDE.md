# Zoom Clone — Interview Preparation Guide

This guide is designed to help you confidently explain the architecture, design choices, real-time protocols, and code implementation of this Zoom Clone in technical interviews.

---

## Table of Contents
1. [Project Architecture](#1-project-architecture)
2. [Why Next.js](#2-why-nextjs)
3. [Why FastAPI](#3-why-fastapi)
4. [SQLite Schema](#4-sqlite-schema)
5. [How "New Meeting" Works](#5-how-new-meeting-works)
6. [How "Join Meeting" Works](#6-how-join-meeting-works)
7. [How Scheduling Works](#7-how-scheduling-works)
8. [What WebRTC Is](#8-what-webrtc-is)
9. [What WebSockets Are](#9-what-websockets-are)
10. [Why Both WebRTC & WebSockets Are Needed](#10-why-both-webrtc--websockets-are-needed)
11. [SDP Offer / Answer Exchange](#11-sdp-offer--answer-exchange)
12. [ICE Candidates & NAT Traversal](#12-ice-candidates--nat-traversal)
13. [RTCPeerConnection Lifecycle](#13-rtcpeerconnection-lifecycle)
14. [getUserMedia & Hardware Management](#14-getusermedia--hardware-management)
15. [Screen Sharing Implementation](#15-screen-sharing-implementation)
16. [Participant Management](#16-participant-management)
17. [How Host Controls Work](#17-how-host-controls-work)
18. [REST API Design](#18-rest-api-design)
19. [Important Database Relationships](#19-important-database-relationships)
20. [Major Technical Challenges Solved](#20-major-technical-challenges-solved)
21. [WebRTC Connection Quality & getStats() Monitoring](#21-webrtc-connection-quality--getstats-monitoring)
22. [Common Interview Questions & Model Answers](#22-common-interview-questions--model-answers)

---

## 1. Project Architecture

The application adopts a **hybrid decoupled architecture**:
1. **Metadata & State Management (Client-Server)**: Handled via standard RESTful APIs between the Next.js React frontend and FastAPI backend, backed by SQLite with SQLAlchemy.
2. **Signaling & Coordination (Bi-directional WebSocket Gateway)**: FastAPI WebSockets route real-time room discovery, SDP offers/answers, ICE candidate trickling, chat messages, and host commands.
3. **High-Bandwidth Audio/Video Streams (Peer-to-Peer WebRTC Mesh)**: Browsers exchange media streams directly over encrypted SRTP (Secure Real-time Transport Protocol). The backend server never handles or stores heavy media data.

---

## 2. Why Next.js?

- **App Router & Layout Hierarchy**: Provides clean route modularity (`/`, `/meetings`, `/meeting/[meetingId]`) with shared navigation wrappers and unified styling.
- **Client & Server Boundary Separation**: Static pages render fast, while real-time components (`useWebRTC`, `MeetingRoom`, `ParticipantTile`) operate strictly on the client using `"use client"` directives.
- **TypeScript Integration**: Strong compile-time type safety for signaling packets, media track states, and API responses.
- **Tailwind CSS Styling**: Rapid construction of Zoom's compact, professional design system without bulky CSS frameworks.

---

## 3. Why FastAPI?

- **Native Asynchronous I/O (`asyncio`)**: Python's `async/await` enables high-concurrency WebSocket connection handling with minimal memory footprint compared to synchronous Flask or Django.
- **Integrated WebSocket Router**: FastAPI handles WebSocket endpoints alongside standard REST routes in the same application, sharing database sessions and dependencies.
- **Pydantic Validation**: Automatic request parsing, data validation, and error formatting for meeting payloads.
- **Automatic OpenAPI / Swagger**: Built-in interactive API documentation at `/docs`.

---

## 4. SQLite Schema

Two core relational tables in `models.py`:
- **`meetings`**: Stores `meeting_id` (e.g., `849-204-1928`), `title`, `description`, `host_name`, `scheduled_at`, `duration`, `invite_link`, `status` (`scheduled`, `in_progress`, `completed`, `cancelled`), and timestamps.
- **`participants`**: Tracks each participant session with `meeting_id` (foreign key with `cascade="all, delete-orphan"`), `display_name`, `peer_id`, `is_host`, `joined_at`, and `left_at`.

---

## 5. How "New Meeting" Works

1. User clicks **New Meeting** on the dashboard.
2. Frontend calls `POST /api/meetings` with `{ title: "Kavyansh Mehra's Instant Meeting", host_name: "Kavyansh Mehra", is_instant: true }`.
3. Backend generates a 10-digit Zoom-style ID (e.g., `382-901-4712`), sets status to `in_progress`, and commits to SQLite.
4. Next.js router navigates to `/meeting/[meetingId]`.
5. Pre-join screen initializes camera/mic hardware, allowing pre-flight toggling.
6. Clicking **Join Meeting** mounts `MeetingRoom`, connects to the WebSocket signaling gateway, and begins peer discovery.

---

## 6. How "Join Meeting" Works

1. An invitee enters a meeting ID or clicks an invitation link (`/meeting/849-204-1928`).
2. The dynamic route fetches meeting metadata from `GET /api/meetings/{meeting_id}`.
3. If valid, the pre-join preview loads; the user enters their display name and checks audio/video.
4. On join, frontend calls `POST /api/meetings/{id}/join` to record the participant session in SQLite.
5. Client opens a WebSocket to `/ws/meeting/{meeting_id}?peer_id=...&display_name=...`.
6. Backend WebSocket manager notifies existing peers via `user-joined` and sends the newcomer `room-info` with existing participants.

---

## 7. How Scheduling Works

1. User clicks **Schedule** on the dashboard or `/meetings` page.
2. A modal collects meeting title, agenda description, scheduled date/time, and duration (e.g., 45 mins).
3. Frontend issues `POST /api/meetings` with `is_instant: false`.
4. Backend saves the meeting with `status = "scheduled"`.
5. The meeting immediately displays on the dashboard under **Upcoming Meetings** and on the **Meetings** page with direct "Start" buttons and copyable invite links.

---

## 8. What WebRTC Is

**WebRTC (Web Real-Time Communication)** is an open-standard browser API allowing peer-to-peer audio, video, and arbitrary data exchange directly between browsers without intermediate media relay servers.
- Encryption: Enforced by default using DTLS (Datagram Transport Layer Security) and SRTP.
- Codecs: VP8, VP9, or H.264 for video; Opus for low-latency audio.

---

## 9. What WebSockets Are

**WebSockets** provide a persistent, full-duplex, low-latency TCP communication channel between client and server over a single connection (`ws://` or `wss://`). Unlike HTTP request-response polling, the server can push messages to connected clients instantly.

---

## 10. Why Both WebRTC & WebSockets Are Needed

**WebRTC cannot establish a connection on its own.**
Browsers don't know each other's IP addresses, ports, or supported media codecs before connecting.
- **WebSockets = The Mailman (Signaling)**: Transports metadata (SDP session descriptions and ICE network candidates) between peers.
- **WebRTC = The Highway (Media Transmission)**: Once peers know how to reach each other, media packets stream directly peer-to-peer over UDP/SRTP without passing through the WebSocket server.

---

## 11. SDP Offer / Answer Exchange

**SDP (Session Description Protocol)** describes media capabilities (codecs, resolutions, encryption keys, media direction).
1. **Peer A (Initiator)** creates an SDP Offer: `peerConnection.createOffer()`.
2. Peer A sets its local description: `peerConnection.setLocalDescription(offer)` and sends it via WebSocket to Peer B (`type: "offer"`).
3. **Peer B (Receiver)** receives the offer and sets its remote description: `peerConnection.setRemoteDescription(offer)`.
4. Peer B creates an SDP Answer: `peerConnection.createAnswer()`, sets `peerConnection.setLocalDescription(answer)`, and sends it back via WebSocket (`type: "answer"`).
5. Peer A receives the answer and sets: `peerConnection.setRemoteDescription(answer)`.
Both peers now agree on media parameters.

---

## 12. ICE Candidates & NAT Traversal

**ICE (Interactive Connectivity Establishment)** discovers network paths through firewalls and NAT (Network Address Translation):
1. Each browser contacts a public **STUN server** (`stun.l.google.com:19302`) to discover its public IP address and port mapping.
2. The browser generates **ICE candidates** containing IP/port/protocol tuples.
3. Candidates are trickled via WebSocket (`type: "ice-candidate"`) to the remote peer.
4. The remote peer adds them via `peerConnection.addIceCandidate(candidate)`.
5. *Pending Queue Optimization*: If candidates arrive before `setRemoteDescription` completes, they are buffered in a queue and drained sequentially once the remote description is active.

---

## 13. RTCPeerConnection Lifecycle

In `useWebRTC.ts`, an `RTCPeerConnection` instance is maintained for every remote peer:
1. **Instantiate**: `new RTCPeerConnection(ICE_SERVERS)`.
2. **Attach Local Tracks**: `localStream.getTracks().forEach(track => pc.addTrack(track, localStream))`.
3. **Listen for Remote Tracks**: `pc.ontrack = (event) => setRemoteStreams(prev => ...)`.
4. **Listen for ICE Candidates**: `pc.onicecandidate = (event) => sendSignalingMessage(...)`.
5. **Connection State**: Track `connectionState` and `iceConnectionState` to detect disconnections.
6. **Teardown**: On peer leave or unmount, close peer connections, clear track senders, and delete from map.

---

## 14. getUserMedia & Hardware Management

- Local media is requested via `navigator.mediaDevices.getUserMedia({ audio: true, video: true })`.
- **Mute / Unmute**: Instead of tearing down the stream, `track.enabled = false` / `true` toggles track transmission without triggering expensive hardware renegotiation.
- **Chrome Autoplay Fix**: React's JSX `muted` attribute does not guarantee setting the HTML video element's DOM property. In `ParticipantTile.tsx`, `video.muted = true` and `video.defaultMuted = true` are imperatively assigned in JavaScript to prevent Chrome from blocking unmuted autoplay with black screens.
- **Hardware Handover**: `MeetingPreview` hands its active `MediaStream` directly to `MeetingRoom`, preventing camera device lockouts (`NotReadableError`) on Windows Media Foundation.

---

## 15. Screen Sharing Implementation

1. User clicks **Share Screen**.
2. Frontend calls `navigator.mediaDevices.getDisplayMedia({ video: true })`.
3. The display track replaces the webcam video track across all active peer connections using `sender.replaceTrack(screenTrack)`.
4. The local video tile swaps the track so the user sees their active share.
5. When screen sharing ends (via Zoom control bar or browser native "Stop Sharing" pill), the native `screenTrack.onended` event listener automatically restores the original camera video track.

---

## 16. Participant Management

- Real-time room rosters are managed via the FastAPI WebSocket connection manager.
- When a user joins, the backend broadcasts `user-joined` containing `peer_id`, `display_name`, and `is_host`.
- When a user toggles mute or camera, a `media-state` message synchronizes the state across all peers without renegotiating WebRTC.
- When a user leaves or closes their tab, the WebSocket disconnect handler detects it and broadcasts `user-left`.

---

## 17. How Host Controls Work

1. **Host Identification**: The user who created the meeting or launched instant mode has `is_host: true`.
2. **Host Mute All**: Host clicks "Mute All" $\rightarrow$ sends WebSocket message `{ type: "host-mute-all" }` $\rightarrow$ backend fans out to all room participants $\rightarrow$ attendee clients set `localAudioTrack.enabled = false` and update local UI.
3. **Host Kick Participant**: Host clicks "Remove" on a participant tile $\rightarrow$ sends `{ type: "remove-participant", target_peer_id: id }` $\rightarrow$ targeted attendee receives `removed-by-host` notification, closes all WebRTC connections, and is redirected to the home dashboard.

---

## 18. REST API Design

- REST endpoints handle non-realtime operations: CRUD operations on meetings, participant join logs, and meeting status transitions.
- Standard HTTP status codes: `200 OK`, `201 Created`, `400 Bad Request`, `404 Not Found`, and `422 Unprocessable Entity`.
- Structured Pydantic schemas enforce type safety and input validation for all request and response bodies.

---

## 19. Important Database Relationships

- **One-to-Many**: One `Meeting` has many `Participant` records.
- **Cascade Delete**: When a meeting is deleted via `DELETE /api/meetings/{id}`, all associated participant records are deleted automatically via SQLAlchemy cascade options (`cascade="all, delete-orphan"`).
- **Session Duration Tracking**: Participant records capture `joined_at` and `left_at` timestamps, enabling calculation of attendance duration.

---

## 20. Major Technical Challenges Solved

1. **Local Video Black Screen Bug**: Fixed Chrome's autoplay policy blocking unmuted audio streams by imperatively setting `video.muted = true` on the DOM property, and eliminating synthetic canvas fallbacks.
2. **Windows Hardware Device Lock**: Avoided `NotReadableError` by preserving and passing the active camera stream across the preview-to-room transition rather than releasing and re-acquiring the device within milliseconds.
3. **Out-of-Order ICE Candidate Arrival**: Implemented an ICE candidate queue to buffer early-arriving network candidates until `setRemoteDescription()` completes, preventing silent connection failures.
4. **Clean Identity & Label Sanitization**: Consolidated user identity into a single constant configuration (`Kavyansh Mehra` / `KM`) and sanitized labels to prevent duplicate tags like `(You) (You)`.

## 21. WebRTC Connection Quality & getStats() Monitoring

### RTCPeerConnection.getStats()
`RTCPeerConnection.getStats()` is a browser WebRTC API that queries the underlying network and media transport stack. It returns an asynchronous `RTCStatsReport` map containing metrics on network interfaces, candidate pairs, audio/video codecs, and inbound/outbound RTP streams.

### Round-Trip Time (RTT)
- **What it is**: The time (in milliseconds) it takes for a data packet to travel from the local peer to the remote peer and back.
- **How it is measured**: Extracted from active `candidate-pair` reports (`currentRoundTripTime` or `roundTripTime`).
- **Standard Thresholds**:
  - `< 120 ms`: Excellent (imperceptible latency, fluid real-time speech).
  - `120 – 300 ms`: Good (acceptable interactive conversation).
  - `> 350 ms`: Poor (noticeable conversational overlap and lag).

### Packet Loss
- **What it is**: The percentage of media packets dropped during UDP transmission due to network congestion or link degradation.
- **How it is measured**: Queried from `inbound-rtp` reports (`packetsLost` vs `packetsReceived`).
- **Impact**: Real-time media uses UDP instead of TCP, so lost packets are not retransmitted by default. Loss above 5–7% introduces audio clipping, stuttering, and robotic voice artifacts.

### Why Connection Quality Matters in Video Conferencing
Unlike static file downloads or web browsing where buffers mask network hiccups, live video conferencing demands immediate, sub-300ms media delivery. Showing a real-time connection indicator gives users immediate visibility into their network health, prevents user frustration by diagnosing local Wi-Fi drops, and is a hallmark feature in production applications like Zoom.

---

## 22. Common Interview Questions & Model Answers

### Q1: "Why did you choose a WebRTC mesh instead of an SFU?"
> *"For a college assignment targeting small group meetings (2–6 people), a mesh topology is ideal because it requires no complex media server infrastructure (like mediasoup or Janus) and runs entirely peer-to-peer. In a production enterprise app with 20+ participants, I would introduce an SFU (Selective Forwarding Unit) to reduce client upstream bandwidth from $O(N)$ to $O(1)$."*

### Q2: "What happens if an ICE candidate arrives before the SDP Answer?"
> *"If `addIceCandidate()` is called before `setRemoteDescription()`, WebRTC throws an `InvalidStateError`. To solve this, my `useWebRTC` hook checks `pc.remoteDescription`. If null, it buffers candidates in a queue (`pendingIceCandidates`). As soon as `setRemoteDescription()` resolves, it drains the queue sequentially."*

### Q3: "How does the app handle participants with strict NAT or corporate firewalls?"
> *"My implementation configures Google's public STUN servers for standard NAT traversal. In enterprise environments with symmetric NATs where STUN is insufficient, WebRTC requires a TURN relay server. The code structure is designed so that TURN server credentials can be added to the `ICE_SERVERS` configuration object with zero architectural changes."*

### Q4: "Why use WebSockets for signaling instead of HTTP polling or Server-Sent Events (SSE)?"
> *"WebSockets offer full-duplex communication over a single persistent TCP connection. Signaling requires bi-directional exchange (Peer A sends an offer, Peer B sends an answer, and both continuously trickle ICE candidates). HTTP polling introduces unacceptable latency, and SSE is one-way (server-to-client only), requiring secondary HTTP POSTs for client-to-server messages."*

### Q5: "How did you implement the WebRTC Connection Quality Indicator?"
> *"I implemented a modular hook (`useConnectionQuality.ts`) that periodically polls `RTCPeerConnection.getStats()`. It inspects the selected `candidate-pair` to measure instantaneous round-trip time (RTT) and sums `packetsLost` and `packetsReceived` from `inbound-rtp` tracks. The hook computes a 4-tier quality status (Excellent, Good, Poor, Connecting) and provides exact metrics in a compact popover without inventing fake data."*

