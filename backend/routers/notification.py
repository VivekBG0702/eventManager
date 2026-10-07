from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from database import get_db
from models.notification import Notification

router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"],
)


class BroadcastNotificationRequest(BaseModel):
    title: str
    message: str
    recipient_role: str = "student"
    event_id: Optional[int] = None
    type: str = "announcement"


@router.get("/")
def get_notifications(
    user_id: Optional[int] = None,
    role: Optional[str] = "student",
    db: Session = Depends(get_db),
):
    query = db.query(Notification)

    if user_id is not None:
        query = query.filter(
            or_(
                Notification.user_id == user_id,
                Notification.user_id.is_(None),
            )
        )
    if role:
        query = query.filter(
            or_(
                Notification.recipient_role == role,
                Notification.recipient_role == "all",
            )
        )

    notifications = query.order_by(Notification.created_at.desc()).limit(50).all()

    return {
        "notifications": [
            {
                "id": n.id,
                "title": n.title,
                "message": n.message,
                "type": n.type,
                "event_id": n.event_id,
                "is_read": bool(n.is_read),
                "created_at": n.created_at,
            }
            for n in notifications
        ]
    }


@router.get("/student/{student_id}")
def get_student_notifications(
    student_id: int,
    db: Session = Depends(get_db),
):
    notifications = (
        db.query(Notification)
        .filter(
            or_(
                Notification.user_id == student_id,
                Notification.user_id.is_(None),
            )
        )
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )

    return {
        "notifications": [
            {
                "id": n.id,
                "title": n.title,
                "message": n.message,
                "type": n.type,
                "event_id": n.event_id,
                "is_read": bool(n.is_read),
                "created_at": n.created_at,
            }
            for n in notifications
        ]
    }


@router.put("/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
):
    notif = (
        db.query(Notification)
        .filter(Notification.id == notification_id)
        .first()
    )
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    notif.is_read = True
    db.commit()

    return {"message": "Notification marked as read", "id": notif.id}


@router.post("/broadcast", status_code=201)
def broadcast_notification(
    payload: BroadcastNotificationRequest,
    db: Session = Depends(get_db),
):
    notif = Notification(
        user_id=None,
        recipient_role=payload.recipient_role,
        title=payload.title.strip(),
        message=payload.message.strip(),
        type=payload.type,
        event_id=payload.event_id,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)

    return {"message": "Broadcast notification created", "id": notif.id}
