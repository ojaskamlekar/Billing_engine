import { useRef, useState, useEffect } from "react";
import { api } from "./api";

function UploadFile({ onUploaded }) {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [retryCooldown, setRetryCooldown] = useState(0);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (retryCooldown <= 0) return;
    const interval = setInterval(() => {
      setRetryCooldown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [retryCooldown]);

  const showToast = (message, type = "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const handleUpload = async () => {
    if (!file || retryCooldown > 0) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.post("/upload", formData);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onUploaded?.();
      showToast("Uploaded successfully!", "success");
    } catch (err) {
      const status = err.response?.status;
      if (status === 429) {
        const secs = err.response?.data?.retry_after || 60;
        setRetryCooldown(secs);
        showToast(`Too many uploads. Please wait ${secs} seconds.`, "error");
      } else {
        const msg = err.response?.data?.detail || "Upload failed. Please try again.";
        showToast(msg, "error");
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mt-6 flex flex-col gap-4 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/80 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 text-left sm:flex-row sm:items-center">
          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">
            Choose file
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <span className="truncate text-sm text-slate-500">
            {file ? file.name : "No file selected"}
          </span>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={handleUpload}
            disabled={!file || isUploading || retryCooldown > 0}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUploading ? "Uploading…" : retryCooldown > 0 ? `Retry in: ${retryCooldown}s` : "Upload"}
          </button>
        </div>
      </div>

      {/* Rate limit / error toast */}
      {toast && (
        <div className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium ${
          toast.type === "success"
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : "bg-red-50 border-red-200 text-red-700"
        }`}>
          {toast.type === "success" ? (
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

export default UploadFile;
