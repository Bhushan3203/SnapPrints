import { useState, useEffect, useCallback } from "react";
import { QRCodeCanvas } from "qrcode.react";
import "./PrintForm.css";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const API_BASE =
  process.env.REACT_APP_API_BASE ||
  "https://printdemo-production.up.railway.app/api";

function PrintForm() {
  const [machineId, setMachineId]       = useState("");
  const [machineStatus, setMachineStatus] = useState(null);
  const [file, setFile]                 = useState(null);

  const [color, setColor]         = useState("bw");
  const [copies, setCopies]       = useState(1);
  const [printSide, setPrintSide] = useState("single");
  const [paperSize, setPaperSize] = useState("A4");

  const [jobId, setJobId]     = useState(null);
  const [summary, setSummary] = useState(null);
  const [otp, setOtp]         = useState(null);
  const [qrToken, setQrToken] = useState(null);

  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  /* derive current step: 1 = Upload, 2 = Pay, 3 = Collect */
  const step = otp ? 3 : jobId ? 2 : 1;

  /* ── GET MACHINE FROM URL ── */
  useEffect(() => {
    const params  = new URLSearchParams(window.location.search);
    const machine = params.get("machine");
    if (machine) {
      setMachineId(machine);
      fetchStatus(machine);
    } else {
      setError("Invalid kiosk link. Machine not specified.");
    }
  }, []);

  const fetchStatus = async (id) => {
    try {
      const res  = await fetch(`${API_BASE}/machines/${id}/status`);
      const data = await res.json();
      if (res.ok) setMachineStatus(data);
    } catch {
      setError("Network error while fetching machine status.");
    }
  };

  /* ── POLL FOR PRINT COMPLETION ── */
  useEffect(() => {
    if (!jobId || !otp) return;
    const interval = setInterval(async () => {
      const res  = await fetch(`${API_BASE}/job-status/${jobId}`);
      const data = await res.json();
      if (data.status === "PRINTED") {
        clearInterval(interval);
        setSuccess("Print completed successfully!");
        setTimeout(() => { window.location.href = `/?machine=${machineId}`; }, 3000);
      }
      if (data.status === "FAILED") {
        clearInterval(interval);
        setError("Printing failed. Please contact support.");
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [jobId, otp, machineId]);

  /* ── FILE VALIDATION ── */
  const handleFileChange = (e) => {
    setError(""); setSuccess("");
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    if (selectedFile.type !== "application/pdf") {
      setError("Only PDF files are allowed."); return;
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError("PDF must be under 50 MB."); return;
    }
    setFile(selectedFile);
  };

  const fetchSummary = async (id) => {
    const res  = await fetch(`${API_BASE}/job-summary/${id}`);
    const data = await res.json();
    if (res.ok) setSummary(data);
  };

  /* ── UPDATE JOB ── */
  const updateJob = useCallback(async () => {
    if (!jobId) return;
    const res = await fetch(`${API_BASE}/job/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color, copies, paperSize, printSide }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    await fetchSummary(jobId);
  }, [jobId, color, copies, paperSize, printSide]);

  useEffect(() => {
    if (jobId && !otp) updateJob();
  }, [jobId, otp, updateJob]);

  /* ── STEP 1: UPLOAD ── */
  const handleUploadJob = async () => {
    setError(""); setSuccess("");
    if (!machineStatus || machineStatus.is_print_locked) {
      setError("Machine is out of paper. Try later."); return;
    }
    if (!machineId || !file) {
      setError("Machine and PDF are required."); return;
    }
    const formData = new FormData();
    formData.append("pdf", file);
    formData.append("machineId", machineId);
    formData.append("color", color);
    formData.append("copies", copies);
    formData.append("paperSize", paperSize);
    formData.append("printSide", printSide);
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/upload-job`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setJobId(data.jobId);
      await fetchSummary(data.jobId);
      setSuccess(`Job created — ID: ${data.jobId}`);
    } catch (err) {
      setError(err.message || "Upload failed.");
    } finally {
      setLoading(false);
    }
  };

  /* ── STEP 2: PAYMENT ── */
  const startPayment = async () => {
    setError(""); setSuccess("");
    setLoading(true);
    try {
      await updateJob();
      const res  = await fetch(`${API_BASE}/create-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const options = {
        key: data.key,
        amount: data.amount,
        currency: "INR",
        order_id: data.orderId,
        handler: async (response) => {
          const verifyRes  = await fetch(`${API_BASE}/verify-payment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });
          const verifyData = await verifyRes.json();
          if (!verifyRes.ok) throw new Error(verifyData.error);
          setOtp(verifyData.otp);
          setQrToken(verifyData.qrToken);
          setSuccess("Payment successful — OTP generated.");
        },
        theme: { color: "#a3e635" },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      setError(err.message || "Payment failed.");
    } finally {
      setLoading(false);
    }
  };

  /* ── FORMAT FILE SIZE ── */
  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  /* ── UI ── */
  return (
    <div className="pf-page">
      {/* Header */}
      <div className="pf-header">
        <div className="pf-header-icon">🖨️</div>
        <div className="pf-header-text">
          <h1>PrintKiosk</h1>
          <p>Upload · Pay · Collect</p>
        </div>
      </div>

      {/* Card */}
      <div className="pf-card">

        {/* Step Bar */}
        <div className="pf-steps">
          {[["1","Upload"],["2","Pay"],["3","Collect"]].map(([num, label]) => (
            <div
              key={num}
              className={`pf-step ${step === Number(num) ? "active" : step > Number(num) ? "done" : ""}`}
            >
              <div className="pf-step-num">{step > Number(num) ? "✓" : num}</div>
              <div className="pf-step-label">{label}</div>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className={`pf-body pf-step-enter`}>

          {/* Machine status */}
          {machineStatus && !machineStatus.is_print_locked && (
            <div className="pf-status-bar">
              <span className="dot" />
              Printer online · Ready
            </div>
          )}

          {machineStatus?.is_print_locked && (
            <div className="pf-machine-warning">
              ⚠ Machine out of paper — payment disabled.
            </div>
          )}

          {/* Alerts */}
          {error   && <div className="pf-alert error">⚠ {error}</div>}
          {success && <div className="pf-alert success">✓ {success}</div>}

          {/* ── STEP 1: UPLOAD ── */}
          {step === 1 && (
            <>
              <div className="pf-section-title">📄 Document</div>

              {/* Drop zone */}
              <div className={`pf-dropzone${file ? " has-file" : ""}`}>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                />
                {file ? (
                  <>
                    <span className="pf-dropzone-icon">✅</span>
                    <div className="pf-dropzone-text">{file.name}</div>
                    <div className="pf-dropzone-hint">{formatSize(file.size)} · Click to change</div>
                  </>
                ) : (
                  <>
                    <span className="pf-dropzone-icon">📄</span>
                    <div className="pf-dropzone-text">Select file</div>
                    <div className="pf-dropzone-hint">PDF only · max 50 MB</div>
                  </>
                )}
              </div>

              <div className="pf-divider" />

              {/* Print options */}
              <div className="pf-section-title">⚙ Print options</div>
              <div className="pf-grid">
                <div className="pf-field">
                  <label>Print type</label>
                  <select value={color} onChange={(e) => setColor(e.target.value)}>
                    <option value="bw">Black &amp; White</option>
                    <option value="color">Color</option>
                  </select>
                </div>

                <div className="pf-field">
                  <label>Copies</label>
                  <div className="pf-counter">
                    <button
                      className="pf-counter-btn"
                      onClick={() => setCopies(c => Math.max(1, c - 1))}
                      type="button"
                    >−</button>
                    <div className="pf-counter-value">{copies}</div>
                    <button
                      className="pf-counter-btn"
                      onClick={() => setCopies(c => Math.min(50, c + 1))}
                      type="button"
                    >+</button>
                  </div>
                </div>

                <div className="pf-field">
                  <label>Print side</label>
                  <select value={printSide} onChange={(e) => setPrintSide(e.target.value)}>
                    <option value="single">Single Side</option>
                    <option value="duplex">Duplex</option>
                  </select>
                </div>

                <div className="pf-field">
                  <label>Paper size</label>
                  <select value={paperSize} onChange={(e) => setPaperSize(e.target.value)}>
                    <option value="A4">A4</option>
                    <option value="A3">A3</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* ── STEP 2: SUMMARY + PAY ── */}
          {step === 2 && summary && (
            <>
              <div className="pf-section-title">🧾 Order summary</div>
              <div className="pf-summary">
                <div className="pf-summary-header">
                  <h3>Print Job</h3>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--ink-3)" }}>
                    {jobId}
                  </span>
                </div>
                <div className="pf-summary-body">
                  <div className="pf-summary-row">
                    <span className="key">Pages</span>
                    <span className="val">{summary.totalPages}</span>
                  </div>
                  <div className="pf-summary-row">
                    <span className="key">Copies</span>
                    <span className="val">{summary.copies}</span>
                  </div>
                  <div className="pf-summary-row">
                    <span className="key">Type</span>
                    <span className="val">{summary.color === "bw" ? "B&W" : "Color"}</span>
                  </div>
                  <div className="pf-summary-row">
                    <span className="key">Side</span>
                    <span className="val">{summary.printSide === "duplex" ? "Duplex" : "Single"}</span>
                  </div>
                  <div className="pf-summary-row">
                    <span className="key">Rate</span>
                    <span className="val">₹{summary.rate}/sheet</span>
                  </div>
                  <div className="pf-summary-total">
                    <span className="label">Total</span>
                    <span className="amount">₹{summary.totalAmount}</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── STEP 3: OTP ── */}
          {step === 3 && otp && (
            <div className="pf-otp-box">
              <div className="pf-otp-label">Enter this OTP at the printer</div>
              <span className="pf-otp-code">{otp}</span>
              <div className="pf-otp-expiry">Valid for 5 minutes</div>

              <div className="pf-or">or scan QR</div>

              <div className="pf-qr-wrap">
                <QRCodeCanvas value={qrToken} size={180} />
              </div>
              <div className="pf-qr-hint">Scan at the printer to release your job</div>

              <div className="pf-waiting">
                <div style={{
                  width: 10, height: 10, borderRadius: "50%",
                  border: "2px solid var(--lime)", borderTopColor: "transparent",
                  animation: "spin 0.8s linear infinite"
                }} />
                Waiting for printer confirmation…
              </div>
            </div>
          )}
        </div>

        {/* Action bar */}
        <div className="pf-action-bar">
          {step === 1 && (
            <button
              className="pf-btn primary"
              onClick={handleUploadJob}
              disabled={loading || !file || machineStatus?.is_print_locked}
            >
              {loading
                ? <><div className="pf-spinner" /> Uploading…</>
                : "Upload & Continue →"}
            </button>
          )}

          {step === 2 && (
            <button
              className="pf-btn pay"
              onClick={startPayment}
              disabled={loading || machineStatus?.is_print_locked}
            >
              {loading
                ? <><div className="pf-spinner" /> Processing…</>
                : `Pay ₹${summary?.totalAmount ?? ""} & Get OTP →`}
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="pf-footer">PrintKiosk v1.0</div>
      </div>
    </div>
  );
}

export default PrintForm;