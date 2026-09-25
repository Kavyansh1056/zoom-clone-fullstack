import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from database import SessionLocal
from services.meeting_service import get_meeting_by_id, record_join, record_leave
from schemas import JoinMeetingRequest, LeaveMeetingRequest
from websocket.connection_manager import manager

logger = logging.getLogger("uvicorn.error")

router = APIRouter()


@router.websocket("/ws/meeting/{meeting_id}")
async def meeting_signaling_endpoint(
    websocket: WebSocket,
    meeting_id: str,
    peer_id: str = Query(...),
    display_name: str = Query(...),
    is_host: bool = Query(False),
):
    # Normalize meeting id
    norm_id = meeting_id.strip()

    # Verify meeting exists in database
    db = SessionLocal()
    meeting_meta = {}
    try:
        meeting = get_meeting_by_id(db, norm_id)
        if not meeting:
            await websocket.close(code=4004, reason="Meeting not found")
            return

        meeting_meta = {
            "meeting_id": str(meeting.meeting_id),
            "title": str(meeting.title),
            "host_name": str(meeting.host_name),
        }

        # Record participant join in database
        try:
            record_join(db, norm_id, JoinMeetingRequest(
                display_name=display_name,
                peer_id=peer_id,
                is_host=is_host
            ))
        except Exception as e:
            logger.warning(f"Could not record participant join in DB: {e}")
    finally:
        db.close()

    # Accept connection and register in room
    peer_info = await manager.connect(websocket, norm_id, peer_id, display_name, is_host)

    try:
        # 1. Send existing room peers to the new participant
        existing_peers = manager.get_room_peers(norm_id, exclude_peer_id=peer_id)
        await manager.send_personal_message({
            "type": "room-info",
            "peer_id": peer_id,
            "display_name": display_name,
            "is_host": is_host,
            "peers": existing_peers,
            "meeting": meeting_meta,
        }, websocket)

        # 2. Notify existing participants that someone joined
        await manager.broadcast_to_room(norm_id, {
            "type": "user-joined",
            "peer_id": peer_id,
            "display_name": display_name,
            "is_host": is_host,
            "audio_enabled": True,
            "video_enabled": True,
        }, exclude_peer_id=peer_id)

        # 3. Message routing loop
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                logger.warning("Received invalid non-JSON payload over websocket")
                continue

            msg_type = message.get("type")
            target_id = message.get("target_id")

            if msg_type == "offer":
                # WebRTC SDP Offer -> forward to target peer
                if target_id:
                    await manager.send_to_peer(norm_id, target_id, {
                        "type": "offer",
                        "sender_id": peer_id,
                        "sdp": message.get("sdp"),
                    })

            elif msg_type == "answer":
                # WebRTC SDP Answer -> forward to target peer
                if target_id:
                    await manager.send_to_peer(norm_id, target_id, {
                        "type": "answer",
                        "sender_id": peer_id,
                        "sdp": message.get("sdp"),
                    })

            elif msg_type == "ice-candidate":
                # WebRTC ICE candidate exchange
                if target_id:
                    await manager.send_to_peer(norm_id, target_id, {
                        "type": "ice-candidate",
                        "sender_id": peer_id,
                        "candidate": message.get("candidate"),
                    })

            elif msg_type == "media-state":
                # Broadcast audio/video mute state toggle
                audio_en = message.get("audio_enabled", True)
                video_en = message.get("video_enabled", True)
                peer_info.audio_enabled = audio_en
                peer_info.video_enabled = video_en
                await manager.broadcast_to_room(norm_id, {
                    "type": "media-state",
                    "sender_id": peer_id,
                    "audio_enabled": audio_en,
                    "video_enabled": video_en,
                }, exclude_peer_id=peer_id)

            elif msg_type == "host-mute-all":
                # Only hosts can invoke mute all
                if peer_info.is_host:
                    await manager.broadcast_to_room(norm_id, {
                        "type": "host-mute-all",
                        "sender_id": peer_id,
                    }, exclude_peer_id=peer_id)

            elif msg_type == "remove-participant":
                # Host removes participant
                if peer_info.is_host and target_id:
                    # Notify target they have been removed
                    await manager.send_to_peer(norm_id, target_id, {
                        "type": "removed-by-host",
                        "reason": message.get("reason", "Removed by host"),
                    })
                    # Disconnect target from room
                    manager.disconnect(norm_id, target_id)
                    # Broadcast leave to remaining
                    await manager.broadcast_to_room(norm_id, {
                        "type": "user-left",
                        "peer_id": target_id,
                    })

            elif msg_type == "chat-message":
                # In-meeting chat: broadcast to all other peers in the room
                await manager.broadcast_to_room(norm_id, {
                    "type": "chat-message",
                    "sender_id": peer_id,
                    "sender_name": display_name,
                    "message": message.get("message", ""),
                    "timestamp": message.get("timestamp"),
                }, exclude_peer_id=peer_id)

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for peer {peer_id}")
    except Exception as e:
        logger.error(f"WebSocket error for peer {peer_id}: {e}")
    finally:
        # Cleanup connection
        manager.disconnect(norm_id, peer_id)

        # Notify peers
        await manager.broadcast_to_room(norm_id, {
            "type": "user-left",
            "peer_id": peer_id,
        })

        # Record leave in database
        db_leave = SessionLocal()
        try:
            record_leave(db_leave, norm_id, LeaveMeetingRequest(
                peer_id=peer_id,
                display_name=display_name
            ))
        except Exception as e:
            logger.warning(f"Could not record participant leave in DB: {e}")
        finally:
            db_leave.close()
