import os
import datetime
from database import SessionLocal, Base, engine
from models import Meeting, Participant

BASE_INVITE_URL = (
    os.getenv("BASE_INVITE_URL")
    or f"{os.getenv('FRONTEND_URL', 'http://localhost:3000').rstrip('/')}/meeting"
)


def seed_database(clear_existing: bool = True):
    """Seed SQLite database with clean, realistic professional meetings."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        if not clear_existing:
            existing_count = db.query(Meeting).count()
            if existing_count > 0:
                print(f"Database already contains {existing_count} meetings. Skipping automatic seed.")
                return
        else:
            db.query(Participant).delete()
            db.query(Meeting).delete()
            db.commit()

        now = datetime.datetime.utcnow()

        sample_meetings = [
            # 3 Professional Upcoming Meetings
            {
                "meeting_id": "849-204-1928",
                "title": "Product Design Review",
                "description": "Cross-functional walkthrough of Q4 design specifications, design system components, and WebRTC responsive layout.",
                "host_name": "Kavyansh Mehra",
                "scheduled_at": now + datetime.timedelta(hours=2, minutes=30),
                "duration": 45,
                "status": "scheduled",
                "created_at": now - datetime.timedelta(hours=4),
                "participants": [
                    {"display_name": "Kavyansh Mehra", "is_host": True}
                ]
            },
            {
                "meeting_id": "713-904-8219",
                "title": "Weekly Team Sync",
                "description": "Weekly team alignment meeting to review ongoing deliverables, engineering roadmaps, and unblock sprint dependencies.",
                "host_name": "Sarah Chen",
                "scheduled_at": now + datetime.timedelta(days=1, hours=3),
                "duration": 30,
                "status": "scheduled",
                "created_at": now - datetime.timedelta(days=1),
                "participants": [
                    {"display_name": "Sarah Chen", "is_host": True}
                ]
            },
            {
                "meeting_id": "934-812-4091",
                "title": "Project Planning Session",
                "description": "Sprint planning, sprint backlog refinement, and technical task estimation for upcoming milestones.",
                "host_name": "David Miller",
                "scheduled_at": now + datetime.timedelta(days=2, hours=5),
                "duration": 60,
                "status": "scheduled",
                "created_at": now - datetime.timedelta(days=2),
                "participants": [
                    {"display_name": "David Miller", "is_host": True}
                ]
            },
            # 3 Professional Recent / Completed Meetings
            {
                "meeting_id": "581-309-8472",
                "title": "Sprint Review",
                "description": "Demo of completed sprint features, retrospective feedback, and sprint velocity analysis.",
                "host_name": "Kavyansh Mehra",
                "scheduled_at": now - datetime.timedelta(days=1, hours=4),
                "duration": 45,
                "status": "completed",
                "created_at": now - datetime.timedelta(days=2),
                "ended_at": now - datetime.timedelta(days=1, hours=3, minutes=15),
                "participants": [
                    {"display_name": "Kavyansh Mehra", "is_host": True, "left_at": now - datetime.timedelta(days=1, hours=3, minutes=15)},
                    {"display_name": "Sarah Chen", "is_host": False, "left_at": now - datetime.timedelta(days=1, hours=3, minutes=15)},
                    {"display_name": "David Miller", "is_host": False, "left_at": now - datetime.timedelta(days=1, hours=3, minutes=15)},
                ]
            },
            {
                "meeting_id": "620-491-3820",
                "title": "Client Discussion",
                "description": "Discussion with key client stakeholders regarding deployment roadmap, SLAs, and technical requirements.",
                "host_name": "Elena Rostova",
                "scheduled_at": now - datetime.timedelta(days=2, hours=6),
                "duration": 30,
                "status": "completed",
                "created_at": now - datetime.timedelta(days=3),
                "ended_at": now - datetime.timedelta(days=2, hours=5, minutes=30),
                "participants": [
                    {"display_name": "Elena Rostova", "is_host": True, "left_at": now - datetime.timedelta(days=2, hours=5, minutes=30)},
                    {"display_name": "Kavyansh Mehra", "is_host": False, "left_at": now - datetime.timedelta(days=2, hours=5, minutes=30)},
                ]
            },
            {
                "meeting_id": "319-840-2715",
                "title": "Engineering Sync",
                "description": "Deep-dive architecture discussion on low-latency signaling gateway and WebRTC media pipeline.",
                "host_name": "David Miller",
                "scheduled_at": now - datetime.timedelta(days=4, hours=2),
                "duration": 45,
                "status": "completed",
                "created_at": now - datetime.timedelta(days=5),
                "ended_at": now - datetime.timedelta(days=4, hours=1, minutes=15),
                "participants": [
                    {"display_name": "David Miller", "is_host": True, "left_at": now - datetime.timedelta(days=4, hours=1, minutes=15)},
                    {"display_name": "Kavyansh Mehra", "is_host": False, "left_at": now - datetime.timedelta(days=4, hours=1, minutes=15)},
                ]
            }
        ]

        for m_data in sample_meetings:
            p_data_list = m_data.pop("participants", [])
            invite_url = f"{BASE_INVITE_URL}/{m_data['meeting_id']}"
            meeting = Meeting(
                **m_data,
                invite_link=invite_url
            )
            db.add(meeting)
            db.flush()

            for p_info in p_data_list:
                participant = Participant(
                    meeting_id=meeting.meeting_id,
                    display_name=p_info["display_name"],
                    is_host=p_info.get("is_host", False),
                    joined_at=m_data["created_at"],
                    left_at=p_info.get("left_at", None),
                )
                db.add(participant)

        db.commit()
        print(f"Successfully seeded database with {len(sample_meetings)} realistic meetings (3 upcoming, 3 recent)!")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    seed_database(clear_existing=True)
