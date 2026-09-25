import json
import urllib.request
import urllib.error

API_BASE = "http://127.0.0.1:8000"

def make_request(method: str, path: str, data: dict = None):
    url = f"{API_BASE}{path}"
    headers = {"Content-Type": "application/json"}
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(err_body)
        except:
            return e.code, err_body

def run_api_audit():
    print("==================================================", flush=True)
    print("RUNNING REST API INTEGRATION AUDIT", flush=True)
    print("==================================================", flush=True)

    # 1. GET /api/meetings
    code, data = make_request("GET", "/api/meetings")
    print(f"1. GET /api/meetings: Status {code} (returned {len(data)} meetings)")
    assert code == 200 and isinstance(data, list)

    # 2. GET /api/meetings/upcoming
    code, upcoming = make_request("GET", "/api/meetings/upcoming")
    print(f"2. GET /api/meetings/upcoming: Status {code} (returned {len(upcoming)} meetings)")
    assert code == 200 and isinstance(upcoming, list)

    # 3. GET /api/meetings/recent
    code, recent = make_request("GET", "/api/meetings/recent")
    print(f"3. GET /api/meetings/recent: Status {code} (returned {len(recent)} meetings)")
    assert code == 200 and isinstance(recent, list)

    # 4. POST /api/meetings (Valid)
    code, new_meeting = make_request("POST", "/api/meetings", {
        "title": "API Audit Meeting",
        "description": "Verifying all REST endpoints",
        "host_name": "QA Auditor",
        "duration": 45,
        "is_instant": False,
    })
    print(f"4. POST /api/meetings (Valid): Status {code} (ID: {new_meeting.get('meeting_id')})")
    assert code == 201
    m_id = new_meeting["meeting_id"]

    # 5. GET /api/meetings/{id} (Valid)
    code, single = make_request("GET", f"/api/meetings/{m_id}")
    print(f"5. GET /api/meetings/{m_id}: Status {code} (Title: '{single.get('title')}')")
    assert code == 200 and single["meeting_id"] == m_id

    # 6. GET /api/meetings/{invalid_id}
    code, err404 = make_request("GET", "/api/meetings/non-existent-999")
    print(f"6. GET /api/meetings/non-existent-999: Status {code} (Detail: '{err404.get('detail')}')")
    assert code == 404

    # 7. POST /api/meetings (Empty title validation error)
    code, err_val = make_request("POST", "/api/meetings", {
        "title": "   ",
        "host_name": "QA Auditor",
    })
    print(f"7. POST /api/meetings (Blank title): Status {code} (Validation error handled)")
    assert code in (400, 422)

    # 8. POST /api/meetings/{id}/join (Valid)
    code, join_res = make_request("POST", f"/api/meetings/{m_id}/join", {
        "display_name": "Test Attendee",
        "peer_id": "peer-qa-1",
        "is_host": False,
    })
    print(f"8. POST /api/meetings/{m_id}/join: Status {code} (Participant: '{join_res.get('display_name')}')")
    assert code == 200 and join_res["display_name"] == "Test Attendee"

    # 9. POST /api/meetings/{invalid_id}/join (404)
    code, err_join = make_request("POST", "/api/meetings/non-existent-999/join", {
        "display_name": "Test Attendee",
    })
    print(f"9. POST /api/meetings/non-existent-999/join: Status {code}")
    assert code == 404

    # 10. POST /api/meetings/{id}/leave (Valid)
    code, leave_res = make_request("POST", f"/api/meetings/{m_id}/leave", {
        "peer_id": "peer-qa-1",
    })
    print(f"10. POST /api/meetings/{m_id}/leave: Status {code}")
    assert code == 200

    # 11. PATCH /api/meetings/{id} (Update title)
    code, patched = make_request("PATCH", f"/api/meetings/{m_id}", {
        "title": "Updated Audit Title",
    })
    print(f"11. PATCH /api/meetings/{m_id}: Status {code} (New title: '{patched.get('title')}')")
    assert code == 200 and patched["title"] == "Updated Audit Title"

    # 12. PATCH /api/meetings/{invalid_id} (404)
    code, err_patch = make_request("PATCH", "/api/meetings/non-existent-999", {
        "title": "Should Fail",
    })
    print(f"12. PATCH /api/meetings/non-existent-999: Status {code}")
    assert code == 404

    # 13. DELETE /api/meetings/{id} (Valid)
    code, del_res = make_request("DELETE", f"/api/meetings/{m_id}")
    print(f"13. DELETE /api/meetings/{m_id}: Status {code}")
    assert code == 200

    # 14. DELETE /api/meetings/{invalid_id} (404)
    code, err_del = make_request("DELETE", "/api/meetings/non-existent-999")
    print(f"14. DELETE /api/meetings/non-existent-999: Status {code}")
    assert code == 404

    print("\n>>> ALL 14 REST API ENDPOINTS & ERROR CASES AUDITED AND PASSED! <<<", flush=True)

if __name__ == "__main__":
    run_api_audit()
