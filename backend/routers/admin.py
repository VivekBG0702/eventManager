from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from models.admin import Admin
from models.attendance import Attendance
from models.certificate import Certificate
from models.coordinator import Coordinator
from models.event import Event
from models.notification import Notification
from models.registration import Registration
from models.user import User

router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
)


# =========================================================
# DASHBOARD SYSTEM STATISTICS
# =========================================================

@router.get("/stats")
def get_admin_dashboard_stats(
    db: Session = Depends(get_db),
):
    total_students = db.query(User).count()
    total_coordinators = db.query(Coordinator).count()
    total_events = db.query(Event).count()
    upcoming_events = (
        db.query(Event)
        .filter(Event.status == "upcoming", Event.event_date >= date.today())
        .count()
    )
    total_registrations = db.query(Registration).count()
    total_present = (
        db.query(Registration)
        .filter(Registration.attendance_status == "present")
        .count()
    )
    total_certificates = db.query(Certificate).count()

    attendance_pct = (
        round((total_present / total_registrations) * 100, 1)
        if total_registrations > 0
        else 0
    )

    recent_events = (
        db.query(Event)
        .order_by(Event.created_at.desc())
        .limit(5)
        .all()
    )

    return {
        "total_students": total_students,
        "total_coordinators": total_coordinators,
        "total_events": total_events,
        "upcoming_events": upcoming_events,
        "total_registrations": total_registrations,
        "total_present": total_present,
        "total_absent": total_registrations - total_present,
        "attendance_percentage": attendance_pct,
        "total_certificates": total_certificates,
        "recent_events": [
            {
                "id": ev.id,
                "title": ev.title,
                "event_date": ev.event_date,
                "venue": ev.venue,
                "status": ev.status,
                "capacity": ev.capacity,
            }
            for ev in recent_events
        ],
    }


# =========================================================
# VIEW ALL STUDENTS
# =========================================================

@router.get("/students")
def get_all_students(
    search: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(User)

    if department:
        query = query.filter(User.department == department)

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            (User.name.ilike(s)) | (User.usn.ilike(s)) | (User.email.ilike(s))
        )

    students = query.order_by(User.name.asc()).all()

    data = []
    for st in students:
        reg_count = db.query(Registration).filter(Registration.student_id == st.id).count()
        att_count = (
            db.query(Registration)
            .filter(Registration.student_id == st.id, Registration.attendance_status == "present")
            .count()
        )
        cert_count = db.query(Certificate).filter(Certificate.student_id == st.id).count()

        data.append({
            "id": st.id,
            "name": st.name,
            "usn": st.usn,
            "email": st.email,
            "department": st.department,
            "year": st.year,
            "phone": st.phone,
            "created_at": st.created_at,
            "total_registrations": reg_count,
            "total_present": att_count,
            "total_certificates": cert_count,
        })

    return {"students": data}


# =========================================================
# VIEW ALL REGISTRATIONS
# =========================================================

@router.get("/registrations")
def get_all_registrations(
    event_id: Optional[int] = Query(None),
    student_id: Optional[int] = Query(None),
    attendance_status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Registration)

    if event_id is not None:
        query = query.filter(Registration.event_id == event_id)
    if student_id is not None:
        query = query.filter(Registration.student_id == student_id)
    if attendance_status:
        query = query.filter(Registration.attendance_status == attendance_status)

    registrations = query.order_by(Registration.registered_at.desc()).all()

    data = []
    for reg in registrations:
        student = db.query(User).filter(User.id == reg.student_id).first()
        event = db.query(Event).filter(Event.id == reg.event_id).first()

        data.append({
            "id": reg.id,
            "student_id": reg.student_id,
            "student_name": student.name if student else "Unknown",
            "student_usn": student.usn if student else "N/A",
            "student_department": student.department if student else "",
            "event_id": reg.event_id,
            "event_title": event.title if event else "Unknown",
            "event_date": str(event.event_date) if event else "",
            "registered_at": reg.registered_at,
            "attendance_status": reg.attendance_status,
            "attendance_marked_at": reg.attendance_marked_at,
            "qr_token": reg.qr_token,
        })

    return {"registrations": data}


# =========================================================
# VIEW ALL ATTENDANCE RECORDS
# =========================================================

@router.get("/attendance")
def get_all_attendance(
    event_id: Optional[int] = Query(None),
    student_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Attendance)

    if event_id is not None:
        query = query.filter(Attendance.event_id == event_id)
    if student_id is not None:
        query = query.filter(Attendance.student_id == student_id)

    records = query.order_by(Attendance.marked_at.desc()).all()

    data = []
    for att in records:
        student = db.query(User).filter(User.id == att.student_id).first()
        event = db.query(Event).filter(Event.id == att.event_id).first()
        coordinator = (
            db.query(Coordinator).filter(Coordinator.id == att.marked_by).first()
            if att.marked_by
            else None
        )

        data.append({
            "id": att.id,
            "registration_id": att.registration_id,
            "student_id": att.student_id,
            "student_name": student.name if student else "Unknown",
            "student_usn": student.usn if student else "N/A",
            "event_id": att.event_id,
            "event_title": event.title if event else "Unknown",
            "marked_at": att.marked_at,
            "marked_by": coordinator.name if coordinator else "System",
            "method": att.method,
        })

    return {"attendance": data}
