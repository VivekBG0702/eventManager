import { useState } from "react";
import { API_URL } from "../utils/auth";

const DEPTS = [
  ["EEE", "Electrical & Electronics Engineering"],
  ["ECE", "Electronics & Communication Engineering"],
  ["CSE", "Computer Science Engineering"],
  ["ISE", "Information Science Engineering"],
  ["ME", "Mechanical Engineering"],
  ["CE", "Civil Engineering"],
];

const YEARS = [["1", "1st Year"], ["2", "2nd Year"], ["3", "3rd Year"], ["4", "4th Year"]];

function strength(pw) {
  if (!pw) return { score: 0, label: "" };
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const score = Math.min(s, 4);
  return { score, label: ["", "Weak", "Fair", "Good", "Strong"][score] };
}

export default function Register() {
  const [show, setShow] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "", usn: "", email: "", department: "", year: "",
    phone: "", password: "", confirmPassword: "",
  });

  const pw = strength(form.password);
  const match = form.confirmPassword && form.password === form.confirmPassword;
  const mismatch = form.confirmPassword && !match;

  const fields = ["name", "usn", "email", "department", "year", "phone", "password", "confirmPassword"];
  const filled = fields.filter((f) => form[f].trim() !== "").length;
  const progress = Math.round((filled / fields.length) * 100);

  const change = (e) => {
    const { name, value } = e.target;
    setError("");
    setForm((p) => ({ ...p, [name]: value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError("Those two passwords don't match.");
      return;
    }
    const { confirmPassword: _confirmPassword, ...data } = form;

    setError("");
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.detail || "Unable to create your account. Please try again.");
      }
      setDone(true);
    } catch (requestError) {
      setError(requestError.message || "Unable to reach the server. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="reg-page">
        <div className="reg-card reg-done">
          <span className="stamp">Registered</span>
          <h1>You're in, {form.name.split(" ")[0] || "friend"}.</h1>
          <p className="lede">
            We've sent a confirmation to {form.email}. Verify it and your campus
            event feed is ready and waiting.
          </p>
          <a className="btn btn-pink" href="/login">Go to login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="reg-page">
      <aside className="reg-side">
        <a href="/" className="mark">Event<em>Manager</em></a>
        <h2>One account.<br />Every event on<br />campus.</h2>
        <ul className="perks">
          <li>Register in a single tap</li>
          <li>Reminders before things start</li>
          <li>Certificates collected in your profile</li>
        </ul>
        <p className="side-foot">College Event Manager · 2026</p>
      </aside>

      <div className="reg-main">
        <div className="reg-card">
          <p className="kicker">Join the campus</p>
          <h1>Create your <span>account.</span></h1>

          <div className="progress" aria-hidden="true">
            <i style={{ width: progress + "%" }} />
          </div>
          <p className="progress-note">{progress}% complete</p>

          <form onSubmit={submit} noValidate={false}>
            <label htmlFor="name">Full name</label>
            <input id="name" name="name" value={form.name} onChange={change}
              placeholder="Enter your full name" required />

            <label htmlFor="usn">USN</label>
            <input id="usn" name="usn" value={form.usn} onChange={change}
              placeholder="1XX23EE001" required />

            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" value={form.email}
              onChange={change} placeholder="you@example.com" required />

            <label htmlFor="department">Department</label>
            <select id="department" name="department" value={form.department}
              onChange={change} required>
              <option value="">Select department</option>
              {DEPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>

            <label htmlFor="year">Year</label>
            <select id="year" name="year" value={form.year} onChange={change} required>
              <option value="">Select year</option>
              {YEARS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>

            <label htmlFor="phone">Phone number</label>
            <input id="phone" name="phone" type="tel" value={form.phone}
              onChange={change} placeholder="Enter your phone number" required />

            <div className="label-row">
              <label htmlFor="password">Password</label>
              <button type="button" className="peek" onClick={() => setShow((s) => !s)}>
                {show ? "Hide" : "Show"}
              </button>
            </div>
            <input id="password" name="password" type={show ? "text" : "password"}
              value={form.password} onChange={change} placeholder="At least 8 characters"
              minLength={8} required />

            {form.password && (
              <div className="meter" data-score={pw.score}>
                <span /><span /><span /><span />
                <p>{pw.label}</p>
              </div>
            )}

            <label htmlFor="confirmPassword">Confirm password</label>
            <input id="confirmPassword" name="confirmPassword"
              type={show ? "text" : "password"} value={form.confirmPassword}
              onChange={change} placeholder="Type it once more"
              className={mismatch ? "bad" : match ? "good" : ""}
              minLength={8} required />
            {mismatch && <p className="hint bad-text">Passwords don't match yet.</p>}
            {match && <p className="hint good-text">Passwords match.</p>}

            <label className="terms">
              <input type="checkbox" required />
              <span>I agree to the terms and conditions</span>
            </label>

            {error && <p className="err" role="alert">{error}</p>}

            <button type="submit" className="btn btn-pink wide" disabled={isSubmitting}>
              {isSubmitting ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="alt">
            Already have an account? <a href="/login">Log in</a>
          </p>
        </div>
      </div>
    </div>
  );
}
