import os

import bcrypt

from database import SessionLocal
from models.admin import Admin


required_values = {
    "ADMIN_NAME": os.getenv("ADMIN_NAME"),
    "ADMIN_ID": os.getenv("ADMIN_ID"),
    "ADMIN_EMAIL": os.getenv("ADMIN_EMAIL"),
    "ADMIN_PASSWORD": os.getenv("ADMIN_PASSWORD"),
}
missing_values = [name for name, value in required_values.items() if not value]
if missing_values:
    raise ValueError(
        "Required environment variables are missing: "
        + ", ".join(missing_values)
    )

password_hash = bcrypt.hashpw(
    required_values["ADMIN_PASSWORD"].encode("utf-8"),
    bcrypt.gensalt()
).decode("utf-8")


db = SessionLocal()

try:
    admin_email = required_values["ADMIN_EMAIL"].strip().lower()
    admin_id = required_values["ADMIN_ID"].strip().upper()
    existing_admin = (
        db.query(Admin)
        .filter((Admin.email == admin_email) | (Admin.admin_id == admin_id))
        .first()
    )
    if existing_admin:
        raise ValueError("An admin with this email or admin ID already exists")

    admin = Admin(
        name=required_values["ADMIN_NAME"].strip(),
        admin_id=admin_id,
        email=admin_email,
        password_hash=password_hash,
    )

    db.add(admin)
    db.commit()
    db.refresh(admin)

    print("Admin created successfully!")
    print("ID:", admin.id)
    print("Admin ID:", admin.admin_id)
    print("Email:", admin.email)

finally:
    db.close()