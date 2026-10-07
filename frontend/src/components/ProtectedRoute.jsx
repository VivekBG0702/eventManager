import { Navigate } from "react-router-dom";
import { getAuth } from "../utils/auth";

export default function ProtectedRoute({ allowedRoles, children }) {
  const { token, role, user } = getAuth();

  // If not logged in at all, redirect to login page
  if (!token && !user) {
    return <Navigate to="/login" replace />;
  }

  // If role is not allowed for this route, redirect to their role's dashboard
  if (allowedRoles && !allowedRoles.includes(role)) {
    if (role === "student") {
      return <Navigate to="/student-dashboard" replace />;
    }
    if (role === "coordinator") {
      return <Navigate to="/coordinator-dashboard" replace />;
    }
    if (role === "admin") {
      return <Navigate to="/admin-dashboard" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return children;
}
