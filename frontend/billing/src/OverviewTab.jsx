import { useState, useEffect } from "react";
import UploadFile from "./UploadFile";

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / 1024 ** i;
  return `${value.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function KpiCard({ label, value, subtext, icon, isLocked, onUpgradeClick, valueClassName }) {
  if (isLocked) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-zinc-250/80 bg-zinc-50/50 p-6 text-left shadow-[0_1px_3px_rgba(0,0,0,0.03)] group transition-all duration-200 hover:shadow-sm">
        <div className="opacity-40">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-sans">{label}</p>
          <p className="mt-2 text-xl font-bold tracking-tight text-zinc-400">—</p>
          <p className="mt-1 text-[11px] text-zinc-400 font-medium">Upgrade required</p>
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/2 md:bg-transparent backdrop-blur-[0.5px] p-4">
          <button
            onClick={onUpgradeClick}
            className="flex items-center gap-1.5 rounded-lg bg-[#635BFF] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5249f0] transition shadow-sm cursor-pointer border-0"
          >
            <span>🔒 Unlock metrics</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 text-left shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-all duration-200 hover:shadow-md hover:border-zinc-300">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-sans">{label}</p>
          <p className={`mt-2.5 truncate text-2xl font-bold tracking-tight text-zinc-900 inline-block transition-all duration-300 ${valueClassName || ""}`}>
            {value}
          </p>
          {subtext && (
            <p className="mt-1 text-xs text-zinc-500 font-medium">{subtext}</p>
          )}
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-50 border border-zinc-200 text-zinc-500 shadow-xs transition-colors">
          {icon}
        </div>
      </div>
    </div>
  );
}

function FileIcon() {
  return (
    <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

function StorageIcon() {
  return (
    <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
    </svg>
  );
}

function CostIcon() {
  return (
    <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function PlanIcon() {
  return (
    <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

export default function OverviewTab({
  usage,
  summary,
  forecast,
  recommendation,
  loading,
  recLoading,
  recError,
  onRetryRecommendation,
  onUploaded,
  plan = "Free",
  onUpgradeClick
}) {
  const totalStorageBytes = summary?.total_storage_bytes ?? 0;
  const currentPlan = plan;
  const isFree = plan === "Free";

  const [animateStorage, setAnimateStorage] = useState(false);
  const [animateCost, setAnimateCost] = useState(false);
  const [prevStorage, setPrevStorage] = useState(totalStorageBytes);
  const [prevCost, setPrevCost] = useState(summary?.total_cost ?? 0);

  useEffect(() => {
    if (totalStorageBytes < prevStorage) {
      setAnimateStorage(true);
      const timer = setTimeout(() => setAnimateStorage(false), 600);
      return () => clearTimeout(timer);
    }
    setPrevStorage(totalStorageBytes);
  }, [totalStorageBytes, prevStorage]);

  useEffect(() => {
    const currentCost = summary?.total_cost ?? 0;
    if (currentCost < prevCost) {
      setAnimateCost(true);
      const timer = setTimeout(() => setAnimateCost(false), 600);
      return () => clearTimeout(timer);
    }
    setPrevCost(currentCost);
  }, [summary?.total_cost, prevCost]);

  // Subscription configuration
  const storageLimits = {
    Free: 5 * 1024 * 1024 * 1024,
    Pro: 100 * 1024 * 1024 * 1024,
    Enterprise: 5 * 1024 * 1024 * 1024 * 1024
  };

  const limitBytes = storageLimits[plan] ?? (5 * 1024 * 1024 * 1024);
  const usagePercentage = limitBytes ? Math.min((totalStorageBytes / limitBytes) * 100, 100) : 0;

  const currentStorageMb = summary ? (summary.total_storage_bytes / (1024 * 1024)).toFixed(2) : "0.00";
  const recommendedPlan = recommendation?.recommended_plan ?? "—";
  
  const isDataLoading = loading || recLoading;

  const getPlanBadgeColor = (p) => {
    switch (p?.toLowerCase()) {
      case "free":
        return "bg-zinc-50 text-zinc-650 border-zinc-200";
      case "pro":
        return "bg-indigo-50/60 text-[#635BFF] border-purple-200/40";
      case "enterprise":
        return "bg-purple-50 text-purple-700 border-purple-200/80";
      default:
        return "bg-zinc-50 text-zinc-600 border-zinc-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* 4 KPI Metrics in a row */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Overview metrics">
        <KpiCard
          label="Total Files"
          value={loading ? "—" : usage.length.toLocaleString()}
          subtext="Objects in storage"
          icon={<FileIcon />}
        />
        <KpiCard
          label="Storage Used"
          value={loading ? "—" : formatBytes(totalStorageBytes)}
          subtext={loading ? "" : `${(totalStorageBytes / 1024 ** 3).toFixed(3)} GB / ${plan === "Enterprise" ? "5120" : plan === "Pro" ? "100" : "5"} GB`}
          icon={<StorageIcon />}
          valueClassName={animateStorage ? "animate-value-decrease" : ""}
        />
        <KpiCard
          label="Total Cost"
          value={loading ? "—" : `₹${summary?.total_cost ?? 0}`}
          subtext="Pay-as-you-go · estimated"
          icon={<CostIcon />}
          valueClassName={animateCost ? "animate-value-decrease" : ""}
        />
        <KpiCard
          label="Current Plan"
          value={loading ? "—" : currentPlan}
          subtext="Active subscription"
          icon={<PlanIcon />}
        />
      </section>

      {/* Storage Progress Bar */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6 text-left shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wider">Storage Limit Quota</h3>
            <p className="text-xs text-zinc-500 mt-1">
              Currently using {formatBytes(totalStorageBytes)} out of {plan === "Enterprise" ? "5 TB" : plan === "Pro" ? "100 GB" : "5 GB"}
            </p>
          </div>
          <span className="text-xs font-bold text-zinc-700">{usagePercentage.toFixed(1)}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              usagePercentage < 90 ? "bg-gradient-to-r from-[#635BFF] to-[#5249f0]" : "bg-red-500"
            }`}
            style={{ width: `${usagePercentage}%` }}
          />
        </div>
      </section>

      {/* Upload File Section */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6 text-left shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h2 className="text-xs font-bold text-zinc-800 uppercase tracking-wider">Add Objects</h2>
            <p className="text-xs text-zinc-500 mt-1">
              Max upload size: {plan === "Enterprise" ? "5 GB" : plan === "Pro" ? "500 MB" : "25 MB"}.
            </p>
          </div>
        </div>

        <UploadFile onUploaded={onUploaded} />
      </section>

      {/* Executive Billing Summary Card */}
      <section aria-label="Main business summary">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-left relative shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-150 pb-4 gap-4">
            <div>
              <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wider">Executive Billing Summary</h3>
              <p className="text-xs text-zinc-500 mt-1">Overview of current metered usage stats.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 font-medium">Plan:</span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border ${getPlanBadgeColor(currentPlan)}`}>
                {currentPlan}
              </span>
            </div>
          </div>

          {isFree ? (
            <div className="relative mt-6 min-h-[160px]">
              {/* Blurred dummy panel */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 filter blur-[2px] opacity-20 pointer-events-none select-none">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 h-24" />
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 h-24" />
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 h-24" />
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 h-24" />
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                <div className="max-w-xs rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                  <span className="text-xs font-bold text-zinc-850">🔒 Pro Access Required</span>
                  <p className="mt-1 text-[11px] text-zinc-500 leading-relaxed">
                    Unlocks AI-backed storage health recommendation models and advanced transaction logs.
                  </p>
                  <button
                    onClick={onUpgradeClick}
                    className="mt-3 rounded-lg bg-[#635BFF] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#5249f0] transition shadow-xs cursor-pointer border-0"
                  >
                    Upgrade Now
                  </button>
                </div>
              </div>
            </div>
          ) : isDataLoading ? (
            <div className="mt-6 space-y-4 animate-pulse">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-16 bg-zinc-100 rounded-lg" />
                ))}
              </div>
            </div>
          ) : recError ? (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50/30 p-4 text-xs text-red-800">
              <h4 className="font-bold">Failed to load billing metrics</h4>
              <p className="text-red-650 mt-1">There was a problem retrieving data from the recommender engine.</p>
              <button
                onClick={onRetryRecommendation}
                className="mt-3 inline-flex items-center justify-center rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-500 transition cursor-pointer border-0"
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="mt-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                
                {/* Metric 1: Current Storage */}
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/10 p-4 flex flex-col justify-between shadow-xs">
                  <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider">Current Storage</span>
                  <div className="mt-2.5 flex items-baseline gap-1">
                    <span className="text-xl font-extrabold text-zinc-900">{currentStorageMb}</span>
                    <span className="text-[10px] font-bold text-zinc-500">MB</span>
                  </div>
                  <span className="mt-2 text-[10px] text-zinc-450 font-medium">Total uploaded data</span>
                </div>
 
                {/* Metric 2: API Requests */}
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/10 p-4 flex flex-col justify-between shadow-xs">
                  <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider">API Requests</span>
                  <div className="mt-2.5 flex items-baseline gap-1">
                    <span className="text-xl font-extrabold text-zinc-900">{(summary?.api_requests_count ?? 0).toLocaleString()}</span>
                    <span className="text-[10px] font-bold text-zinc-500">reqs</span>
                  </div>
                  <span className="mt-2 text-[10px] text-zinc-450 font-medium">Total API calls made</span>
                </div>
 
                {/* Metric 3: Bandwidth Used */}
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/10 p-4 flex flex-col justify-between shadow-xs">
                  <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider">Bandwidth Used</span>
                  <div className="mt-2.5 flex items-baseline gap-1">
                    <span className="text-xl font-extrabold text-zinc-900">{formatBytes(summary?.bandwidth_bytes ?? 0)}</span>
                  </div>
                  <span className="mt-2 text-[10px] text-zinc-450 font-medium">Data transferred out</span>
                </div>
 
                {/* Metric 4: Recommended Plan */}
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/10 p-4 flex flex-col justify-between shadow-xs">
                  <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider">Recommended Plan</span>
                  <div className="mt-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border ${getPlanBadgeColor(recommendedPlan)}`}>
                      {recommendedPlan}
                    </span>
                  </div>
                  <span className="mt-2 text-[10px] text-zinc-450 font-medium">Cost-efficiency match</span>
                </div>
 
              </div>
              
              <div className="mt-4 rounded-lg bg-purple-50/30 border border-purple-100/50 px-4 py-3 text-xs text-purple-900 flex items-start gap-2.5">
                <svg className="h-4.5 w-4.5 text-[#635BFF] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="leading-relaxed text-[11px]">
                  <strong className="font-semibold text-purple-950">Recommender Insight:</strong> {recommendation?.reason || "Insights will be available once we gather sufficient usage logs details."}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
