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


class Registration(Base):
    __tablename__ = "registrations"

    id = Column(
        Integer,
        primary_key=True,
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

    registered_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow
    )

    status = Column(
        String(30),
        nullable=False,
        default="registered"
    )

    # Unique token used to generate the student's QR code.
    qr_token = Column(
        String(100),
        unique=True,
        nullable=False,
        index=True
    )

    # Attendance starts as absent.
    attendance_status = Column(
        String(20),
        nullable=False,
        default="absent"
    )

    # Filled when the coordinator scans the QR.
    attendance_marked_at = Column(
        DateTime,
        nullable=True
    )

    __table_args__ = (
        UniqueConstraint(
            "student_id",
            "event_id",
            name="unique_student_event_registration"
        ),
    )