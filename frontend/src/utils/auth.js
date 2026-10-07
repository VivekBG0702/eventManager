const API_URL = import.meta.env.VITE_API_URL ?? "";

export { API_URL };

export function getAuth() {
  try {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    let user = null;

    if (role === "student") {
      user = JSON.parse(localStorage.getItem("student") || "null");
    } else if (role === "coordinator") {
      user = JSON.parse(localStorage.getItem("coordinator") || "null");
    } else if (role === "admin") {
      user = JSON.parse(localStorage.getItem("admin") || "null");
    }

    return { token, role, user };
  } catch {
    return { token: null, role: null, user: null };
  }
}

export function setAuth(token, role, user) {
  if (token) {
    localStorage.setItem("token", token);
  }
  if (role) {
    localStorage.setItem("role", role);
  }

  if (role === "student") {
    localStorage.setItem("student", JSON.stringify(user));
  } else if (role === "coordinator") {
    localStorage.setItem("coordinator", JSON.stringify(user));
  } else if (role === "admin") {
    localStorage.setItem("admin", JSON.stringify(user));
  }
}

export function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  localStorage.removeItem("student");
  localStorage.removeItem("coordinator");
  localStorage.removeItem("admin");
}

export function getAuthHeaders(extraHeaders = {}) {
  const token = localStorage.getItem("token");
  const headers = { ...extraHeaders };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}
