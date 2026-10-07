from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String

from database import Base


class User(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String(120), nullable=False)

    usn = Column(String(30), unique=True, nullable=False, index=True)

    email = Column(String(255), unique=True, nullable=False, index=True)

    department = Column(String(100), nullable=False)

    year = Column(String(20), nullable=False)

    phone = Column(String(25), nullable=False)

    password_hash = Column(String(255), nullable=False)

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )