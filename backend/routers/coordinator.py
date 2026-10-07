from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.security import (
    create_access_token,
    get_current_user_token,
    hash_password,
    verify_password,
)
from database import get_db
from models.coordinator import Coordinator
from models.event import Event
from schemas.coordinator import (
    CoordinatorCreate,
    CoordinatorLogin,
)

router = APIRouter(
    prefix="/coordinators",
    tags=["Coordinators"],
)


class StatusUpdateRequest(BaseModel):
    status: str


# --------------------------------------------------
# CREATE COORDINATOR
# --------------------------------------------------

@router.post("/", status_code=201)
def create_coordinator(
    coordinator_data: CoordinatorCreate,
    db: Session = Depends(get_db),
):
    normalized_id = coordinator_data.coordinator_id.strip().upper()
    existing_id = (
        db.query(Coordinator)
        .filter(Coordinator.coordinator_id == normalized_id)
        .first()
    )

    if existing_id:
        raise HTTPException(
            status_code=400,
            detail="Coordinator ID already exists",
        )

    normalized_email = str(coordinator_data.email).strip().lower()

    existing_email = (
        db.query(Coordinator)
        .filter(Coordinator.email == normalized_email)
        .first()
    )

    if existing_email:
        raise HTTPException(
            status_code=400,
            detail="Coordinator email already exists",
        )

    hashed_password = hash_password(coordinator_data.password)

    new_coordinator = Coordinator(
        name=coordinator_data.name.strip(),
        coordinator_id=normalized_id,
        email=normalized_email,
        password_hash=hashed_password,
        department=coordinator_data.department.strip(),
        phone=coordinator_data.phone.strip() if coordinator_data.phone else None,
        status="active",
    )

    db.add(new_coordinator)
    db.commit()
    db.refresh(new_coordinator)

    return {
        "message": "Coordinator created successfully",
        "coordinator": {
            "id": new_coordinator.id,
            "name": new_coordinator.name,
            "coordinator_id": new_coordinator.coordinator_id,
            "email": new_coordinator.email,
            "department": new_coordinator.department,
            "phone": new_coordinator.phone,
            "status": new_coordinator.status,
        },
    }


# --------------------------------------------------
# GET ALL COORDINATORS
# --------------------------------------------------

@router.get("/")
def get_coordinators(
    db: Session = Depends(get_db),
):
    coordinators = (
        db.query(Coordinator)
        .order_by(Coordinator.name.asc())
        .all()
    )

    results = []
    for c in coordinators:
        assigned_events_count = (
            db.query(Event)
            .filter(Event.coordinator_id == c.id)
            .count()
        )
        results.append({
            "id": c.id,
            "name": c.name,
            "coordinator_id": c.coordinator_id,
            "email": c.email,
            "department": c.department,
            "phone": c.phone,
            "status": c.status or "active",
            "last_login": c.last_login,
            "assigned_events_count": assigned_events_count,
        })

    return {"coordinators": results}


# --------------------------------------------------
# GET SINGLE COORDINATOR
# --------------------------------------------------

@router.get("/{coordinator_id}")
def get_coordinator(
    coordinator_id: int,
    db: Session = Depends(get_db),
):
    coordinator = (
        db.query(Coordinator)
        .filter(Coordinator.id == coordinator_id)
        .first()
    )

    if not coordinator:
        raise HTTPException(status_code=404, detail="Coordinator not found")

    assigned_events = (
        db.query(Event)
        .filter(Event.coordinator_id == coordinator.id)
        .all()
    )

    return {
        "coordinator": {
            "id": coordinator.id,
            "name": coordinator.name,
            "coordinator_id": coordinator.coordinator_id,
            "email": coordinator.email,
            "department": coordinator.department,
            "phone": coordinator.phone,
            "status": coordinator.status or "active",
            "last_login": coordinator.last_login,
        },
        "assigned_events": [
            {
                "id": ev.id,
                "title": ev.title,
                "event_date": ev.event_date,
                "status": ev.status,
            }
            for ev in assigned_events
        ],
    }


# --------------------------------------------------
# UPDATE COORDINATOR STATUS
# --------------------------------------------------

@router.put("/{coordinator_id}/status")
def update_coordinator_status(
    coordinator_id: int,
    payload: StatusUpdateRequest,
    db: Session = Depends(get_db),
):
    coordinator = (
        db.query(Coordinator)
        .filter(Coordinator.id == coordinator_id)
        .first()
    )

    if not coordinator:
        raise HTTPException(status_code=404, detail="Coordinator not found")

    coordinator.status = payload.status
    db.commit()
    db.refresh(coordinator)

    return {
        "message": f"Coordinator status updated to {payload.status}",
        "coordinator": {
            "id": coordinator.id,
            "status": coordinator.status,
        },
    }


# --------------------------------------------------
# DELETE COORDINATOR
# --------------------------------------------------

@router.delete("/{coordinator_id}")
def delete_coordinator(
    coordinator_id: int,
    db: Session = Depends(get_db),
):
    coordinator = (
        db.query(Coordinator)
        .filter(Coordinator.id == coordinator_id)
        .first()
    )

    if not coordinator:
        raise HTTPException(status_code=404, detail="Coordinator not found")

    # Set coordinator_id to null on assigned events before deletion
    db.query(Event).filter(Event.coordinator_id == coordinator_id).update(
        {"coordinator_id": None}
    )

    db.delete(coordinator)
    db.commit()

    return {"message": "Coordinator removed successfully"}


# --------------------------------------------------
# COORDINATOR LOGIN
# --------------------------------------------------

@router.post("/login")
def coordinator_login(
    coordinator_data: CoordinatorLogin,
    db: Session = Depends(get_db),
):
    normalized_email = str(coordinator_data.email).strip().lower()

    coordinator = (
        db.query(Coordinator)
        .filter(Coordinator.email == normalized_email)
        .first()
    )

    if not coordinator:
        raise HTTPException(
            status_code=401,
            detail="Invalid coordinator email or password",
        )

    password_correct = verify_password(
        coordinator_data.password,
        coordinator.password_hash,
    )

    if not password_correct:
        raise HTTPException(
            status_code=401,
            detail="Invalid coordinator email or password",
        )

    coordinator.last_login = datetime.utcnow()
    db.commit()

    token = create_access_token({
        "id": coordinator.id,
        "sub": str(coordinator.id),
        "role": "coordinator",
        "email": coordinator.email,
        "name": coordinator.name,
    })

    return {
        "message": "Coordinator login successful",
        "token": token,
        "access_token": token,
        "token_type": "bearer",
        "role": "coordinator",
        "coordinator": {
            "id": coordinator.id,
            "name": coordinator.name,
            "coordinator_id": coordinator.coordinator_id,
            "email": coordinator.email,
            "department": coordinator.department,
            "phone": coordinator.phone,
            "status": coordinator.status or "active",
        },
    }