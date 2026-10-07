from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)

from database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    # If null, notification applies to all recipients matching recipient_role
    user_id = Column(
        Integer,
        ForeignKey(
            "students.id",
            ondelete="CASCADE"
        ),
        nullable=True,
        index=True
    )

    coordinator_id = Column(
        Integer,
        ForeignKey(
            "coordinators.id",
            ondelete="CASCADE"
        ),
        nullable=True,
        index=True
    )

    recipient_role = Column(
        String(20),
        nullable=False,
        default="student"
    )

    title = Column(
        String(200),
        nullable=False
    )

    message = Column(
        Text,
        nullable=False
    )

    type = Column(
        String(50),
        nullable=False,
        default="info"
    )

    event_id = Column(
        Integer,
        ForeignKey(
            "events.id",
            ondelete="SET NULL"
        ),
        nullable=True,
        index=True
    )

    is_read = Column(
        Boolean,
        nullable=False,
        default=False
    )

    created_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow
    )
