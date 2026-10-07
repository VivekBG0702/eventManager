import secrets
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.security import get_current_user_token
from database import get_db
from models.certificate import Certificate
from models.event import Event
from models.notification import Notification
from models.registration import Registration
from models.user import User

router = APIRouter(
    prefix="/certificates",
    tags=["Certificates"],
)


class IssueCertificateRequest(BaseModel):
    event_id: int
    student_id: Optional[int] = None


@router.post("/issue")
def issue_certificates(
    payload: IssueCertificateRequest,
    db: Session = Depends(get_db),
):
    event = db.query(Event).filter(Event.id == payload.event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    reg_query = db.query(Registration).filter(
        Registration.event_id == payload.event_id,
        Registration.attendance_status == "present",
    )

    if payload.student_id:
        reg_query = reg_query.filter(Registration.student_id == payload.student_id)

    registrations = reg_query.all()
    if not registrations:
        raise HTTPException(
            status_code=400,
            detail="No eligible present attendees found for certificate issuance.",
        )

    issued_count = 0
    results = []

    for reg in registrations:
        existing = (
            db.query(Certificate)
            .filter(Certificate.registration_id == reg.id)
            .first()
        )

        if existing:
            results.append({
                "certificate_id": existing.certificate_id,
                "student_id": existing.student_id,
                "status": "already_issued",
            })
            continue

        cert_id = f"CERT-{event.id}-{reg.student_id}-{secrets.token_hex(4).upper()}"
        new_cert = Certificate(
            certificate_id=cert_id,
            registration_id=reg.id,
            student_id=reg.student_id,
            event_id=event.id,
            issue_date=datetime.utcnow(),
            status="issued",
        )
        db.add(new_cert)

        # Notify student
        notif = Notification(
            user_id=reg.student_id,
            recipient_role="student",
            title=f"Certificate Issued: {event.title}",
            message=f"Congratulations! Your certificate of participation for '{event.title}' is now available in your profile.",
            type="certificate",
            event_id=event.id,
        )
        db.add(notif)
        issued_count += 1
        results.append({
            "certificate_id": cert_id,
            "student_id": reg.student_id,
            "status": "issued",
        })

    db.commit()

    return {
        "message": f"{issued_count} certificate(s) issued successfully.",
        "issued_count": issued_count,
        "certificates": results,
    }


@router.get("/student/{student_id}")
def get_student_certificates(
    student_id: int,
    db: Session = Depends(get_db),
):
    student = db.query(User).filter(User.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    certificates = (
        db.query(Certificate)
        .filter(Certificate.student_id == student_id)
        .order_by(Certificate.issue_date.desc())
        .all()
    )

    data = []
    for cert in certificates:
        event = db.query(Event).filter(Event.id == cert.event_id).first()
        data.append({
            "id": cert.id,
            "certificate_id": cert.certificate_id,
            "issue_date": cert.issue_date,
            "status": cert.status,
            "student": {
                "id": student.id,
                "name": student.name,
                "usn": student.usn,
                "department": student.department,
            },
            "event": {
                "id": event.id if event else None,
                "title": event.title if event else "Event",
                "category": event.category if event else "",
                "event_date": str(event.event_date) if event else "",
                "venue": event.venue if event else "",
                "organizer": event.organizer if event else "",
            },
        })

    return {"certificates": data}


@router.get("/event/{event_id}")
def get_event_certificates(
    event_id: int,
    db: Session = Depends(get_db),
):
    certificates = (
        db.query(Certificate)
        .filter(Certificate.event_id == event_id)
        .all()
    )

    data = []
    for cert in certificates:
        student = db.query(User).filter(User.id == cert.student_id).first()
        data.append({
            "id": cert.id,
            "certificate_id": cert.certificate_id,
            "issue_date": cert.issue_date,
            "status": cert.status,
            "student_id": cert.student_id,
            "student_name": student.name if student else "Unknown",
            "student_usn": student.usn if student else "N/A",
        })

    return {"certificates": data}


@router.get("/{certificate_id}")
def get_certificate_details(
    certificate_id: str,
    db: Session = Depends(get_db),
):
    cert = (
        db.query(Certificate)
        .filter(Certificate.certificate_id == certificate_id)
        .first()
    )
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")

    student = db.query(User).filter(User.id == cert.student_id).first()
    event = db.query(Event).filter(Event.id == cert.event_id).first()

    return {
        "certificate_id": cert.certificate_id,
        "issue_date": cert.issue_date,
        "status": cert.status,
        "student": {
            "name": student.name if student else "Attendee",
            "usn": student.usn if student else "N/A",
            "department": student.department if student else "",
        },
        "event": {
            "title": event.title if event else "Event",
            "category": event.category if event else "",
            "event_date": str(event.event_date) if event else "",
            "venue": event.venue if event else "",
            "organizer": event.organizer if event else "",
        },
    }
