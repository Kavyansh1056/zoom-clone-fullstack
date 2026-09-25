import sqlite3
import datetime
from database import SessionLocal, engine
from models import Meeting, Participant

def audit_database():
    print("==================================================", flush=True)
    print("RUNNING IN-DEPTH SQLITE & RELATIONAL SCHEMA AUDIT", flush=True)
    print("==================================================", flush=True)

    conn = sqlite3.connect("zoom_clone.db")
    cursor = conn.cursor()

    # 1. Check foreign keys enabled
    cursor.execute("PRAGMA foreign_keys;")
    fk_status = cursor.fetchone()[0]
    print(f"1. SQLite PRAGMA foreign_keys: {'ENABLED (1)' if fk_status else 'DISABLED (0)'}")

    # 2. Check foreign key violations
    cursor.execute("PRAGMA foreign_key_check;")
    fk_violations = cursor.fetchall()
    print(f"2. Foreign key check violations: {len(fk_violations)}")
    assert len(fk_violations) == 0, f"Foreign key integrity violations found: {fk_violations}"

    # 3. Check table schemas
    cursor.execute("SELECT name, sql FROM sqlite_master WHERE type='table';")
    tables = {row[0]: row[1] for row in cursor.fetchall()}
    print(f"3. Registered tables in SQLite: {list(tables.keys())}")
    assert "meetings" in tables, "Table 'meetings' missing from SQLite"
    assert "participants" in tables, "Table 'participants' missing from SQLite"

    # 4. Check indices
    cursor.execute("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index';")
    indices = cursor.fetchall()
    print(f"4. Table indices ({len(indices)} found):")
    idx_names = [i[0] for i in indices]
    for idx in indices:
        print(f"   - {idx[0]} on {idx[1]}")
    assert any("meeting_id" in name.lower() for name in idx_names), "Index on meeting_id missing!"

    # 5. Check duplicate meeting_id prevention (Unique constraint)
    print("5. Testing unique constraint on meeting_id...")
    test_id = "test-unique-check-999"
    cursor.execute("""
        INSERT INTO meetings (meeting_id, title, host_name, duration, invite_link, status, created_at)
        VALUES (?, 'Test 1', 'Host', 30, 'http://localhost:3000/meeting/test-1', 'scheduled', datetime('now'))
    """, (test_id,))
    conn.commit()

    try:
        cursor.execute("""
            INSERT INTO meetings (meeting_id, title, host_name, duration, invite_link, status, created_at)
            VALUES (?, 'Test 2', 'Host', 30, 'http://localhost:3000/meeting/test-2', 'scheduled', datetime('now'))
        """, (test_id,))
        conn.commit()
        assert False, "SQLite failed to enforce unique constraint on meeting_id!"
    except sqlite3.IntegrityError:
        print("   -> Unique constraint verified: duplicate meeting_id correctly rejected with IntegrityError.")
    finally:
        # Cleanup
        cursor.execute("DELETE FROM meetings WHERE meeting_id = ?", (test_id,))
        conn.commit()

    # 6. Test Cascade Deletion of Participants
    print("6. Testing foreign key cascade deletion...")
    cascade_m_id = "cascade-test-111"
    cursor.execute("""
        INSERT INTO meetings (meeting_id, title, host_name, duration, invite_link, status, created_at)
        VALUES (?, 'Cascade Parent', 'Host', 30, 'http://localhost:3000/meeting/cascade', 'scheduled', datetime('now'))
    """, (cascade_m_id,))
    cursor.execute("""
        INSERT INTO participants (meeting_id, display_name, is_host, joined_at)
        VALUES (?, 'Child Participant A', 1, datetime('now'))
    """, (cascade_m_id,))
    cursor.execute("""
        INSERT INTO participants (meeting_id, display_name, is_host, joined_at)
        VALUES (?, 'Child Participant B', 0, datetime('now'))
    """, (cascade_m_id,))
    conn.commit()

    # Verify children exist
    cursor.execute("SELECT count(*) FROM participants WHERE meeting_id = ?", (cascade_m_id,))
    count_before = cursor.fetchone()[0]
    assert count_before == 2, f"Expected 2 participants, found {count_before}"

    # Delete parent via SQLAlchemy session to test ORM cascade
    db = SessionLocal()
    m_obj = db.query(Meeting).filter(Meeting.meeting_id == cascade_m_id).first()
    assert m_obj is not None
    db.delete(m_obj)
    db.commit()
    db.close()

    # Verify children were deleted
    cursor.execute("SELECT count(*) FROM participants WHERE meeting_id = ?", (cascade_m_id,))
    count_after = cursor.fetchone()[0]
    print(f"   -> Participants before delete: {count_before}, after parent delete: {count_after}")
    assert count_after == 0, f"Expected 0 participants after cascade delete, found {count_after}!"

    # 7. Data consistency audit on existing meetings
    print("7. Auditing all existing database records for timestamp and status validity...")
    cursor.execute("SELECT id, meeting_id, title, status, duration, created_at, scheduled_at, ended_at FROM meetings;")
    all_meetings = cursor.fetchall()
    for m in all_meetings:
        assert m[1] and len(m[1]) > 0, "Missing meeting_id"
        assert m[2] and len(m[2]) > 0, "Missing title"
        assert m[3] in ("scheduled", "in_progress", "completed", "cancelled"), f"Invalid status: {m[3]}"
        assert m[4] > 0, f"Invalid duration: {m[4]}"
        assert m[5] is not None, "Missing created_at timestamp"
        if m[3] == "completed":
            assert m[7] is not None or m[6] is not None, "Completed meeting should have end or schedule timestamp"

    print(f"   -> All {len(all_meetings)} meetings verified healthy with valid schema constraints.")

    conn.close()
    print("\n>>> DATABASE AUDIT PASSED WITH 100% INTEGRITY! <<<", flush=True)

if __name__ == "__main__":
    audit_database()
