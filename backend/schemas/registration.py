from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class RegistrationCreate(BaseModel):
    event_id: int


class AttendanceVerifyRequest(BaseModel):
    qr_token: str
    event_id: Optional[int] = None


class AttendanceMarkRequest(BaseModel):
    qr_token: str
    event_id: Optional[int] = None


class ManualAttendanceRequest(BaseModel):
    registration_id: int
    event_id: int


class RegistrationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    event_id: int
    registered_at: datetime
    status: str
    qr_token: str
    attendance_status: str
    attendance_marked_at: Optional[datetime] = None
