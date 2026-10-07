from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from core.security import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from database import get_db
from models.admin import Admin
from models.coordinator import Coordinator
from models.notification import Notification
from models.user import User
from schemas.user import (
    AdminLogin,
    UserLogin,
    UserRegister,
    UserResponse,
)

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


@router.post("/register", response_model=UserResponse, status_code=201)
def register_user(
    user_data: UserRegister,
    db: Session = Depends(get_db),
):
    normalized_email = str(user_data.email).strip().lower()
    normalized_usn = str(user_data.usn).strip().upper()

    # Check email
    existing_email = (
        db.query(User)
        .filter(User.email == normalized_email)
        .first()
    )

    if existing_email:
        raise HTTPException(
            status_code=400,
            detail="Email already registered",
        )

    # Check USN
    existing_usn = (
        db.query(User)
        .filter(User.usn == normalized_usn)
        .first()
    )

    if existing_usn:
        raise HTTPException(
            status_code=400,
            detail="USN already registered",
        )

    # Hash password
    hashed_password = hash_password(user_data.password)

    # Create user
    new_user = User(
        name=user_data.name.strip(),
        usn=normalized_usn,
        email=normalized_email,
        department=user_data.department.strip(),
        year=user_data.year.strip(),
        phone=user_data.phone.strip(),
        password_hash=hashed_password,
    )

    db.add(new_user)
    db.flush()

    # Create welcome notification
    welcome_notif = Notification(
        user_id=new_user.id,
        recipient_role="student",
        title="Welcome to EventManager!",
        message=f"Hi {new_user.name}, your student account is ready. Browse upcoming college events and register today.",
        type="announcement",
    )
    db.add(welcome_notif)

    db.commit()
    db.refresh(new_user)

    return new_user


@router.post("/login")
def login_user(
    user_data: UserLogin,
    db: Session = Depends(get_db),
):
    normalized_email = str(user_data.email).strip().lower()
    user = (
        db.query(User)
        .filter(User.email == normalized_email)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    password_correct = verify_password(
        user_data.password,
        user.password_hash,
    )

    if not password_correct:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    token = create_access_token({
        "id": user.id,
        "sub": str(user.id),
        "role": "student",
        "email": user.email,
        "name": user.name,
    })

    return {
        "message": "Login successful",
        "token": token,
        "access_token": token,
        "token_type": "bearer",
        "role": "student",
        "user": {
            "id": user.id,
            "name": user.name,
            "usn": user.usn,
            "email": user.email,
            "department": user.department,
            "year": user.year,
            "phone": user.phone,
        },
    }


@router.post("/admin/login")
def admin_login(
    admin_data: AdminLogin,
    db: Session = Depends(get_db),
):
    normalized_email = str(admin_data.email).strip().lower()

    admin = (
        db.query(Admin)
        .filter(Admin.email == normalized_email)
        .first()
    )

    if not admin:
        raise HTTPException(
            status_code=401,
            detail="Invalid admin email or password",
        )

    password_correct = verify_password(
        admin_data.password,
        admin.password_hash,
    )

    if not password_correct:
        raise HTTPException(
            status_code=401,
            detail="Invalid admin email or password",
        )

    admin.last_login = datetime.utcnow()
    db.commit()

    token = create_access_token({
        "id": admin.id,
        "sub": str(admin.id),
        "role": "admin",
        "email": admin.email,
        "name": admin.name,
    })

    return {
        "message": "Admin login successful",
        "token": token,
        "access_token": token,
        "token_type": "bearer",
        "role": "admin",
        "admin": {
            "id": admin.id,
            "name": admin.name,
            "admin_id": admin.admin_id,
            "email": admin.email,
        },
    }


@router.get("/me")
def get_current_user_profile(
    current: dict = Depends(get_current_user),
):
    user_obj = current["user"]
    role = current["role"]

    profile = {
        "id": user_obj.id,
        "name": user_obj.name,
        "email": user_obj.email,
        "role": role,
    }

    if role == "student":
        profile.update({
            "usn": user_obj.usn,
            "department": user_obj.department,
            "year": user_obj.year,
            "phone": user_obj.phone,
        })
    elif role == "coordinator":
        profile.update({
            "coordinator_id": user_obj.coordinator_id,
            "department": user_obj.department,
            "phone": user_obj.phone,
            "status": user_obj.status,
        })
    elif role == "admin":
        profile.update({
            "admin_id": user_obj.admin_id,
        })

    return {
        "status": "authenticated",
        "role": role,
        "user": profile,
    }
