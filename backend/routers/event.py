from datetime import date, datetime, time
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy import or_
from sqlalchemy.orm import Session

from core.security import get_current_user
from database import get_db
from models.coordinator import Coordinator
from models.event import Event
from models.notification import Notification
from models.registration import Registration

router = APIRouter(
    prefix="/events",
    tags=["Events"],
)

UPLOAD_DIR = Path("uploads/events")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

MAX_IMAGE_SIZE = 5 * 1024 * 1024


def _serialize_event(event: Event, db: Session) -> dict:
    coordinator = None
    if event.coordinator_id:
        coordinator = (
            db.query(Coordinator)
            .filter(Coordinator.id == event.coordinator_id)
            .first()
        )

    registered_count = (
        db.query(Registration)
        .filter(
            Registration.event_id == event.id,
            Registration.status == "registered",
        )
        .count()
    )

    present_count = (
        db.query(Registration)
        .filter(
            Registration.event_id == event.id,
            Registration.status == "registered",
            Registration.attendance_status == "present",
        )
        .count()
    )

    return {
        "id": event.id,
        "title": event.title,
        "description": event.description,
        "intro_image": event.intro_image,
        "category": event.category,
        "event_date": event.event_date,
        "start_time": event.start_time,
        "end_time": event.end_time,
        "venue": event.venue,
        "organizer": event.organizer,
        "coordinator_id": event.coordinator_id,
        "coordinator": {
            "id": coordinator.id,
            "name": coordinator.name,
            "department": coordinator.department,
            "email": coordinator.email,
        } if coordinator else None,
        "capacity": event.capacity,
        "registered_count": registered_count,
        "present_count": present_count,
        "available_seats": max(0, event.capacity - registered_count),
        "registration_deadline": event.registration_deadline,
        "status": event.status,
        "created_at": event.created_at,
    }


# ==================================================
# CREATE EVENT
# ==================================================

@router.post("/", status_code=201)
async def create_event(
    title: str = Form(...),
    description: str = Form(...),
    category: str = Form(...),
    event_date: date = Form(...),
    start_time: time = Form(...),
    end_time: time = Form(...),
    venue: str = Form(...),
    organizer: str = Form(...),
    coordinator_id: int = Form(...),
    capacity: int = Form(...),
    registration_deadline: date = Form(...),
    intro_image: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    if capacity <= 0:
        raise HTTPException(
            status_code=400,
            detail="Capacity must be greater than 0",
        )

    if end_time <= start_time:
        raise HTTPException(
            status_code=400,
            detail="End time must be later than start time",
        )

    if registration_deadline > event_date:
        raise HTTPException(
            status_code=400,
            detail="Registration deadline cannot be after the event date",
        )

    coordinator = (
        db.query(Coordinator)
        .filter(Coordinator.id == coordinator_id)
        .first()
    )

    if not coordinator:
        raise HTTPException(
            status_code=404,
            detail="Coordinator not found",
        )

    image_path = None
    if intro_image and intro_image.filename:
        if intro_image.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status_code=400,
                detail="Only JPG, PNG, and WEBP images are allowed",
            )

        image_data = await intro_image.read()
        if len(image_data) > MAX_IMAGE_SIZE:
            raise HTTPException(
                status_code=400,
                detail="Image size must not exceed 5 MB",
            )

        extension = ALLOWED_IMAGE_TYPES[intro_image.content_type]
        unique_filename = f"{uuid4().hex}{extension}"
        file_path = UPLOAD_DIR / unique_filename

        with open(file_path, "wb") as image_file:
            image_file.write(image_data)

        image_path = f"uploads/events/{unique_filename}"

    new_event = Event(
        title=title.strip(),
        description=description.strip(),
        intro_image=image_path,
        category=category.strip(),
        event_date=event_date,
        start_time=start_time,
        end_time=end_time,
        venue=venue.strip(),
        organizer=organizer.strip(),
        coordinator_id=coordinator_id,
        capacity=capacity,
        registration_deadline=registration_deadline,
        status="upcoming",
    )

    db.add(new_event)
    db.flush()

    # Create general notification for students
    new_event_notif = Notification(
        user_id=None,
        recipient_role="student",
        title=f"New Event: {new_event.title}",
        message=f"A new {new_event.category} event '{new_event.title}' scheduled on {new_event.event_date} is now open for registration.",
        type="event",
        event_id=new_event.id,
    )
    db.add(new_event_notif)

    db.commit()
    db.refresh(new_event)

    return {
        "message": "Event created successfully",
        "event": _serialize_event(new_event, db),
    }


# ==================================================
# GET ALL EVENTS
# ==================================================

@router.get("/")
def get_events(
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Event)

    if category and category.lower() != "all":
        query = query.filter(Event.category == category)

    if status and status.lower() != "all":
        query = query.filter(Event.status == status)

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Event.title.ilike(s),
                Event.venue.ilike(s),
                Event.organizer.ilike(s),
                Event.description.ilike(s),
            )
        )

    events = query.order_by(Event.event_date.asc()).all()

    return {
        "events": [_serialize_event(event, db) for event in events]
    }


