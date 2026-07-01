// steps/StepUpload.jsx
// import React from "react";
// import { MdAttachFile,MdCloudUpload  } from "react-icons/md";

// function formatBytes(bytes) {
//   if (bytes < 1024) return `${bytes} B`;
//   if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
//   return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
// }

// export default function StepUpload({
//   file,
//   handleFileChange,
//   fileError,
//   color, setColor,
//   copies, setCopies,
//   printSide, setPrintSide,
//   paperSize, setPaperSize,
//   isLocked,
//   jobError,
// }) {
//   return (
//     <div className="pf-step-enter">

//       <p className="pf-section-title">Accepted formats:PDF,DOCX,JPG,JPEG,PNG </p>

//       <div className={`pf-dropzone ${file ? "has-file" : ""}`}>
//         <input
//           type="file"
//           accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.bmp,.webp,.tif,.tiff"
//           onChange={handleFileChange}
//         />
//         {!file ? (
//           <>
//             <div className="pf-dropzone-icon"><MdCloudUpload size={60} color="#2a7cc0" /></div>
//             <div className="pf-dropzone-text">Drop your file here</div>
//             {/* <div className="pf-dropzone-hint">PDF only · Max 50 MB</div> */}
//           </>
//         ) : (
//           <>
//             <div className="pf-dropzone-icon">✅</div>
//             <div className="pf-dropzone-text">File selected</div>
//             <div className="pf-dropzone-hint">We delete your files once printed</div>
//           </>
//         )}
//       </div>

//       {fileError ? (
//         <div className="pf-alert error">⚠ {fileError}</div>
//       ) : null}

//       {file ? (
//         <div className="pf-file-info">
//           <span style={{ color: "var(--lime)", display: "flex" }}>
//             <MdAttachFile size={16} />
//           </span>
//           <span className="file-name">{file.name}</span>
//           <span className="file-size">{formatBytes(file.size)}</span>
//         </div>
//       ) : null}

//       {file ? (
//         <>
//           <div className="pf-divider" />
//           <p className="pf-section-title">Print Options</p>

//           <div className="pf-grid">
//             <div className="pf-field">
//               <label>Print Type</label>
//               <select value={color} onChange={(e) => setColor(e.target.value)}>
//                 <option value="bw">B &amp; W</option>
//                 <option value="color">Color</option>
//               </select>
//             </div>

//             <div className="pf-field">
//               <label>Copies</label>
//               <div className="pf-counter">
//                 <button
//                   type="button"
//                   onClick={() => setCopies((prev) => Math.max(1, prev - 1))}
//                   className="pf-counter-btn"
//                 >−</button>
//                 <span className="pf-counter-value">{copies}</span>
//                 <button
//                   type="button"
//                   onClick={() => setCopies((prev) => Math.min(50, prev + 1))}
//                   className="pf-counter-btn"
//                 >+</button>
//               </div>
//             </div>

//             <div className="pf-field">
//               <label>Print Side</label>
//               <select value={printSide} onChange={(e) => setPrintSide(e.target.value)}>
//                 <option value="single">Single</option>
//                 <option value="duplex">Duplex</option>
//               </select>
//             </div>

//             <div className="pf-field">
//               <label>Paper Size</label>
//               <select value={paperSize} onChange={(e) => setPaperSize(e.target.value)}>
//                 <option value="A4">A4</option>
//                 <option value="A3">A3</option>
//               </select>
//             </div>
//           </div>
//         </>
//       ) : null}

//       {jobError ? (
//         <div className="pf-alert error" style={{ marginTop: 10 }}>⚠ {jobError}</div>
//       ) : null}

//       {isLocked ? (
//         <div className="pf-alert warning" style={{ marginTop: 10 }}>
//           ⚠ Machine is out of paper. Printing is unavailable.
//         </div>
//       ) : null}

//     </div>
//   );
// }




// steps/StepUpload.jsx
import React, { useEffect, useRef, useState } from "react";
import { MdAttachFile, MdCloudUpload } from "react-icons/md";

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getPreviewType(file) {
  if (!file) return null;
  if (file.type === "application/pdf") return "pdf";
  if (file.type.startsWith("image/")) return "image";
  return "other";
}

