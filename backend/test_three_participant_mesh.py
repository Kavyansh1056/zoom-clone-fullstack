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
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

async def test_three_peer_mesh_conference():
    print("==================================================", flush=True)
    print("RUNNING 3-PARTICIPANT WEBRTC MESH & HOST KICK TEST", flush=True)
    print("==================================================", flush=True)

    # 1. Create meeting
    meeting = http_post(f"{API_BASE}/api/meetings", {
        "title": "3-Participant Multi-Party WebRTC Conference",
        "host_name": "Host (Peer A)",
        "is_instant": True,
        "duration": 45,
    })
    m_id = meeting["meeting_id"]
    print(f"Meeting created: {m_id}", flush=True)

    uri_a = f"ws://127.0.0.1:8000/ws/meeting/{m_id}?peer_id=peer-a&display_name=Peer+A+(Host)&is_host=true"
    uri_b = f"ws://127.0.0.1:8000/ws/meeting/{m_id}?peer_id=peer-b&display_name=Peer+B&is_host=false"
    uri_c = f"ws://127.0.0.1:8000/ws/meeting/{m_id}?peer_id=peer-c&display_name=Peer+C&is_host=false"

    # Connect Peer A
    print("\n[Mesh 1] Connecting Peer A (Host)...", flush=True)
    async with websockets.connect(uri_a) as ws_a:
        info_a = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=5.0))
        assert len(info_a["peers"]) == 0

        # Connect Peer B
        print("[Mesh 2] Connecting Peer B...", flush=True)
        async with websockets.connect(uri_b) as ws_b:
            info_b = json.loads(await asyncio.wait_for(ws_b.recv(), timeout=5.0))
            assert len(info_b["peers"]) == 1 and info_b["peers"][0]["peer_id"] == "peer-a"

            # Peer A gets user-joined for B
            joined_b = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=5.0))
            assert joined_b["peer_id"] == "peer-b"

            # Connect Peer C
            print("[Mesh 3] Connecting Peer C...", flush=True)
            async with websockets.connect(uri_c) as ws_c:
                info_c = json.loads(await asyncio.wait_for(ws_c.recv(), timeout=5.0))
                # Peer C must discover BOTH Peer A and Peer B!
                discovered_by_c = [p["peer_id"] for p in info_c["peers"]]
                print(f"Peer C discovered {len(info_c['peers'])} existing peers in room: {discovered_by_c}", flush=True)
                assert "peer-a" in discovered_by_c
                assert "peer-b" in discovered_by_c

                # Peer A gets user-joined for C
                joined_c_to_a = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=5.0))
                assert joined_c_to_a["peer_id"] == "peer-c"

                # Peer B gets user-joined for C
                joined_c_to_b = json.loads(await asyncio.wait_for(ws_b.recv(), timeout=5.0))
                assert joined_c_to_b["peer_id"] == "peer-c"
                print("All peers successfully notified of 3-party mesh membership!", flush=True)

                # WebRTC Handshake: C initiates offer to A and to B
                print("\n[Mesh 4] WebRTC Handshake across all 3 mesh connections...", flush=True)
                # C -> A offer
                await ws_c.send(json.dumps({"type": "offer", "sender_id": "peer-c", "target_id": "peer-a", "sdp": {"type": "offer", "sdp": "sdp-c-to-a"}}))
                offer_at_a = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=5.0))
                assert offer_at_a["sender_id"] == "peer-c"

                # C -> B offer
                await ws_c.send(json.dumps({"type": "offer", "sender_id": "peer-c", "target_id": "peer-b", "sdp": {"type": "offer", "sdp": "sdp-c-to-b"}}))
                offer_at_b = json.loads(await asyncio.wait_for(ws_b.recv(), timeout=5.0))
                assert offer_at_b["sender_id"] == "peer-c"

                # A -> C answer
                await ws_a.send(json.dumps({"type": "answer", "sender_id": "peer-a", "target_id": "peer-c", "sdp": {"type": "answer", "sdp": "sdp-a-to-c"}}))
                ans_at_c1 = json.loads(await asyncio.wait_for(ws_c.recv(), timeout=5.0))
                assert ans_at_c1["sender_id"] == "peer-a"

                # B -> C answer
                await ws_b.send(json.dumps({"type": "answer", "sender_id": "peer-b", "target_id": "peer-c", "sdp": {"type": "answer", "sdp": "sdp-b-to-c"}}))
                ans_at_c2 = json.loads(await asyncio.wait_for(ws_c.recv(), timeout=5.0))
                assert ans_at_c2["sender_id"] == "peer-b"
                print("Full 3-peer mesh SDP offer/answer relay completed!", flush=True)

                # Multi-party Chat Broadcast Test: C sends message, both A and B must receive it
                print("\n[Mesh 5] Testing Multi-Party Chat Fanout...", flush=True)
                await ws_c.send(json.dumps({
                    "type": "chat-message",
                    "sender_id": "peer-c",
                    "sender_name": "Peer C",
                    "message": "Hello everyone in the 3-way conference!",
                    "timestamp": "2026-09-25T22:50:00Z"
                }))

                chat_a = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=5.0))
                assert chat_a["message"] == "Hello everyone in the 3-way conference!"
                chat_b = json.loads(await asyncio.wait_for(ws_b.recv(), timeout=5.0))
                assert chat_b["message"] == "Hello everyone in the 3-way conference!"
                print("Both Peer A and Peer B received broadcast chat from Peer C!", flush=True)

                # Media state broadcast from B: both A and C must receive it
                print("\n[Mesh 6] Testing Media State Fanout...", flush=True)
                await ws_b.send(json.dumps({
                    "type": "media-state",
                    "audio_enabled": False,
                    "video_enabled": True
                }))
                ms_to_a = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=5.0))
                assert ms_to_a["audio_enabled"] is False and ms_to_a["sender_id"] == "peer-b"
                ms_to_c = json.loads(await asyncio.wait_for(ws_c.recv(), timeout=5.0))
                assert ms_to_c["audio_enabled"] is False and ms_to_c["sender_id"] == "peer-b"
                print("Both Peer A and Peer C received Peer B's media state change!", flush=True)

                # Host Kick / Remove Participant test
                print("\n[Mesh 7] Testing Host Control: Remove Peer B...", flush=True)
                await ws_a.send(json.dumps({
                    "type": "remove-participant",
                    "sender_id": "peer-a",
                    "target_id": "peer-b",
                    "reason": "Removed by conference host."
                }))

                # Peer B must receive 'removed-by-host'
                kick_evt_b = json.loads(await asyncio.wait_for(ws_b.recv(), timeout=5.0))
                assert kick_evt_b["type"] == "removed-by-host"
                print("Peer B received removed-by-host notification!", flush=True)

                # Peer A and Peer C must receive 'user-left' for Peer B
                left_b_to_a = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=5.0))
                assert left_b_to_a["type"] == "user-left" and left_b_to_a["peer_id"] == "peer-b"
                left_b_to_c = json.loads(await asyncio.wait_for(ws_c.recv(), timeout=5.0))
                assert left_b_to_c["type"] == "user-left" and left_b_to_c["peer_id"] == "peer-b"
                print("Remaining peers (A and C) received user-left notification for removed Peer B!", flush=True)

                # Verify A and C can continue communicating
                print("\n[Mesh 8] Verifying A and C remain in call and communicate...", flush=True)
                await ws_a.send(json.dumps({
                    "type": "chat-message",
                    "sender_id": "peer-a",
                    "sender_name": "Host",
                    "message": "Continuing meeting with Peer C.",
                    "timestamp": "2026-09-25T22:50:30Z"
                }))
                msg_at_c = json.loads(await asyncio.wait_for(ws_c.recv(), timeout=5.0))
                assert msg_at_c["message"] == "Continuing meeting with Peer C."
                print("Peer A and Peer C successfully exchanged message post-kick!", flush=True)

    # Clean up test meeting so demo DB remains pristine
    del_req = urllib.request.Request(f"{API_BASE}/api/meetings/{m_id}", method="DELETE")
    with urllib.request.urlopen(del_req) as resp:
        pass
    print("Cleaned up 3-party test meeting from SQLite database.", flush=True)

    print("\n==================================================", flush=True)
    print("3-PARTICIPANT MESH & HOST KICK TEST PASSED 100%!", flush=True)
    print("==================================================", flush=True)

if __name__ == "__main__":
    asyncio.run(test_three_peer_mesh_conference())

