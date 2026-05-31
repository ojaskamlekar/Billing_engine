import React from "react";

export default function InvoiceTab({ invoice, loading, error, onRetry }) {
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

  const handleDownload = () => {
    window.location.href = "http://127.0.0.1:8000/invoice/download";
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
            onClick={handleDownload}
            disabled={loading || error || !invoice}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Invoice PDF
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
    </div>
  );
}
