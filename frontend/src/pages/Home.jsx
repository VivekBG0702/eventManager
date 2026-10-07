import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";

import { API_URL, getAuth, getAuthHeaders } from "../utils/auth";

const FILTERS = [
  "All",
  "Technology",
  "Workshop",
  "Hackathon",
  "Cultural",
  "Sports",
  "Academic",
  "Other",
];

function useReveal() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;

    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.dataset.shown = "true";
          io.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    io.observe(el);

    return () => io.disconnect();
  }, []);

  return ref;
}

function formatDate(dateString) {
  if (!dateString) {
    return {
      day: "",
      mon: "",
    };
  }

  const date = new Date(`${dateString}T00:00:00`);

  return {
    day: date
      .getDate()
      .toString()
      .padStart(2, "0"),

    mon: date.toLocaleDateString(
      "en-US",
      {
        month: "short",
      }
    ),
  };
}

function formatTime(timeString) {
  if (!timeString) {
    return "";
  }

  const [hours, minutes] =
    timeString.split(":");

  const date = new Date();

  date.setHours(
    Number(hours),
    Number(minutes),
    0,
    0
  );

  return date.toLocaleTimeString(
    "en-US",
    {
      hour: "numeric",
      minute: "2-digit",
    }
  );
}

function Home() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState("All");
  const [registered, setRegistered] = useState([]);
  const auth = getAuth();
  const [isLoggedIn, setIsLoggedIn] = useState(Boolean(auth.user));
  const [open, setOpen] = useState(null);
  const [registrationEvent, setRegistrationEvent] = useState(null);
  const [registrationDone, setRegistrationDone] = useState(false);
  const [registrationError, setRegistrationError] = useState("");
  const [isSubmittingReg, setIsSubmittingReg] = useState(false);
  const [registrationForm, setRegistrationForm] = useState({
    name: "",
    usn: "",
    email: "",
    department: "",
    year: "",
    phone: "",
  });
  const [menu, setMenu] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /*
   * Load student registrations if logged in
   */
  useEffect(() => {
    const currentAuth = getAuth();
    if (currentAuth.role === "student" && currentAuth.user?.id) {
      fetch(`${API_URL}/registrations/me`, {
        headers: getAuthHeaders(),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.registrations) {
            setRegistered(data.registrations.map((r) => r.event_id));
          }
        })
        .catch(() => {});
    }
  }, []);

  /*
   * Load events from FastAPI
   */
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `${API_URL}/events/`
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.detail ||
              "Failed to load events."
          );
        }

        setEvents(result.events || []);
      } catch (error) {
        console.error(error);

        setError(
          error.message ||
            "Unable to load events."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  /*
   * Filter events
   */
  const shown =
    filter === "All"
      ? events
      : events.filter(
          (event) =>
            event.category === filter
        );

  const startRegistration = (event) => {
    const currentAuth = getAuth();
    const student = currentAuth.role === "student" ? currentAuth.user : null;

    if (!student) {
      navigate(`/login`);
      return;
    }

    setIsLoggedIn(true);
    setRegistrationForm({
      name: student.name || "",
      usn: student.usn || "",
      email: student.email || "",
      department: student.department || "",
      year: student.year || "",
      phone: student.phone || "",
    });
    setRegistrationEvent(event);
    setRegistrationDone(false);
    setRegistrationError("");
    setOpen(null);
  };

  const completeRegistration = async (event) => {
    const currentAuth = getAuth();
    const student = currentAuth.role === "student" ? currentAuth.user : null;

    if (!student?.id) {
      navigate("/login");
      return;
    }

    setRegistrationError("");
    setIsSubmittingReg(true);

    try {
      const response = await fetch(`${API_URL}/registrations/`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          event_id: event.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "Registration failed.");
      }

      setRegistered((current) =>
        current.includes(event.id) ? current : [...current, event.id]
      );
      setRegistrationDone(true);
    } catch (err) {
      setRegistrationError(err.message || "Registration failed.");
    } finally {
      setIsSubmittingReg(false);
    }
  };

  /*
   * Close modal using Escape key
   */
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") {
        setOpen(null);
      }
    };

    window.addEventListener(
      "keydown",
      onKey
    );

    return () => {
      window.removeEventListener(
        "keydown",
        onKey
      );
    };
  }, []);

  const eventsRef = useReveal();
  const aboutRef = useReveal();

  return (
    <div className="app">

      {/* ================= NAVBAR ================= */}

      <header className="nav">

        <Link className="mark" to="/">
          Event<em>Manager</em>
        </Link>

        <nav
          className={
            menu
              ? "links open"
              : "links"
          }
          onClick={() => setMenu(false)}
        >
          <a href="#events">
            Events
          </a>

          <a href="#how">
            How it works
          </a>

          <a href="#about">
            About
          </a>
        </nav>

        <div className="nav-right">
          {isLoggedIn ? (
            <Link
              className="btn btn-pink"
              to={
                auth.role === "admin"
                  ? "/admin-dashboard"
                  : auth.role === "coordinator"
                    ? "/coordinator-dashboard"
                    : "/student-dashboard"
              }
            >
              My Dashboard →
            </Link>
          ) : (
            <>
              <Link className="btn btn-ink" to="/login">
                Log in
              </Link>
              <Link className="btn btn-pink" to="/register">
                Register
              </Link>
            </>
          )}

          <button
            className="burger"
            aria-label="Menu"
            aria-expanded={menu}
            onClick={() =>
              setMenu(
                (current) => !current
              )
            }
          >
            <span />
            <span />
            <span />
          </button>

        </div>

      </header>


      {/* ================= HERO ================= */}

      <section
        className="hero"
        id="top"
      >

        <div className="hero-type">

          <p className="kicker">
            Campus noticeboard, minus the
            staples
          </p>

          <h1>
            <span className="l1">
              Everything
            </span>

            <span className="l2">
              happening
            </span>

            <span className="l3">
              on campus
            </span>
          </h1>

          <p className="lede">
            Hackathons, workshops, fests
            and talks from every department,
            collected in one place. Find
            something this week and register
            in two taps.
          </p>

          <div className="hero-actions">

            <a
              className="btn btn-pink"
              href="#events"
            >
              Browse events
            </a>

            <a
              className="btn btn-ghost"
              href="#how"
            >
              Run an event
            </a>

          </div>

        </div>


        {/* ================= HERO EVENT FLYERS ================= */}

        <div
          className="flyers"
          aria-hidden="true"
        >

          {events
            .slice(0, 3)
            .map((event, index) => {

              const date =
                formatDate(
                  event.event_date
                );

              return (
                <article
                  className={`flyer f${index}`}
                  key={event.id}
                >

                  <span className="flyer-cat">
                    {event.category}
                  </span>

                  <p className="flyer-date">
                    {date.day}
                    <i>
                      {date.mon}
                    </i>
                  </p>

                  <h3>
                    {event.title}
                  </h3>

                  <p className="flyer-place">
                    {event.venue}
                  </p>

                  <span className="pin" />

                </article>
              );
            })}

        </div>

      </section>


      {/* ================= TICKER ================= */}

      <div
        className="ticker"
        aria-hidden="true"
      >

        <div className="ticker-track">

          {[0, 1].map((key) => (

            <span key={key}>

              {events.map((event) => {

                const date =
                  formatDate(
                    event.event_date
                  );

                return (
                  <b key={event.id}>
                    {event.title}

                    <i>·</i>

                    {date.day}{" "}
                    {date.mon}

                    <i>·</i>
                  </b>
                );
              })}

            </span>

          ))}

        </div>

      </div>


      {/* ================= EVENTS ================= */}

      <section
        className="events"
        id="events"
        ref={eventsRef}
      >

        <div className="events-head">

          <h2>
            This month
          </h2>

          <div
            className="filters"
            role="tablist"
          >

            {FILTERS.map((item) => (

              <button
                key={item}
                role="tab"
                aria-selected={
                  filter === item
                }
                className={
                  filter === item
                    ? "chip on"
                    : "chip"
                }
                onClick={() =>
                  setFilter(item)
                }
              >
                {item}
              </button>

            ))}

          </div>

        </div>


        {/* ================= LOADING ================= */}

        {loading && (
          <p className="empty">
            Loading events...
          </p>
        )}


        {/* ================= ERROR ================= */}

        {!loading && error && (
          <p className="empty">
            {error}
          </p>
        )}


        {/* ================= EVENT GRID ================= */}

        {!loading &&
          !error &&
          shown.length > 0 && (

            <div className="grid">

              {shown.map((event) => {

                const date =
                  formatDate(
                    event.event_date
                  );

                const startTime =
                  formatTime(
                    event.start_time
                  );

                const endTime =
                  formatTime(
                    event.end_time
                  );

                return (
                  <article
                    className="stub"
                    key={event.id}
                  >

                    <div className="stub-main">

                      <span
                        className={`cat cat-${event.category.toLowerCase()}`}
                      >
                        {event.category}
                      </span>

                      <h3>
                        {event.title}
                      </h3>

                      <p className="meta">
                        {event.venue}
                      </p>

                      <p className="meta">
                        {startTime} –{" "}
                        {endTime}
                      </p>

                      <button
                        className="link"
                        onClick={() =>
                          setOpen(event)
                        }
                      >
                        Full details
                      </button>

                    </div>


                    <div className="stub-tear">

                      <p className="stub-date">
                        {date.day}

                        <i>
                          {date.mon}
                        </i>
                      </p>

                      <button
                        className={
                          isLoggedIn && registered.includes(event.id)
                            ? "save on"
                            : "save"
                        }
                        onClick={() =>
                          startRegistration(event)
                        }
                      >
                        {isLoggedIn && registered.includes(event.id)
                          ? "Registered"
                          : "Register"}
                      </button>

                    </div>

                  </article>
                );
              })}

            </div>
          )}


        {/* ================= EMPTY ================= */}

        {!loading &&
          !error &&
          shown.length === 0 && (

            <p className="empty">
              {events.length === 0
                ? "No events have been created yet."
                : "Nothing in this category yet. Try another."}
            </p>

          )}

      </section>


      {/* ================= HOW IT WORKS ================= */}

      <section
        className="how"
        id="how"
      >

        <h2>
          Three steps, start to certificate
        </h2>

        <ol className="steps">

          <li>
            <strong>
              Find it
            </strong>

            <p>
              Filter by department, type
              or date and see what's
              actually open.
            </p>
          </li>

          <li>
            <strong>
              Register
            </strong>

            <p>
              Register in one tap and add
              the event to your list.
            </p>
          </li>

          <li>
            <strong>
              Collect the proof
            </strong>

            <p>
              Attendance and certificates
              land in your profile after it
              ends.
            </p>
          </li>

        </ol>

      </section>


      {/* ================= ABOUT ================= */}

      <section
        className="about"
        id="about"
        ref={aboutRef}
      >

        <h2>
          Built for students,
          coordinators and staff alike.
        </h2>

        <p>
          Coordinators post once and reach
          the whole campus. Students stop
          digging through WhatsApp forwards.
          Administrators see attendance
          without chasing spreadsheets.
        </p>

      </section>


      {/* ================= FOOTER ================= */}

      <footer className="foot">

        <Link
          className="mark"
          to="/"
        >
          Event<em>Manager</em>
        </Link>

        <p>
          College Event Manager · 2026
        </p>

      </footer>


      {/* ================= EVENT MODAL ================= */}

      {open && (

        <div
          className="modal-wrap"
          onClick={() =>
            setOpen(null)
          }
        >

          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <button
              className="close"
              onClick={() =>
                setOpen(null)
              }
              aria-label="Close"
            >
              ×
            </button>


            {/* EVENT IMAGE */}

            {open.intro_image && (
              <img
                src={`${API_URL}/${open.intro_image}`}
                alt={open.title}
                className="event-modal-image"
              />
            )}


            <span
              className={`cat cat-${open.category.toLowerCase()}`}
            >
              {open.category}
            </span>

            <h3>
              {open.title}
            </h3>

            <p className="modal-when">

              {formatDate(
                open.event_date
              ).day}{" "}

              {formatDate(
                open.event_date
              ).mon}

              {" · "}

              {formatTime(
                open.start_time
              )}

              {" – "}

              {formatTime(
                open.end_time
              )}

            </p>

            <p>
              {open.description}
            </p>

            <p className="meta">
              {open.venue} ·{" "}
              {open.capacity} seats
            </p>

            <p className="meta">
              Organizer:{" "}
              {open.organizer}
            </p>

            <button
              className={
                isLoggedIn && registered.includes(open.id)
                  ? "btn btn-ink"
                  : "btn btn-pink"
              }
              onClick={() =>
                startRegistration(open)
              }
            >
              {isLoggedIn && registered.includes(open.id)
                ? "Registered"
                : "Register for this event"}
            </button>

          </div>

        </div>

      )}

      {registrationEvent && (
        <div
          className="modal-wrap"
          onClick={() => setRegistrationEvent(null)}
        >
          <div
            className="modal registration-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="close"
              onClick={() => setRegistrationEvent(null)}
              aria-label="Close"
            >
              ×
            </button>

            {registrationDone ? (
              <>
                <span className="stamp">Registered</span>
                <h3>You are registered.</h3>
                <p>
                  Your spot for {registrationEvent.title} is confirmed.
                </p>
                <button
                  className="btn btn-pink"
                  onClick={() => setRegistrationEvent(null)}
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <p className="kicker">Event registration</p>
                <h3>{registrationEvent.title}</h3>
                <p className="meta">
                  {registrationEvent.venue} · {formatDate(registrationEvent.event_date).day} {formatDate(registrationEvent.event_date).mon}
                </p>

                <form
                  className="registration-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    completeRegistration(registrationEvent);
                  }}
                >
                  {[
                    ["name", "Full name"],
                    ["usn", "USN"],
                    ["email", "Email"],
                    ["department", "Department"],
                    ["year", "Year"],
                    ["phone", "Phone number"],
                  ].map(([field, label]) => (
                    <label key={field}>
                      {label}
                      <input
                        name={field}
                        type={field === "email" ? "email" : "text"}
                        value={registrationForm[field]}
                        onChange={(event) =>
                          setRegistrationForm((current) => ({
                            ...current,
                            [field]: event.target.value,
                          }))
                        }
                        required
                      />
                    </label>
                  ))}

                  {registrationError && (
                    <p className="err" role="alert" style={{ color: "#ef4444", margin: "10px 0" }}>
                      {registrationError}
                    </p>
                  )}

                  <button className="btn btn-pink" type="submit" disabled={isSubmittingReg}>
                    {isSubmittingReg ? "Registering..." : "Confirm registration"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

export default Home;
