from datetime import datetime

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    Time,
)

from database import Base


class Event(Base):
    __tablename__ = "events"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    title = Column(
        String(200),
        nullable=False
    )

    description = Column(
        Text,
        nullable=False
    )

    intro_image = Column(
        String(500),
        nullable=True
    )

    category = Column(
        String(100),
        nullable=False
    )

    event_date = Column(
        Date,
        nullable=False
    )

    start_time = Column(
        Time,
        nullable=False
    )

    end_time = Column(
        Time,
        nullable=False
    )

    venue = Column(
        String(200),
        nullable=False
    )

    organizer = Column(
        String(150),
        nullable=False
    )

    capacity = Column(
        Integer,
        nullable=False
    )

    registration_deadline = Column(
        Date,
        nullable=False
    )

    status = Column(
        String(30),
        nullable=False,
        default="upcoming"
    )

    coordinator_id = Column(
    Integer,
    ForeignKey(
        "coordinators.id",
        ondelete="SET NULL"
    ),
    nullable=True,
    index=True
    )

    created_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow
    )