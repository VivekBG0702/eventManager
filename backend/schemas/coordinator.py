from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class CoordinatorCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    coordinator_id: str = Field(min_length=2, max_length=30)
    email: EmailStr
    department: str = Field(min_length=2, max_length=100)
    phone: str | None = Field(default=None, max_length=25)
    password: str = Field(min_length=8, max_length=128)


class CoordinatorLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class CoordinatorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    coordinator_id: str
    email: EmailStr
    department: str
    phone: str | None
    created_at: datetime