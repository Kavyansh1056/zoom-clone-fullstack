from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator


class ParticipantBase(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=100)
    peer_id: Optional[str] = Field(None, max_length=64)
    is_host: bool = False


class ParticipantCreate(ParticipantBase):
    pass


class ParticipantResponse(ParticipantBase):
    id: int
    meeting_id: str
    joined_at: datetime
    left_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MeetingBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    host_name: str = Field(default="Host", min_length=1, max_length=100)
    scheduled_at: Optional[datetime] = None
    duration: int = Field(default=30, ge=5, le=480)  # 5 mins to 8 hours


class MeetingCreate(MeetingBase):
    is_instant: bool = False

    @field_validator("title")
    def validate_title(cls, v):
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Title cannot be empty or blank")
        return cleaned


class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    ended_at: Optional[datetime] = None


class MeetingResponse(MeetingBase):
    id: int
    meeting_id: str
    invite_link: str
    status: str
    created_at: datetime
    ended_at: Optional[datetime] = None
    participants: List[ParticipantResponse] = []
    active_participant_count: int = 0

    class Config:
        from_attributes = True


class JoinMeetingRequest(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=100)
    peer_id: Optional[str] = Field(None, max_length=64)
    is_host: bool = False


class LeaveMeetingRequest(BaseModel):
    peer_id: Optional[str] = None
    display_name: Optional[str] = None
