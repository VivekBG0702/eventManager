import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import QrAttendanceScanner from "../components/QrAttendanceScanner";
import { API_URL, clearAuth, getAuth, getAuthHeaders } from "../utils/auth";
import { apiErrorMessage } from "../utils/apiErrors";

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

const NAV_ITEMS = [
  { key: "events", label: "My Events", icon: "📅" },
  { key: "notifications", label: "Notifications", icon: "🔔" },
  { key: "settings", label: "Settings", icon: "⚙️" },
];

function CoordinatorDashboard() {
  const navigate = useNavigate();
  const auth = getAuth();
  const [coordinator] = useState(auth.user);
  const [activeMenu, setActiveMenu] = useState("events");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState("");
  const [scanEvent, setScanEvent] = useState(null);
  const [attendanceMessage, setAttendanceMessage] = useState("");

  const fetchMyEvents = async () => {
    if (!coordinator?.id) return;
    setEventsLoading(true);
    setEventsError("");

    try {
      const response = await fetch(
        `${API_URL}/events/coordinator/${coordinator.id}`,
        { headers: getAuthHeaders() }
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(apiErrorMessage(response.status, result.detail, "Unable to load events."));
      }

      setEvents(result.events || []);
    } catch (error) {
      console.error("Coordinator events error:", error);
      setEventsError(error.message || "Unable to load events.");
    } finally {
      setEventsLoading(false);
    }
  };

  useEffect(() => {
    fetchMyEvents();
  }, [coordinator?.id]);

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  if (!coordinator?.id) {
    return <Navigate to="/login" replace />;
  }

  const initial = coordinator.name?.charAt(0)?.toUpperCase() || "C";
  const selectMenu = (key) => {
    setActiveMenu(key);
    setSidebarOpen(false);
  };

  return (
    <div className="admin-dashboard">
      <button
        className="admin-sidebar-toggle"
        onClick={() => setSidebarOpen((o) => !o)}
        aria-label="Toggle menu"
        aria-expanded={sidebarOpen}
      >
        <span /><span /><span />
      </button>

      <aside className={sidebarOpen ? "admin-sidebar open" : "admin-sidebar"}>
        <div className="admin-brand">
          <div className="admin-brand-icon">E</div>
          <div>
            <h2>EventManager</h2>
            <span>COORDINATOR PANEL</span>
          </div>
        </div>

        <div className="admin-nav-title">MAIN MENU</div>

        <nav className="admin-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={activeMenu === item.key ? "admin-nav-item active" : "admin-nav-item"}
              onClick={() => selectMenu(item.key)}
            >
              <span className="admin-nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="admin-sidebar-bottom">
          <div className="admin-user">
            <div className="admin-avatar">{initial}</div>
            <div>
              <strong>{coordinator.name || "Coordinator"}</strong>
              <span>{coordinator.coordinator_id || "COORDINATOR"}</span>
            </div>
          </div>

          <button className="admin-logout" onClick={handleLogout}>
            ↪ Logout
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="admin-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      <main className="admin-main">
        <section className="admin-section">
          <div className="admin-section-heading">
            <p className="admin-kicker">COORDINATOR PORTAL</p>
            <h2>My Assigned Events</h2>
            <p>Open an event to view only the students registered for that event, then run QR attendance.</p>
          </div>
        </section>

        {activeMenu === "events" && (
          <section className="admin-section">
            <div className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <p className="admin-kicker">EVENT MANAGEMENT</p>
                  <h2>My Events</h2>
                </div>
                <span className="admin-count-pill">{events.length} Events</span>
              </div>

              {attendanceMessage && (
                <div className="reg-success">{attendanceMessage}</div>
              )}

              {eventsLoading && (
                <div className="admin-empty-state">
                  <div className="admin-spinner" aria-hidden="true" />
                  <p>Loading your assigned events…</p>
                </div>
              )}

              {!eventsLoading && eventsError && (
                <div className="admin-empty-state">
                  <div className="admin-empty-icon">⚠️</div>
                  <h3>Unable to load events</h3>
                  <p>{eventsError}</p>
                </div>
              )}

              {!eventsLoading && !eventsError && events.length === 0 && (
                <div className="admin-empty-state">
                  <div className="admin-empty-icon">📅</div>
                  <h3>No events assigned</h3>
                  <p>Events assigned to you by the administrator will appear here.</p>
                </div>
              )}

              {!eventsLoading && !eventsError && events.length > 0 && (
                <div className="event-card-grid">
                  {events.map((event) => (
                    <div className="event-select-card" key={event.id}>
                      <div className="event-select-card-body">
                        <small className={`admin-status admin-status-${(event.status || "").toLowerCase()}`}>
                          {event.status}
                        </small>
                        <h3>{event.title}</h3>
                        <p>
                          {formatDate(event.event_date)} · {formatTime(event.start_time)} – {formatTime(event.end_time)}
                        </p>
                        <p>{event.venue} · {event.category}</p>
                        <div className="event-card-stats">
                          <span>{event.registered_count || 0} Registered</span>
                          <span>{event.present_count || 0} Present</span>
                        </div>
                      </div>
                      <div className="event-card-actions">
                        <button
                          type="button"
                          className="admin-primary-button"
                          onClick={() => navigate(`/coordinator/events/${event.id}/students`)}
                        >
                          View Students
                        </button>
                        <button
                          type="button"
                          className="admin-secondary-button"
                          onClick={() => {
                            setAttendanceMessage("");
                            setScanEvent(event);
                          }}
                        >
                          Attendance
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {activeMenu === "notifications" && (
          <section className="admin-section">
            <div className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <p className="admin-kicker">NOTIFICATIONS</p>
                  <h2>Notifications</h2>
                </div>
              </div>

              <div className="admin-empty-state">
                <div className="admin-empty-icon">🔔</div>
                <h3>No notifications</h3>
                <p>Assignment alerts and administration announcements will appear here.</p>
              </div>
            </div>
          </section>
        )}

        {activeMenu === "settings" && (
          <section className="admin-section">
            <div className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <p className="admin-kicker">ACCOUNT</p>
                  <h2>Coordinator Profile</h2>
                </div>
              </div>

              <div className="admin-status-list">
                <div><span>Name</span><strong>{coordinator.name}</strong></div>
                <div><span>Coordinator ID</span><strong>{coordinator.coordinator_id}</strong></div>
                <div><span>Email</span><strong>{coordinator.email}</strong></div>
                <div><span>Department</span><strong>{coordinator.department}</strong></div>
                <div><span>Assigned Events</span><strong>{events.length}</strong></div>
              </div>
            </div>
          </section>
        )}
      </main>

      {scanEvent && (
        <QrAttendanceScanner
          event={scanEvent}
          onClose={() => setScanEvent(null)}
          onAttendanceMarked={(result) => {
            setAttendanceMessage(`✓ Attendance marked for ${result.attendance?.student_name || "student"}!`);
            fetchMyEvents();
          }}
        />
      )}
    </div>
  );
}

export default CoordinatorDashboard;
