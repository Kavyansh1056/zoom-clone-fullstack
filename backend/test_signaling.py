import asyncio
import json
import websockets

async def test_webrtc_signaling():
    meeting_id = "849-204-1928"
    uri_peer_a = f"ws://127.0.0.1:8000/ws/meeting/{meeting_id}?peer_id=peer-a&display_name=Alice&is_host=true"
    uri_peer_b = f"ws://127.0.0.1:8000/ws/meeting/{meeting_id}?peer_id=peer-b&display_name=Bob&is_host=false"

    print("Connecting Peer A (Alice)...", flush=True)
    async with websockets.connect(uri_peer_a) as ws_a:
        msg_a = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=5.0))
        print(f"Peer A got: {msg_a['type']}", flush=True)

        print("Connecting Peer B (Bob)...", flush=True)
        async with websockets.connect(uri_peer_b) as ws_b:
            msg_b = json.loads(await asyncio.wait_for(ws_b.recv(), timeout=5.0))
            print(f"Peer B got: {msg_b['type']}, existing peers: {len(msg_b.get('peers', []))}", flush=True)

            # Peer A should receive user-joined for Bob
            msg_joined = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=5.0))
            print(f"Peer A received: {msg_joined['type']} for {msg_joined.get('display_name')}", flush=True)
            assert msg_joined["type"] == "user-joined"

            # Bob sends SDP offer to Alice
            print("Bob sending SDP Offer to Alice...", flush=True)
            await ws_b.send(json.dumps({
                "type": "offer",
                "sender_id": "peer-b",
                "target_id": "peer-a",
                "sdp": {"type": "offer", "sdp": "dummy-offer-sdp"}
            }))

            # Alice receives offer
            msg_offer = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=5.0))
            print(f"Alice received relayed: {msg_offer['type']} from {msg_offer['sender_id']}", flush=True)
            assert msg_offer["type"] == "offer"

            # Alice sends SDP answer to Bob
            print("Alice sending SDP Answer to Bob...", flush=True)
            await ws_a.send(json.dumps({
                "type": "answer",
                "sender_id": "peer-a",
                "target_id": "peer-b",
                "sdp": {"type": "answer", "sdp": "dummy-answer-sdp"}
            }))

            # Bob receives answer
            msg_answer = json.loads(await asyncio.wait_for(ws_b.recv(), timeout=5.0))
            print(f"Bob received relayed: {msg_answer['type']} from {msg_answer['sender_id']}", flush=True)
            assert msg_answer["type"] == "answer"

            # Alice sends ICE candidate to Bob
            print("Alice sending ICE candidate to Bob...", flush=True)
            await ws_a.send(json.dumps({
                "type": "ice-candidate",
                "sender_id": "peer-a",
                "target_id": "peer-b",
                "candidate": {"candidate": "candidate:dummy", "sdpMid": "0"}
            }))

            # Bob receives ICE candidate
            msg_ice = json.loads(await asyncio.wait_for(ws_b.recv(), timeout=5.0))
            print(f"Bob received relayed ICE candidate from {msg_ice['sender_id']}", flush=True)
            assert msg_ice["type"] == "ice-candidate"

            # Bob sends chat message
            print("Bob sending chat message...", flush=True)
            await ws_b.send(json.dumps({
                "type": "chat-message",
                "sender_id": "peer-b",
                "sender_name": "Bob",
                "message": "Hi Alice, WebRTC signaling works!",
                "timestamp": "2026-09-25T22:30:00Z"
            }))

            # Alice receives chat message
            msg_chat = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=5.0))
            print(f"Alice received chat from {msg_chat['sender_name']}: '{msg_chat['message']}'", flush=True)
            assert msg_chat["type"] == "chat-message"

    print("\nSUCCESS: WebRTC signaling, offer/answer routing, ICE candidate exchange, and in-room chat all verified!", flush=True)

if __name__ == "__main__":
    asyncio.run(test_webrtc_signaling())
