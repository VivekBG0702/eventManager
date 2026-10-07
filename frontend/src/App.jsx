import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import StudentDashboard from "./pages/StudentDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import CreateEvent from "./pages/CreateEvent";
import CoordinatorManagement from "./pages/ManageCoordinators";
import CoordinatorDashboard from "./pages/CoordinatorDashboard";
import EventRegisteredStudents from "./pages/EventRegisteredStudents";
import ProtectedRoute from "./components/ProtectedRoute";

import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/home" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected Student Portal */}
        <Route
          path="/student-dashboard"
          element={
            <ProtectedRoute allowedRoles={["student"]}>
              <StudentDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student"
          element={<Navigate to="/student-dashboard" replace />}
        />

        {/* Protected Coordinator Portal */}
        <Route
          path="/coordinator-dashboard"
          element={
            <ProtectedRoute allowedRoles={["coordinator"]}>
              <CoordinatorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/coordinator"
          element={<Navigate to="/coordinator-dashboard" replace />}
        />

        <Route
          path="/coordinator/events/:eventId/students"
          element={
            <ProtectedRoute allowedRoles={["coordinator"]}>
              <EventRegisteredStudents />
            </ProtectedRoute>
          }
        />

        {/* Protected Admin Portal */}
        <Route
          path="/admin-dashboard"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={<Navigate to="/admin-dashboard" replace />}
        />
        <Route
          path="/admin/manage-coordinators"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <CoordinatorManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/create-event"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <CreateEvent />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/events/:eventId/students"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <EventRegisteredStudents />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;