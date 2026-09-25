import asyncio
import json
import urllib.request
import websockets

API_BASE = "http://127.0.0.1:8000"

def http_post(url: str, data: dict):
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode("utf-8"))

def http_get(url: str):
    with urllib.request.urlopen(url) as response:
        return json.loads(response.read().decode("utf-8"))

async def test_full_two_participant_lifecycle():
    print("==================================================", flush=True)
    print("STARTING TWO-PARTICIPANT FULL WEBRTC LIFECYCLE TEST", flush=True)
    print("==================================================", flush=True)

    # 1. Create a fresh instant meeting via REST API
    meeting = http_post(f"{API_BASE}/api/meetings", {
        "title": "Two-Participant Automated Integration Call",
        "description": "Comprehensive E2E WebRTC signaling and media state test",
        "host_name": "Kavyansh Mehra (Host)",
        "is_instant": True,
        "duration": 30,
    })
    meeting_id = meeting["meeting_id"]
    print(f"Created meeting {meeting_id} for test.", flush=True)

    peer_a_id = "peer-host-kavyansh"
    peer_b_id = "peer-sarah-chen"
    uri_a = f"ws://127.0.0.1:8000/ws/meeting/{meeting_id}?peer_id={peer_a_id}&display_name=Kavyansh+Mehra+(Host)&is_host=true"
    uri_b = f"ws://127.0.0.1:8000/ws/meeting/{meeting_id}?peer_id={peer_b_id}&display_name=Sarah+Chen&is_host=false"

    # Step A: Connect Host (Browser A)
    print("\n[Step 1] Connecting Browser A (Host: Kavyansh Mehra)...", flush=True)
    async with websockets.connect(uri_a) as ws_a:
        msg_a1 = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=5.0))
        assert msg_a1["type"] == "room-info"
        assert len(msg_a1["peers"]) == 0
        print(f"Browser A connected successfully. Room has {len(msg_a1['peers'])} existing peers.", flush=True)

        # Step B: Connect Participant (Browser B)
        print("\n[Step 2] Connecting Browser B (Participant: Sarah Chen)...", flush=True)
        async with websockets.connect(uri_b) as ws_b:
            msg_b1 = json.loads(await asyncio.wait_for(ws_b.recv(), timeout=5.0))
            assert msg_b1["type"] == "room-info"
            assert len(msg_b1["peers"]) == 1
            assert msg_b1["peers"][0]["peer_id"] == peer_a_id
            print(f"Browser B connected. Discovered existing peer: {msg_b1['peers'][0]['display_name']}", flush=True)

            # Browser A should receive 'user-joined'
            joined_evt = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=5.0))
            assert joined_evt["type"] == "user-joined"
            assert joined_evt["peer_id"] == peer_b_id
            print(f"Browser A received notification: {joined_evt['display_name']} joined room.", flush=True)

            # Step C: WebRTC SDP Offer (B -> A)
            print("\n[Step 3] Browser B generating and sending SDP Offer to Browser A...", flush=True)
            await ws_b.send(json.dumps({
                "type": "offer",
                "sender_id": peer_b_id,
                "target_id": peer_a_id,
                "sdp": {"type": "offer", "sdp": "v=0\r\no=sarah 123 2 IN IP4 127.0.0.1\r\ns=TestOffer"}
            }))

            relayed_offer = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=5.0))
            assert relayed_offer["type"] == "offer"
            assert relayed_offer["sender_id"] == peer_b_id
            print(f"Browser A received relayed SDP Offer from {relayed_offer['sender_id']}.", flush=True)

            # Step D: WebRTC SDP Answer (A -> B)
            print("\n[Step 4] Browser A generating and returning SDP Answer to Browser B...", flush=True)
            await ws_a.send(json.dumps({
                "type": "answer",
                "sender_id": peer_a_id,
                "target_id": peer_b_id,
                "sdp": {"type": "answer", "sdp": "v=0\r\no=kavyansh 456 2 IN IP4 127.0.0.1\r\ns=TestAnswer"}
            }))

            relayed_answer = json.loads(await asyncio.wait_for(ws_b.recv(), timeout=5.0))
            assert relayed_answer["type"] == "answer"
            assert relayed_answer["sender_id"] == peer_a_id
            print(f"Browser B received relayed SDP Answer from {relayed_answer['sender_id']}.", flush=True)

            # Step E: ICE Candidate Exchange (Both directions)
            print("\n[Step 5] Exchanging ICE candidates...", flush=True)
            await ws_b.send(json.dumps({
                "type": "ice-candidate",
                "sender_id": peer_b_id,
                "target_id": peer_a_id,
                "candidate": {"candidate": "candidate:b1 1 UDP 2122252543 192.168.1.50 5000 typ host", "sdpMid": "0"}
            }))
            ice_to_a = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=5.0))
            assert ice_to_a["type"] == "ice-candidate"
            print("Browser A received ICE candidate from Browser B.", flush=True)

            await ws_a.send(json.dumps({
                "type": "ice-candidate",
                "sender_id": peer_a_id,
                "target_id": peer_b_id,
                "candidate": {"candidate": "candidate:a1 1 UDP 2122252543 192.168.1.60 5002 typ host", "sdpMid": "0"}
            }))
            ice_to_b = json.loads(await asyncio.wait_for(ws_b.recv(), timeout=5.0))
            assert ice_to_b["type"] == "ice-candidate"
            print("Browser B received ICE candidate from Browser A.", flush=True)

            # Step F: Audio Mute / Unmute & Video Off / On Tests
            print("\n[Step 6] Testing Media State Transitions (Mute, Camera toggle)...", flush=True)
            # A mutes
            await ws_a.send(json.dumps({
                "type": "media-state",
                "audio_enabled": False,
                "video_enabled": True
            }))
            ms_evt_b1 = json.loads(await asyncio.wait_for(ws_b.recv(), timeout=5.0))
            assert ms_evt_b1["type"] == "media-state"
            assert ms_evt_b1["audio_enabled"] is False
            print("Browser A muted -> Browser B observed Audio=False.", flush=True)

            # A unmutes
            await ws_a.send(json.dumps({
                "type": "media-state",
                "audio_enabled": True,
                "video_enabled": True
            }))
            ms_evt_b2 = json.loads(await asyncio.wait_for(ws_b.recv(), timeout=5.0))
            assert ms_evt_b2["audio_enabled"] is True
            print("Browser A unmuted -> Browser B observed Audio=True.", flush=True)

            # A turns off camera
            await ws_a.send(json.dumps({
                "type": "media-state",
                "audio_enabled": True,
                "video_enabled": False
            }))
            ms_evt_b3 = json.loads(await asyncio.wait_for(ws_b.recv(), timeout=5.0))
            assert ms_evt_b3["video_enabled"] is False
            print("Browser A disabled camera -> Browser B observed Video=False.", flush=True)

            # A turns on camera
            await ws_a.send(json.dumps({
                "type": "media-state",
                "audio_enabled": True,
                "video_enabled": True
            }))
            ms_evt_b4 = json.loads(await asyncio.wait_for(ws_b.recv(), timeout=5.0))
            assert ms_evt_b4["video_enabled"] is True
            print("Browser A enabled camera -> Browser B observed Video=True.", flush=True)

            # B mutes and turns off camera
            await ws_b.send(json.dumps({
                "type": "media-state",
                "audio_enabled": False,
                "video_enabled": False
            }))
            ms_evt_a1 = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=5.0))
            assert ms_evt_a1["type"] == "media-state"
            assert ms_evt_a1["audio_enabled"] is False
            assert ms_evt_a1["video_enabled"] is False
            print("Browser B muted & disabled camera -> Browser A observed Audio=False, Video=False.", flush=True)

            # Step G: In-Meeting Chat Test
            print("\n[Step 7] Testing In-Meeting Real-time Chat...", flush=True)
            await ws_b.send(json.dumps({
                "type": "chat-message",
                "message": "Can you hear me clearly, Kavyansh?",
                "timestamp": "2026-09-25T22:45:00Z"
            }))
            chat_to_a = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=5.0))
            assert chat_to_a["type"] == "chat-message"
            assert chat_to_a["message"] == "Can you hear me clearly, Kavyansh?"
            print(f"Browser A received chat: '{chat_to_a['message']}' from {chat_to_a.get('sender_name')}.", flush=True)

            await ws_a.send(json.dumps({
                "type": "chat-message",
                "message": "Loud and clear Sarah! Video stream is crystal sharp.",
                "timestamp": "2026-09-25T22:45:05Z"
            }))
            chat_to_b = json.loads(await asyncio.wait_for(ws_b.recv(), timeout=5.0))
            assert chat_to_b["type"] == "chat-message"
            assert chat_to_b["message"] == "Loud and clear Sarah! Video stream is crystal sharp."
            print(f"Browser B received chat reply: '{chat_to_b['message']}'.", flush=True)

            # Step H: Host Control - Mute All
            print("\n[Step 8] Testing Host Control: Mute All...", flush=True)
            await ws_a.send(json.dumps({
                "type": "host-mute-all"
            }))
            mute_all_evt = json.loads(await asyncio.wait_for(ws_b.recv(), timeout=5.0))
            assert mute_all_evt["type"] == "host-mute-all"
            print("Browser B received host-mute-all enforcement signal.", flush=True)

            print("\n[Step 9] Browser B leaves meeting...", flush=True)
            # Browser B exits the with block, closing the websocket

        # Now Browser A should receive 'user-left' for Browser B
        left_evt = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=5.0))
        assert left_evt["type"] == "user-left"
        assert left_evt["peer_id"] == peer_b_id
        print(f"Browser A received user-left for {peer_b_id}.", flush=True)

    print("\n[Step 10] Browser A (Host) leaves meeting...", flush=True)

    # Allow background leave write to complete
    await asyncio.sleep(0.5)

    # Step I: Database Audit of Participant & Meeting Lifecycle
    print("\n[Step 11] Auditing SQLite Database records...", flush=True)
    m_data = http_get(f"{API_BASE}/api/meetings/{meeting_id}")
    print(f"Meeting status: '{m_data['status']}'")
    print(f"Total recorded participants: {len(m_data['participants'])}")
    for p in m_data["participants"]:
        print(f" - {p['display_name']} (joined: {p['joined_at']}, left: {p['left_at']})")
        assert p["left_at"] is not None, f"Expected participant {p['display_name']} to have left_at recorded!"

    assert m_data["status"] == "completed", f"Expected meeting status 'completed', got '{m_data['status']}'"

    # Clean up test meeting so demo DB remains pristine
    del_req = urllib.request.Request(f"{API_BASE}/api/meetings/{meeting_id}", method="DELETE")
    with urllib.request.urlopen(del_req) as resp:
        pass
    print("Cleaned up test meeting from SQLite database.", flush=True)

    print("\n>>> ALL 11 TWO-PARTICIPANT WEBRTC TESTS PASSED WITH 100% SUCCESS! <<<", flush=True)

if __name__ == "__main__":
    asyncio.run(test_full_two_participant_lifecycle())

