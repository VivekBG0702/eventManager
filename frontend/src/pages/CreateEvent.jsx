import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL, getAuthHeaders } from "../utils/auth";

function CreateEvent() {
  const navigate = useNavigate();

  // -----------------------------------------
  // Coordinator state
  // -----------------------------------------

  const [coordinators, setCoordinators] = useState([]);
  const [loadingCoordinators, setLoadingCoordinators] =
    useState(true);

  // -----------------------------------------
  // Event form state
  // -----------------------------------------

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    eventDate: "",
    startTime: "",
    endTime: "",
    venue: "",
    organizer: "",
    coordinatorId: "",
    capacity: "",
    registrationDeadline: "",
    introImage: null,
  });

  // -----------------------------------------
  // Other state
  // -----------------------------------------

  const [imagePreview, setImagePreview] = useState("");
  const [error, setError] = useState("");

  // -----------------------------------------
  // Fetch coordinators
  // -----------------------------------------

  useEffect(() => {
    const fetchCoordinators = async () => {
      try {
        const response = await fetch(
          `${API_URL}/coordinators/`,
          { headers: getAuthHeaders() }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.detail ||
              "Failed to load coordinators."
          );
        }

        setCoordinators(result.coordinators);
      } catch (error) {
        console.error(error);

        setError(
          error.message ||
            "Unable to load coordinators."
        );
      } finally {
        setLoadingCoordinators(false);
      }
    };

    fetchCoordinators();
  }, []);

  // -----------------------------------------
  // Handle normal input changes
  // -----------------------------------------

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  // -----------------------------------------
  // Handle image selection
  // -----------------------------------------

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    // Check image type
    if (!allowedTypes.includes(file.type)) {
      setError(
        "Please select a JPG, PNG, or WEBP image."
      );

      return;
    }

    // Check image size
    if (file.size > 5 * 1024 * 1024) {
      setError(
        "Image size must not exceed 5 MB."
      );

      return;
    }

    setError("");

    setForm((previous) => ({
      ...previous,
      introImage: file,
    }));

    setImagePreview(
      URL.createObjectURL(file)
    );
  };

  // -----------------------------------------
  // Submit event
  // -----------------------------------------

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");

    // Make sure coordinator is selected
    if (!form.coordinatorId) {
      setError(
        "Please select a coordinator."
      );

      return;
    }

    // Create multipart form data
    const formData = new FormData();

    formData.append(
      "title",
      form.title
    );

    formData.append(
      "description",
      form.description
    );

    formData.append(
      "category",
      form.category
    );

    formData.append(
      "event_date",
      form.eventDate
    );

    formData.append(
      "start_time",
      form.startTime
    );

    formData.append(
      "end_time",
      form.endTime
    );

    formData.append(
      "venue",
      form.venue
    );

    formData.append(
      "organizer",
      form.organizer
    );

    // Coordinator selected from dropdown
    formData.append(
      "coordinator_id",
      form.coordinatorId
    );

    formData.append(
      "capacity",
      form.capacity
    );

    formData.append(
      "registration_deadline",
      form.registrationDeadline
    );

    // Add image only if selected
    if (form.introImage) {
      formData.append(
        "intro_image",
        form.introImage
      );
    }

    try {
      const response = await fetch(
        `${API_URL}/events/`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.detail ||
            "Failed to create event."
        );
      }

      alert(
        "Event created successfully!"
      );

      navigate("/admin-dashboard");

    } catch (requestError) {
      console.error(requestError);

      setError(
        requestError.message ||
          "Unable to create event."
      );
    }
  };

  return (
    <div className="create-event-page">

      <div className="create-event-container">

        {/* -------------------------------- */}
        {/* Back Button */}
        {/* -------------------------------- */}

        <button
          type="button"
          className="back-button"
          onClick={() =>
            navigate("/admin-dashboard")
          }
        >
          ← Back to Dashboard
        </button>


        {/* -------------------------------- */}
        {/* Page Header */}
        {/* -------------------------------- */}

        <div className="create-event-header">

          <p className="admin-kicker">
            EVENT MANAGEMENT
          </p>

          <h1>
            Create New Event
          </h1>

          <p>
            Create and publish a new
            campus event.
          </p>

        </div>


        {/* -------------------------------- */}
        {/* Event Form */}
        {/* -------------------------------- */}

        <form
          className="create-event-form"
          onSubmit={handleSubmit}
        >

          {/* ================================ */}
          {/* EVENT INFORMATION */}
          {/* ================================ */}

          <section className="create-event-section">

            <h2>
              Event Information
            </h2>


            {/* Event Title */}

            <div className="form-group full-width">

              <label htmlFor="title">
                Event Title *
              </label>

              <input
                id="title"
                name="title"
                type="text"
                value={form.title}
                onChange={handleChange}
                placeholder="Enter event title"
                required
              />

            </div>


            {/* Description */}

            <div className="form-group full-width">

              <label htmlFor="description">
                Description *
              </label>

              <textarea
                id="description"
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Tell students about the event..."
                rows="5"
                required
              />

            </div>


            {/* Category + Organizer */}

            <div className="form-row">

              <div className="form-group">

                <label htmlFor="category">
                  Category *
                </label>

                <select
                  id="category"
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  required
                >

                  <option value="">
                    Select category
                  </option>

                  <option value="Technology">
                    Technology
                  </option>

                  <option value="Workshop">
                    Workshop
                  </option>

                  <option value="Hackathon">
                    Hackathon
                  </option>

                  <option value="Cultural">
                    Cultural
                  </option>

                  <option value="Sports">
                    Sports
                  </option>

                  <option value="Academic">
                    Academic
                  </option>

                  <option value="Other">
                    Other
                  </option>

                </select>

              </div>


              <div className="form-group">

                <label htmlFor="organizer">
                  Organizer *
                </label>

                <input
                  id="organizer"
                  name="organizer"
                  type="text"
                  value={form.organizer}
                  onChange={handleChange}
                  placeholder="Department / organizer"
                  required
                />

              </div>

            </div>


            {/* Coordinator */}

            <div className="form-row">

              <div className="form-group">

                <label htmlFor="coordinatorId">
                  Coordinator *
                </label>

                <select
                  id="coordinatorId"
                  name="coordinatorId"
                  value={form.coordinatorId}
                  onChange={handleChange}
                  required
                  disabled={
                    loadingCoordinators
                  }
                >

                  <option value="">

                    {loadingCoordinators
                      ? "Loading coordinators..."
                      : "Select coordinator"}

                  </option>

                  {coordinators.map(
                    (coordinator) => (
                      <option
                        key={
                          coordinator.id
                        }
                        value={
                          coordinator.id
                        }
                      >
                        {coordinator.name}{" "}
                        -{" "}
                        {
                          coordinator.department
                        }
                      </option>
                    )
                  )}

                </select>

              </div>

            </div>

          </section>


          {/* ================================ */}
          {/* EVENT IMAGE */}
          {/* ================================ */}

          <section className="create-event-section">

            <h2>
              Event Image
            </h2>

            <label
              htmlFor="introImage"
              className="image-upload-box"
            >

              {imagePreview ? (

                <img
                  src={imagePreview}
                  alt="Event preview"
                  className="event-image-preview"
                />

              ) : (

                <>
                  <div className="upload-icon">
                    📷
                  </div>

                  <strong>
                    Upload event image
                  </strong>

                  <span>
                    JPG, PNG or WEBP •
                    Maximum 5 MB
                  </span>
                </>

              )}

              <input
                id="introImage"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={
                  handleImageChange
                }
                hidden
              />

            </label>

          </section>


          {/* ================================ */}
          {/* DATE AND TIME */}
          {/* ================================ */}

          <section className="create-event-section">

            <h2>
              Date & Time
            </h2>


            {/* Event Date + Registration Deadline */}

            <div className="form-row">

              <div className="form-group">

                <label htmlFor="eventDate">
                  Event Date *
                </label>

                <input
                  id="eventDate"
                  name="eventDate"
                  type="date"
                  value={form.eventDate}
                  onChange={handleChange}
                  required
                />

              </div>


              <div className="form-group">

                <label htmlFor="registrationDeadline">
                  Registration Deadline *
                </label>

                <input
                  id="registrationDeadline"
                  name="registrationDeadline"
                  type="date"
                  value={
                    form.registrationDeadline
                  }
                  onChange={handleChange}
                  required
                />

              </div>

            </div>


            {/* Start + End Time */}

            <div className="form-row">

              <div className="form-group">

                <label htmlFor="startTime">
                  Start Time *
                </label>

                <input
                  id="startTime"
                  name="startTime"
                  type="time"
                  value={form.startTime}
                  onChange={handleChange}
                  required
                />

              </div>


              <div className="form-group">

                <label htmlFor="endTime">
                  End Time *
                </label>

                <input
                  id="endTime"
                  name="endTime"
                  type="time"
                  value={form.endTime}
                  onChange={handleChange}
                  required
                />

              </div>

            </div>


            {/* Venue + Capacity */}

            <div className="form-row">

              <div className="form-group">

                <label htmlFor="venue">
                  Venue *
                </label>

                <input
                  id="venue"
                  name="venue"
                  type="text"
                  value={form.venue}
                  onChange={handleChange}
                  placeholder="Seminar Hall"
                  required
                />

              </div>


              <div className="form-group">

                <label htmlFor="capacity">
                  Capacity *
                </label>

                <input
                  id="capacity"
                  name="capacity"
                  type="number"
                  min="1"
                  value={form.capacity}
                  onChange={handleChange}
                  placeholder="100"
                  required
                />

              </div>

            </div>

          </section>


          {/* ================================ */}
          {/* ERROR MESSAGE */}
          {/* ================================ */}

          {error && (
            <div className="form-error">
              {error}
            </div>
          )}


          {/* ================================ */}
          {/* FORM BUTTONS */}
          {/* ================================ */}

          <div className="create-event-actions">

            <button
              type="button"
              className="cancel-button"
              onClick={() =>
                navigate(
                  "/admin-dashboard"
                )
              }
            >
              Cancel
            </button>


            <button
              type="submit"
              className="admin-primary-button"
            >
              Create Event
            </button>

          </div>

        </form>

      </div>

    </div>
  );
}

export default CreateEvent;