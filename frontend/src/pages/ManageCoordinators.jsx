import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL, getAuthHeaders } from "../utils/auth";

function ManageCoordinators() {
  const navigate = useNavigate();

  const [coordinators, setCoordinators] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [showForm, setShowForm] =
    useState(false);

  const [form, setForm] = useState({
    name: "",
    coordinator_id: "",
    email: "",
    department: "",
    phone: "",
    password: "",
  });

  const [saving, setSaving] =
    useState(false);

  /*
   * Load coordinators from backend
   */
  const fetchCoordinators = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/coordinators/`,
        { headers: getAuthHeaders() }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.detail ||
            "Failed to load coordinators."
        );
      }

      setCoordinators(
        result.coordinators || []
      );

    } catch (error) {
      console.error(error);

      setError(
        error.message ||
          "Unable to load coordinators."
      );

    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoordinators();
  }, []);

  const handleDeleteCoordinator = async (id, name) => {
    if (!window.confirm(`Are you sure you want to remove coordinator '${name}'?`)) return;
    try {
      const response = await fetch(`${API_URL}/coordinators/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to delete coordinator.");
      alert("Coordinator removed successfully.");
      fetchCoordinators();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === "active" ? "pending" : "active";
    try {
      const response = await fetch(`${API_URL}/coordinators/${id}/status`, {
        method: "PUT",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) throw new Error("Failed to update status.");
      fetchCoordinators();
    } catch (err) {
      alert(err.message);
    }
  };

  /*
   * Handle form input
   */
  const handleChange = (event) => {
    const {
      name,
      value,
    } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  /*
   * Create coordinator
   */
  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");

      const response = await fetch(
        `${API_URL}/coordinators/`,
        {
          method: "POST",
          headers: getAuthHeaders({
            "Content-Type": "application/json",
          }),
          body: JSON.stringify(form),
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.detail ||
            "Failed to create coordinator."
        );
      }

      alert(
        "Coordinator created successfully."
      );

      setForm({
        name: "",
        coordinator_id: "",
        email: "",
        department: "",
        phone: "",
        password: "",
      });

      setShowForm(false);

      await fetchCoordinators();

    } catch (error) {
      console.error(error);

      setError(
        error.message ||
          "Unable to create coordinator."
      );

    } finally {
      setSaving(false);
    }
  };

  /*
   * Search coordinators
   */
  const filteredCoordinators =
    coordinators.filter(
      (coordinator) => {
        const searchText =
          search.toLowerCase();

        return (
          coordinator.name
            .toLowerCase()
            .includes(searchText) ||

          coordinator.coordinator_id
            .toLowerCase()
            .includes(searchText) ||

          coordinator.email
            .toLowerCase()
            .includes(searchText) ||

          coordinator.department
            .toLowerCase()
            .includes(searchText)
        );
      }
    );

  return (
    <div className="admin-page">

      <div className="admin-content">

        {/* HEADER */}

        <div className="page-header">

          <div>
            <p className="admin-kicker">
              ADMINISTRATION
            </p>

            <h1>
              Manage Coordinators
            </h1>

            <p>
              Add and manage event
              coordinators.
            </p>
          </div>

          <div className="page-header-actions">

            <button
              className="admin-secondary-button"
              onClick={() =>
                navigate(
                  "/admin-dashboard"
                )
              }
            >
              ← Dashboard
            </button>

            <button
              className="admin-primary-button"
              onClick={() =>
                setShowForm(
                  (current) =>
                    !current
                )
              }
            >
              {showForm
                ? "Cancel"
                : "+ Add Coordinator"}
            </button>

          </div>

        </div>


        {/* ERROR */}

        {error && (
          <div className="form-error">
            {error}
          </div>
        )}


        {/* ADD COORDINATOR FORM */}

        {showForm && (

          <section className="admin-panel">

            <div className="admin-panel-header">

              <div>
                <h2>
                  Add Coordinator
                </h2>

                <p>
                  Create a coordinator
                  account.
                </p>
              </div>

            </div>

            <form
              className="create-event-form"
              onSubmit={handleSubmit}
            >

              <div className="form-row">

                <div className="form-group">

                  <label>
                    Full Name *
                  </label>

                  <input
                    name="name"
                    type="text"
                    value={form.name}
                    onChange={
                      handleChange
                    }
                    placeholder="Coordinator name"
                    required
                  />

                </div>


                <div className="form-group">

                  <label>
                    Coordinator ID *
                  </label>

                  <input
                    name="coordinator_id"
                    type="text"
                    value={
                      form.coordinator_id
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="C002"
                    required
                  />

                </div>

              </div>


              <div className="form-row">

                <div className="form-group">

                  <label>
                    Email *
                  </label>

                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={
                      handleChange
                    }
                    placeholder="coordinator@example.com"
                    required
                  />

                </div>


                <div className="form-group">

                  <label>
                    Phone
                  </label>

                  <input
                    name="phone"
                    type="text"
                    value={form.phone}
                    onChange={
                      handleChange
                    }
                    placeholder="9876543210"
                  />

                </div>

              </div>


              <div className="form-row">

                <div className="form-group">

                  <label>
                    Department *
                  </label>

                  <input
                    name="department"
                    type="text"
                    value={
                      form.department
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="EEE"
                    required
                  />

                </div>


                <div className="form-group">

                  <label>
                    Password *
                  </label>

                  <input
                    name="password"
                    type="password"
                    value={
                      form.password
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="Minimum 8 characters"
                    minLength="8"
                    required
                  />

                </div>

              </div>


              <div className="create-event-actions">

                <button
                  type="button"
                  className="cancel-button"
                  onClick={() =>
                    setShowForm(false)
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="admin-primary-button"
                  disabled={saving}
                >
                  {saving
                    ? "Creating..."
                    : "Create Coordinator"}
                </button>

              </div>

            </form>

          </section>
        )}


        {/* SEARCH */}

        <section className="admin-panel">

          <div className="admin-panel-header">

            <div>
              <h2>
                Coordinators
              </h2>

              <p>
                {coordinators.length} coordinator
                {coordinators.length !== 1
                  ? "s"
                  : ""}{" "}
                registered
              </p>
            </div>

            <div className="form-group">
              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search coordinators..."
              />
            </div>

          </div>


          {/* LOADING */}

          {loading && (
            <p className="empty">
              Loading coordinators...
            </p>
          )}


          {/* TABLE */}

          {!loading &&
            filteredCoordinators.length >
              0 && (

              <div className="admin-table-wrapper">

                <table className="admin-table">

                  <thead>
                    <tr>
                      <th>
                        Coordinator
                      </th>

                      <th>
                        ID
                      </th>

                      <th>
                        Department
                      </th>

                      <th>
                        Email
                      </th>

                      <th>
                        Phone
                      </th>

                      <th>
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>

                    {filteredCoordinators.map(
                      (coordinator) => (

                        <tr
                          key={
                            coordinator.id
                          }
                        >

                          <td>
                            <strong>
                              {
                                coordinator.name
                              }
                            </strong>
                          </td>

                          <td>
                            {
                              coordinator.coordinator_id
                            }
                          </td>

                          <td>
                            {
                              coordinator.department
                            }
                          </td>

                          <td>
                            {
                              coordinator.email
                            }
                          </td>

                          <td>
                            {
                              coordinator.phone ||
                              "—"
                            }
                          </td>

                          <td>
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button
                                className="table-action-button"
                                onClick={() =>
                                  alert(
                                    `Coordinator: ${coordinator.name}\nID: ${coordinator.coordinator_id}\nDepartment: ${coordinator.department}\nEmail: ${coordinator.email}\nStatus: ${coordinator.status || "active"}`
                                  )
                                }
                              >
                                View
                              </button>

                              <button
                                className="table-action-button"
                                style={{
                                  color: coordinator.status === "active" ? "#10b981" : "#f59e0b",
                                }}
                                onClick={() =>
                                  handleToggleStatus(coordinator.id, coordinator.status || "active")
                                }
                              >
                                {coordinator.status === "active" ? "Active" : "Pending"}
                              </button>

                              <button
                                className="table-action-button"
                                style={{ color: "#ef4444" }}
                                onClick={() =>
                                  handleDeleteCoordinator(coordinator.id, coordinator.name)
                                }
                              >
                                Delete
                              </button>
                            </div>
                          </td>

                        </tr>

                      )
                    )}

                  </tbody>

                </table>

              </div>
            )}


          {!loading &&
            filteredCoordinators.length ===
              0 && (

              <p className="empty">
                No coordinators found.
              </p>

            )}

        </section>

      </div>

    </div>
  );
}

export default ManageCoordinators;