// ---- PDF preview component ----
function PdfPreview({ file }) {
  const canvasRef = useRef(null);
  const [pageInfo, setPageInfo] = useState(null); // { total }
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load PDF.js from CDN once
  useEffect(() => {
    if (window.pdfjsLib) return;
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    };
    document.head.appendChild(script);
  }, []);

  // Load the PDF file
  useEffect(() => {
    if (!file) return;
    let cancelled = false;

    const loadPdf = async () => {
      setLoading(true);
      setCurrentPage(1);

      // Wait for pdfjsLib to be ready
      let attempts = 0;
      while (!window.pdfjsLib && attempts < 30) {
        await new Promise((r) => setTimeout(r, 100));
        attempts++;
      }
      if (!window.pdfjsLib || cancelled) return;

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      if (cancelled) return;

      setPdfDoc(pdf);
      setPageInfo({ total: pdf.numPages });
      setLoading(false);
    };

    loadPdf();
    return () => {
      cancelled = true;
    };
  }, [file]);

  // Render current page onto canvas
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let cancelled = false;

    const renderPage = async () => {
      const page = await pdfDoc.getPage(currentPage);
      if (cancelled) return;

      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: canvas.getContext("2d"),
        viewport,
      }).promise;
    };

    renderPage();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, currentPage]);

  if (loading) {
    return (
      <div className="pf-pdf-loading">
        <span className="pf-spinner dark" />
        <span>Loading preview...</span>
      </div>
    );
  }

  return (
    <div className="pf-pdf-preview-wrap">
      <canvas ref={canvasRef} className="pf-pdf-canvas" />

      {pageInfo?.total > 1 && (
        <div className="pf-pdf-nav">
          <button
            className="pf-pdf-nav-btn"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            ‹
          </button>
          <span className="pf-pdf-nav-label">
            Page {currentPage} / {pageInfo.total}
          </span>
          <button
            className="pf-pdf-nav-btn"
            onClick={() => setCurrentPage((p) => Math.min(pageInfo.total, p + 1))}
            disabled={currentPage === pageInfo.total}
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Image preview component (object URL, cleaned up on change/unmount) ----
function ImagePreview({ file }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  if (!url) return null;
  return (
    <div className="pf-image-preview-wrap">
      <img src={url} alt="File preview" className="pf-preview-img" />
    </div>
  );
}

export default function StepUpload({
  file,
  handleFileChange,
  fileError,
  color, setColor,
  copies, setCopies,
  printSide, setPrintSide,
  paperSize, setPaperSize,
  isLocked,
  jobError,
}) {
  const previewType = getPreviewType(file);

  return (
    <div className="pf-step-enter">

      <p className="pf-section-title">Accepted formats:PDF,DOCX,JPG,JPEG,PNG </p>

      <div className={`pf-dropzone ${file ? "has-file" : ""}`}>
        <input
          type="file"
          accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.bmp,.webp,.tif,.tiff"
          onChange={handleFileChange}
        />
        {!file ? (
          <>
            <div className="pf-dropzone-icon"><MdCloudUpload size={60} color="#2a7cc0" /></div>
            <div className="pf-dropzone-text">Drop your file here</div>
            {/* <div className="pf-dropzone-hint">PDF only · Max 50 MB</div> */}
          </>
        ) : previewType === "image" ? (
          <ImagePreview file={file} />
        ) : previewType === "pdf" ? (
          <PdfPreview file={file} />
        ) : (
          <>
            <div className="pf-dropzone-icon">✅</div>
            <div className="pf-dropzone-text">File selected</div>
            <div className="pf-dropzone-hint">We delete your files once printed</div>
          </>
        )}
      </div>

      {fileError ? (
        <div className="pf-alert error">⚠ {fileError}</div>
      ) : null}

      {file ? (
        <div className="pf-file-info">
          <span style={{ color: "var(--lime)", display: "flex" }}>
            <MdAttachFile size={16} />
          </span>
          <span className="file-name">{file.name}</span>
          <span className="file-size">{formatBytes(file.size)}</span>
        </div>
      ) : null}

      {file ? (
        <>
          <div className="pf-divider" />
          <p className="pf-section-title">Print Options</p>

          <div className="pf-grid">
            <div className="pf-field">
              <label>Print Type</label>
              <select value={color} onChange={(e) => setColor(e.target.value)}>
                <option value="bw">B &amp; W</option>
                <option value="color">Color</option>
              </select>
            </div>

            <div className="pf-field">
              <label>Copies</label>
              <div className="pf-counter">
                <button
                  type="button"
                  onClick={() => setCopies((prev) => Math.max(1, prev - 1))}
                  className="pf-counter-btn"
                >−</button>
                <span className="pf-counter-value">{copies}</span>
                <button
                  type="button"
                  onClick={() => setCopies((prev) => Math.min(50, prev + 1))}
                  className="pf-counter-btn"
                >+</button>
              </div>
            </div>

            <div className="pf-field">
              <label>Print Side</label>
              <select value={printSide} onChange={(e) => setPrintSide(e.target.value)}>
                <option value="single">Single</option>
                <option value="duplex">Duplex</option>
              </select>
            </div>

            <div className="pf-field">
              <label>Paper Size</label>
              <select value={paperSize} onChange={(e) => setPaperSize(e.target.value)}>
                <option value="A4">A4</option>
                <option value="A3">A3</option>
              </select>
            </div>
          </div>
        </>
      ) : null}

      {jobError ? (
        <div className="pf-alert error" style={{ marginTop: 10 }}>⚠ {jobError}</div>
      ) : null}

      {isLocked ? (
        <div className="pf-alert warning" style={{ marginTop: 10 }}>
          ⚠ Machine is out of paper. Printing is unavailable.
        </div>
      ) : null}

    </div>
  );
}