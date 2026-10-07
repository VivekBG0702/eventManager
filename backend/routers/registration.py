import math
import secrets
from datetime import date, datetime
from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from core.security import get_current_user
from database import get_db
from models.attendance import Attendance
from models.certificate import Certificate
from models.coordinator import Coordinator
from models.event import Event
from models.notification import Notification
from models.registration import Registration
from models.user import User
from schemas.registration import (
    AttendanceMarkRequest,
    AttendanceVerifyRequest,
    ManualAttendanceRequest,
    RegistrationCreate,
    RegistrationResponse,
)


class AttendanceScanRequest(BaseModel):
    qr_token: str
    event_id: Optional[int] = None


router = APIRouter(
    prefix="/registrations",
    tags=["Registrations"],
)


def _iso(value: Any) -> Optional[str]:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def _authorize_event_staff(event: Event, current: dict[str, Any]) -> None:
    role = current.get("role")
    if role == "admin":
        return
    if role == "coordinator":
        if event.coordinator_id != current["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not assigned to this event",
            )
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Students cannot access event registration lists",
    )


def _authorize_event_coordinator(event: Event, current: dict[str, Any]) -> int:
    """Return the authenticated coordinator ID after checking event ownership."""
    if current["role"] != "coordinator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only coordinators can mark event attendance",
        )
    if event.coordinator_id != current["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not assigned to this event",
        )
    return current["id"]


def _serialize_student_registration(reg: Registration, event: Event, certificate) -> dict:
    return {
        "id": reg.id,
        "student_id": reg.student_id,
        "event_id": reg.event_id,
        "registered_at": reg.registered_at,
        "status": reg.status,
        "qr_token": reg.qr_token,
        "attendance_status": reg.attendance_status,
        "attendance_marked_at": reg.attendance_marked_at,
        "certificate": {
            "id": certificate.id,
            "certificate_id": certificate.certificate_id,
            "issue_date": certificate.issue_date,
            "status": certificate.status,
        } if certificate else None,
        "event": {
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
            "capacity": event.capacity,
            "registration_deadline": event.registration_deadline,
            "status": event.status,
        },
    }


# =========================================================
# STUDENT: MY REGISTRATIONS
# =========================================================

@router.get("/me")
def get_my_registrations(
    current: dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current["role"] != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can view personal registrations here",
        )

    student = current["user"]
    registrations = (
        db.query(Registration)
        .filter(Registration.student_id == student.id)
        .order_by(Registration.registered_at.desc())
        .all()
    )

    result = []
    for reg in registrations:
        event = db.query(Event).filter(Event.id == reg.event_id).first()
        if not event:
            continue
        certificate = (
            db.query(Certificate)
            .filter(Certificate.registration_id == reg.id)
            .first()
        )
        result.append(_serialize_student_registration(reg, event, certificate))

    return {
        "student": {
            "id": student.id,
            "name": student.name,
            "usn": student.usn,
        },
        "registrations": result,
    }


# =========================================================
# STUDENT REGISTRATIONS
# =========================================================

@router.get("/student/{student_id}")
def get_student_registrations(
    student_id: int,
    current: dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current["role"] != "student" or current["id"] != student_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Students can only view their own registrations",
        )

    student = (
        db.query(User)
        .filter(User.id == student_id)
        .first()
    )

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found",
        )

    registrations = (
        db.query(Registration)
        .filter(Registration.student_id == student_id)
        .order_by(Registration.registered_at.desc())
        .all()
    )

    result = []
    for reg in registrations:
        event = db.query(Event).filter(Event.id == reg.event_id).first()
        if not event:
            continue

        certificate = (
            db.query(Certificate)
            .filter(Certificate.registration_id == reg.id)
            .first()
        )

        result.append(_serialize_student_registration(reg, event, certificate))

    return {
        "student": {
            "id": student.id,
            "name": student.name,
            "usn": student.usn,
        },
        "registrations": result,
    }


