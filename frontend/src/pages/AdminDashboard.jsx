import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { API_URL, clearAuth, getAuth, getAuthHeaders } from "../utils/auth";

const menuItems = [
  { id: "dashboard", icon: "▦", label: "Dashboard" },
  { id: "events", icon: "📅", label: "Events" },
  { id: "students", icon: "🎓", label: "Students" },
  { id: "coordinators", icon: "👥", label: "Manage Coordinators" },
  { id: "registrations", icon: "📋", label: "Registrations" },
  { id: "attendance", icon: "✓", label: "Attendance" },
  { id: "certificates", icon: "🏆", label: "Certificates" },
  { id: "notifications", icon: "🔔", label: "Notifications" },
];

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const today = new Date();

function formatTime(timeString) {
  if (!timeString) return "Time unavailable";
  const [hours, minutes] = timeString.split(":");
  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0, 0);
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDate(dateString) {
  if (!dateString) return "Date unavailable";
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function AdminDashboard() {
  const navigate = useNavigate();
  const auth = getAuth();
  const [admin] = useState(auth.user);
  const [activeMenu, setActiveMenu] = useState("dashboard");

  // Live Statistics
  const [stats, setStats] = useState({
    total_students: 0,
    total_coordinators: 0,
    total_events: 0,
    upcoming_events: 0,
    total_registrations: 0,
    total_present: 0,
    total_absent: 0,
    attendance_percentage: 0,
    total_certificates: 0,
  });

  // Events state
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState("");
  const [selectedEditEvent, setSelectedEditEvent] = useState(null);
  const [coordinatorsList, setCoordinatorsList] = useState([]);

  // Students state
  const [studentsList, setStudentsList] = useState([]);
  const [studentSearch, setStudentSearch] = useState("");

  // Attendance state
  const [attendanceList, setAttendanceList] = useState([]);

  // Certificates state
  const [certificatesList, setCertificatesList] = useState([]);
  const [certEventId, setCertEventId] = useState("");

  // Notifications state
  const [broadcastForm, setBroadcastForm] = useState({
    title: "",
    message: "",
    recipient_role: "student",
  });
  const [broadcastSuccess, setBroadcastSuccess] = useState("");

  // Calendar state
  const [viewMonth, setViewMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState(today);

  // --------------------------------------------------
  // FETCH STATS AND EVENTS
  // --------------------------------------------------
  const fetchDashboardData = async () => {
    try {
      const [statsRes, eventsRes, coordsRes] = await Promise.all([
        fetch(`${API_URL}/admin/stats`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/events/`),
        fetch(`${API_URL}/coordinators/`),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setEvents(
          (eventsData.events || []).map((event) => ({
            ...event,
            date: new Date(`${event.event_date}T00:00:00`),
            time: `${formatTime(event.start_time)} - ${formatTime(event.end_time)}`,
            place: event.venue,
          }))
        );
      }

      if (coordsRes.ok) {
        const coordsData = await coordsRes.json();
        setCoordinatorsList(coordsData.coordinators || []);
      }
    } catch (error) {
      console.error("Dashboard fetch error:", error);
      setEventsError(error.message || "Unable to load dashboard data.");
    } finally {
      setEventsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Fetch tab-specific data on menu switch
  useEffect(() => {
    if (activeMenu === "students") {
      fetch(`${API_URL}/admin/students`, { headers: getAuthHeaders() })
        .then((r) => r.json())
        .then((d) => setStudentsList(d.students || []))
        .catch(console.error);
    } else if (activeMenu === "attendance") {
      fetch(`${API_URL}/admin/attendance`, { headers: getAuthHeaders() })
        .then((r) => r.json())
        .then((d) => setAttendanceList(d.attendance || []))
        .catch(console.error);
    } else if (activeMenu === "certificates") {
      fetch(`${API_URL}/admin/registrations?attendance_status=present`, { headers: getAuthHeaders() })
        .then((r) => r.json())
        .then((d) => setCertificatesList(d.registrations || []))
        .catch(console.error);
    }
  }, [activeMenu]);

  // Calendar cells
  const calendarCells = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const leadingBlanks = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells = Array.from({ length: leadingBlanks }, () => null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(new Date(year, month, d));
    }
    return cells;
  }, [viewMonth]);

  const eventsOn = (date) => events.filter((e) => isSameDay(e.date, date));
  const selectedEvents = eventsOn(selectedDate);

  const changeMonth = (step) =>
    setViewMonth(
      new Date(viewMonth.getFullYear(), viewMonth.getMonth() + step, 1)
    );

  // --------------------------------------------------
  // CANCEL EVENT
  // --------------------------------------------------
  const handleCancelEvent = async (eventId, title) => {
    if (!window.confirm(`Are you sure you want to cancel '${title}'? Registered students will be notified.`)) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/events/${eventId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error("Unable to cancel event.");
      }

      alert("Event has been cancelled.");
      fetchDashboardData();
    } catch (err) {
      alert(err.message);
    }
  };

  // --------------------------------------------------
  // EDIT EVENT SUBMISSION
  // --------------------------------------------------
  const handleSaveEditEvent = async (e) => {
    e.preventDefault();
    if (!selectedEditEvent) return;

    try {
      const formData = new FormData();
      formData.append("title", selectedEditEvent.title);
      formData.append("description", selectedEditEvent.description);
      formData.append("venue", selectedEditEvent.venue);
      formData.append("category", selectedEditEvent.category);
      formData.append("capacity", selectedEditEvent.capacity);
      if (selectedEditEvent.coordinator_id) {
        formData.append("coordinator_id", selectedEditEvent.coordinator_id);
      }

      const response = await fetch(`${API_URL}/events/${selectedEditEvent.id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to update event.");
      }

      alert("Event updated successfully!");
      setSelectedEditEvent(null);
      fetchDashboardData();
    } catch (err) {
      alert(err.message);
    }
  };

  // --------------------------------------------------
  // BROADCAST NOTIFICATION SUBMISSION
  // --------------------------------------------------
  const handleBroadcastNotification = async (e) => {
    e.preventDefault();
    setBroadcastSuccess("");

    try {
      const response = await fetch(`${API_URL}/notifications/broadcast`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(broadcastForm),
      });

      if (!response.ok) {
        throw new Error("Failed to send broadcast notification.");
      }

      setBroadcastSuccess("Broadcast notification sent successfully!");
      setBroadcastForm({ title: "", message: "", recipient_role: "student" });
    } catch (err) {
      alert(err.message);
    }
  };

  // --------------------------------------------------
  // ISSUE CERTIFICATES FOR EVENT
  // --------------------------------------------------
  const handleIssueCertificatesAdmin = async () => {
    if (!certEventId) {
      alert("Please select an event to issue certificates.");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/certificates/issue`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ event_id: Number(certEventId) }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.detail || "Unable to issue certificates.");
      }

      alert(result.message);
      fetchDashboardData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  if (!admin) return <Navigate to="/login" replace />;

  const initial = admin.name?.charAt(0)?.toUpperCase() || "A";

  const filteredStudents = studentsList.filter((st) => {
    const s = studentSearch.trim().toLowerCase();
    return (
      !s ||
      st.name.toLowerCase().includes(s) ||
      st.usn.toLowerCase().includes(s) ||
      st.department.toLowerCase().includes(s)
    );
  });

  return (
    <div className="admin-dashboard">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-icon">E</div>
          <div>
            <h2>EventManager</h2>
            <span>ADMIN PANEL</span>
          </div>
        </div>

        <div className="admin-nav-title">MAIN MENU</div>

        <nav className="admin-nav">
          {menuItems.map((item) => (
            item.id === "coordinators" ? (
              <Link
                key={item.id}
                to="/admin/manage-coordinators"
                className="admin-nav-item"
              >
                <span className="admin-nav-icon" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ) : (
              <button
                key={item.id}
                className={activeMenu === item.id ? "admin-nav-item active" : "admin-nav-item"}
                onClick={() => setActiveMenu(item.id)}
              >
                <span className="admin-nav-icon" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            )
          ))}
        </nav>

        <div className="admin-sidebar-bottom">
          <div className="admin-user">
            <div className="admin-avatar">{initial}</div>
            <div>
              <strong>{admin.name || "System Admin"}</strong>
              <span>{admin.admin_id || "ADMIN"}</span>
            </div>
          </div>

          <button className="admin-logout" onClick={handleLogout}>
            ↪ Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        {/* ================= DASHBOARD TAB ================= */}
        {activeMenu === "dashboard" && (
          <>
            {/* LIVE SYSTEM STATS */}
            <section className="admin-section">
              <div className="admin-section-heading">
                <p className="admin-kicker">CAMPUS ANALYTICS</p>
                <h2>System Overview</h2>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "16px",
                  marginBottom: "24px",
                }}
              >
                <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "600" }}>TOTAL STUDENTS</span>
                  <div style={{ fontSize: "28px", fontWeight: "800", color: "#1e293b", marginTop: "4px" }}>
                    {stats.total_students}
                  </div>
                </div>

                <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "600" }}>COORDINATORS</span>
                  <div style={{ fontSize: "28px", fontWeight: "800", color: "#1e293b", marginTop: "4px" }}>
                    {stats.total_coordinators}
                  </div>
                </div>

                <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "600" }}>TOTAL EVENTS</span>
                  <div style={{ fontSize: "28px", fontWeight: "800", color: "#1e293b", marginTop: "4px" }}>
                    {stats.total_events}
                  </div>
                </div>

                <div style={{ background: "#ecfdf5", padding: "16px", borderRadius: "12px", border: "1px solid #a7f3d0" }}>
                  <span style={{ fontSize: "12px", color: "#065f46", fontWeight: "600" }}>REGISTRATIONS</span>
                  <div style={{ fontSize: "28px", fontWeight: "800", color: "#047857", marginTop: "4px" }}>
                    {stats.total_registrations}
                  </div>
                </div>

                <div style={{ background: "#f5f3ff", padding: "16px", borderRadius: "12px", border: "1px solid #ddd6fe" }}>
                  <span style={{ fontSize: "12px", color: "#5b21b6", fontWeight: "600" }}>ATTENDANCE RATE</span>
                  <div style={{ fontSize: "28px", fontWeight: "800", color: "#7c3aed", marginTop: "4px" }}>
                    {stats.attendance_percentage}%
                  </div>
                </div>

                <div style={{ background: "#fffbeb", padding: "16px", borderRadius: "12px", border: "1px solid #fde68a" }}>
                  <span style={{ fontSize: "12px", color: "#92400e", fontWeight: "600" }}>CERTIFICATES</span>
                  <div style={{ fontSize: "28px", fontWeight: "800", color: "#b45309", marginTop: "4px" }}>
                    {stats.total_certificates}
                  </div>
                </div>
              </div>

              <div className="admin-actions-grid">
                <button
                  className="admin-action-card"
                  onClick={() => navigate("/admin/create-event")}
                >
                  <div className="admin-action-icon" aria-hidden="true">+</div>
                  <div>
                    <strong>Create Event</strong>
                    <span>Publish a new event</span>
                  </div>
                  <span className="admin-action-arrow">→</span>
                </button>

                <button
                  className="admin-action-card"
                  onClick={() => navigate("/admin/manage-coordinators")}
                >
                  <div className="admin-action-icon" aria-hidden="true">👥</div>
                  <div>
                    <strong>Manage Coordinators</strong>
                    <span>Create & assign staff</span>
                  </div>
                  <span className="admin-action-arrow">→</span>
                </button>
              </div>
            </section>

            {/* Calendar */}
            <section className="admin-section">
              <div className="cal-wrap">
                <div className="admin-panel">
                  <div className="cal-head">
                    <h2>
                      {viewMonth.toLocaleString("en", { month: "long", year: "numeric" })}
                    </h2>
                    <div className="cal-nav">
                      <button onClick={() => changeMonth(-1)} aria-label="Previous month">‹</button>
                      <button onClick={() => changeMonth(1)} aria-label="Next month">›</button>
                    </div>
                  </div>

                  <div className="cal-grid">
                    {WEEK_DAYS.map((d) => (
                      <div key={d} className="cal-dow">{d}</div>
                    ))}

                    {calendarCells.map((date, i) => {
                      if (!date) return <div key={`blank-${i}`} className="cal-day blank" />;

                      const count = Math.min(eventsOn(date).length, 3);
                      const classes = ["cal-day"];
                      if (isSameDay(date, today)) classes.push("today");
                      if (isSameDay(date, selectedDate)) classes.push("selected");

                      return (
                        <button
                          key={date.getDate()}
                          className={classes.join(" ")}
                          onClick={() => setSelectedDate(date)}
                        >
                          <span>{date.getDate()}</span>
                          <span className="cal-dots">
                            {Array.from({ length: count }, (_, n) => <i key={n} />)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="admin-panel">
                  <div className="admin-panel-header">
                    <div>
                      <p className="admin-kicker">
                        {selectedDate.toLocaleString("en", { weekday: "long" })}
                      </p>
                      <h2>
                        {selectedDate.toLocaleString("en", { day: "numeric", month: "long", year: "numeric" })}
                      </h2>
                    </div>
                  </div>

                  {selectedEvents.length > 0 ? (
                    <div className="day-events">
                      {selectedEvents.map((e) => (
                        <div key={e.id} className="day-event">
                          <strong>{e.title}</strong>
                          <span>{e.time} · {e.place}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="day-empty">
                      <p>No events on this day.</p>
                      <button
                        className="admin-primary-button"
                        onClick={() => navigate("/admin/create-event")}
                      >
                        + Create Event
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </>
        )}

        {/* ================= EVENTS TAB ================= */}
        {activeMenu === "events" && (
          <section className="admin-section">
            <div className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <p className="admin-kicker">CAMPUS EVENTS</p>
                  <h2>All Events</h2>
                </div>
                <button
                  className="admin-primary-button"
                  onClick={() => navigate("/admin/create-event")}
                >
                  + Create New Event
                </button>
              </div>

              {!eventsLoading && !eventsError && events.length > 0 && (
                <div className="event-card-grid" style={{ marginBottom: "24px" }}>
                  {events.map((ev) => (
                    <div className="event-select-card" key={`card-${ev.id}`}>
                      <div className="event-select-card-body">
                        <small className={`admin-status admin-status-${(ev.status || "").toLowerCase()}`}>
                          {ev.status}
                        </small>
                        <h3>{ev.title}</h3>
                        <p>{formatDate(ev.event_date)}</p>
                        <p>Coordinator: {ev.coordinator?.name || "Unassigned"}</p>
                        <div className="event-card-stats">
                          <span>{ev.registered_count || 0} Registered</span>
                          <span>{ev.present_count || 0} Present</span>
                        </div>
                      </div>
                      <div className="event-card-actions">
                        <button
                          type="button"
                          className="admin-primary-button"
                          onClick={() => navigate(`/admin/events/${ev.id}/students`)}
                        >
                          View Students
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Date & Time</th>
                      <th>Venue</th>
                      <th>Coordinator</th>
                      <th>Registered</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventsLoading ? (
                      <tr><td colSpan="7" style={{ textAlign: "center", padding: "2rem" }}>Loading events...</td></tr>
                    ) : eventsError ? (
                      <tr><td colSpan="7" style={{ textAlign: "center", color: "#ef4444", padding: "2rem" }}>{eventsError}</td></tr>
                    ) : events.length === 0 ? (
                      <tr><td colSpan="7" style={{ textAlign: "center", padding: "2rem" }}>No events found.</td></tr>
                    ) : (
                      events.map((ev) => (
                        <tr key={ev.id}>
                          <td><strong>{ev.title}</strong></td>
                          <td>{formatDate(ev.event_date)}</td>
                          <td>{ev.venue}</td>
                          <td>{ev.coordinator?.name || "Unassigned"}</td>
                          <td>{ev.registered_count || 0}/{ev.capacity}</td>
                          <td>
                            <span className={`admin-status admin-status-${(ev.status || "").toLowerCase()}`}>
                              {ev.status}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                              <button
                                type="button"
                                className="table-action-button"
                                onClick={() => navigate(`/admin/events/${ev.id}/students`)}
                              >
                                View Registered Students
                              </button>
                              <button
                                type="button"
                                className="table-action-button"
                                onClick={() => setSelectedEditEvent(ev)}
                              >
                                Edit
                              </button>
                              {ev.status !== "cancelled" && (
                                <button
                                  type="button"
                                  className="table-action-button"
                                  style={{ color: "#ef4444" }}
                                  onClick={() => handleCancelEvent(ev.id, ev.title)}
                                >
                                  Cancel
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* ================= STUDENTS TAB ================= */}
        {activeMenu === "students" && (
          <section className="admin-section">
            <div className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <p className="admin-kicker">USER DIRECTORY</p>
                  <h2>Registered Students ({studentsList.length})</h2>
                </div>
                <input
                  type="search"
                  placeholder="Search students..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  style={{ width: "260px" }}
                />
              </div>

              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>USN</th>
                      <th>Dept & Year</th>
                      <th>Email</th>
                      <th>Registrations</th>
                      <th>Attended</th>
                      <th>Certificates</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((st) => (
                      <tr key={st.id}>
                        <td><strong>{st.name}</strong></td>
                        <td>{st.usn}</td>
                        <td>{st.department} · Yr {st.year}</td>
                        <td>{st.email}</td>
                        <td>{st.total_registrations}</td>
                        <td>{st.total_present}</td>
                        <td>{st.total_certificates}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* ================= REGISTRATIONS TAB ================= */}
        {activeMenu === "registrations" && (
          <section className="admin-section">
            <div className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <p className="admin-kicker">PARTICIPATION LOGS</p>
                  <h2>Choose an event to view registrations</h2>
                </div>
              </div>
              <p style={{ color: "var(--muted)", marginBottom: "16px" }}>
                Registrations are event-specific. Open an event below to see only the students registered for that event.
              </p>
              <div className="event-card-grid">
                {events.map((ev) => (
                  <div className="event-select-card" key={`reg-${ev.id}`}>
                    <div className="event-select-card-body">
                      <h3>{ev.title}</h3>
                      <p>{formatDate(ev.event_date)} · {ev.coordinator?.name || "Unassigned"}</p>
                      <div className="event-card-stats">
                        <span>{ev.registered_count || 0} Registered</span>
                      </div>
                    </div>
                    <div className="event-card-actions">
                      <button
                        type="button"
                        className="admin-primary-button"
                        onClick={() => navigate(`/admin/events/${ev.id}/students`)}
                      >
                        View Registered Students
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ================= ATTENDANCE TAB ================= */}
        {activeMenu === "attendance" && (
          <section className="admin-section">
            <div className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <p className="admin-kicker">VERIFICATION AUDIT</p>
                  <h2>Attendance Audit Logs ({attendanceList.length})</h2>
                </div>
              </div>

              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>USN</th>
                      <th>Event</th>
                      <th>Marked By</th>
                      <th>Timestamp</th>
                      <th>Method</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceList.map((att) => (
                      <tr key={att.id}>
                        <td><strong>{att.student_name}</strong></td>
                        <td>{att.student_usn}</td>
                        <td>{att.event_title}</td>
                        <td>{att.marked_by}</td>
                        <td>{new Date(att.marked_at).toLocaleString()}</td>
                        <td>
                          <span style={{ fontSize: "12px", background: "#f1f5f9", padding: "4px 8px", borderRadius: "4px" }}>
                            {att.method === "qr_scan" ? "📷 QR Scan" : "⌨ Manual"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* ================= CERTIFICATES TAB ================= */}
        {activeMenu === "certificates" && (
          <section className="admin-section">
            <div className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <p className="admin-kicker">CREDENTIALS</p>
                  <h2>Certificates Management</h2>
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", margin: "16px 0", alignItems: "center" }}>
                <select
                  value={certEventId}
                  onChange={(e) => setCertEventId(e.target.value)}
                  style={{ maxWidth: "340px", padding: "10px" }}
                >
                  <option value="">Select Event to Issue Certificates...</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title} ({ev.present_count || 0} attendees)
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className="admin-primary-button"
                  onClick={handleIssueCertificatesAdmin}
                >
                  Issue Certificates for Event
                </button>
              </div>

              <h3>Present Attendees Eligible for Certificates</h3>
              <div className="admin-table-wrapper" style={{ marginTop: "12px" }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>USN</th>
                      <th>Event</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {certificatesList.map((c) => (
                      <tr key={c.id}>
                        <td><strong>{c.student_name}</strong></td>
                        <td>{c.student_usn}</td>
                        <td>{c.event_title}</td>
                        <td><span className="badge-present">✓ Attendance Confirmed</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* ================= NOTIFICATIONS TAB ================= */}
        {activeMenu === "notifications" && (
          <section className="admin-section">
            <div className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <p className="admin-kicker">COMMUNICATIONS</p>
                  <h2>Broadcast Campus Notification</h2>
                </div>
              </div>

              {broadcastSuccess && (
                <div style={{ padding: "10px 14px", background: "#ecfdf5", color: "#065f46", borderRadius: "8px", margin: "12px 0" }}>
                  {broadcastSuccess}
                </div>
              )}

              <form onSubmit={handleBroadcastNotification} style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "600px", margin: "16px 0" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="E.g., Campus Fest Schedule Released"
                    value={broadcastForm.title}
                    onChange={(e) => setBroadcastForm({ ...broadcastForm, title: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Message *</label>
                  <textarea
                    rows="4"
                    required
                    placeholder="Enter announcement text..."
                    value={broadcastForm.message}
                    onChange={(e) => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--line)" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Target Audience</label>
                  <select
                    value={broadcastForm.recipient_role}
                    onChange={(e) => setBroadcastForm({ ...broadcastForm, recipient_role: e.target.value })}
                  >
                    <option value="student">All Students</option>
                    <option value="coordinator">All Coordinators</option>
                    <option value="all">Everyone</option>
                  </select>
                </div>

                <button type="submit" className="admin-primary-button" style={{ alignSelf: "flex-start" }}>
                  Send Broadcast Notification
                </button>
              </form>
            </div>
          </section>
        )}
      </main>

      {/* ================= EDIT EVENT MODAL ================= */}
      {selectedEditEvent && (
        <div className="admin-modal-backdrop" onClick={() => setSelectedEditEvent(null)}>
          <div
            className="admin-panel admin-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "600px" }}
          >
            <button
              className="admin-modal-close"
              onClick={() => setSelectedEditEvent(null)}
              aria-label="Close"
            >
              ×
            </button>

            <h3>Edit Event</h3>
            <form onSubmit={handleSaveEditEvent} style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "600" }}>Title</label>
                <input
                  type="text"
                  value={selectedEditEvent.title}
                  onChange={(e) => setSelectedEditEvent({ ...selectedEditEvent, title: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600" }}>Venue</label>
                <input
                  type="text"
                  value={selectedEditEvent.venue}
                  onChange={(e) => setSelectedEditEvent({ ...selectedEditEvent, venue: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600" }}>Category</label>
                  <input
                    type="text"
                    value={selectedEditEvent.category}
                    onChange={(e) => setSelectedEditEvent({ ...selectedEditEvent, category: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600" }}>Capacity</label>
                  <input
                    type="number"
                    value={selectedEditEvent.capacity}
                    onChange={(e) => setSelectedEditEvent({ ...selectedEditEvent, capacity: Number(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600" }}>Assigned Coordinator</label>
                <select
                  value={selectedEditEvent.coordinator_id || ""}
                  onChange={(e) => setSelectedEditEvent({ ...selectedEditEvent, coordinator_id: Number(e.target.value) })}
                >
                  <option value="">Select Coordinator...</option>
                  {coordinatorsList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.department})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600" }}>Description</label>
                <textarea
                  rows="3"
                  value={selectedEditEvent.description}
                  onChange={(e) => setSelectedEditEvent({ ...selectedEditEvent, description: e.target.value })}
                  style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid var(--line)" }}
                  required
                />
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "12px" }}>
                <button
                  type="button"
                  className="admin-secondary-button"
                  onClick={() => setSelectedEditEvent(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="admin-primary-button">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;