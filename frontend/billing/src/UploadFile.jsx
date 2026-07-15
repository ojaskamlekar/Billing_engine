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
    <div className="flex flex-col gap-4">
      <div 
        onClick={() => { if (!isUploading && fileInputRef.current) fileInputRef.current.click(); }}
        className={`group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all duration-200
          ${file 
            ? "border-[#635BFF]/30 bg-[#635BFF]/2 shadow-xs" 
            : "border-zinc-200 bg-zinc-50/40 hover:border-[#635BFF]/40 hover:bg-[#635BFF]/1"
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="sr-only"
          disabled={isUploading}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        
        {file ? (
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#635BFF]/10 text-[#635BFF] flex items-center justify-center border border-[#635BFF]/20 shadow-xs">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-800 truncate max-w-[280px]" title={file.name}>
                {file.name}
              </p>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                {(file.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                disabled={isUploading}
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="rounded-lg border border-zinc-200 bg-white hover:bg-zinc-550 px-3 py-1.5 text-xs font-semibold text-zinc-700 cursor-pointer transition"
              >
                Clear
              </button>
              <button
                type="button"
                disabled={isUploading || retryCooldown > 0}
                onClick={(e) => {
                  e.stopPropagation();
                  handleUpload();
                }}
                className="rounded-lg bg-[#635BFF] hover:bg-[#5249f0] text-white px-4 py-1.5 text-xs font-semibold cursor-pointer shadow-xs transition disabled:opacity-50"
              >
                {isUploading ? "Uploading..." : retryCooldown > 0 ? `Wait ${retryCooldown}s` : "Upload File"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-zinc-100 group-hover:bg-[#635BFF]/10 group-hover:text-[#635BFF]/90 text-zinc-500 flex items-center justify-center border border-zinc-200/60 transition-colors">
              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-700">
                Click to select or drag a file
              </p>
              <p className="text-[10px] text-zinc-400 mt-0.5">
                Support for all files up to maximum limit
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Rate limit / error toast */}
      {toast && (
        <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
          toast.type === "success"
            ? "bg-emerald-50/50 border-emerald-200 text-emerald-700"
            : "bg-red-50/50 border-red-200 text-red-700"
        }`}>
          {toast.type === "success" ? (
            <svg className="h-4 w-4 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="h-4 w-4 shrink-0 text-red-650" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
