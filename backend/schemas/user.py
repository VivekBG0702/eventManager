from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserRegister(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    usn: str = Field(min_length=3, max_length=30)
    email: EmailStr
    department: str = Field(min_length=2, max_length=100)
    year: str = Field(min_length=1, max_length=20)
    phone: str = Field(min_length=7, max_length=25)
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    usn: str
    email: EmailStr
    department: str
    year: str
    phone: str
    created_at: datetime

class AdminLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
