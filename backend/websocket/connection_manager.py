import json
import logging
from typing import Dict, List, Optional
from fastapi import WebSocket

logger = logging.getLogger("uvicorn.error")


class PeerConnectionInfo:
    def __init__(self, websocket: WebSocket, peer_id: str, display_name: str, is_host: bool = False):
        self.websocket = websocket
        self.peer_id = peer_id
        self.display_name = display_name
        self.is_host = is_host
        self.audio_enabled = True
        self.video_enabled = True


class ConnectionManager:
    """Manages active WebRTC signaling WebSocket connections by meeting room."""

    def __init__(self):
        # meeting_id -> { peer_id: PeerConnectionInfo }
        self.rooms: Dict[str, Dict[str, PeerConnectionInfo]] = {}

    async def connect(
        self,
        websocket: WebSocket,
        meeting_id: str,
        peer_id: str,
        display_name: str,
        is_host: bool = False,
    ) -> PeerConnectionInfo:
        await websocket.accept()

        if meeting_id not in self.rooms:
            self.rooms[meeting_id] = {}

        peer_info = PeerConnectionInfo(
            websocket=websocket,
            peer_id=peer_id,
            display_name=display_name,
            is_host=is_host,
        )
        self.rooms[meeting_id][peer_id] = peer_info

        logger.info(f"Peer '{display_name}' ({peer_id}) joined room '{meeting_id}'. Total peers: {len(self.rooms[meeting_id])}")
        return peer_info

    def disconnect(self, meeting_id: str, peer_id: str):
        if meeting_id in self.rooms and peer_id in self.rooms[meeting_id]:
            peer_info = self.rooms[meeting_id].pop(peer_id)
            logger.info(f"Peer '{peer_info.display_name}' ({peer_id}) left room '{meeting_id}'.")
            if not self.rooms[meeting_id]:
                del self.rooms[meeting_id]
                logger.info(f"Room '{meeting_id}' is now empty and removed.")

    def get_room_peers(self, meeting_id: str, exclude_peer_id: Optional[str] = None) -> List[dict]:
        if meeting_id not in self.rooms:
            return []
        peers = []
        for pid, peer in self.rooms[meeting_id].items():
            if exclude_peer_id and pid == exclude_peer_id:
                continue
            peers.append({
                "peer_id": peer.peer_id,
                "display_name": peer.display_name,
                "is_host": peer.is_host,
                "audio_enabled": peer.audio_enabled,
                "video_enabled": peer.video_enabled,
            })
        return peers

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"Error sending direct message to websocket: {e}")

    async def send_to_peer(self, meeting_id: str, target_peer_id: str, message: dict) -> bool:
        if meeting_id in self.rooms and target_peer_id in self.rooms[meeting_id]:
            target_ws = self.rooms[meeting_id][target_peer_id].websocket
            try:
                await target_ws.send_text(json.dumps(message))
                return True
            except Exception as e:
                logger.error(f"Error relaying to peer {target_peer_id}: {e}")
                return False
        return False

    async def broadcast_to_room(self, meeting_id: str, message: dict, exclude_peer_id: Optional[str] = None):
        if meeting_id not in self.rooms:
            return
        payload = json.dumps(message)
        for pid, peer in list(self.rooms[meeting_id].items()):
            if exclude_peer_id and pid == exclude_peer_id:
                continue
            try:
                await peer.websocket.send_text(payload)
            except Exception as e:
                logger.error(f"Error broadcasting to peer {pid}: {e}")


manager = ConnectionManager()
