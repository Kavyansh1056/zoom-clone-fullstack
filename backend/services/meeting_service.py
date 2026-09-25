import os
import random
import datetime
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc, or_
from models import Meeting, Participant
from schemas import MeetingCreate, MeetingUpdate, JoinMeetingRequest, LeaveMeetingRequest

BASE_INVITE_URL = (
    os.getenv("BASE_INVITE_URL")
    or f"{os.getenv('FRONTEND_URL', 'http://localhost:3000').rstrip('/')}/meeting"
)


def generate_meeting_id() -> str:
    """Generate a realistic Zoom-like meeting ID: 10 digits formatted as 3-3-4 (e.g., 849-204-1928)."""
    p1 = f"{random.randint(100, 999)}"
    p2 = f"{random.randint(100, 999)}"
    p3 = f"{random.randint(1000, 9999)}"
    return f"{p1}-{p2}-{p3}"


def normalize_meeting_id(meeting_id: str) -> str:
    """Normalize meeting ID by stripping whitespace and extra slashes."""
    return meeting_id.strip()


def create_meeting(db: Session, meeting_in: MeetingCreate) -> Meeting:
    # Ensure meeting ID is unique
    for _ in range(5):
        m_id = generate_meeting_id()
        existing = db.query(Meeting).filter(Meeting.meeting_id == m_id).first()
        if not existing:
            break
    else:
        # Fallback timestamp suffix
        m_id = f"{random.randint(100, 999)}-{random.randint(100, 999)}-{int(datetime.datetime.utcnow().timestamp()) % 10000:04d}"

    invite_url = f"{BASE_INVITE_URL}/{m_id}"
    now = datetime.datetime.utcnow()

    if meeting_in.is_instant:
        status = "in_progress"
        scheduled_at = now
    else:
        status = "scheduled"
        scheduled_at = meeting_in.scheduled_at or now

    meeting = Meeting(
        meeting_id=m_id,
        title=meeting_in.title,
        description=meeting_in.description,
        host_name=meeting_in.host_name or "Host",
        scheduled_at=scheduled_at,
        duration=meeting_in.duration,
        invite_link=invite_url,
        status=status,
        created_at=now,
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return meeting


def get_meeting_by_id(db: Session, meeting_id: str) -> Optional[Meeting]:
    norm_id = normalize_meeting_id(meeting_id)
    # Also support searching without hyphens if user entered raw digits
    clean_id = norm_id.replace("-", "").replace(" ", "")

    meeting = db.query(Meeting).filter(Meeting.meeting_id == norm_id).first()
    if not meeting and len(clean_id) == 10:
        formatted = f"{clean_id[:3]}-{clean_id[3:6]}-{clean_id[6:]}"
        meeting = db.query(Meeting).filter(Meeting.meeting_id == formatted).first()

    return meeting


def get_all_meetings(db: Session) -> List[Meeting]:
    return db.query(Meeting).order_by(desc(Meeting.created_at)).all()


def get_upcoming_meetings(db: Session) -> List[Meeting]:
    """Retrieve upcoming and currently active meetings."""
    return (
        db.query(Meeting)
        .filter(Meeting.status.in_(["scheduled", "in_progress"]))
        .order_by(asc(Meeting.scheduled_at))
        .all()
    )


def get_recent_meetings(db: Session) -> List[Meeting]:
    """Retrieve past or completed meetings."""
    return (
        db.query(Meeting)
        .filter(Meeting.status.in_(["completed", "cancelled"]))
        .order_by(desc(Meeting.created_at))
        .all()
    )


def record_join(db: Session, meeting_id: str, join_req: JoinMeetingRequest) -> Participant:
    meeting = get_meeting_by_id(db, meeting_id)
    if not meeting:
        raise ValueError(f"Meeting with ID '{meeting_id}' not found")

    # If meeting was scheduled, transition to in_progress
    if meeting.status == "scheduled":
        meeting.status = "in_progress"
        db.add(meeting)

    participant = Participant(
        meeting_id=meeting.meeting_id,
        display_name=join_req.display_name,
        peer_id=join_req.peer_id,
        is_host=join_req.is_host,
        joined_at=datetime.datetime.utcnow(),
    )
    db.add(participant)
    db.commit()
    db.refresh(participant)
    return participant


def record_leave(db: Session, meeting_id: str, leave_req: LeaveMeetingRequest) -> Optional[Participant]:
    meeting = get_meeting_by_id(db, meeting_id)
    if not meeting:
        return None

    query = db.query(Participant).filter(
        Participant.meeting_id == meeting.meeting_id,
        Participant.left_at.is_(None)
    )

    if leave_req.peer_id:
        query = query.filter(Participant.peer_id == leave_req.peer_id)
    elif leave_req.display_name:
        query = query.filter(Participant.display_name == leave_req.display_name)

    participant = query.first()
    if participant:
        participant.left_at = datetime.datetime.utcnow()
        db.add(participant)

        # Check if there are any remaining active participants
        active_count = (
            db.query(Participant)
            .filter(Participant.meeting_id == meeting.meeting_id, Participant.left_at.is_(None))
            .count()
        )
        if active_count <= 1:
            meeting.status = "completed"
            meeting.ended_at = datetime.datetime.utcnow()
            db.add(meeting)

        db.commit()
        db.refresh(participant)
        return participant

    return None


def update_meeting(db: Session, meeting_id: str, update_data: MeetingUpdate) -> Optional[Meeting]:
    meeting = get_meeting_by_id(db, meeting_id)
    if not meeting:
        return None

    if update_data.title is not None:
        meeting.title = update_data.title
    if update_data.description is not None:
        meeting.description = update_data.description
    if update_data.status is not None:
        meeting.status = update_data.status
    if update_data.ended_at is not None:
        meeting.ended_at = update_data.ended_at

    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return meeting


def delete_meeting(db: Session, meeting_id: str) -> bool:
    meeting = get_meeting_by_id(db, meeting_id)
    if not meeting:
        return False
    db.delete(meeting)
    db.commit()
    return True
