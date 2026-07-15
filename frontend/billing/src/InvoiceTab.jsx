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
        return "bg-zinc-100 text-zinc-700 border-zinc-200";
      case "pro":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "enterprise":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      default:
        return "bg-zinc-50 text-zinc-700 border-zinc-200";
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
              className="bg-zinc-800 hover:bg-zinc-900 text-white font-semibold text-xs px-2.5 py-1 rounded transition cursor-pointer"
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
      <div className="rounded-xl border border-zinc-200 bg-white text-left overflow-hidden">
        
        <div className="bg-zinc-50 border-b border-zinc-200 p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#635BFF]">Invoice Statement</span>
            <h2 className="text-lg font-bold text-zinc-900 mt-0.5">
              {loading ? "INV-2026-XXXX" : invoice?.invoice_id}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">Generated on {loading ? "—" : invoice?.generated_at}</p>
          </div>
           <button
            onClick={() => handleDownload()}
            disabled={loading || error || !invoice || downloading || completed}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold text-white transition cursor-pointer ${
              completed
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-[#635BFF] hover:bg-[#5249f0]"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {downloading ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Downloading...
              </>
            ) : completed ? (
              <>
                <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                ✓ Downloaded
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download PDF
              </>
            )}
          </button>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-10 w-44 bg-zinc-100 rounded" />
              <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-10 bg-zinc-100 rounded" />
                ))}
              </div>
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-100 bg-red-50/50 p-4 text-xs text-red-600">
              <p className="font-semibold">Failed to load invoice details</p>
              <button
                onClick={onRetry}
                className="mt-2 font-medium underline hover:text-red-800 focus:outline-none block"
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="border border-zinc-200 rounded-xl p-4 bg-zinc-50/10">
                <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2.5">Customer Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-zinc-400 font-medium">Customer Name</p>
                    <p className="font-semibold text-zinc-800 mt-0.5">{invoice?.customer_name || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-zinc-400 font-medium">Customer Email</p>
                    <p className="font-semibold text-zinc-800 mt-0.5">{invoice?.customer_email || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-zinc-400 font-medium">Billing Period</p>
                    <p className="font-semibold text-zinc-800 mt-0.5">{invoice?.billing_period}</p>
                  </div>
                  <div>
                    <p className="text-zinc-400 font-medium">Billing Model</p>
                    <p className="font-semibold text-zinc-800 mt-0.5">Usage-Based (Pay As You Go)</p>
                  </div>
                  <div>
                    <p className="text-zinc-400 font-medium">Current Plan</p>
                    <p className="mt-0.5">
                      <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold border ${getBadgeColor(invoice?.plan)}`}>
                        {invoice?.plan}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-400 font-medium">Generated Date</p>
                    <p className="font-semibold text-zinc-800 mt-0.5">{invoice?.generated_at}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2.5">Usage Summary</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="border border-zinc-200 rounded-xl p-3.5 bg-white transition-colors hover:border-zinc-300">
                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Storage Used</span>
                    <p className="text-lg font-bold text-zinc-800 mt-1">{formatBytes(invoice?.total_bytes)}</p>
                  </div>
                  <div className="border border-zinc-200 rounded-xl p-3.5 bg-white transition-colors hover:border-zinc-300">
                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">API Requests</span>
                    <p className="text-lg font-bold text-zinc-800 mt-1">{invoice?.api_requests_count?.toLocaleString() || 0}</p>
                  </div>
                  <div className="border border-zinc-200 rounded-xl p-3.5 bg-white transition-colors hover:border-zinc-300">
                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Bandwidth Used</span>
                    <p className="text-lg font-bold text-zinc-800 mt-1">{formatBytes(invoice?.bandwidth_bytes)}</p>
                  </div>
                  <div className="border border-zinc-200 rounded-xl p-3.5 bg-white transition-colors hover:border-zinc-300">
                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Total Files Stored</span>
                    <p className="text-lg font-bold text-zinc-800 mt-1">{invoice?.total_files?.toLocaleString() || 0} files</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2.5">Billing Breakdown</h3>
                <div className="border border-zinc-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-semibold">
                        <th className="p-3">Charge Component</th>
                        <th className="p-3">Calculations</th>
                        <th className="p-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 text-zinc-700">
                      <tr>
                        <td className="p-3 font-medium">Storage Charges</td>
                        <td className="p-3 font-mono text-[10px] text-zinc-500">
                          {invoice?.storage_used_mb?.toFixed(2)} MB × ₹{invoice?.pricing_config?.storage_price_per_mb?.toFixed(3)} / MB
                        </td>
                        <td className="p-3 text-right font-semibold text-zinc-800">₹{invoice?.storage_cost?.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-medium">API Request Charges</td>
                        <td className="p-3 font-mono text-[10px] text-zinc-500">
                          {invoice?.api_requests_count?.toLocaleString()} Requests × ₹{invoice?.pricing_config?.api_price_per_request?.toFixed(4)} / Request
                        </td>
                        <td className="p-3 text-right font-semibold text-zinc-800">₹{invoice?.api_request_cost?.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-medium">Bandwidth Charges</td>
                        <td className="p-3 font-mono text-[10px] text-zinc-500">
                          {((invoice?.bandwidth_bytes || 0) / (1024 * 1024 * 1024))?.toFixed(4)} GB × ₹{invoice?.pricing_config?.bandwidth_price_per_gb?.toFixed(2)} / GB
                        </td>
                        <td className="p-3 text-right font-semibold text-zinc-800">₹{invoice?.bandwidth_cost?.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end">
                <div className="w-full sm:w-60 border border-zinc-200 rounded-xl p-4 bg-zinc-50/10 space-y-2 text-xs">
                  <div className="flex justify-between text-zinc-500">
                    <span>Subtotal</span>
                    <span className="font-semibold text-zinc-800">₹{invoice?.subtotal?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-500">
                    <span>GST (0%)</span>
                    <span className="font-semibold text-zinc-800">₹0.00</span>
                  </div>
                  <div className="border-t border-zinc-200 pt-2 flex justify-between items-center text-xs">
                    <span className="font-bold text-zinc-900">Grand Total</span>
                    <span className="text-base font-bold text-[#635BFF]">₹{invoice?.total_amount?.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {invoice?.billing_insights && invoice.billing_insights.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2.5">Billing Insights</h3>
                  <div className="border border-amber-200 bg-amber-50/20 rounded-xl p-3.5 space-y-1.5">
                    {invoice.billing_insights.map((insight, idx) => (
                      <div key={idx} className="flex items-start gap-1.5 text-xs text-amber-900 font-medium">
                        <span className="text-amber-500 mt-0.5">•</span>
                        <span>{insight}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2.5">Pricing Reference</h3>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="border border-zinc-200 rounded-xl p-3 bg-zinc-50/10">
                    <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Storage</p>
                    <p className="text-xs font-semibold text-zinc-800 mt-0.5">₹{invoice?.pricing_config?.storage_price_per_mb?.toFixed(2)} / MB</p>
                  </div>
                  <div className="border border-zinc-200 rounded-xl p-3 bg-zinc-50/10">
                    <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">API Requests</p>
                    <p className="text-xs font-semibold text-zinc-800 mt-0.5">₹{invoice?.pricing_config?.api_price_per_request?.toFixed(3)} / req</p>
                  </div>
                  <div className="border border-zinc-200 rounded-xl p-3 bg-zinc-50/10">
                    <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Bandwidth</p>
                    <p className="text-xs font-semibold text-zinc-800 mt-0.5">₹{invoice?.pricing_config?.bandwidth_price_per_gb?.toFixed(2)} / GB</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-zinc-200 pt-4 text-center space-y-0.5">
                <p className="text-[11px] font-semibold text-zinc-500 italic">Thank you for choosing WeCloud.</p>
                <p className="text-[9px] text-zinc-400">
                  This invoice was generated automatically by the WeCloud Billing Engine.
                </p>
              </div>
            </div>
          )}
        </div>

      </div>

      {downloadProgress && (
        <div className="fixed bottom-6 left-6 z-50 flex w-full max-w-sm flex-col rounded-xl border border-zinc-200 bg-white p-4 shadow-sm text-left">
          <div className="flex items-start justify-between mb-2">
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-zinc-800 truncate">
                {downloadProgress.status === "complete" ? "✓ Download Complete" : "Downloading invoice..."}
              </h4>
              <p className="text-[10px] text-zinc-400 truncate font-mono">{downloadProgress.filename}</p>
            </div>
            {downloadProgress.status === "downloading" && (
              <span className="text-[10px] font-semibold text-[#635BFF] bg-purple-50 border border-purple-100 rounded px-1.5 py-0.5 animate-pulse">
                Active
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden relative">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  downloadProgress.status === "complete" ? "bg-emerald-500" : "bg-[#635BFF]"
                }`}
                style={{ width: `${downloadProgress.percent}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] text-zinc-500 font-semibold">
              <span>{downloadProgress.percent.toFixed(0)}%</span>
              <span>{formatBytes(downloadProgress.loaded)} / {formatBytes(downloadProgress.total)}</span>
            </div>
          </div>

          {downloadProgress.status === "downloading" && (
            <div className="mt-2.5 pt-2 border-t border-zinc-200 flex justify-between text-[10px] text-zinc-400 font-semibold">
              <div className="flex items-center gap-1">
                <span>Speed:</span>
                <span className="text-zinc-700 font-bold font-mono">
                  {downloadProgress.speed > 0 ? `${(downloadProgress.speed / (1024 * 1024)).toFixed(1)} MB/s` : "Calculating..."}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span>ETA:</span>
                <span className="text-zinc-700 font-bold">
                  {downloadProgress.eta !== null ? `${downloadProgress.eta}s remaining` : "Calculating..."}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2.5 w-full">
            {toast.type === "success" ? (
              <svg className="h-4.5 w-4.5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="h-4.5 w-4.5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <div className="text-xs font-semibold text-zinc-800 flex-1">{toast.message}</div>
            <button
              onClick={() => setToast(null)}
              className="ml-auto pl-2 text-zinc-400 hover:text-zinc-600 transition cursor-pointer"
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
