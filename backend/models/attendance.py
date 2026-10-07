from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)

from database import Base


class Attendance(Base):
    __tablename__ = "attendances"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    registration_id = Column(
        Integer,
        ForeignKey(
            "registrations.id",
            ondelete="CASCADE"
        ),
        unique=True,
        nullable=False,
        index=True
    )

    student_id = Column(
        Integer,
        ForeignKey(
            "students.id",
            ondelete="CASCADE"
        ),
        nullable=False,
        index=True
    )

    event_id = Column(
        Integer,
        ForeignKey(
            "events.id",
            ondelete="CASCADE"
        ),
        nullable=False,
        index=True
    )

    marked_by = Column(
        Integer,
        ForeignKey(
            "coordinators.id",
            ondelete="SET NULL"
        ),
        nullable=True,
        index=True
    )

    marked_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow
    )

    method = Column(
        String(30),
        nullable=False,
        default="qr_scan"
    )

    __table_args__ = (
        UniqueConstraint(
            "student_id",
            "event_id",
            name="unique_student_event_attendance"
        ),
    )
