import asyncio
import json
import urllib.request
import datetime
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

def http_get(url: str):
    with urllib.request.urlopen(url) as resp:
        return json.loads(resp.read().decode("utf-8"))

async def test_full_regression():
    print("==================================================", flush=True)
    print("RUNNING FINAL SYSTEM REGRESSION TEST SUITE", flush=True)
    print("==================================================", flush=True)

    # 1. Dashboard upcoming load
    print("\n[Check 1] Loading initial upcoming meetings...", flush=True)
    initial_upcoming = http_get(f"{API_BASE}/api/meetings/upcoming")
    print(f"Loaded {len(initial_upcoming)} existing upcoming meetings.", flush=True)

    # 2. Instant Meeting Creation (Click 'New Meeting')
    print("\n[Check 2] Clicking 'New Meeting' (POST /api/meetings)...", flush=True)
    new_meeting = http_post(f"{API_BASE}/api/meetings", {
        "title": "Kavyansh Mehra's Instant Regression Meeting",
        "host_name": "Kavyansh Mehra (You)",
        "is_instant": True,
        "duration": 45,
    })
    meeting_id = new_meeting["meeting_id"]
    print(f"Meeting created: ID = {meeting_id}, invite = {new_meeting['invite_link']}", flush=True)
    assert new_meeting["status"] == "in_progress"
    assert len(meeting_id.split("-")) == 3, f"Expected 3-part ID, got {meeting_id}"

    # 3. Host enters room
    print("\n[Check 3] Host enters meeting room...", flush=True)
    uri_host = f"ws://127.0.0.1:8000/ws/meeting/{meeting_id}?peer_id=peer-reg-host&display_name=Kavyansh+Mehra&is_host=true"
    async with websockets.connect(uri_host) as ws_host:
        host_room_info = json.loads(await asyncio.wait_for(ws_host.recv(), timeout=5.0))
        assert host_room_info["type"] == "room-info"
        print("Host received room-info with meeting title:", host_room_info["meeting"]["title"], flush=True)

        # 4. Guest joins
        print("\n[Check 4] Guest joins via invite link...", flush=True)
        uri_guest = f"ws://127.0.0.1:8000/ws/meeting/{meeting_id}?peer_id=peer-reg-guest&display_name=Elena+Rostova&is_host=false"
        async with websockets.connect(uri_guest) as ws_guest:
            guest_room_info = json.loads(await asyncio.wait_for(ws_guest.recv(), timeout=5.0))
            assert guest_room_info["type"] == "room-info"
            assert len(guest_room_info["peers"]) == 1
            print("Guest discovered Host peer:", guest_room_info["peers"][0]["display_name"], flush=True)

            host_got_join = json.loads(await asyncio.wait_for(ws_host.recv(), timeout=5.0))
            assert host_got_join["type"] == "user-joined"
            print("Host received notification: Elena joined room.", flush=True)

            # 5. WebRTC Offer & Answer Handshake
            print("\n[Check 5] Performing WebRTC SDP Offer / Answer handshake...", flush=True)
            await ws_guest.send(json.dumps({
                "type": "offer",
                "sender_id": "peer-reg-guest",
                "target_id": "peer-reg-host",
                "sdp": {"type": "offer", "sdp": "v=0\r\no=elena 111 2 IN IP4 127.0.0.1\r\ns=RegressionOffer"}
            }))
            offer_to_host = json.loads(await asyncio.wait_for(ws_host.recv(), timeout=5.0))
            assert offer_to_host["type"] == "offer"

            await ws_host.send(json.dumps({
                "type": "answer",
                "sender_id": "peer-reg-host",
                "target_id": "peer-reg-guest",
                "sdp": {"type": "answer", "sdp": "v=0\r\no=kavyansh 222 2 IN IP4 127.0.0.1\r\ns=RegressionAnswer"}
            }))
            answer_to_guest = json.loads(await asyncio.wait_for(ws_guest.recv(), timeout=5.0))
            assert answer_to_guest["type"] == "answer"
            print("WebRTC offer/answer relay completed successfully.", flush=True)

            # 6. Controls - Mic & Camera Toggles
            print("\n[Check 6] Testing meeting controls and media synchronization...", flush=True)
            # Host mutes
            await ws_host.send(json.dumps({"type": "media-state", "audio_enabled": False, "video_enabled": True}))
            ms_g1 = json.loads(await asyncio.wait_for(ws_guest.recv(), timeout=5.0))
            assert ms_g1["audio_enabled"] is False

            # Host unmutes
            await ws_host.send(json.dumps({"type": "media-state", "audio_enabled": True, "video_enabled": True}))
            ms_g2 = json.loads(await asyncio.wait_for(ws_guest.recv(), timeout=5.0))
            assert ms_g2["audio_enabled"] is True
            print("Controls state toggle verified across peers.", flush=True)

            # 7. Guest leaves
            print("\n[Check 7] Guest leaves meeting...", flush=True)

        host_got_left = json.loads(await asyncio.wait_for(ws_host.recv(), timeout=5.0))
        assert host_got_left["type"] == "user-left"
        print("Host received notification: Elena left room.", flush=True)

    print("\n[Check 8] Host leaves meeting...", flush=True)
    await asyncio.sleep(0.5)

    # Verify meeting completed in SQLite
    m_check = http_get(f"{API_BASE}/api/meetings/{meeting_id}")
    assert m_check["status"] == "completed"
    print(f"Meeting status transitioned to: '{m_check['status']}'", flush=True)

    # 9. Schedule Meeting Flow
    print("\n[Check 9] Testing Schedule Meeting workflow...", flush=True)
    future_time = (datetime.datetime.utcnow() + datetime.timedelta(days=2)).isoformat()
    scheduled_res = http_post(f"{API_BASE}/api/meetings", {
        "title": "Quarterly Technical Architecture Review",
        "description": "Cross-functional roadmap sync",
        "host_name": "Kavyansh Mehra (You)",
        "scheduled_at": future_time,
        "duration": 60,
        "is_instant": False,
    })
    sched_id = scheduled_res["meeting_id"]
    print(f"Scheduled meeting created: ID = {sched_id}", flush=True)
    assert scheduled_res["status"] == "scheduled"

    # Verify meeting shows in upcoming list immediately
    updated_upcoming = http_get(f"{API_BASE}/api/meetings/upcoming")
    ids_in_upcoming = [m["meeting_id"] for m in updated_upcoming]
    assert sched_id in ids_in_upcoming, f"Expected {sched_id} in upcoming meetings!"
    print(f"Scheduled meeting verified in Upcoming Meetings list! (Total upcoming: {len(updated_upcoming)})", flush=True)

    # Clean up test meetings so demo DB remains pristine
    for m_id in [meeting_id, sched_id]:
        del_req = urllib.request.Request(f"{API_BASE}/api/meetings/{m_id}", method="DELETE")
        with urllib.request.urlopen(del_req) as resp:
            pass
    print("Cleaned up regression test meetings from SQLite database.", flush=True)

    print("\n==================================================", flush=True)
    print("FINAL REGRESSION TEST COMPLETE: 100% PASS!", flush=True)
    print("==================================================", flush=True)

if __name__ == "__main__":
    asyncio.run(test_full_regression())

