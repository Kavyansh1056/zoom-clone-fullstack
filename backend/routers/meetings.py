from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from schemas import (
    MeetingCreate,
    MeetingResponse,
    MeetingUpdate,
    ParticipantResponse,
    JoinMeetingRequest,
    LeaveMeetingRequest,
)
from services import meeting_service
from websocket.connection_manager import manager

router = APIRouter(prefix="/api/meetings", tags=["meetings"])


def _enrich_meeting_response(meeting, db: Session) -> dict:
    """Helper to convert meeting model and enrich with active participant count."""
    active_in_db = sum(1 for p in meeting.participants if p.left_at is None)
    active_in_ws = len(manager.rooms.get(meeting.meeting_id, {}))
    # WS live count takes precedence if available
    active_count = max(active_in_db, active_in_ws)

    return {
        "id": meeting.id,
        "meeting_id": meeting.meeting_id,
        "title": meeting.title,
        "description": meeting.description,
        "host_name": meeting.host_name,
        "scheduled_at": meeting.scheduled_at,
        "duration": meeting.duration,
        "invite_link": meeting.invite_link,
        "status": meeting.status,
        "created_at": meeting.created_at,
        "ended_at": meeting.ended_at,
        "participants": meeting.participants,
        "active_participant_count": active_count,
    }


@router.get("", response_model=List[MeetingResponse])
def get_all_meetings(db: Session = Depends(get_db)):
    """Fetch all meetings ordered by creation date."""
    meetings = meeting_service.get_all_meetings(db)
    return [_enrich_meeting_response(m, db) for m in meetings]


@router.get("/upcoming", response_model=List[MeetingResponse])
def get_upcoming_meetings(db: Session = Depends(get_db)):
    """Fetch scheduled and in-progress meetings."""
    meetings = meeting_service.get_upcoming_meetings(db)
    return [_enrich_meeting_response(m, db) for m in meetings]


@router.get("/recent", response_model=List[MeetingResponse])
def get_recent_meetings(db: Session = Depends(get_db)):
    """Fetch recent / completed meetings."""
    meetings = meeting_service.get_recent_meetings(db)
    return [_enrich_meeting_response(m, db) for m in meetings]


@router.get("/{meeting_id}", response_model=MeetingResponse)
def get_meeting_by_id(meeting_id: str, db: Session = Depends(get_db)):
    """Fetch meeting details by meeting ID."""
    meeting = meeting_service.get_meeting_by_id(db, meeting_id)
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meeting with ID '{meeting_id}' not found. Please verify the meeting ID or link.",
        )
    return _enrich_meeting_response(meeting, db)


@router.post("", response_model=MeetingResponse, status_code=status.HTTP_201_CREATED)
def create_meeting(meeting_in: MeetingCreate, db: Session = Depends(get_db)):
    """Create a new instant or scheduled meeting."""
    try:
        meeting = meeting_service.create_meeting(db, meeting_in)
        return _enrich_meeting_response(meeting, db)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create meeting: {str(e)}"
        )


@router.post("/{meeting_id}/join", response_model=ParticipantResponse)
def join_meeting(
    meeting_id: str,
    join_req: JoinMeetingRequest,
    db: Session = Depends(get_db)
):
    """Validate and record participant joining a meeting."""
    try:
        participant = meeting_service.record_join(db, meeting_id, join_req)
        return participant
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{meeting_id}/leave")
def leave_meeting(
    meeting_id: str,
    leave_req: LeaveMeetingRequest,
    db: Session = Depends(get_db)
):
    """Record participant leaving a meeting."""
    participant = meeting_service.record_leave(db, meeting_id, leave_req)
    if not participant:
        return {"message": "Leave recorded or participant already left"}
    return {"message": "Successfully left meeting", "participant_id": participant.id}


@router.patch("/{meeting_id}", response_model=MeetingResponse)
def update_meeting(
    meeting_id: str,
    update_data: MeetingUpdate,
    db: Session = Depends(get_db)
):
    """Update meeting details or status."""
    meeting = meeting_service.update_meeting(db, meeting_id, update_data)
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meeting with ID '{meeting_id}' not found",
        )
    return _enrich_meeting_response(meeting, db)


@router.delete("/{meeting_id}", status_code=status.HTTP_200_OK)
def delete_meeting(meeting_id: str, db: Session = Depends(get_db)):
    """Delete a meeting."""
    success = meeting_service.delete_meeting(db, meeting_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meeting with ID '{meeting_id}' not found",
        )
    return {"message": f"Meeting '{meeting_id}' deleted successfully"}
