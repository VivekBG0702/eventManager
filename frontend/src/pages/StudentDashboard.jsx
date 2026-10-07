import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import { API_URL, clearAuth, getAuth, getAuthHeaders } from "../utils/auth";

function formatDate(dateString) {
  if (!dateString) return "Date unavailable";
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(timeString) {
  if (!timeString) return "Time unavailable";
  const [hours, minutes] = timeString.split(":");
  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0, 0);
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: "▥" },
  { key: "events", label: "Browse Events", icon: "▣" },
  { key: "registrations", label: "My Registrations", icon: "♧" },
  { key: "certificates", label: "My Certificates", icon: "🏆" },
  { key: "notifications", label: "Notifications", icon: "🔔" },
  { key: "profile", label: "Profile", icon: "♙" },
];

function StudentDashboard() {
  const navigate = useNavigate();
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const auth = getAuth();
  const [student, setStudent] = useState(auth.user);

  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState("");

  const [registrations, setRegistrations] = useState([]);
  const [registrationsLoading, setRegistrationsLoading] = useState(true);
  const [registrationsError, setRegistrationsError] = useState("");

  const [certificates, setCertificates] = useState([]);
  const [certificatesLoading, setCertificatesLoading] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  const [selectedRegistration, setSelectedRegistration] = useState(null);
  const [selectedCertificate, setSelectedCertificate] = useState(null);
  const [registeringEventId, setRegisteringEventId] = useState(null);
  const [registrationFilter, setRegistrationFilter] = useState("all");

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Fetch registrations
  const fetchRegistrations = async () => {
    if (!student?.id) return;
    setRegistrationsLoading(true);
    setRegistrationsError("");

    try {
      const response = await fetch(`${API_URL}/registrations/me`, {
        headers: getAuthHeaders(),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "Unable to load registrations.");
      }

      setRegistrations(result.registrations || []);
    } catch (error) {
      console.error("Student registrations error:", error);
      setRegistrationsError(error.message || "Unable to load registrations.");
    } finally {
      setRegistrationsLoading(false);
    }
  };

  // Fetch certificates
  const fetchCertificates = async () => {
    if (!student?.id) return;
    setCertificatesLoading(true);

    try {
      const response = await fetch(`${API_URL}/certificates/student/${student.id}`, {
        headers: getAuthHeaders(),
      });
      const result = await response.json();
      if (response.ok) {
        setCertificates(result.certificates || []);
      }
    } catch (error) {
      console.error("Certificates load error:", error);
    } finally {
      setCertificatesLoading(false);
    }
  };

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!student?.id) return;
    setNotificationsLoading(true);

    try {
      const response = await fetch(`${API_URL}/notifications/student/${student.id}`, {
        headers: getAuthHeaders(),
      });
      const result = await response.json();
      if (response.ok) {
        setNotifications(result.notifications || []);
      }
    } catch (error) {
      console.error("Notifications load error:", error);
    } finally {
      setNotificationsLoading(false);
    }
  };

  // Fetch events
  const fetchEvents = async () => {
    setEventsLoading(true);
    setEventsError("");

    try {
      const response = await fetch(`${API_URL}/events/`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "Unable to load events.");
      }

      setEvents(result.events || []);
    } catch (error) {
      setEventsError(error.message || "Unable to load events.");
    } finally {
      setEventsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    if (student?.id) {
      fetchRegistrations();
      fetchCertificates();
      fetchNotifications();
    }
  }, [student?.id]);

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  const handleRegister = async (eventId) => {
    if (!student?.id) {
      alert("Student information not found. Please login again.");
      navigate("/login");
      return;
    }

    try {
      setRegisteringEventId(eventId);

      const response = await fetch(`${API_URL}/registrations/`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ event_id: eventId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "Registration failed.");
      }

      alert("Successfully registered for the event!");
      await fetchRegistrations();
      await fetchEvents();
      await fetchNotifications();
    } catch (error) {
      alert(error.message || "Unable to register for the event.");
    } finally {
      setRegisteringEventId(null);
    }
  };

  const markNotificationRead = async (notifId) => {
    try {
      await fetch(`${API_URL}/notifications/${notifId}/read`, {
        method: "PUT",
        headers: getAuthHeaders(),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.error("Failed to mark notification read", err);
    }
  };

  const studentName = student?.name || "Student";
  const studentInitials = student?.name
    ? student.name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join("")
    : "ST";
  const studentDepartment = student?.department || "Department";
  const studentUsn = student?.usn || "USN not available";

  const registeredEventIds = registrations.map((r) => r.event_id);
  const attendedCount = registrations.filter((r) => r.attendance_status === "present").length;
  const unreadNotifsCount = notifications.filter((n) => !n.is_read).length;

  const categories = [
    "All",
    ...new Set(events.map((event) => event.category).filter(Boolean)),
  ];

  const filteredEvents = events.filter((event) => {
    const search = searchTerm.trim().toLowerCase();
    const matchesName = !search || event.title?.toLowerCase().includes(search);
    const matchesCategory =
      selectedCategory === "All" ||
      event.category?.toLowerCase() === selectedCategory.toLowerCase();
    return matchesName && matchesCategory;
  });

  const filteredRegistrations = registrations.filter((reg) => {
    if (registrationFilter === "attended") {
      return reg.attendance_status === "present";
    }
    if (registrationFilter === "upcoming") {
      return reg.attendance_status !== "present";
    }
    return true;
  });

  const selectMenu = (key) => {
    setActiveMenu(key);
    setSidebarOpen(false);
  };

  return (
    <div className="student-dashboard">
      {/* ================= SIDEBAR ================= */}
      <aside className={`student-sidebar ${sidebarOpen ? "student-sidebar-open" : ""}`}>
        <div className="student-brand">
          <div className="brand-logo">🎓</div>
          <div>
            <h2>EventManager</h2>
            <span>Student Portal</span>
          </div>
        </div>

        <nav className="student-navigation">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={activeMenu === item.key ? "active" : ""}
              onClick={() => selectMenu(item.key)}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
              {item.key === "notifications" && unreadNotifsCount > 0 && (
                <span className="notification-badge" style={{ position: "relative", marginLeft: "auto" }}>
                  {unreadNotifsCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="student-sidebar-bottom">
          <div className="student-profile-mini">
            <div className="student-avatar">{studentInitials}</div>
            <div>
              <strong>{studentName}</strong>
              <span>Student</span>
              <small>{studentUsn} · {studentDepartment}</small>
            </div>
          </div>

          <button type="button" className="student-logout" onClick={handleLogout}>
            <span aria-hidden="true">↪</span>
            Logout
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="student-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ================= MAIN CONTENT ================= */}
      <main className="student-main">
        <header className="student-header">
          <button
            className="mobile-sidebar-button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle menu"
          >
            ☰
          </button>

          <div>
            <h1>Student Dashboard</h1>
            <p>Welcome back, {studentName}! Manage your events, attendance, and certificates.</p>
          </div>

          <div className="student-header-right">
            <button
              className="notification-button"
              aria-label="Notifications"
              onClick={() => selectMenu("notifications")}
              style={{ position: "relative" }}
            >
              🔔
              {unreadNotifsCount > 0 && (
                <span className="notification-badge">{unreadNotifsCount}</span>
              )}
            </button>

            <div className="header-profile" onClick={() => selectMenu("profile")}>
              <div className="header-avatar">{studentInitials}</div>
              <strong>{studentName}</strong>
              <span aria-hidden="true">⌄</span>
            </div>
          </div>
        </header>

        <div className="student-content">
          {/* ================= DASHBOARD HOME ================= */}
          {activeMenu === "dashboard" && (
            <>
              <section className="student-statistics">
                <div className="dashboard-stat-card">
                  <div className="stat-card-icon purple">🏆</div>
                  <div>
                    <span>Certificates</span>
                    <strong>{certificates.length}</strong>
                    <button type="button" onClick={() => selectMenu("certificates")}>
                      View Details →
                    </button>
                  </div>
                </div>

                <div className="dashboard-stat-card">
                  <div className="stat-card-icon green">▣</div>
                  <div>
                    <span>Registered Events</span>
                    <strong>{registrations.length}</strong>
                    <button type="button" onClick={() => selectMenu("registrations")}>
                      My List →
                    </button>
                  </div>
                </div>

                <div className="dashboard-stat-card">
                  <div className="stat-card-icon purple">✓</div>
                  <div>
                    <span>Attended Events</span>
                    <strong>{attendedCount}</strong>
                    <button type="button" onClick={() => selectMenu("registrations")}>
                      View Attendance →
                    </button>
                  </div>
                </div>

                <div className="dashboard-stat-card">
                  <div className="stat-card-icon green">📅</div>
                  <div>
                    <span>Events Available</span>
                    <strong>{events.length}</strong>
                    <button type="button" onClick={() => selectMenu("events")}>
                      Browse all →
                    </button>
                  </div>
                </div>
              </section>

              <section className="featured-events">
                <div className="featured-header">
                  <div className="featured-title">
                    <span aria-hidden="true">▣</span>
                    <h2>Upcoming Campus Events</h2>
                  </div>

                  <button type="button" onClick={() => selectMenu("events")}>
                    View All Events →
                  </button>
                </div>

                <div className="event-list">
                  {eventsLoading && <p className="empty">Loading events...</p>}
                  {!eventsLoading && eventsError && <p className="empty">{eventsError}</p>}
                  {!eventsLoading && !eventsError && events.length === 0 && (
                    <p className="empty">No events have been created yet.</p>
                  )}

                  {!eventsLoading &&
                    !eventsError &&
                    events.slice(0, 4).map((event) => {
                      const isRegistering = registeringEventId === event.id;
                      const isRegistered = registeredEventIds.includes(event.id);

                      return (
                        <article className="dashboard-event-card" key={event.id}>
                          {event.intro_image ? (
                            <img
                              src={`${API_URL}/${event.intro_image}`}
                              alt={event.title}
                              className="dashboard-event-image"
                            />
                          ) : (
                            <div className="dashboard-event-image event-image-placeholder">Event</div>
                          )}

                          <div className="dashboard-event-details">
                            <h3>{event.title}</h3>
                            <p className="event-description">{event.description}</p>

                            <div className="event-meta">
                              <span>📅 {formatDate(event.event_date)}</span>
                              <span>◷ {formatTime(event.start_time)} - {formatTime(event.end_time)}</span>
                              <span>📍 {event.venue}</span>
                            </div>

                            <div className="event-tags">
                              <span className="event-category-tag">{event.category}</span>
                              <span className={`event-level-tag status-${(event.status || "").toLowerCase()}`}>
                                {event.status}
                              </span>
                              <span className="event-rating">
                                {event.registration_deadline
                                  ? `Register by ${formatDate(event.registration_deadline)}`
                                  : "Open registration"}
                              </span>
                            </div>
                          </div>

                          <div className="dashboard-event-action">
                            <div className="event-capacity">
                              <span>👥 {event.registered_count || 0}/{event.capacity} seats</span>
                              <span>Coordinator: {event.coordinator?.name || "Assigned Staff"}</span>
                            </div>

                            <div className="event-organizer">by {event.organizer}</div>

                            <button
                              type="button"
                              className={isRegistered ? "register-event-button done" : "register-event-button"}
                              onClick={() => handleRegister(event.id)}
                              disabled={isRegistering || isRegistered || event.status === "cancelled"}
                            >
                              {isRegistering
                                ? "Registering..."
                                : isRegistered
                                  ? "Registered ✓"
                                  : event.status === "cancelled"
                                    ? "Cancelled"
                                    : "Register Now"}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                </div>
              </section>
            </>
          )}

          {/* ================= BROWSE EVENTS ================= */}
          {activeMenu === "events" && (
            <section className="browse-events-section">
              <div className="browse-events-header">
                <div>
                  <h2>Browse Events</h2>
                  <p>Explore all upcoming college events and register to participate.</p>
                </div>
              </div>

              <div className="event-search-container">
                <div className="event-search-box">
                  <span aria-hidden="true">🔍</span>
                  <input
                    type="text"
                    placeholder="Search events by name, organizer or venue..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      className="search-clear"
                      onClick={() => setSearchTerm("")}
                      aria-label="Clear search"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="event-category-filter">
                  <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                    {categories.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="browse-events-count">
                <strong>{filteredEvents.length}</strong> events found
              </div>

              <div className="browse-events-grid">
                {eventsLoading && (
                  <div className="browse-events-loading">
                    <span className="spinner" aria-hidden="true" />
                    <p>Loading events…</p>
                  </div>
                )}

                {!eventsLoading && eventsError && (
                  <div className="empty-events">
                    <div aria-hidden="true">⚠️</div>
                    <h3>Something went wrong</h3>
                    <p>{eventsError}</p>
                  </div>
                )}

                {!eventsLoading && !eventsError && filteredEvents.length === 0 && (
                  <div className="empty-events">
                    <div aria-hidden="true">🔍</div>
                    <h3>No events found</h3>
                    <p>Try another event name or category.</p>
                  </div>
                )}

                {!eventsLoading &&
                  !eventsError &&
                  filteredEvents.map((event) => {
                    const isRegistering = registeringEventId === event.id;
                    const isRegistered = registeredEventIds.includes(event.id);

                    return (
                      <article className="browse-event-card" key={event.id}>
                        {event.intro_image ? (
                          <img
                            src={`${API_URL}/${event.intro_image}`}
                            alt={event.title}
                            className="browse-event-image"
                          />
                        ) : (
                          <div className="browse-event-image event-image-placeholder">Event</div>
                        )}

                        <div className="browse-event-content">
                          <div className="browse-event-top">
                            <span className="event-category-tag">{event.category}</span>
                            <span className={`event-level-tag status-${(event.status || "").toLowerCase()}`}>
                              {event.status}
                            </span>
                          </div>

                          <h3>{event.title}</h3>
                          <p className="browse-event-description">{event.description}</p>

                          <div className="browse-event-info">
                            <span>📅 {formatDate(event.event_date)}</span>
                            <span>◷ {formatTime(event.start_time)} - {formatTime(event.end_time)}</span>
                            <span>📍 {event.venue}</span>
                          </div>

                          <div className="browse-event-bottom">
                            <span>👥 Seats: {event.registered_count || 0}/{event.capacity}</span>

                            <button
                              type="button"
                              className={isRegistered ? "register-event-button done" : "register-event-button"}
                              onClick={() => handleRegister(event.id)}
                              disabled={isRegistering || isRegistered || event.status === "cancelled"}
                            >
                              {isRegistering
                                ? "Registering…"
                                : isRegistered
                                  ? "Registered ✓"
                                  : event.status === "cancelled"
                                    ? "Cancelled"
                                    : "Register Now"}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
              </div>
            </section>
          )}

          {/* ================= MY REGISTRATIONS ================= */}
          {activeMenu === "registrations" && (
            <section className="dashboard-section">
              <div className="section-header">
                <div>
                  <p className="section-kicker">Your activity</p>
                  <h2>My Registrations</h2>
                  <p>Events you have registered for. Present your QR code to the coordinator for attendance.</p>
                </div>
              </div>

              <div className="tabs-nav">
                <button
                  type="button"
                  className={registrationFilter === "all" ? "tab-btn active" : "tab-btn"}
                  onClick={() => setRegistrationFilter("all")}
                >
                  All ({registrations.length})
                </button>
                <button
                  type="button"
                  className={registrationFilter === "upcoming" ? "tab-btn active" : "tab-btn"}
                  onClick={() => setRegistrationFilter("upcoming")}
                >
                  Upcoming / Not Marked ({registrations.filter((r) => r.attendance_status !== "present").length})
                </button>
                <button
                  type="button"
                  className={registrationFilter === "attended" ? "tab-btn active" : "tab-btn"}
                  onClick={() => setRegistrationFilter("attended")}
                >
                  Attended / Present ({attendedCount})
                </button>
              </div>

              {registrationsLoading && (
                <div className="empty-state">
                  <p>Loading your registrations...</p>
                </div>
              )}

              {registrationsError && (
                <div className="empty-state">
                  <p>{registrationsError}</p>
                </div>
              )}

              {!registrationsLoading && !registrationsError && filteredRegistrations.length === 0 && (
                <div className="empty-state">
                  <h3>No registrations in this category</h3>
                  <p>Browse events and register for campus activities to see them here.</p>
                </div>
              )}

              {!registrationsLoading && !registrationsError && filteredRegistrations.length > 0 && (
                <div className="events-grid">
                  {filteredRegistrations.map((registration) => {
                    const event = registration.event;
                    if (!event) return null;

                    const isPresent = registration.attendance_status === "present";

                    return (
                      <article className="event-card" key={registration.id}>
                        <div className="event-card-image">
                          {event.intro_image ? (
                            <img
                              src={`${API_URL}/${event.intro_image}`}
                              alt={event.title}
                            />
                          ) : (
                            <div className="event-card-placeholder">Event</div>
                          )}
                        </div>

                        <div className="event-card-content">
                          <span className="event-category">{event.category || "General"}</span>

                          <h3>{event.title}</h3>

                          <div className="event-details">
                            <p>📅 {formatDate(event.event_date)}</p>
                            <p>🕐 {formatTime(event.start_time)} – {formatTime(event.end_time)}</p>
                            <p>📍 {event.venue || "Campus Venue"}</p>
                          </div>

                          <div className="registration-status">
                            <span className="registered-badge">✓ Registered</span>

                            <span className={isPresent ? "attendance-present" : "attendance-absent"}>
                              {isPresent ? "✓ Attendance Marked (Present)" : "Attendance Not Marked"}
                            </span>
                          </div>

                          <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                            <button
                              type="button"
                              className="register-event-button"
                              onClick={() => setSelectedRegistration(registration)}
                            >
                              Show QR Code
                            </button>

                            {isPresent && registration.certificate && (
                              <button
                                type="button"
                                className="register-event-button"
                                style={{ background: "#7c3aed", color: "#fff" }}
                                onClick={() =>
                                  setSelectedCertificate({
                                    certificate_id: registration.certificate.certificate_id,
                                    issue_date: registration.certificate.issue_date,
                                    student: { name: studentName, usn: studentUsn, department: studentDepartment },
                                    event: event,
                                  })
                                }
                              >
                                🏆 Certificate
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* ================= MY CERTIFICATES ================= */}
          {activeMenu === "certificates" && (
            <section className="dashboard-section">
              <div className="section-header">
                <div>
                  <p className="section-kicker">Honors & Proof</p>
                  <h2>My Participation Certificates</h2>
                  <p>Certificates issued for completed events you attended.</p>
                </div>
              </div>

              {certificatesLoading && (
                <div className="empty-state">
                  <p>Loading certificates...</p>
                </div>
              )}

              {!certificatesLoading && certificates.length === 0 && (
                <div className="empty-state">
                  <div style={{ fontSize: "36px", marginBottom: "12px" }}>🏆</div>
                  <h3>No certificates issued yet</h3>
                  <p>When you attend events and the coordinator marks your attendance, your certificates will be issued here.</p>
                </div>
              )}

              {!certificatesLoading && certificates.length > 0 && (
                <div className="events-grid">
                  {certificates.map((cert) => (
                    <article className="event-card" key={cert.id} style={{ border: "2px solid #c084fc" }}>
                      <div className="event-card-content">
                        <span className="event-category" style={{ background: "#f3e8ff", color: "#7c3aed" }}>
                          Verified Certificate
                        </span>

                        <h3>{cert.event?.title}</h3>

                        <div className="event-details">
                          <p>📅 Event Date: {formatDate(cert.event?.event_date)}</p>
                          <p>📍 {cert.event?.venue}</p>
                          <p>📜 Certificate ID: <strong>{cert.certificate_id}</strong></p>
                          <p>⏱ Issued: {formatDate(cert.issue_date)}</p>
                        </div>

                        <button
                          type="button"
                          className="register-event-button"
                          style={{ background: "#7c3aed", color: "#fff", marginTop: "12px" }}
                          onClick={() => setSelectedCertificate(cert)}
                        >
                          View & Download Certificate →
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ================= NOTIFICATIONS ================= */}
          {activeMenu === "notifications" && (
            <section className="browse-events-section">
              <div className="browse-events-header">
                <div>
                  <h2>Notifications</h2>
                  <p>Real-time campus updates, registration confirmations, and attendance notices.</p>
                </div>
              </div>

              {notificationsLoading && (
                <div className="empty-state">
                  <p>Loading notifications...</p>
                </div>
              )}

              {!notificationsLoading && notifications.length === 0 && (
                <div className="empty-events standalone">
                  <div aria-hidden="true">🔔</div>
                  <h3>No notifications yet</h3>
                  <p>Announcements, event reminders, and attendance confirmations will appear here.</p>
                </div>
              )}

              {!notificationsLoading && notifications.length > 0 && (
                <div style={{ maxWidth: "720px", margin: "20px auto 0" }}>
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`notification-card ${!notif.is_read ? "unread" : ""}`}
                    >
                      <div className="notification-header">
                        <h4>{notif.title}</h4>
                        <span className="notification-time">
                          {new Date(notif.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p style={{ margin: "6px 0 12px", color: "var(--text)" }}>{notif.message}</p>
                      {!notif.is_read && (
                        <button
                          type="button"
                          className="table-action-button"
                          onClick={() => markNotificationRead(notif.id)}
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ================= PROFILE ================= */}
          {activeMenu === "profile" && (
            <section className="browse-events-section">
              <div className="browse-events-header">
                <div>
                  <h2>Student Profile</h2>
                  <p>Your academic registration and event participation record.</p>
                </div>
              </div>

              <div className="profile-panel">
                <div className="student-avatar large">{studentInitials}</div>
                <div className="profile-fields">
                  <div><span>Name</span><strong>{studentName}</strong></div>
                  <div><span>USN</span><strong>{studentUsn}</strong></div>
                  <div><span>Department</span><strong>{studentDepartment}</strong></div>
                  <div><span>Year</span><strong>Year {student?.year || "N/A"}</strong></div>
                  <div><span>Email</span><strong>{student?.email || "Not available"}</strong></div>
                  <div><span>Phone</span><strong>{student?.phone || "Not available"}</strong></div>
                  <div><span>Events Registered</span><strong>{registrations.length}</strong></div>
                  <div><span>Events Attended</span><strong>{attendedCount}</strong></div>
                  <div><span>Certificates Earned</span><strong>{certificates.length}</strong></div>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>

      {/* ================= QR MODAL ================= */}
      {selectedRegistration && (
        <div
          className="qr-modal-backdrop"
          onClick={() => setSelectedRegistration(null)}
        >
          <div
            className="qr-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="qr-modal-close"
              onClick={() => setSelectedRegistration(null)}
            >
              ×
            </button>

            <h2>{selectedRegistration.event?.title}</h2>

            <p>
              Present this event QR code to your coordinator.
              <br />
              <small style={{ color: "#7c3aed" }}>
                Attendance will only be marked when verified by the coordinator.
              </small>
            </p>

            {selectedRegistration.qr_token ? (
              <>
                <div className="qr-code-container">
                  <QRCodeCanvas
                    value={selectedRegistration.qr_token}
                    size={240}
                    includeMargin
                  />
                </div>
                <p>
                  QR token:{" "}
                  <code style={{ overflowWrap: "anywhere" }}>
                    {selectedRegistration.qr_token}
                  </code>
                </p>
              </>
            ) : (
              <p role="alert">
                A QR token is not available for this registration. Refresh the
                page or contact an administrator.
              </p>
            )}

            <p className="qr-attendance-status">
              Attendance Status:{" "}
              <span className={selectedRegistration.attendance_status === "present" ? "badge-present" : "badge-absent"}>
                {selectedRegistration.attendance_status === "present"
                  ? "✓ Present"
                  : "Not Marked"}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* ================= CERTIFICATE VIEWER MODAL ================= */}
      {selectedCertificate && (
        <div
          className="cert-modal-backdrop"
          onClick={() => setSelectedCertificate(null)}
        >
          <div
            className="cert-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="qr-modal-close"
              onClick={() => setSelectedCertificate(null)}
            >
              ×
            </button>

            <div className="cert-header">
              <p className="cert-institution">Campus Event Management System</p>
              <h2 className="cert-title">Certificate of Participation</h2>
              <p className="cert-subtitle">This certificate is awarded in recognition of active participation.</p>
            </div>

            <div className="cert-body">
              <p className="cert-presented-to">This is proudly presented to</p>
              <h1 className="cert-student-name">{selectedCertificate.student?.name || studentName}</h1>
              <p className="cert-student-meta">
                USN: {selectedCertificate.student?.usn || studentUsn} · Department of {selectedCertificate.student?.department || studentDepartment}
              </p>

              <p className="cert-for">
                For successful participation in <strong>{selectedCertificate.event?.title}</strong>,
                organized by <strong>{selectedCertificate.event?.organizer || "Campus Event Committee"}</strong> on{" "}
                <strong>{formatDate(selectedCertificate.event?.event_date)}</strong> at{" "}
                <strong>{selectedCertificate.event?.venue}</strong>.
              </p>
            </div>

            <div className="cert-footer-grid">
              <div className="cert-info-block">
                <span>Certificate ID</span>
                <strong>{selectedCertificate.certificate_id}</strong>
                <span style={{ marginTop: "4px" }}>Issue Date</span>
                <strong>{formatDate(selectedCertificate.issue_date)}</strong>
              </div>

              <div className="cert-seal">
                Official<br />Seal
              </div>
            </div>

            <div className="cert-modal-actions">
              <button
                type="button"
                className="cert-print-btn"
                onClick={() => window.print()}
              >
                🖨 Print / Save Certificate
              </button>

              <button
                type="button"
                className="cert-close-btn"
                onClick={() => setSelectedCertificate(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudentDashboard;
