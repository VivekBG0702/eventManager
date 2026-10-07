from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String

from database import Base


class Coordinator(Base):
    __tablename__ = "coordinators"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    name = Column(
        String(120),
        nullable=False
    )

    coordinator_id = Column(
        String(30),
        unique=True,
        nullable=False,
        index=True
    )

    email = Column(
        String(255),
        unique=True,
        nullable=False,
        index=True
    )

    password_hash = Column(
        String(255),
        nullable=False
    )

    department = Column(
        String(100),
        nullable=False
    )

    phone = Column(
        String(25),
        nullable=True
    )

    created_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow
    )

    status = Column(
        String(20),
        nullable=False,
        default="pending"
    )

    last_login = Column(
        DateTime,
        nullable=True
    )