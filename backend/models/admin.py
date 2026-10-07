from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String

from database import Base


class Admin(Base):
    __tablename__ = "admins"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(
        String(120),
        nullable=False
    )

    admin_id = Column(
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

    created_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow
    )

    last_login = Column(
        DateTime,
        nullable=True
    )