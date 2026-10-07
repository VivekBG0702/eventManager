import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL, clearAuth, setAuth } from "../utils/auth";

function Login() {
  const navigate = useNavigate();

  const [role, setRole] = useState("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const isAdminLogin = role === "admin";
      const isCoordinatorLogin = role === "coordinator";
      const endpoint = isAdminLogin
        ? `${API_URL}/auth/admin/login`
        : isCoordinatorLogin
          ? `${API_URL}/coordinators/login`
          : `${API_URL}/auth/login`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.detail ||
            "Unable to log in. Please check your credentials."
        );
      }

      clearAuth();

      if (role === "admin") {
        setAuth(result.token, "admin", result.admin);
        setMessage(`Welcome back, ${result.admin.name}.`);
        navigate("/admin-dashboard");
        return;
      }

      if (role === "coordinator") {
        setAuth(result.token, "coordinator", result.coordinator);
        setMessage(`Welcome back, ${result.coordinator.name}.`);
        navigate("/coordinator-dashboard");
        return;
      }

      const student = result.user;
      setAuth(result.token, "student", student);
      setMessage(`Welcome back, ${student.name}.`);
      navigate("/student-dashboard");
    } catch (requestError) {
      console.error("Login error:", requestError);
      setError(
        requestError.message ||
          "Unable to reach the server. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        {/* Header */}
        <div className="login-header">
          <a href="/" className="login-logo">
            Event<span>Manager</span>
          </a>

          <p className="login-kicker">WELCOME BACK</p>

          <h1>
            Login to your
            <br />
            <span>campus.</span>
          </h1>

          <p>
            Access events, registrations, certificates and
            everything happening on campus.
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          <label>I am a</label>

          <div className="role-buttons">
            <button
              type="button"
              className={role === "student" ? "role active" : "role"}
              onClick={() => setRole("student")}
            >
              🎓 Student
            </button>

            <button
              type="button"
              className={role === "coordinator" ? "role active" : "role"}
              onClick={() => setRole("coordinator")}
            >
              📋 Coordinator
            </button>

            <button
              type="button"
              className={role === "admin" ? "role active" : "role"}
              onClick={() => setRole("admin")}
            >
              ⚙️ Admin
            </button>
          </div>

          {/* Email */}
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />

          {/* Password */}
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />

          {/* Error */}
          {error && (
            <p className="err" role="alert">
              {error}
            </p>
          )}

          {/* Success */}
          {message && (
            <p className="hint good-text" role="status">
              {message}
            </p>
          )}

          {/* Login button */}
          <button
            className="login-submit"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Logging in..." : "Login →"}
          </button>
        </form>

        {/* Register */}
        <p className="register-text">
          Don't have an account?
          <a href="/register"> Create one</a>
        </p>
      </div>
    </div>
  );
}

export default Login;