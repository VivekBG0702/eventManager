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


class Certificate(Base):
    __tablename__ = "certificates"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    certificate_id = Column(
        String(64),
        unique=True,
        nullable=False,
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

    issue_date = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow
    )

    status = Column(
        String(20),
        nullable=False,
        default="issued"
    )

    certificate_url = Column(
        String(500),
        nullable=True
    )

    __table_args__ = (
        UniqueConstraint(
            "student_id",
            "event_id",
            name="unique_student_event_certificate"
        ),
    )
