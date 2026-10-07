import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import QrAttendanceScanner from "../components/QrAttendanceScanner";
import { apiErrorMessage } from "../utils/apiErrors";
import { API_URL, getAuth, getAuthHeaders } from "../utils/auth";

function formatTime(timeString) {
  if (!timeString) return "Time unavailable";
  const value = String(timeString);
  const [hours, minutes] = value.split(":");
  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0, 0);
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDate(dateString) {
  if (!dateString) return "Date unavailable";
  return new Date(`${String(dateString).slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function methodLabel(method) {
  if (method === "qr_scan") return "QR Scan";
  if (method === "manual") return "Manual";
  return "—";
}

function EventRegisteredStudents() {
  const { eventId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const auth = getAuth();
  const role = auth.role;
  const user = auth.user;
  const isCoordinator = role === "coordinator";
  const isAdmin = role === "admin";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [eventInfo, setEventInfo] = useState(null);
  const [summary, setSummary] = useState({
    total_registered: 0,
    present: 0,
    not_marked: 0,
    attendance_percentage: 0,
  });
  const [students, setStudents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, pages: 1 });
  const [departments, setDepartments] = useState([]);
  const [years, setYears] = useState([]);
  const [message, setMessage] = useState("");
  const [showScanner, setShowScanner] = useState(searchParams.get("scan") === "1");

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [year, setYear] = useState("all");
  const [attendanceFilter, setAttendanceFilter] = useState("all");
  const [page, setPage] = useState(1);

  const dashboardPath = isAdmin ? "/admin-dashboard" : "/coordinator-dashboard";

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, department, year, attendanceFilter]);

  const fetchStudents = async () => {
    if (!eventId) return;
    setLoading(true);
    setError("");

    const params = new URLSearchParams({
      page: String(page),
      limit: "25",
    });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (department !== "all") params.set("department", department);
    if (year !== "all") params.set("year", year);
    if (attendanceFilter !== "all") params.set("attendance_status", attendanceFilter);

    try {
      const response = await fetch(
        `${API_URL}/registrations/event/${eventId}?${params.toString()}`,
        { headers: getAuthHeaders() }
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(apiErrorMessage(response.status, result.detail, "Unable to load registered students."));
      }

      setEventInfo(result.event);
      setSummary(result.summary || {});
      setStudents(result.students || result.registrations || []);
      setPagination(result.pagination || { page: 1, limit: 25, total: 0, pages: 1 });
      setDepartments(result.filters?.departments || []);
      setYears(result.filters?.years || []);
    } catch (err) {
      setEventInfo(null);
      setStudents([]);
      setError(err.message || "Unable to load registered students.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [eventId, page, debouncedSearch, department, year, attendanceFilter]);

  const handleManualMark = async (registrationId) => {
    if (!window.confirm("Mark attendance as Present for this student?")) return;
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/registrations/attendance/manual`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          registration_id: registrationId,
          event_id: Number(eventId),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(apiErrorMessage(response.status, result.detail, "Could not mark attendance."));
      }
      setMessage(result.message || "Attendance marked successfully.");
      await fetchStudents();
    } catch (err) {
      setError(err.message || "Could not mark attendance.");
    }
  };

  const pageNumbers = useMemo(() => {
    const total = pagination.pages || 1;
    const current = pagination.page || 1;
    const start = Math.max(1, current - 2);
    const end = Math.min(total, start + 4);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [pagination.page, pagination.pages]);

  if (!user?.id || (!isAdmin && !isCoordinator)) {
    return <Navigate to="/login" replace />;
  }

  const startIndex = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endIndex = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="admin-page">
      <div className="admin-content">
        <div className="page-header">
          <div>
            <p className="admin-kicker">{isAdmin ? "ADMIN PORTAL" : "COORDINATOR PORTAL"}</p>
            <h1>Registered Students</h1>
            <p>Students registered for this event only. Registrations from other events are never mixed in.</p>
          </div>
          <div className="page-header-actions">
            <button type="button" className="admin-secondary-button" onClick={() => navigate(dashboardPath)}>
              ← Back to Dashboard
            </button>
            {isCoordinator && eventInfo && (
              <button
                type="button"
                className="admin-primary-button"
                onClick={() => setShowScanner(true)}
              >
                📷 Attendance Scanner
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="admin-panel">
            <div className="admin-empty-state">
              <div className="admin-empty-icon">⚠️</div>
              <h3>Unable to load registered students</h3>
              <p>{error}</p>
            </div>
          </div>
        )}

        {!error && eventInfo && (
          <section className="admin-panel">
            <div className="admin-panel-header">
              <div>
                <p className="admin-kicker">EVENT</p>
                <h2>{eventInfo.title}</h2>
                <p>
                  📅 {formatDate(eventInfo.event_date || eventInfo.date)} · 🕐 {formatTime(eventInfo.start_time)} – {formatTime(eventInfo.end_time)} · 📍 {eventInfo.venue}
                </p>
              </div>
            </div>

            <div className="event-meta-grid">
              <div><span>Category</span><strong>{eventInfo.category || "—"}</strong></div>
              <div><span>Registration deadline</span><strong>{formatDate(eventInfo.registration_deadline)}</strong></div>
              <div><span>Capacity</span><strong>{eventInfo.capacity}</strong></div>
              {isAdmin && (
                <div><span>Coordinator</span><strong>{eventInfo.coordinator?.name || "Unassigned"}</strong></div>
              )}
            </div>

            <div className="reg-stats-grid">
              <div className="reg-stat">
                <span>Total Registered</span>
                <strong>{summary.total_registered ?? summary.total_registrations ?? 0}</strong>
              </div>
              <div className="reg-stat present">
                <span>Present</span>
                <strong>{summary.present ?? summary.present_count ?? 0}</strong>
              </div>
              <div className="reg-stat absent">
                <span>Not Marked</span>
                <strong>{summary.not_marked ?? summary.absent_count ?? 0}</strong>
              </div>
              <div className="reg-stat rate">
                <span>Attendance %</span>
                <strong>{summary.attendance_percentage ?? 0}%</strong>
              </div>
            </div>
          </section>
        )}

        {!error && (
          <section className="admin-panel">
            <div className="admin-panel-header">
              <div>
                <p className="admin-kicker">EVENT-SPECIFIC LIST</p>
                <h2>Students registered for this event</h2>
              </div>
            </div>

            {message && (
              <div className="reg-success">{message}</div>
            )}

            <div className="reg-filters">
              <input
                type="search"
                placeholder="Search by name, USN, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select value={department} onChange={(e) => setDepartment(e.target.value)}>
                <option value="all">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
              <select value={year} onChange={(e) => setYear(e.target.value)}>
                <option value="all">All Years</option>
                {years.map((yr) => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
              <div className="attendance-filter-pills">
                {[
                  ["all", "All"],
                  ["present", "Present"],
                  ["not_marked", "Not Marked"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={attendanceFilter === value ? "filter-pill active" : "filter-pill"}
                    onClick={() => setAttendanceFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="admin-empty-state">
                <div className="admin-spinner" aria-hidden="true" />
                <p>Loading registered students...</p>
              </div>
            ) : students.length === 0 ? (
              <div className="admin-empty-state">
                <div className="admin-empty-icon">🎓</div>
                <h3>No students have registered for this event yet.</h3>
                <p>
                  {debouncedSearch || department !== "all" || year !== "all" || attendanceFilter !== "all"
                    ? "No matching students in this event. Try a different search or filter."
                    : "When students register, they will appear here for this event only."}
                </p>
              </div>
            ) : (
              <>
                <div className="admin-table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>USN</th>
                        <th>Email</th>
                        <th>Department</th>
                        <th>Year</th>
                        <th>Phone</th>
                        <th>Registered</th>
                        <th>Status</th>
                        <th>Attendance</th>
                        <th>Marked At</th>
                        <th>Method</th>
                        {isCoordinator && <th>Action</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((st) => {
                        const isPresent = st.attendance_status === "present";
                        return (
                          <tr key={st.registration_id || st.id}>
                            <td><strong>{st.name || st.student_name}</strong></td>
                            <td>{st.usn || st.student_usn}</td>
                            <td>{st.email || st.student_email || "—"}</td>
                            <td>{st.department || st.student_department || "—"}</td>
                            <td>{st.year || st.student_year || "—"}</td>
                            <td>{st.phone || st.student_phone || "—"}</td>
                            <td>{formatDateTime(st.registered_at)}</td>
                            <td>{st.registration_status || st.status || "registered"}</td>
                            <td>
                              <span className={isPresent ? "badge-present" : "badge-absent"}>
                                {isPresent ? "✓ Present" : "Not Marked"}
                              </span>
                            </td>
                            <td>{formatDateTime(st.attendance_marked_at)}</td>
                            <td>{methodLabel(st.attendance_method)}</td>
                            {isCoordinator && (
                              <td>
                                {!isPresent ? (
                                  <button
                                    type="button"
                                    className="table-action-button"
                                    onClick={() => handleManualMark(st.registration_id || st.id)}
                                  >
                                    Mark Present
                                  </button>
                                ) : (
                                  <small style={{ color: "#059669" }}>✓ Verified</small>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="pagination-bar">
                  <span>
                    Showing {startIndex}–{endIndex} of {pagination.total} students
                  </span>
                  <div className="pagination-controls">
                    <button
                      type="button"
                      className="table-action-button"
                      disabled={pagination.page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </button>
                    {pageNumbers.map((num) => (
                      <button
                        key={num}
                        type="button"
                        className={num === pagination.page ? "page-btn active" : "page-btn"}
                        onClick={() => setPage(num)}
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="table-action-button"
                      disabled={pagination.page >= pagination.pages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        )}
      </div>

      {showScanner && isCoordinator && eventInfo && (
        <QrAttendanceScanner
          event={{ id: Number(eventId), title: eventInfo.title }}
          onClose={() => {
            setShowScanner(false);
            if (searchParams.get("scan") === "1") {
              searchParams.delete("scan");
              setSearchParams(searchParams, { replace: true });
            }
          }}
          onAttendanceMarked={(result) => {
            setMessage(`✓ Attendance marked for ${result.attendance?.student_name || "student"}!`);
            fetchStudents();
          }}
        />
      )}
    </div>
  );
}

export default EventRegisteredStudents;
