import os
import secrets
import unittest
from datetime import date, datetime, time, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import text

from database import Base, SessionLocal, engine
from main import app
from models.admin import Admin
from models.coordinator import Coordinator
from models.event import Event
from models.registration import Registration
from models.user import User


class EventManagerWorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)
        cls.db = SessionLocal()

        # Seed test admin if not exists
        cls.test_email_suffix = secrets.token_hex(4)
        cls.admin = cls.db.query(Admin).first()
        if not cls.admin:
            from core.security import hash_password
            cls.admin = Admin(
                name="Test Admin",
                admin_id=f"ADM_{cls.test_email_suffix}",
                email=f"admin_{cls.test_email_suffix}@college.com",
                password_hash=hash_password("Admin@123"),
            )
            cls.db.add(cls.admin)
            cls.db.commit()
            cls.db.refresh(cls.admin)

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def test_01_authentication_and_jwt(self):
        # Register a new student
        suffix = secrets.token_hex(4)
        student_data = {
            "name": f"Test Student {suffix}",
            "usn": f"1TD24CS{suffix.upper()}",
            "email": f"student_{suffix}@college.com",
            "department": "CSE",
            "year": "3",
            "phone": "9876543210",
            "password": "Password@123",
        }
        res = self.client.post("/auth/register", json=student_data)
        self.assertEqual(res.status_code, 201)
        student_id = res.json()["id"]

        # Duplicate email registration should fail with 400
        res_dup = self.client.post("/auth/register", json=student_data)
        self.assertEqual(res_dup.status_code, 400)
        self.assertIn("Email already registered", res_dup.json()["detail"])

        # Student login
        login_res = self.client.post(
            "/auth/login",
            json={
                "email": student_data["email"],
                "password": "Password@123",
            },
        )
        self.assertEqual(login_res.status_code, 200)
        login_data = login_res.json()
        self.assertIn("token", login_data)
        self.assertEqual(login_data["role"], "student")
        token = login_data["token"]

        # /auth/me with Bearer token
        me_res = self.client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(me_res.status_code, 200)
        self.assertEqual(me_res.json()["user"]["id"], student_id)
        self.assertEqual(me_res.json()["role"], "student")

        # Admin login
        admin_login_res = self.client.post(
            "/auth/admin/login",
            json={
                "email": self.admin.email,
                "password": "Admin@123",
            },
        )
        self.assertEqual(admin_login_res.status_code, 200)
        self.assertIn("token", admin_login_res.json())
        self.assertEqual(admin_login_res.json()["role"], "admin")

    def test_02_coordinator_and_event_creation(self):
        suffix = secrets.token_hex(4)
        # Create coordinator
        coord_res = self.client.post(
            "/coordinators/",
            json={
                "name": f"Coord {suffix}",
                "coordinator_id": f"CRD_{suffix.upper()}",
                "email": f"coord_{suffix}@college.com",
                "department": "ECE",
                "phone": "9123456789",
                "password": "Password@123",
            },
        )
        self.assertEqual(coord_res.status_code, 201)
        coord_id = coord_res.json()["coordinator"]["id"]

        # Coordinator login
        coord_login = self.client.post(
            "/coordinators/login",
            json={
                "email": f"coord_{suffix}@college.com",
                "password": "Password@123",
            },
        )
        self.assertEqual(coord_login.status_code, 200)
        coord_token = coord_login.json()["token"]

        # Create event assigned to this coordinator
        tomorrow = (date.today() + timedelta(days=2)).isoformat()
        deadline = (date.today() + timedelta(days=1)).isoformat()
        event_res = self.client.post(
            "/events/",
            data={
                "title": f"Robotics Workshop {suffix}",
                "description": "Hands-on robotics workshop for college students.",
                "category": "Workshop",
                "event_date": tomorrow,
                "start_time": "10:00:00",
                "end_time": "16:00:00",
                "venue": "Auditorium Hall 2",
                "organizer": "Robotics Club",
                "coordinator_id": coord_id,
                "capacity": 50,
                "registration_deadline": deadline,
            },
        )
        self.assertEqual(event_res.status_code, 201)
        event_id = event_res.json()["event"]["id"]

        # Fetch coordinator's events (JWT must match assigned coordinator)
        my_events_res = self.client.get(
            f"/events/coordinator/{coord_id}",
            headers={"Authorization": f"Bearer {coord_token}"},
        )
        self.assertEqual(my_events_res.status_code, 200)
        self.assertTrue(any(e["id"] == event_id for e in my_events_res.json()["events"]))

    def test_03_student_registration_and_qr_attendance_flow(self):
        suffix = secrets.token_hex(4)
        # 1. Create student
        st_res = self.client.post(
            "/auth/register",
            json={
                "name": f"Workflow Student {suffix}",
                "usn": f"1TD24EE{suffix.upper()}",
                "email": f"wf_student_{suffix}@college.com",
                "department": "EEE",
                "year": "2",
                "phone": "9811223344",
                "password": "Password@123",
            },
        )
        student_id = st_res.json()["id"]
        student_login = self.client.post(
            "/auth/login",
            json={
                "email": f"wf_student_{suffix}@college.com",
                "password": "Password@123",
            },
        )
        self.assertEqual(student_login.status_code, 200)
        student_headers = {"Authorization": f"Bearer {student_login.json()['token']}"}

        # 2. Create coordinator
        c_res = self.client.post(
            "/coordinators/",
            json={
                "name": f"Workflow Coord {suffix}",
                "coordinator_id": f"WCRD_{suffix.upper()}",
                "email": f"wf_coord_{suffix}@college.com",
                "department": "EEE",
                "phone": "9811223355",
                "password": "Password@123",
            },
        )
        coord_id = c_res.json()["coordinator"]["id"]

        coord_login = self.client.post(
            "/coordinators/login",
            json={
                "email": f"wf_coord_{suffix}@college.com",
                "password": "Password@123",
            },
        )
        self.assertEqual(coord_login.status_code, 200)
        coord_token = coord_login.json()["token"]
        coord_headers = {"Authorization": f"Bearer {coord_token}"}

        # 3. Create another coordinator for authorization test
        other_c_res = self.client.post(
            "/coordinators/",
            json={
                "name": f"Other Coord {suffix}",
                "coordinator_id": f"OTHR_{suffix.upper()}",
                "email": f"other_coord_{suffix}@college.com",
                "department": "ME",
                "phone": "9811223366",
                "password": "Password@123",
            },
        )
        other_coord_id = other_c_res.json()["coordinator"]["id"]
        other_coord_login = self.client.post(
            "/coordinators/login",
            json={
                "email": f"other_coord_{suffix}@college.com",
                "password": "Password@123",
            },
        )
        self.assertEqual(other_coord_login.status_code, 200)
        other_coord_headers = {"Authorization": f"Bearer {other_coord_login.json()['token']}"}

        # 4. Create Event A (assigned to coord_id)
        future_date = (date.today() + timedelta(days=5)).isoformat()
        deadline = (date.today() + timedelta(days=3)).isoformat()
        ev_res = self.client.post(
            "/events/",
            data={
                "title": f"IoT Expo {suffix}",
                "description": "IoT Expo and project demonstration.",
                "category": "Technology",
                "event_date": future_date,
                "start_time": "09:00:00",
                "end_time": "15:00:00",
                "venue": "Seminar Hall A",
                "organizer": "IEEE Student Branch",
                "coordinator_id": coord_id,
                "capacity": 30,
                "registration_deadline": deadline,
            },
        )
        event_a_id = ev_res.json()["event"]["id"]

        # Create Event B (assigned to coord_id) for wrong event test
        ev_b_res = self.client.post(
            "/events/",
            data={
                "title": f"Hackathon B {suffix}",
                "description": "Second Event",
                "category": "Hackathon",
                "event_date": future_date,
                "start_time": "09:00:00",
                "end_time": "15:00:00",
                "venue": "Seminar Hall B",
                "organizer": "Coding Club",
                "coordinator_id": coord_id,
                "capacity": 30,
                "registration_deadline": deadline,
            },
        )
        event_b_id = ev_b_res.json()["event"]["id"]

        # 5. Student registers for Event A
        reg_res = self.client.post(
            "/registrations/",
            json={
                "event_id": event_a_id,
            },
            headers=student_headers,
        )
        self.assertEqual(reg_res.status_code, 201)
        reg_data = reg_res.json()
        qr_token = reg_data["qr_token"]
        self.assertEqual(reg_data["attendance_status"], "absent")
        self.assertIsNotNone(qr_token)
        self.assertEqual(len(qr_token), 12)

        # Duplicate registration test: must fail
        dup_reg = self.client.post(
            "/registrations/",
            json={
                "event_id": event_a_id,
            },
            headers=student_headers,
        )
        self.assertEqual(dup_reg.status_code, 400)
        self.assertIn("already registered", dup_reg.json()["detail"].lower())

        # 6. Student views My Registrations: SHOWING QR MUST NOT MARK ATTENDANCE
        my_regs = self.client.get("/registrations/me", headers=student_headers)
        self.assertEqual(my_regs.status_code, 200)
        user_reg = next(r for r in my_regs.json()["registrations"] if r["event_id"] == event_a_id)
        self.assertEqual(user_reg["attendance_status"], "absent")
        self.assertIsNone(user_reg["attendance_marked_at"])

        # 7. QR Attendance: Wrong Event test
        # Try verifying QR for Event A against Event B
        wrong_event_verify = self.client.post(
            "/registrations/attendance/verify",
            json={
                "qr_token": qr_token,
                "event_id": event_b_id,
            },
            headers=coord_headers,
        )
        self.assertEqual(wrong_event_verify.status_code, 400)
        self.assertIn("does not belong to this event", wrong_event_verify.json()["detail"].lower())

        # 8. QR Attendance: Unauthorized Coordinator test
        # Try verifying with other_coord_id who does not own Event A
        unauth_verify = self.client.post(
            "/registrations/attendance/verify",
            json={
                "qr_token": qr_token,
                "event_id": event_a_id,
            },
            headers=other_coord_headers,
        )
        self.assertEqual(unauth_verify.status_code, 403)
        self.assertIn("not assigned to this event", unauth_verify.json()["detail"].lower())

        # 9. QR Attendance: Invalid QR test
        invalid_qr_verify = self.client.post(
            "/registrations/attendance/verify",
            json={
                "qr_token": "non_existent_fake_qr_token",
                "event_id": event_a_id,
            },
            headers=coord_headers,
        )
        self.assertEqual(invalid_qr_verify.status_code, 404)
        self.assertIn("invalid or expired qr", invalid_qr_verify.json()["detail"].lower())

        # 10. QR Attendance Step 1: Coordinator scans and verifies (DOES NOT MARK ATTENDANCE)
        valid_verify = self.client.post(
            "/registrations/attendance/verify",
            json={
                "qr_token": qr_token,
                "event_id": event_a_id,
            },
            headers=coord_headers,
        )
        self.assertEqual(valid_verify.status_code, 200)
        verify_data = valid_verify.json()
        self.assertTrue(verify_data["valid"])
        self.assertFalse(verify_data["already_marked"])
        self.assertEqual(verify_data["student"]["id"], student_id)

        # Check DB: attendance MUST STILL BE absent!
        check_reg = self.client.get("/registrations/me", headers=student_headers).json()
        saved_reg = next(r for r in check_reg["registrations"] if r["event_id"] == event_a_id)
        self.assertEqual(saved_reg["attendance_status"], "absent")

        # 11. QR Attendance Step 2: Coordinator marks attendance
        mark_res = self.client.post(
            "/registrations/attendance/mark",
            json={
                "qr_token": qr_token,
                "event_id": event_a_id,
            },
            headers=coord_headers,
        )
        self.assertEqual(mark_res.status_code, 200)
        self.assertEqual(mark_res.json()["attendance"]["attendance_status"], "present")
        self.assertIsNotNone(mark_res.json()["attendance"]["attendance_marked_at"])

        # Check DB: attendance is now present!
        after_mark = self.client.get("/registrations/me", headers=student_headers).json()
        saved_reg_after = next(r for r in after_mark["registrations"] if r["event_id"] == event_a_id)
        self.assertEqual(saved_reg_after["attendance_status"], "present")

        # 12. Duplicate attendance test: Try marking again
        dup_mark = self.client.post(
            "/registrations/attendance/mark",
            json={
                "qr_token": qr_token,
                "event_id": event_a_id,
            },
            headers=coord_headers,
        )
        self.assertEqual(dup_mark.status_code, 400)
        self.assertIn("already marked attendance", dup_mark.json()["detail"].lower())

        # 13. Verify coordinator attendance summary updates
        summary_res = self.client.get(
            f"/registrations/event/{event_a_id}/summary",
            headers=coord_headers,
        )
        self.assertEqual(summary_res.status_code, 200)
        sum_data = summary_res.json()
        self.assertEqual(sum_data["total_registrations"], 1)
        self.assertEqual(sum_data["present_count"], 1)
        self.assertEqual(sum_data["absent_count"], 0)
        self.assertEqual(sum_data["attendance_percentage"], 100.0)

        # 14. Certificate issuance for present student
        cert_issue_res = self.client.post(
            "/certificates/issue",
            json={"event_id": event_a_id},
        )
        self.assertEqual(cert_issue_res.status_code, 200)
        self.assertEqual(cert_issue_res.json()["issued_count"], 1)

        # 15. Student views certificate
        student_certs = self.client.get(f"/certificates/student/{student_id}")
        self.assertEqual(student_certs.status_code, 200)
        self.assertEqual(len(student_certs.json()["certificates"]), 1)
        cert_id = student_certs.json()["certificates"][0]["certificate_id"]

        # View single certificate
        cert_detail = self.client.get(f"/certificates/{cert_id}")
        self.assertEqual(cert_detail.status_code, 200)
        self.assertEqual(cert_detail.json()["student"]["usn"], f"1TD24EE{suffix.upper()}")

        # 16. Student notifications check
        notifs_res = self.client.get(f"/notifications/student/{student_id}")
        self.assertEqual(notifs_res.status_code, 200)
        notifs = notifs_res.json()["notifications"]
        # Student should have received registration confirmation, attendance verification, and certificate notifications
        types = [n["type"] for n in notifs]
        self.assertIn("registration", types)
        self.assertIn("attendance", types)
        self.assertIn("certificate", types)

    def test_04_admin_dashboard_stats(self):
        stats_res = self.client.get("/admin/stats")
        self.assertEqual(stats_res.status_code, 200)
        stats = stats_res.json()
        self.assertIn("total_students", stats)
        self.assertIn("total_coordinators", stats)
        self.assertIn("total_events", stats)
        self.assertIn("total_registrations", stats)
        self.assertIn("total_present", stats)
        self.assertIn("attendance_percentage", stats)
        self.assertGreaterEqual(stats["total_students"], 1)

    def test_05_event_specific_registered_students_authorization(self):
        suffix = secrets.token_hex(4)
        from core.security import hash_password

        student_a = self.client.post(
            "/auth/register",
            json={
                "name": f"Rahul {suffix}",
                "usn": f"1XX21CS{suffix[:4].upper()}",
                "email": f"rahul_{suffix}@college.com",
                "department": "CSE",
                "year": "3",
                "phone": "9000000001",
                "password": "Password@123",
            },
        )
        self.assertEqual(student_a.status_code, 201)
        student_a_id = student_a.json()["id"]
        student_token = self.client.post(
            "/auth/login",
            json={"email": f"rahul_{suffix}@college.com", "password": "Password@123"},
        ).json()["token"]

        student_b = self.client.post(
            "/auth/register",
            json={
                "name": f"Anjali {suffix}",
                "usn": f"1XX21EC{suffix[:4].upper()}",
                "email": f"anjali_{suffix}@college.com",
                "department": "ECE",
                "year": "2",
                "phone": "9000000002",
                "password": "Password@123",
            },
        )
        student_b_id = student_b.json()["id"]
        student_b_token = self.client.post(
            "/auth/login",
            json={"email": f"anjali_{suffix}@college.com", "password": "Password@123"},
        ).json()["token"]

        coord_a = self.client.post(
            "/coordinators/",
            json={
                "name": f"Coordinator A {suffix}",
                "coordinator_id": f"CA_{suffix.upper()}",
                "email": f"coord_a_{suffix}@college.com",
                "department": "CSE",
                "phone": "9111111111",
                "password": "Password@123",
            },
        ).json()["coordinator"]["id"]
        coord_b = self.client.post(
            "/coordinators/",
            json={
                "name": f"Coordinator B {suffix}",
                "coordinator_id": f"CB_{suffix.upper()}",
                "email": f"coord_b_{suffix}@college.com",
                "department": "ECE",
                "phone": "9222222222",
                "password": "Password@123",
            },
        ).json()["coordinator"]["id"]

        token_a = self.client.post(
            "/coordinators/login",
            json={"email": f"coord_a_{suffix}@college.com", "password": "Password@123"},
        ).json()["token"]
        token_b = self.client.post(
            "/coordinators/login",
            json={"email": f"coord_b_{suffix}@college.com", "password": "Password@123"},
        ).json()["token"]
        admin_token = self.client.post(
            "/auth/admin/login",
            json={"email": self.admin.email, "password": "Admin@123"},
        ).json()["token"]

        future_date = (date.today() + timedelta(days=6)).isoformat()
        deadline = (date.today() + timedelta(days=4)).isoformat()
        event_a_id = self.client.post(
            "/events/",
            data={
                "title": f"Event A {suffix}",
                "description": "Event A only",
                "category": "Tech",
                "event_date": future_date,
                "start_time": "10:00:00",
                "end_time": "12:00:00",
                "venue": "Hall A",
                "organizer": "Club A",
                "coordinator_id": coord_a,
                "capacity": 40,
                "registration_deadline": deadline,
            },
        ).json()["event"]["id"]
        event_b_id = self.client.post(
            "/events/",
            data={
                "title": f"Event B {suffix}",
                "description": "Event B only",
                "category": "Cultural",
                "event_date": future_date,
                "start_time": "14:00:00",
                "end_time": "16:00:00",
                "venue": "Hall B",
                "organizer": "Club B",
                "coordinator_id": coord_b,
                "capacity": 40,
                "registration_deadline": deadline,
            },
        ).json()["event"]["id"]

        self.client.post(
            "/registrations/",
            json={"event_id": event_a_id},
            headers={"Authorization": f"Bearer {student_token}"},
        )
        self.client.post(
            "/registrations/",
            json={"event_id": event_b_id},
            headers={"Authorization": f"Bearer {student_b_token}"},
        )

        unauth = self.client.get(f"/registrations/event/{event_a_id}")
        self.assertEqual(unauth.status_code, 401)

        student_forbidden = self.client.get(
            f"/registrations/event/{event_a_id}",
            headers={"Authorization": f"Bearer {student_token}"},
        )
        self.assertEqual(student_forbidden.status_code, 403)

        coord_a_view = self.client.get(
            f"/registrations/event/{event_a_id}?page=1&limit=25",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        self.assertEqual(coord_a_view.status_code, 200)
        data_a = coord_a_view.json()
        names_a = {s["name"] for s in data_a["students"]}
        self.assertIn(f"Rahul {suffix}", names_a)
        self.assertNotIn(f"Anjali {suffix}", names_a)
        self.assertEqual(data_a["event"]["id"], event_a_id)
        self.assertEqual(data_a["summary"]["total_registered"], 1)
        self.assertEqual(data_a["pagination"]["total"], 1)

        coord_a_on_b = self.client.get(
            f"/registrations/event/{event_b_id}",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        self.assertEqual(coord_a_on_b.status_code, 403)

        missing = self.client.get(
            "/registrations/event/99999999",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        self.assertEqual(missing.status_code, 404)

        admin_a = self.client.get(
            f"/registrations/event/{event_a_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        admin_b = self.client.get(
            f"/registrations/event/{event_b_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        self.assertEqual(admin_a.status_code, 200)
        self.assertEqual(admin_b.status_code, 200)
        self.assertEqual({s["name"] for s in admin_a.json()["students"]}, {f"Rahul {suffix}"})
        self.assertEqual({s["name"] for s in admin_b.json()["students"]}, {f"Anjali {suffix}"})

        me_res = self.client.get(
            "/registrations/me",
            headers={"Authorization": f"Bearer {student_token}"},
        )
        self.assertEqual(me_res.status_code, 200)
        self.assertTrue(all(r["event_id"] == event_a_id for r in me_res.json()["registrations"]))

        unused = hash_password
        self.assertTrue(callable(unused))



if __name__ == "__main__":
    unittest.main()