# =========================================================
# EVENT REGISTRATIONS (COORDINATOR / ADMIN)
# =========================================================

@router.get("/event/{event_id}")
def get_event_registrations(
    event_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    search: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    year: Optional[str] = Query(None),
    attendance_status: Optional[str] = Query(None),
    current: dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    _authorize_event_staff(event, current)

    coordinator = None
    if event.coordinator_id:
        coordinator = (
            db.query(Coordinator)
            .filter(Coordinator.id == event.coordinator_id)
            .first()
        )

    total_registered = (
        db.query(func.count(Registration.id))
        .filter(
            Registration.event_id == event_id,
            Registration.status == "registered",
        )
        .scalar()
        or 0
    )
    present_count = (
        db.query(func.count(Registration.id))
        .filter(
            Registration.event_id == event_id,
            Registration.status == "registered",
            Registration.attendance_status == "present",
        )
        .scalar()
        or 0
    )
    not_marked = total_registered - present_count
    attendance_percentage = (
        round((present_count / total_registered) * 100, 2) if total_registered else 0
    )

    query = (
        db.query(Registration, User, Attendance)
        .outerjoin(User, User.id == Registration.student_id)
        .outerjoin(Attendance, Attendance.registration_id == Registration.id)
        .filter(
            Registration.event_id == event_id,
            Registration.status == "registered",
        )
    )

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                User.name.ilike(term),
                User.usn.ilike(term),
                User.email.ilike(term),
            )
        )

    if department and department.strip() and department.strip().lower() != "all":
        query = query.filter(User.department == department.strip())

    if year and year.strip() and year.strip().lower() != "all":
        query = query.filter(User.year == year.strip())

    if attendance_status:
        status_value = attendance_status.strip().lower()
        if status_value in {"present"}:
            query = query.filter(Registration.attendance_status == "present")
        elif status_value in {"not_marked", "absent", "not marked"}:
            query = query.filter(Registration.attendance_status != "present")

    total_filtered = query.count()
    total_pages = max(1, math.ceil(total_filtered / limit)) if total_filtered else 1
    if page > total_pages:
        page = total_pages

    rows = (
        query.order_by(Registration.registered_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    students = []
    for reg, student, attendance in rows:
        students.append({
            "registration_id": reg.id,
            "id": reg.id,
            "student_id": reg.student_id,
            "name": student.name if student else "Unknown",
            "usn": student.usn if student else "N/A",
            "email": student.email if student else "",
            "department": student.department if student else "",
            "year": student.year if student else "",
            "phone": student.phone if student else "",
            "registered_at": _iso(reg.registered_at),
            "registration_status": reg.status,
            "attendance_status": reg.attendance_status,
            "attendance_marked_at": _iso(
                attendance.marked_at if attendance else reg.attendance_marked_at
            ),
            "attendance_method": attendance.method if attendance else None,
            "student_name": student.name if student else "Unknown",
            "student_usn": student.usn if student else "N/A",
            "student_email": student.email if student else "",
            "student_department": student.department if student else "",
            "student_year": student.year if student else "",
            "student_phone": student.phone if student else "",
            "status": reg.status,
            "event_id": event.id,
        })

    filter_rows = (
        db.query(User.department, User.year)
        .join(Registration, Registration.student_id == User.id)
        .filter(
            Registration.event_id == event_id,
            Registration.status == "registered",
        )
        .distinct()
        .all()
    )
    departments = sorted({row[0] for row in filter_rows if row[0]})
    years = sorted({row[1] for row in filter_rows if row[1]})

    payload = {
        "event": {
            "id": event.id,
            "title": event.title,
            "date": _iso(event.event_date),
            "event_date": _iso(event.event_date),
            "start_time": _iso(event.start_time),
            "end_time": _iso(event.end_time),
            "venue": event.venue,
            "category": event.category,
            "registration_deadline": _iso(event.registration_deadline),
            "capacity": event.capacity,
            "status": event.status,
            "coordinator_id": event.coordinator_id,
            "coordinator": {
                "id": coordinator.id,
                "name": coordinator.name,
                "department": coordinator.department,
            } if coordinator else None,
        },
        "summary": {
            "total_registered": total_registered,
            "present": present_count,
            "not_marked": not_marked,
            "attendance_percentage": attendance_percentage,
            "total_registrations": total_registered,
            "present_count": present_count,
            "absent_count": not_marked,
        },
        "students": students,
        "registrations": students,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total_filtered,
            "pages": total_pages,
        },
        "filters": {
            "departments": departments,
            "years": years,
        },
        "event_id": event.id,
        "event_title": event.title,
    }
    return payload


# =========================================================
# EVENT ATTENDANCE SUMMARY
# =========================================================

@router.get("/event/{event_id}/summary")
def get_event_attendance_summary(
    event_id: int,
    current: dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    _authorize_event_staff(event, current)

    total = db.query(Registration).filter(
        Registration.event_id == event_id,
        Registration.status == "registered",
    ).count()

    present = (
        db.query(Registration)
        .filter(
            Registration.event_id == event_id,
            Registration.status == "registered",
            Registration.attendance_status == "present",
        )
        .count()
    )
    absent = total - present
    percentage = round((present / total) * 100, 2) if total else 0

    return {
        "event_id": event.id,
        "event_title": event.title,
        "total_registrations": total,
        "present_count": present,
        "absent_count": absent,
        "attendance_percentage": percentage,
    }


# =========================================================
# REGISTER FOR EVENT
# =========================================================

@router.post(
    "/",
    response_model=RegistrationResponse,
    status_code=201,
)
def register_for_event(
    registration_data: RegistrationCreate,
    current: dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current["role"] != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can register for events",
        )

    # Always derive the registering student from the authenticated token.
    student = current["user"]

    # 2. Check event exists and status
    event = (
        db.query(Event)
        .filter(Event.id == registration_data.event_id)
        .first()
    )
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if event.status == "cancelled":
        raise HTTPException(
            status_code=400,
            detail="This event has been cancelled",
        )

    # 3. Check duplicate registration
    existing_registration = (
        db.query(Registration)
        .filter(
            Registration.student_id == student.id,
            Registration.event_id == registration_data.event_id,
        )
        .first()
    )
    if existing_registration:
        raise HTTPException(
            status_code=400,
            detail="You are already registered for this event",
        )

    # 4. Check deadline
    if event.registration_deadline and date.today() > event.registration_deadline:
        raise HTTPException(
            status_code=400,
            detail="Registration deadline has passed",
        )

    # 5. Check capacity
    registered_count = (
        db.query(Registration)
        .filter(
            Registration.event_id == event.id,
            Registration.status == "registered",
        )
        .count()
    )
    if registered_count >= event.capacity:
        raise HTTPException(
            status_code=400,
            detail="This event is full",
        )

    # 6. Generate unique secure token
    qr_token = None
    for _ in range(10):
        candidate = secrets.token_urlsafe(9)
        if not db.query(Registration).filter(Registration.qr_token == candidate).first():
            qr_token = candidate
            break

    if qr_token is None:
        raise HTTPException(
            status_code=500,
            detail="Unable to generate a unique QR token",
        )

    # 7. Create registration
    new_registration = Registration(
        student_id=student.id,
        event_id=registration_data.event_id,
        status="registered",
        qr_token=qr_token,
        attendance_status="absent",
    )
    db.add(new_registration)
    db.flush()

    # 8. Create confirmation notification for student
    notif = Notification(
        user_id=student.id,
        recipient_role="student",
        title=f"Registered: {event.title}",
        message=f"You are confirmed for '{event.title}' on {event.event_date}. Open 'My Registrations' to view your event QR code.",
        type="registration",
        event_id=event.id,
    )
    db.add(notif)

    db.commit()
    db.refresh(new_registration)

    return new_registration


# =========================================================
# QR ATTENDANCE STEP 1: VERIFY QR (DOES NOT MARK ATTENDANCE!)
# =========================================================

@router.post("/attendance/verify")
def verify_attendance_qr(
    payload: AttendanceVerifyRequest,
    current: dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    token = payload.qr_token.strip()
    if not token:
        raise HTTPException(status_code=400, detail="QR token is required")

    registration = (
        db.query(Registration)
        .filter(Registration.qr_token == token)
        .first()
    )
    if not registration:
        raise HTTPException(
            status_code=404,
            detail="Invalid or expired QR code",
        )

    event = db.query(Event).filter(Event.id == registration.event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Wrong event check
    if payload.event_id is not None and registration.event_id != payload.event_id:
        raise HTTPException(
            status_code=400,
            detail=f"QR does not belong to this event (Token is for '{event.title}')",
        )

    _authorize_event_coordinator(event, current)

    student = db.query(User).filter(User.id == registration.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    already_marked = registration.attendance_status == "present"

    return {
        "valid": True,
        "already_marked": already_marked,
        "student": {
            "id": student.id,
            "name": student.name,
            "usn": student.usn,
            "department": student.department,
            "email": student.email,
        },
        "event": {
            "id": event.id,
            "title": event.title,
            "event_date": str(event.event_date),
        },
        "registration": {
            "id": registration.id,
            "registered_at": registration.registered_at,
            "attendance_status": registration.attendance_status,
            "attendance_marked_at": registration.attendance_marked_at,
        },
    }


# =========================================================
# QR ATTENDANCE STEP 2: MARK ATTENDANCE
# =========================================================

@router.post("/attendance/mark")
def mark_attendance(
    payload: AttendanceMarkRequest,
    current: dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    token = payload.qr_token.strip()
    if not token:
        raise HTTPException(status_code=400, detail="QR token is required")

    registration = (
        db.query(Registration)
        .filter(Registration.qr_token == token)
        .first()
    )
    if not registration:
        raise HTTPException(
            status_code=404,
            detail="Invalid or expired QR code",
        )

    event = db.query(Event).filter(Event.id == registration.event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Check wrong event
    if payload.event_id is not None and registration.event_id != payload.event_id:
        raise HTTPException(
            status_code=400,
            detail="QR does not belong to this event",
        )

    coordinator_id = _authorize_event_coordinator(event, current)

    # Duplicate attendance prevention
    if registration.attendance_status == "present":
        raise HTTPException(
            status_code=400,
            detail="Already marked attendance",
        )

    # Mark attendance
    now = datetime.utcnow()
    registration.attendance_status = "present"
    registration.attendance_marked_at = now

    # Record in Attendance table
    existing_att = (
        db.query(Attendance)
        .filter(Attendance.registration_id == registration.id)
        .first()
    )
    if not existing_att:
        att = Attendance(
            registration_id=registration.id,
            student_id=registration.student_id,
            event_id=event.id,
            marked_by=coordinator_id,
            marked_at=now,
            method="qr_scan",
        )
        db.add(att)

    # Create notification for student
    student = db.query(User).filter(User.id == registration.student_id).first()
    if student:
        notif = Notification(
            user_id=student.id,
            recipient_role="student",
            title=f"Attendance Verified: {event.title}",
            message=f"Your attendance for '{event.title}' was verified successfully.",
            type="attendance",
            event_id=event.id,
        )
        db.add(notif)

    db.commit()
    db.refresh(registration)

    return {
        "message": "Attendance marked successfully",
        "attendance": {
            "registration_id": registration.id,
            "student_id": registration.student_id,
            "student_name": student.name if student else None,
            "student_usn": student.usn if student else None,
            "event_id": event.id,
            "event_title": event.title,
            "attendance_status": "present",
            "attendance_marked_at": registration.attendance_marked_at,
        },
    }


# =========================================================
# MANUAL ATTENDANCE (COORDINATOR TABLE ACTION)
# =========================================================

@router.post("/attendance/manual")
def manual_mark_attendance(
    payload: ManualAttendanceRequest,
    current: dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    registration = (
        db.query(Registration)
        .filter(Registration.id == payload.registration_id)
        .first()
    )
    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found")

    if registration.event_id != payload.event_id:
        raise HTTPException(
            status_code=400,
            detail="Registration does not match the specified event",
        )

    event = db.query(Event).filter(Event.id == registration.event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    coordinator_id = _authorize_event_coordinator(event, current)

    # Check duplicate
    if registration.attendance_status == "present":
        raise HTTPException(
            status_code=400,
            detail="Already marked attendance",
        )

    now = datetime.utcnow()
    registration.attendance_status = "present"
    registration.attendance_marked_at = now

    existing_att = (
        db.query(Attendance)
        .filter(Attendance.registration_id == registration.id)
        .first()
    )
    if not existing_att:
        att = Attendance(
            registration_id=registration.id,
            student_id=registration.student_id,
            event_id=event.id,
            marked_by=coordinator_id,
            marked_at=now,
            method="manual",
        )
        db.add(att)

    student = db.query(User).filter(User.id == registration.student_id).first()
    if student:
        notif = Notification(
            user_id=student.id,
            recipient_role="student",
            title=f"Attendance Recorded: {event.title}",
            message=f"Your attendance for '{event.title}' was recorded manually by the coordinator.",
            type="attendance",
            event_id=event.id,
        )
        db.add(notif)

    db.commit()
    db.refresh(registration)

    return {
        "message": "Manual attendance marked successfully",
        "attendance": {
            "registration_id": registration.id,
            "student_id": registration.student_id,
            "student_name": student.name if student else None,
            "attendance_status": "present",
            "attendance_marked_at": registration.attendance_marked_at,
        },
    }


# =========================================================
# LEGACY DIRECT SCAN ATTENDANCE
# =========================================================

@router.post("/attendance/scan")
def scan_attendance(
    payload: AttendanceScanRequest | None = Body(default=None),
    qr_token: str | None = None,
    current: dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload is not None:
        qr_token = payload.qr_token

    if not qr_token:
        raise HTTPException(status_code=400, detail="QR token is required")

    registration = (
        db.query(Registration)
        .filter(Registration.qr_token == qr_token.strip())
        .first()
    )
    if not registration:
        raise HTTPException(status_code=404, detail="Invalid QR code")

    event = db.query(Event).filter(Event.id == registration.event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if payload is not None and payload.event_id is not None and registration.event_id != payload.event_id:
        raise HTTPException(status_code=400, detail="QR does not belong to this event")

    coordinator_id = _authorize_event_coordinator(event, current)

    student = db.query(User).filter(User.id == registration.student_id).first()

    if registration.attendance_status == "present":
        raise HTTPException(status_code=400, detail="Already marked attendance")

    now = datetime.utcnow()
    registration.attendance_status = "present"
    registration.attendance_marked_at = now

    existing_att = (
        db.query(Attendance)
        .filter(Attendance.registration_id == registration.id)
        .first()
    )
    if not existing_att:
        att = Attendance(
            registration_id=registration.id,
            student_id=registration.student_id,
            event_id=event.id,
            marked_by=coordinator_id,
            marked_at=now,
            method="qr_scan",
        )
        db.add(att)

    if student:
        notif = Notification(
            user_id=student.id,
            recipient_role="student",
            title=f"Attendance Verified: {event.title}",
            message=f"Your attendance for '{event.title}' was verified successfully.",
            type="attendance",
            event_id=event.id,
        )
        db.add(notif)

    db.commit()
    db.refresh(registration)

    return {
        "message": "Attendance marked successfully",
        "attendance": {
            "registration_id": registration.id,
            "student_id": registration.student_id,
            "student_name": student.name if student else None,
            "student_usn": student.usn if student else None,
            "event_id": event.id,
            "event_title": event.title,
            "attendance_status": "present",
            "attendance_marked_at": registration.attendance_marked_at,
        },
    }
