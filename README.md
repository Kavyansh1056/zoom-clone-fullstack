# Zoom Clone – Video Conferencing Platform

A production-grade, full-stack video conferencing web application engineered with **Next.js (TypeScript, Tailwind CSS)**, **FastAPI (Python)**, **SQLAlchemy (SQLite)**, and peer-to-peer **WebRTC** with asynchronous **WebSocket signaling**.

Replicates Zoom's authentic web experience, professional UI design system, and real-time audio/video communication workflows.

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Tech Stack](#tech-stack)
4. [Architecture](#architecture)
5. [Core Features](#core-features)
6. [Database Schema](#database-schema)
7. [API Endpoints](#api-endpoints)
8. [Local Setup](#local-setup)
9. [Environment Variables](#environment-variables)
10. [Testing Two Participants](#testing-two-participants)
11. [Deployment](#deployment)
12. [Assumptions](#assumptions)
13. [Known Limitations](#known-limitations)

---

## Overview

This project is a complete, deployable full-stack implementation of a Zoom-like video conferencing platform. It supports:
- **Instant Meetings & Pre-Scheduled Sessions**: Create instant rooms or schedule upcoming calls with custom dates and durations.
- **Hardware Pre-Flight Preview**: Live camera and microphone preview before joining a room, allowing pre-call mute/unmute and custom display name selection.
- **Multi-Party WebRTC Video Mesh**: Real-time peer-to-peer audio, video, and screen sharing across participants with zero third-party media servers.
- **Low-Latency WebSocket Signaling Gateway**: FastAPI-powered connection broker managing SDP offer/answer handshakes, ICE candidate trickling, participant state synchronization, and room broadcasts.
- **Host Controls & Moderation**: Host badges, instant "Mute All" broadcasts, and remote participant removal.
- **Relational Persistence**: SQLite with SQLAlchemy ORM tracking scheduled meetings, active calls, and session logs.

---

## Features

- **Zoom Web UI & Design System**: Styled with authentic Zoom palette (`#2D8CFF` blue, `#F26D21` orange accent, slate grays, clean typography, compact control bars).
- **Dashboard & Navigation**: Real-time digital clock, quick meeting join bar, Upcoming Meetings list, and Recent Meetings history.
- **Pre-Join Screen**: Audio/video device preview, mic volume indicator, camera toggle, and customizable display name.
- **WebRTC Conferencing**:
  - Responsive video grid adapting dynamically from 1 to multiple participants.
  - Video start/stop with fallback initials avatar.
  - Microphone mute/unmute with visual speaking indicators.
  - High-definition screen sharing with seamless return to camera video.
  - Video pinning to feature specific participants.
- **In-Meeting Real-Time Chat**: Live peer-to-peer broadcast chat with timestamps, sender tags, and unread counters.
- **Host Moderation**: Host identifier badge, "Mute All" command for participants, and "Remove Participant" kick mechanism.
- **Shareable Meeting Links**: 1-click invitation copying formatted with the active frontend origin.

---

## Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React

### Backend
- **Language**: Python 3.12
- **Framework**: FastAPI (Asynchronous ASGI)
- **ORM**: SQLAlchemy 2.0
- **Validation**: Pydantic v2
- **Server**: Uvicorn

### Database
- **Database Engine**: SQLite 3 (`zoom_clone.db`) per project requirements

### Realtime Communication
- **Signaling Gateway**: FastAPI WebSockets (`/ws/meeting/{meeting_id}`)
- **Media Pipeline**: WebRTC (`RTCPeerConnection`, `getUserMedia`, `getDisplayMedia`) with Google STUN servers

---

## Architecture

The system decouples metadata management (handled via REST/SQLite) from real-time signaling (handled via WebSockets) and high-bandwidth media streams (handled peer-to-peer via WebRTC).

### 1. REST & Metadata Flow
```
Browser Client
     │  REST (HTTP GET/POST/PATCH/DELETE)
     ▼
Next.js (Frontend on Port 3000)
     │  JSON API Proxy / Direct Fetch
     ▼
FastAPI (Backend on Port 8000)
     │  SQLAlchemy ORM
     ▼
SQLite Database (zoom_clone.db)
```

### 2. Real-Time Signaling Flow
```
Browser A (Peer 1)                     Browser B (Peer 2)
     │                                      │
     │ WebSocket Connection                 │ WebSocket Connection
     ▼                                      ▼
┌────────────────────────────────────────────────────────┐
│            FastAPI WebSocket Signaling Router          │
│       • Room membership & discovery                    │
│       • SDP Offer / Answer relay                       │
│       • ICE Candidate trickle                          │
│       • In-call chat & media state broadcasts          │
└────────────────────────────────────────────────────────┘
```

### 3. Media Stream Flow (WebRTC Mesh)
```
After signaling handshake completes:

Browser A (Local Stream) <====== Direct P2P WebRTC Media ======> Browser B (Remote Stream)
                           (SRTP Audio / VP8/H.264 Video)
```

FastAPI never buffers or relays heavy video/audio packets; media flows directly peer-to-peer between client browsers, ensuring minimal latency and zero cloud bandwidth costs for media relay.

---

## Core Features

| Feature | Description | Implementation |
| :--- | :--- | :--- |
| **New Meeting** | 1-click creation of an instant meeting session. | `POST /api/meetings` with `is_instant: true` |
| **Join Meeting** | Join by 10-digit meeting ID (e.g. `849-204-1928`). | Search bar + `POST /api/meetings/{id}/join` |
| **Schedule Meeting** | Schedule future calls with title, date, time, and duration. | Modal form + `POST /api/meetings` |
| **Upcoming Meetings** | Filterable list of upcoming calls with 1-click start. | `GET /api/meetings/upcoming` |
| **Recent Meetings** | Historical log of completed meetings and duration. | `GET /api/meetings/recent` |
| **Camera & Microphone** | Live hardware toggling with native mute states. | `track.enabled` on local `MediaStream` |
| **Participants Panel** | Searchable participant roster with audio/video status. | Live WebSocket participant state fanout |
| **In-Room Chat** | Collapsible chat sidebar with real-time broadcast messages. | WebSocket message type `chat-message` |
| **Screen Sharing** | Share desktop/window stream and swap back to camera. | `navigator.mediaDevices.getDisplayMedia` |
| **Host Controls** | Host badge, mute all attendees, and kick participant. | WebSocket types `host-mute-all` & `remove-participant` |
| **Invite Links** | Copy sharable invite link with current domain. | `window.location.origin + /meeting/{id}` |

---

## Database Schema

The database utilizes SQLite with strict relational foreign keys and cascade rules managed via SQLAlchemy:

### 1. `meetings` Table
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `Integer` | Auto-incrementing primary key |
| `meeting_id` | `String` (Indexed, Unique) | Zoom-formatted ID (e.g., `849-204-1928`) |
| `title` | `String` | Meeting topic |
| `description` | `Text` (Optional) | Agenda or description |
| `host_name` | `String` | Display name of the meeting organizer |
| `scheduled_at` | `DateTime` | Scheduled date and time (UTC) |
| `duration` | `Integer` | Planned duration in minutes |
| `invite_link` | `String` | Sharable invite link |
| `status` | `String` | `scheduled`, `in_progress`, `completed`, or `cancelled` |
| `created_at` | `DateTime` | Record creation timestamp |
| `ended_at` | `DateTime` (Optional) | Timestamp when meeting concluded |

### 2. `participants` Table
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `Integer` | Auto-incrementing primary key |
| `meeting_id` | `String` (FK $\rightarrow$ `meetings.meeting_id`) | Associated meeting (Cascade Delete) |
| `display_name` | `String` | Participant name |
| `peer_id` | `String` (Optional) | Ephemeral WebRTC peer ID |
| `is_host` | `Boolean` | Host privilege indicator |
| `joined_at` | `DateTime` | Join timestamp |
| `left_at` | `DateTime` (Optional) | Disconnection timestamp |

---

## API Endpoints

FastAPI provides full OpenAPI/Swagger documentation at `http://localhost:8000/docs`.

### REST Endpoints
| Method | Endpoint | Description | Status Code |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/meetings` | List all meetings | `200 OK` |
| `GET` | `/api/meetings/upcoming` | List upcoming/scheduled meetings | `200 OK` |
| `GET` | `/api/meetings/recent` | List completed meetings | `200 OK` |
| `POST` | `/api/meetings` | Create a new meeting (instant or scheduled) | `201 Created` |
| `GET` | `/api/meetings/{id}` | Retrieve meeting details by meeting ID | `200 OK` |
| `PATCH` | `/api/meetings/{id}` | Update meeting details | `200 OK` |
| `DELETE` | `/api/meetings/{id}` | Delete meeting and cascade participants | `200 OK` |
| `POST` | `/api/meetings/{id}/join` | Record participant join event | `200 OK` |
| `POST` | `/api/meetings/{id}/leave` | Record participant leave event | `200 OK` |
| `GET` | `/health` | Backend health check probe | `200 OK` |

### WebSocket Endpoint
- **URL**: `/ws/meeting/{meeting_id}?peer_id={peer_id}&display_name={name}&is_host={bool}`
- **Purpose**: Real-time peer discovery, WebRTC SDP offer/answer relay, ICE candidate forwarding, in-meeting chat, and host commands.

---

## Local Setup

### Prerequisites
- **Node.js**: v18.17+ or v20+
- **Python**: v3.10+ (tested on Python 3.12)
- **Operating System**: Windows / macOS / Linux

### 1. Backend Setup (FastAPI)

Open a terminal in the project directory:

```powershell
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment (Windows PowerShell)
.\venv\Scripts\Activate.ps1
# On macOS/Linux: source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Seed initial database with realistic demo meetings
python seed.py

# Start FastAPI server
uvicorn main:app --reload --port 8000
```
Backend API will be running at `http://127.0.0.1:8000`.

### 2. Frontend Setup (Next.js)

Open a second terminal in the project directory:

```powershell
# Navigate to frontend directory
cd frontend

# Install Node dependencies
npm install

# Start Next.js development server
npm run dev
```
Frontend application will be accessible at `http://localhost:3000`.

---

## Environment Variables

Copy the example files before deploying:

### Frontend (`frontend/.env.local`)
```env
# Backend REST API endpoint URL
NEXT_PUBLIC_API_URL=http://localhost:8000

# Backend WebSocket signaling gateway URL
# (If omitted, client automatically derives wss:// or ws:// from NEXT_PUBLIC_API_URL)
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

### Backend (`backend/.env`)
```env
# Port and Host Binding (Render assigns PORT automatically in production)
PORT=8000
HOST=0.0.0.0

# Frontend URL (Used for CORS and invite link generation)
FRONTEND_URL=http://localhost:3000

# Allowed CORS Origins (comma-separated list)
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# SQLite Database URL
DATABASE_URL=sqlite:///./zoom_clone.db

# Meeting Invite Base Link URL
BASE_INVITE_URL=http://localhost:3000/meeting
```

---

## Testing Two Participants

To test real two-way WebRTC audio/video conferencing on a single machine:

1. Open `http://localhost:3000` in your standard browser window (e.g., Google Chrome).
2. Click **New Meeting** to launch an instant meeting as the host (**Kavyansh Mehra**).
3. Grant camera and microphone permissions on the pre-join preview and click **Join Meeting**.
4. In the meeting room, click the **Invite** button on the bottom control bar to copy the meeting invite link.
5. Open an **Incognito / Private Window** (or a second browser such as Firefox / Edge).
6. Paste the invitation URL into the incognito window.
7. On the pre-join screen, enter a guest name (e.g., **Sarah Chen**) and click **Join Meeting**.
8. **Verification**:
   - Both browser windows will display each other's live video and audio.
   - The participant panel in both windows reflects 2 active participants.
   - Sending a chat message in one window delivers instantly to the other.
   - Screen sharing in one window replaces that user's video tile across both windows.
   - The host window displays the `Host` badge and moderation controls (**Mute All**, **Remove Participant**).

---

## Deployment

### 1. Backend Deployment (Render)
1. Push your repository to GitHub.
2. In the [Render Dashboard](https://dashboard.render.com), create a new **Web Service**.
3. Select your GitHub repository.
4. Configure the service settings:
   - **Environment**: `Python 3`
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add Environment Variables:
   - `FRONTEND_URL`: `https://<your-vercel-app-name>.vercel.app` (Add after Vercel URL is known)
   - `CORS_ORIGINS`: `https://<your-vercel-app-name>.vercel.app`
6. Click **Create Web Service** and note your assigned Render URL (e.g. `https://zoom-api.onrender.com`).

### 2. Frontend Deployment (Vercel)
1. In the [Vercel Dashboard](https://vercel.com), click **Add New Project** and import your repository.
2. Configure project settings:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
3. Add Environment Variables:
   - `NEXT_PUBLIC_API_URL`: `https://<your-render-backend-name>.onrender.com`
   - `NEXT_PUBLIC_WS_URL`: `wss://<your-render-backend-name>.onrender.com`
4. Click **Deploy**.
5. Once Vercel deployment completes, update the `FRONTEND_URL` and `CORS_ORIGINS` in your Render service with your production Vercel domain.

---

## Assumptions

1. **Default Logged-in Identity**: Per assignment guidelines ("Focus on functionality rather than authentication; assume a default user is logged in"), the default user identity is configured as **Kavyansh Mehra** (`KM`). Custom display names are supported via the pre-join preview and join modals.
2. **WebRTC Topology**: Implemented as a full peer-to-peer mesh suitable for small-group conferences (2–6 participants) without requiring a costly SFU/MCU media server.
3. **STUN Configuration**: Free public Google STUN servers (`stun.l.google.com:19302`) are utilized for ICE candidate NAT traversal. TURN relay servers can be configured in `ICE_SERVERS` for enterprise symmetric NAT environments.

---

## Known Limitations

1. **SQLite Cloud Persistence**: As specified in the assignment requirements, SQLite is used for relational persistence. On ephemeral cloud hosting providers (e.g. free Render instances), the SQLite file resets upon service restart unless a persistent disk is mounted. Automatic schema creation and database seeding ensure the app starts reliably in all environments.
2. **Mesh Scalability**: Mesh WebRTC requires each client to encode and transmit streams to every other peer ($N \times (N-1)$ connections). For large meetings (>8 participants), an SFU (Selective Forwarding Unit) media server architecture would be recommended.
3. **Browser Permission Rules**: Under Chrome and Edge security policies, camera and microphone access requires either `localhost` or a secure `https://` origin. Production deployments must be served over HTTPS for media hardware access.
