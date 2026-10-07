from datetime import date, time

from pydantic import BaseModel, Field


class EventResponse(BaseModel):
    id: int
    title: str
    description: str
    intro_image: str | None = None
    category: str
    event_date: date
    start_time: time
    end_time: time
    venue: str
    organizer: str
    capacity: int
    registration_deadline: date
    status: str