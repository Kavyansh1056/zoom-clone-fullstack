import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from database import Base


class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(String(32), unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    host_name = Column(String(100), default="Host", nullable=False)
    scheduled_at = Column(DateTime, nullable=True)
    duration = Column(Integer, default=30, nullable=False)  # in minutes
    invite_link = Column(String(512), nullable=False)
    status = Column(String(50), default="scheduled", nullable=False)  # scheduled, in_progress, completed, cancelled
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    ended_at = Column(DateTime, nullable=True)

    # Relationship to participants
    participants = relationship("Participant", back_populates="meeting", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Meeting(meeting_id='{self.meeting_id}', title='{self.title}', status='{self.status}')>"


class Participant(Base):
    __tablename__ = "participants"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(String(32), ForeignKey("meetings.meeting_id", ondelete="CASCADE"), nullable=False, index=True)
    display_name = Column(String(100), nullable=False)
    peer_id = Column(String(64), nullable=True, index=True)
    is_host = Column(Boolean, default=False, nullable=False)
    joined_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    left_at = Column(DateTime, nullable=True)

    # Relationship to meeting
    meeting = relationship("Meeting", back_populates="participants")

    def __repr__(self):
        return f"<Participant(name='{self.display_name}', meeting='{self.meeting_id}', is_host={self.is_host})>"
