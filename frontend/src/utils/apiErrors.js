export function apiErrorMessage(status, detail, fallback = "Request failed.") {
  const text =
    typeof detail === "string"
      ? detail
      : Array.isArray(detail)
        ? detail.map((item) => item.msg || item).join(" ")
        : fallback;

  if (status === 401) {
    return "401 Unauthorized. Please log in again.";
  }
  if (status === 403) {
    return text || "403 Forbidden. You are not allowed to view this event's registered students.";
  }
  if (status === 404) {
    return text || "404 Event not found.";
  }
  if (status >= 500) {
    return "500 Server error. Please try again later.";
  }
  return text || fallback;
}
