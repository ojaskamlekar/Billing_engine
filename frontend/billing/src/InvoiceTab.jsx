import { useState } from "react";
import PremiumLockOverlay from "./PremiumLockOverlay";
import { API_BASE } from "./api";

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / 1024 ** i;
  return `${value.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

export default function InvoiceTab({ invoice, loading, error, onRetry, plan = "Free", onUpgradeClick }) {
  const [downloading, setDownloading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [toast, setToast] = useState(null);
  if (plan === "Free") {
    return (
      <PremiumLockOverlay
        message="Upgrade to a Pro or Enterprise subscription to generate billing statements and download PDF invoices."
        onUpgradeClick={onUpgradeClick}
      />
    );
  }
  const getBadgeColor = (plan) => {
    switch (plan?.toLowerCase()) {
      case "free":
        return "bg-emerald-50 text-emerald-700 border-emerald-200/60";
      case "pro":
        return "bg-blue-50 text-blue-700 border-blue-200/60";
      case "enterprise":
        return "bg-purple-50 text-purple-700 border-purple-200/60";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200/60";
    }
  };

  const handleDownload = async (isRetry = false) => {
    if (downloading && !isRetry) return;

    const filename = invoice?.invoice_id ? `invoice_${invoice.invoice_id}.pdf` : "invoice.pdf";
    
    setDownloading(true);
    setCompleted(false);
    setDownloadProgress({
      filename,
      percent: 0,
      loaded: 0,
      total: 0,
      speed: 0,
      eta: null,
      status: "downloading"
    });

    const token = localStorage.getItem("access_token");
    const headers = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const url = `${API_BASE}/invoice/download`;
      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentLengthHeader = response.headers.get("content-length");
      const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;

      const reader = response.body.getReader();
      const chunks = [];
      let loadedBytes = 0;
      const startTime = Date.now();
      let lastUpdate = Date.now();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        loadedBytes += value.length;

        const now = Date.now();
        if (now - lastUpdate > 100 || loadedBytes === totalBytes) {
          const elapsed = (now - startTime) / 1000;
          const speed = elapsed > 0 ? (loadedBytes / elapsed) : 0;
          const percent = totalBytes > 0 ? Math.min((loadedBytes / totalBytes) * 100, 100) : 0;
          const remainingBytes = totalBytes - loadedBytes;
          const eta = (speed > 0 && remainingBytes > 0) ? Math.ceil(remainingBytes / speed) : null;

          setDownloadProgress({
            filename,
            percent,
            loaded: loadedBytes,
            total: totalBytes || loadedBytes,
            speed,
            eta,
            status: "downloading"
          });
          lastUpdate = now;
        }
      }

      const blob = new Blob(chunks, { type: "application/pdf" });
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      setCompleted(true);
      setDownloadProgress({
        filename,
        percent: 100,
        loaded: loadedBytes,
        total: loadedBytes,
        speed: 0,
        eta: 0,
        status: "complete"
      });

      setToast({ message: "✓ Download Complete", type: "success" });

      setTimeout(() => {
        setDownloading(false);
        setDownloadProgress(null);
        setCompleted(false);
      }, 2000);

    } catch (err) {
      console.error("Failed to download invoice:", err);
      
      setDownloadProgress({
        filename,
        percent: 0,
        loaded: 0,
        total: 0,
        speed: 0,
        eta: null,
        status: "failed"
      });

      setToast({
        message: (
          <div className="flex items-center justify-between gap-3 w-full">
            <span>Failed to download invoice PDF.</span>
            <button
              onClick={() => handleDownload(true)}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs px-2.5 py-1 rounded transition cursor-pointer"
            >
              Retry
            </button>
          </div>
        ),
        type: "error"
      });

      setDownloading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md text-left overflow-hidden">
        
        {/* Header Block resembling SaaS invoice templates */}
        <div className="bg-slate-50 border-b border-slate-100 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Invoice Statement</span>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              {loading ? "INV-2026-XXXX" : invoice?.invoice_id}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Generated on {loading ? "—" : invoice?.generated_at}</p>
          </div>
           <button
            onClick={() => handleDownload()}
            disabled={loading || error || !invoice || downloading || completed}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition cursor-pointer ${
              completed
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-indigo-600 hover:bg-indigo-500"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {downloading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Downloading...
              </>
            ) : completed ? (
              <>
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                ✓ Download Complete
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download PDF
              </>
            )}
          </button>
        </div>

        {/* Invoice details body */}
        <div className="p-6">
          {loading ? (
            <div className="animate-pulse space-y-6">
              <div className="h-12 w-48 bg-slate-100 rounded" />
              <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-12 bg-slate-100 rounded" />
                ))}
              </div>
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-xs text-red-600">
              <p className="font-semibold">Failed to load invoice details</p>
              <button
                onClick={onRetry}
                className="mt-2 font-medium underline hover:text-red-800 focus:outline-none block"
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Prominent Amount Due banner */}
              <div className="bg-indigo-50/40 rounded-xl p-5 border border-indigo-100/50 flex flex-col justify-center items-center text-center">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount Due</span>
                <span className="text-4xl font-extrabold text-indigo-600 mt-1">₹{invoice?.total_amount}</span>
                <span className="text-xs text-slate-400 mt-1">Auto-deducted from balance or payment method</span>
              </div>

              {/* Data Grid list */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                <div className="border border-slate-100 rounded-lg p-4 flex flex-col justify-between">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Billing Period</span>
                  <span className="text-sm font-semibold text-slate-800 mt-1">{invoice?.billing_period}</span>
                </div>

                <div className="border border-slate-100 rounded-lg p-4 flex flex-col justify-between">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Customer Plan</span>
                  <span className="mt-1">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${getBadgeColor(invoice?.plan)}`}>
                      {invoice?.plan}
                    </span>
                  </span>
                </div>

                <div className="border border-slate-100 rounded-lg p-4 flex flex-col justify-between">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Storage Used</span>
                  <span className="text-sm font-semibold text-slate-800 mt-1">{invoice?.storage_used_mb} MB</span>
                </div>

                <div className="border border-slate-100 rounded-lg p-4 flex flex-col justify-between">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Files</span>
                  <span className="text-sm font-semibold text-slate-800 mt-1">{invoice?.total_files} files</span>
                </div>

                <div className="border border-slate-100 rounded-lg p-4 flex flex-col justify-between">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Rate per MB</span>
                  <span className="text-sm font-semibold text-slate-800 mt-1">₹{invoice?.rate_per_mb} / MB</span>
                </div>

                <div className="border border-slate-100 rounded-lg p-4 flex flex-col justify-between">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Estimated Subtotal</span>
                  <span className="text-sm font-semibold text-slate-800 mt-1">₹{invoice?.total_amount}</span>
                </div>

              </div>
              
              <div className="border-t border-slate-100 pt-5 text-[11px] text-slate-400 leading-relaxed">
                <p>
                  This invoice is automatically generated on-the-fly based on metered log records of files uploaded to object buckets. 
                  Charges are subject to plan rates defined in the billing engine settings.
                </p>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Real-time Download Progress Dialog Overlay */}
      {downloadProgress && (
        <div className="fixed bottom-6 left-6 z-50 flex w-full max-w-sm flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl ring-1 ring-black/5 animate-in slide-in-from-left-5 duration-300 text-left">
          <div className="flex items-start justify-between mb-3">
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold text-slate-800 truncate">
                {downloadProgress.status === "complete" ? "✓ Download Complete" : "Downloading invoice..."}
              </h4>
              <p className="text-xs text-slate-400 truncate mt-0.5 font-mono">{downloadProgress.filename}</p>
            </div>
            {downloadProgress.status === "downloading" && (
              <span className="text-xs font-bold text-purple-600 bg-purple-50 border border-purple-100 rounded px-1.5 py-0.5 animate-pulse">
                Active
              </span>
            )}
          </div>

          {/* Progress Bar Container */}
          <div className="space-y-2">
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden relative">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  downloadProgress.status === "complete" ? "bg-emerald-500" : "bg-purple-600"
                }`}
                style={{ width: `${downloadProgress.percent}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-xs text-slate-500 font-semibold">
              <span>{downloadProgress.percent.toFixed(0)}%</span>
              <span>{formatBytes(downloadProgress.loaded)} / {formatBytes(downloadProgress.total)}</span>
            </div>
          </div>

          {/* Transfer stats: Speed & ETA */}
          {downloadProgress.status === "downloading" && (
            <div className="mt-3.5 pt-3 border-t border-slate-100 flex justify-between text-[11px] text-slate-400 font-semibold">
              <div className="flex items-center gap-1">
                <span>Speed:</span>
                <span className="text-slate-600 font-bold font-mono">
                  {downloadProgress.speed > 0 ? `${(downloadProgress.speed / (1024 * 1024)).toFixed(1)} MB/s` : "Calculating..."}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span>ETA:</span>
                <span className="text-slate-600 font-bold">
                  {downloadProgress.eta !== null ? `${downloadProgress.eta}s remaining` : "Calculating..."}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl ring-1 ring-black/5 animate-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-center gap-3 w-full">
            {toast.type === "success" ? (
              <svg className="h-5 w-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="h-5 w-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <div className="text-sm font-medium text-slate-800 flex-1">{toast.message}</div>
            <button
              onClick={() => setToast(null)}
              className="ml-auto pl-3 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              aria-label="Close toast"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