# ==================================================
# GET SINGLE EVENT
# ==================================================

@router.get("/{event_id}")
def get_event(
    event_id: int,
    db: Session = Depends(get_db),
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    return {
        "event": _serialize_event(event, db)
    }


# ==================================================
# UPDATE EVENT
# ==================================================

@router.put("/{event_id}")
async def update_event(
    event_id: int,
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    event_date: Optional[date] = Form(None),
    start_time: Optional[time] = Form(None),
    end_time: Optional[time] = Form(None),
    venue: Optional[str] = Form(None),
    organizer: Optional[str] = Form(None),
    coordinator_id: Optional[int] = Form(None),
    capacity: Optional[int] = Form(None),
    registration_deadline: Optional[date] = Form(None),
    event_status: Optional[str] = Form(None),
    intro_image: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if capacity is not None:
        if capacity <= 0:
            raise HTTPException(status_code=400, detail="Capacity must be greater than 0")
        event.capacity = capacity

    if title is not None:
        event.title = title.strip()
    if description is not None:
        event.description = description.strip()
    if category is not None:
        event.category = category.strip()
    if event_date is not None:
        event.event_date = event_date
    if start_time is not None:
        event.start_time = start_time
    if end_time is not None:
        event.end_time = end_time
    if venue is not None:
        event.venue = venue.strip()
    if organizer is not None:
        event.organizer = organizer.strip()
    if event_status is not None:
        event.status = event_status.strip().lower()

    if registration_deadline is not None:
        if registration_deadline > event.event_date:
            raise HTTPException(
                status_code=400,
                detail="Registration deadline cannot be after the event date",
            )
        event.registration_deadline = registration_deadline

    if coordinator_id is not None:
        coordinator = (
            db.query(Coordinator)
            .filter(Coordinator.id == coordinator_id)
            .first()
        )
        if not coordinator:
            raise HTTPException(status_code=404, detail="Coordinator not found")
        event.coordinator_id = coordinator_id

    if intro_image and intro_image.filename:
        if intro_image.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status_code=400,
                detail="Only JPG, PNG, and WEBP images are allowed",
            )
        image_data = await intro_image.read()
        if len(image_data) > MAX_IMAGE_SIZE:
            raise HTTPException(status_code=400, detail="Image size must not exceed 5 MB")

        extension = ALLOWED_IMAGE_TYPES[intro_image.content_type]
        unique_filename = f"{uuid4().hex}{extension}"
        file_path = UPLOAD_DIR / unique_filename
        with open(file_path, "wb") as f:
            f.write(image_data)
        event.intro_image = f"uploads/events/{unique_filename}"

    db.commit()
    db.refresh(event)

    return {
        "message": "Event updated successfully",
        "event": _serialize_event(event, db),
    }


# ==================================================
# CANCEL OR DELETE EVENT
# ==================================================

@router.delete("/{event_id}")
def delete_or_cancel_event(
    event_id: int,
    hard_delete: bool = Query(False),
    db: Session = Depends(get_db),
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if hard_delete:
        db.delete(event)
        db.commit()
        return {"message": "Event permanently deleted"}

    # Soft cancel: mark status as cancelled and notify registered students
    event.status = "cancelled"

    # Notify all registered students
    registrations = (
        db.query(Registration)
        .filter(Registration.event_id == event.id)
        .all()
    )

    for reg in registrations:
        cancel_notif = Notification(
            user_id=reg.student_id,
            recipient_role="student",
            title=f"Event Cancelled: {event.title}",
            message=f"The event '{event.title}' scheduled for {event.event_date} has been cancelled.",
            type="cancellation",
            event_id=event.id,
        )
        db.add(cancel_notif)

    db.commit()

    return {
        "message": "Event cancelled successfully and registered students notified",
        "event_id": event.id,
        "status": "cancelled",
    }


# ==================================================
# GET EVENTS ASSIGNED TO A COORDINATOR
# ==================================================

@router.get("/coordinator/{coordinator_id}")
def get_coordinator_events(
    coordinator_id: int,
    current: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current["role"] == "student":
        raise HTTPException(
            status_code=403,
            detail="Students cannot view coordinator event assignments",
        )

    if current["role"] == "coordinator":
        coordinator_id = current["id"]

    coordinator = (
        db.query(Coordinator)
        .filter(Coordinator.id == coordinator_id)
        .first()
    )

    if not coordinator:
        raise HTTPException(
            status_code=404,
            detail="Coordinator not found",
        )

    events = (
        db.query(Event)
        .filter(Event.coordinator_id == coordinator_id)
        .order_by(Event.event_date.asc())
        .all()
    )

    return {
        "coordinator": {
            "id": coordinator.id,
            "name": coordinator.name,
            "coordinator_id": coordinator.coordinator_id,
        },
        "events": [_serialize_event(event, db) for event in events],
    }
