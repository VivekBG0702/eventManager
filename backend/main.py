import secrets
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from database import Base, engine
from models.admin import Admin
from models.attendance import Attendance
from models.certificate import Certificate
from models.coordinator import Coordinator
from models.event import Event
from models.notification import Notification
from models.registration import Registration
from models.user import User
from routers.admin import router as admin_router
from routers.auth import router as auth_router
from routers.certificate import router as certificate_router
from routers.coordinator import router as coordinator_router
from routers.event import router as event_router
from routers.notification import router as notification_router
from routers.registration import router as registration_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure uploads directory exists
    Path("uploads/events").mkdir(parents=True, exist_ok=True)

    # create_all creates any missing tables (e.g. attendances, certificates, notifications)
    Base.metadata.create_all(bind=engine)

    # Coordinator table migrations
    with engine.begin() as connection:
        columns = [
            row[0]
            for row in connection.execute(text("SHOW COLUMNS FROM coordinators"))
        ]

        if "status" not in columns:
            connection.execute(
                text(
                    "ALTER TABLE coordinators ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active'"
                )
            )

        if "last_login" not in columns:
            connection.execute(
                text(
                    "ALTER TABLE coordinators ADD COLUMN last_login DATETIME NULL AFTER created_at"
                )
            )

    # Event table migration for coordinator assignments
    with engine.begin() as connection:
        event_columns = [
            row[0]
            for row in connection.execute(text("SHOW COLUMNS FROM events"))
        ]

        if "coordinator_id" not in event_columns:
            connection.execute(
                text("ALTER TABLE events ADD COLUMN coordinator_id INT NULL")
            )

    # Registration QR and attendance migration
    with engine.begin() as connection:
        registration_columns = [
            row[0]
            for row in connection.execute(text("SHOW COLUMNS FROM registrations"))
        ]

        if "qr_token" not in registration_columns:
            connection.execute(
                text(
                    "ALTER TABLE registrations ADD COLUMN qr_token VARCHAR(100) NULL"
                )
            )

        registrations_with_long_or_missing_qr = connection.execute(
            text(
                "SELECT id FROM registrations "
                "WHERE qr_token IS NULL OR qr_token = '' "
                "OR CHAR_LENGTH(qr_token) > 12"
            )
        ).all()
        for registration in registrations_with_long_or_missing_qr:
            for _ in range(10):
                qr_token = secrets.token_urlsafe(9)
                existing_token = connection.execute(
                    text(
                        "SELECT 1 FROM registrations "
                        "WHERE qr_token = :qr_token AND id != :id LIMIT 1"
                    ),
                    {"qr_token": qr_token, "id": registration.id},
                ).first()
                if existing_token is None:
                    break
            else:
                raise RuntimeError(
                    "Unable to generate a unique short QR token for "
                    f"registration {registration.id}"
                )

            connection.execute(
                text(
                    "UPDATE registrations SET qr_token = :qr_token WHERE id = :id"
                ),
                {"id": registration.id, "qr_token": qr_token},
            )

        if "attendance_status" not in registration_columns:
            connection.execute(
                text(
                    "ALTER TABLE registrations "
                    "ADD COLUMN attendance_status VARCHAR(20) NOT NULL DEFAULT 'absent'"
                )
            )

        if "attendance_marked_at" not in registration_columns:
            connection.execute(
                text(
                    "ALTER TABLE registrations ADD COLUMN attendance_marked_at DATETIME NULL"
                )
            )

    yield


app = FastAPI(
    title="College Event Manager API",
    description="Backend API for College Event Manager",
    version="1.0.0",
    lifespan=lifespan,
)

STATIC_DIR = Path(__file__).resolve().parent / "static"
UPLOADS_DIR = Path(__file__).resolve().parent / "uploads"

# Allow React frontend to communicate with FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Include all routers
app.include_router(auth_router)
app.include_router(event_router)
app.include_router(coordinator_router)
app.include_router(registration_router)
app.include_router(certificate_router)
app.include_router(notification_router)
app.include_router(admin_router)

app.mount(
    "/uploads",
    StaticFiles(directory=UPLOADS_DIR),
    name="uploads",
)


@app.get("/")
def frontend_root():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.get("/{frontend_path:path}", include_in_schema=False)
def frontend_routes(frontend_path: str):
    requested_file = (STATIC_DIR / frontend_path).resolve()
    if requested_file.is_relative_to(STATIC_DIR) and requested_file.is_file():
        return FileResponse(requested_file)
    return FileResponse(STATIC_DIR / "index.html")
