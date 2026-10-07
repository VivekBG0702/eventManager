import { useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { API_URL, getAuthHeaders } from "../utils/auth";
import { apiErrorMessage } from "../utils/apiErrors";

function QrAttendanceScanner({ event, onClose, onAttendanceMarked }) {
  const [scannerMode, setScannerMode] = useState("camera");
  const [manualToken, setManualToken] = useState("");
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [verifiedStudent, setVerifiedStudent] = useState(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [markLoading, setMarkLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState("");
  const html5QrCodeRef = useRef(null);

  const stopCamera = async () => {
    if (html5QrCodeRef.current && isCameraActive) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn("Error stopping scanner", err);
      }
      setIsCameraActive(false);
    }
  };

  const closeScannerModal = async () => {
    await stopCamera();
    onClose();
  };

  const startCamera = async () => {
    setAttendanceError("");
    setVerifiedStudent(null);

    const qrElement = document.getElementById("qr-camera-stream");
    if (!qrElement) return;

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode("qr-camera-stream");
      }

      await html5QrCodeRef.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleVerifyToken(decodedText);
          stopCamera();
        },
        () => {}
      );
      setIsCameraActive(true);
    } catch (err) {
      console.error("Camera access error:", err);
      setAttendanceError("Could not access camera. Please check permissions or use manual entry.");
      setIsCameraActive(false);
    }
  };

  const handleFileUpload = async (eventInput) => {
    const file = eventInput.target.files?.[0];
    if (!file) return;

    setAttendanceError("");
    setVerifiedStudent(null);

    try {
      const scanner = new Html5Qrcode("qr-file-preview");
      const decodedText = await scanner.scanFile(file, true);
      handleVerifyToken(decodedText);
    } catch (_err) {
      setAttendanceError("No QR code detected in this image. Please try another file.");
    }
  };

  const handleVerifyToken = async (tokenToVerify) => {
    if (!tokenToVerify?.trim()) {
      setAttendanceError("QR token cannot be empty.");
      return;
    }

    setVerifyLoading(true);
    setAttendanceError("");
    setVerifiedStudent(null);

    try {
      const response = await fetch(`${API_URL}/registrations/attendance/verify`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          qr_token: tokenToVerify.trim(),
          event_id: event.id,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(apiErrorMessage(response.status, result.detail, "Invalid QR code."));
      }

      setVerifiedStudent({
        ...result,
        qr_token: tokenToVerify.trim(),
      });
    } catch (err) {
      setAttendanceError(err.message || "Failed to verify QR.");
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleConfirmMarkAttendance = async () => {
    if (!verifiedStudent?.qr_token) return;

    setMarkLoading(true);
    setAttendanceError("");

    try {
      const response = await fetch(`${API_URL}/registrations/attendance/mark`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          qr_token: verifiedStudent.qr_token,
          event_id: event.id,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(apiErrorMessage(response.status, result.detail, "Unable to mark attendance."));
      }

      setVerifiedStudent(null);
      setManualToken("");
      await stopCamera();
      onAttendanceMarked?.(result);
      onClose();
    } catch (err) {
      setAttendanceError(err.message || "Could not mark attendance.");
    } finally {
      setMarkLoading(false);
    }
  };

  return (
    <div className="scanner-modal-backdrop" onClick={closeScannerModal}>
      <div className="scanner-modal" onClick={(e) => e.stopPropagation()}>
        <button className="admin-modal-close" onClick={closeScannerModal} aria-label="Close">
          ×
        </button>

        <h3>Scan Student QR Code</h3>
        <p style={{ color: "#64748b", fontSize: "14px", margin: "4px 0 16px" }}>
          Event: <strong>{event?.title}</strong>
        </p>

        <div className="tabs-nav" style={{ marginBottom: "12px" }}>
          <button
            type="button"
            className={scannerMode === "camera" ? "tab-btn active" : "tab-btn"}
            onClick={() => {
              setScannerMode("camera");
              stopCamera();
            }}
          >
            📷 Live Camera
          </button>
          <button
            type="button"
            className={scannerMode === "file" ? "tab-btn active" : "tab-btn"}
            onClick={() => {
              setScannerMode("file");
              stopCamera();
            }}
          >
            📁 Upload Image
          </button>
          <button
            type="button"
            className={scannerMode === "manual" ? "tab-btn active" : "tab-btn"}
            onClick={() => {
              setScannerMode("manual");
              stopCamera();
            }}
          >
            ⌨ Manual Token
          </button>
        </div>

        {scannerMode === "camera" && (
          <div>
            <div id="qr-camera-stream" className="scanner-box" />
            <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
              {!isCameraActive ? (
                <button type="button" className="admin-primary-button" onClick={startCamera}>
                  ▶ Start Camera
                </button>
              ) : (
                <button type="button" className="admin-secondary-button" onClick={stopCamera}>
                  ⏹ Stop Camera
                </button>
              )}
            </div>
          </div>
        )}

        {scannerMode === "file" && (
          <div style={{ textAlign: "center", padding: "20px", border: "2px dashed #cbd5e1", borderRadius: "12px" }}>
            <p>Upload a screenshot or photo of the student's QR code:</p>
            <input type="file" accept="image/*" onChange={handleFileUpload} style={{ margin: "12px 0" }} />
            <div id="qr-file-preview" style={{ display: "none" }} />
          </div>
        )}

        {scannerMode === "manual" && (
          <div style={{ marginTop: "12px" }}>
            <label style={{ fontSize: "13px", fontWeight: "600" }}>Paste or enter QR Token:</label>
            <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
              <input
                type="text"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="Enter student QR token..."
                style={{ flex: 1, padding: "8px 12px", borderRadius: "8px" }}
              />
              <button
                type="button"
                className="admin-primary-button"
                onClick={() => handleVerifyToken(manualToken)}
                disabled={verifyLoading || !manualToken.trim()}
              >
                {verifyLoading ? "Verifying…" : "Verify QR"}
              </button>
            </div>
          </div>
        )}

        {attendanceError && (
          <div style={{ marginTop: "12px", padding: "10px", background: "#fef2f2", color: "#b91c1c", borderRadius: "8px", fontSize: "14px" }}>
            ⚠️ {attendanceError}
          </div>
        )}

        {verifiedStudent && (
          <div className={`scan-verify-card ${verifiedStudent.already_marked ? "already-present" : "ready-to-mark"}`}>
            <h4>Student Information Verified</h4>
            <div style={{ fontSize: "14px", lineHeight: "1.6", margin: "8px 0" }}>
              <div>Name: <strong>{verifiedStudent.student?.name}</strong></div>
              <div>USN: <strong>{verifiedStudent.student?.usn}</strong></div>
              <div>Department: <strong>{verifiedStudent.student?.department}</strong></div>
              <div>Event: <strong>{verifiedStudent.event?.title}</strong></div>
              <div>
                Current Status:{" "}
                <span className={verifiedStudent.already_marked ? "badge-present" : "badge-absent"}>
                  {verifiedStudent.already_marked ? "Already Marked Present" : "Not Yet Marked"}
                </span>
              </div>
            </div>

            {verifiedStudent.already_marked ? (
              <p style={{ color: "#b45309", fontSize: "13px", margin: "8px 0 0" }}>
                ⚠️ This student has already been marked present for this event. Duplicate attendance is prevented.
              </p>
            ) : (
              <button
                type="button"
                className="admin-primary-button"
                style={{ width: "100%", marginTop: "10px", background: "#10b981" }}
                onClick={handleConfirmMarkAttendance}
                disabled={markLoading}
              >
                {markLoading ? "Recording Attendance…" : "✓ Confirm & Mark Attendance"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default QrAttendanceScanner;
