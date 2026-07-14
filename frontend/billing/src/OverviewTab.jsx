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
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50/50 p-6 shadow-sm text-left">
        <div className="opacity-30">
          <p className="text-sm font-medium text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-400">—</p>
          <p className="mt-1 text-xs text-slate-400">Locked</p>
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/5 backdrop-blur-[0.5px]">
          <button
            onClick={onUpgradeClick}
            className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-slate-700 transition cursor-pointer"
          >
            <span>🔒 Upgrade</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md text-left">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className={`mt-2 truncate text-3xl font-semibold tracking-tight text-slate-900 inline-block transition-all duration-300 ${valueClassName || ""}`}>
            {value}
          </p>
          {subtext && (
            <p className="mt-1 text-xs text-slate-400">{subtext}</p>
          )}
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          {icon}
        </div>
      </div>
    </div>
  );
}

function FileIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

function StorageIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
    </svg>
  );
}

function CostIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function PlanIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
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

  // Rate config for cost card
  const rates = {
    Free: "₹0",
    Pro: "₹2",
    Enterprise: "₹1.5"
  };
  const activeRate = rates[plan] ?? "₹2";

  const currentStorageMb = summary ? (summary.total_storage_bytes / (1024 * 1024)).toFixed(2) : "0.00";
  const predictedStorage = forecast?.predicted_storage_mb ?? 0;
  const predictedCost = forecast?.predicted_cost ?? 0;
  const recommendedPlan = recommendation?.recommended_plan ?? "—";
  
  const isDataLoading = loading || recLoading;

  const getPlanBadgeColor = (p) => {
    switch (p?.toLowerCase()) {
      case "free":
        return "bg-slate-100 text-slate-700 border-slate-200/60";
      case "pro":
        return "bg-blue-50 text-blue-700 border-blue-200/60";
      case "enterprise":
        return "bg-purple-50 text-purple-700 border-purple-200/60";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200/60";
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
          label="Total Storage Used"
          value={loading ? "—" : formatBytes(totalStorageBytes)}
          subtext={loading ? "" : `${(totalStorageBytes / 1024 ** 3).toFixed(3)} GB / ${plan === "Enterprise" ? "5120" : plan === "Pro" ? "100" : "5"} GB`}
          icon={<StorageIcon />}
          valueClassName={animateStorage ? "animate-value-decrease" : ""}
        />
        <KpiCard
          label="Total Cost"
          value={loading ? "—" : `₹${summary?.total_cost ?? 0}`}
          subtext={`${activeRate}/MB · estimated`}
          icon={<CostIcon />}
          valueClassName={animateCost ? "animate-value-decrease" : ""}
        />
        <KpiCard
          label="Current Plan"
          value={loading ? "—" : currentPlan}
          subtext="Active billing subscription"
          icon={<PlanIcon />}
        />
      </section>

      {/* Storage Progress Bar */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm text-left">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Storage Usage ({formatBytes(totalStorageBytes)})</h3>
            <p className="text-xs text-slate-500">
              Subscription limit: {plan === "Enterprise" ? "5 TB" : plan === "Pro" ? "100 GB" : "5 GB"}
            </p>
          </div>
          <span className="text-sm font-bold text-slate-700">{usagePercentage.toFixed(1)}%</span>
        </div>
        <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              usagePercentage < 70
                ? "bg-emerald-500"
                : usagePercentage < 90
                ? "bg-amber-500"
                : "bg-red-500"
            }`}
            style={{ width: `${usagePercentage}%` }}
          />
        </div>
      </section>

      {/* Upload File Section */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm text-left">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Upload File</h2>
            <p className="text-sm text-slate-500">
              Add objects to your storage bucket. Usage is metered automatically. Max upload size is {plan === "Enterprise" ? "5 GB" : plan === "Pro" ? "500 MB" : "25 MB"}.
            </p>
          </div>
        </div>

        <UploadFile onUploaded={onUploaded} />
      </section>

      {/* Executive Billing Summary Card */}
      <section aria-label="Main business summary">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md text-left relative">
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-5 gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Executive Billing Summary</h3>
              <p className="text-sm text-slate-500 mt-0.5">Comprehensive overview of current and predicted cloud storage expenses.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">Current Plan:</span>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border ${getPlanBadgeColor(currentPlan)}`}>
                {currentPlan}
              </span>
            </div>
          </div>

          {isFree ? (
            <div className="relative mt-8 min-h-[180px]">
              {/* Blurred dummy panel */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 filter blur-[2px] opacity-20 pointer-events-none select-none">
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-5 h-28" />
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-5 h-28" />
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-5 h-28" />
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-5 h-28" />
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                <div className="max-w-sm rounded-xl border border-slate-200 bg-white/95 p-6 shadow-lg backdrop-blur-sm">
                  <span className="text-sm font-bold text-slate-800">🔒 Upgrade to Pro</span>
                  <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                    Unlocks cost forecasting, AI storage tier recommendation, and advanced billing metrics.
                  </p>
                  <button
                    onClick={onUpgradeClick}
                    className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 shadow transition cursor-pointer"
                  >
                    Upgrade Now
                  </button>
                </div>
              </div>
            </div>
          ) : isDataLoading ? (
            <div className="mt-8 space-y-6 animate-pulse">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-20 bg-slate-100 rounded-lg" />
                ))}
              </div>
            </div>
          ) : recError ? (
            <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">
              <h4 className="font-semibold">Failed to load billing metrics</h4>
              <p className="text-xs text-red-600 mt-1">There was a problem retrieving data from the recommender engine.</p>
              <button
                onClick={onRetryRecommendation}
                className="mt-3 inline-flex items-center justify-center rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-500 focus:outline-none transition cursor-pointer"
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="mt-8">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                
                {/* Metric 1: Current Storage */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-5 flex flex-col justify-between">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Current Storage</span>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-slate-900">{currentStorageMb}</span>
                    <span className="text-sm font-semibold text-slate-500">MB</span>
                  </div>
                  <span className="mt-2 text-xs text-slate-400">Total uploaded files data size</span>
                </div>

                {/* Metric 2: Forecast (30 Days) */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-5 flex flex-col justify-between">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Forecast (30 Days)</span>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-indigo-600">{predictedStorage}</span>
                    <span className="text-sm font-semibold text-indigo-500">MB</span>
                  </div>
                  <span className="mt-2 text-xs text-slate-400">Expected size based on trend</span>
                </div>

                {/* Metric 3: Forecast Cost */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-5 flex flex-col justify-between">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Forecast Cost</span>
                  <div className="mt-3 flex items-baseline gap-0.5">
                    <span className="text-2xl font-bold text-slate-900">₹{predictedCost}</span>
                  </div>
                  <span className="mt-2 text-xs text-slate-400">Estimated cost next month ({activeRate}/MB)</span>
                </div>

                {/* Metric 4: Recommended Plan */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-5 flex flex-col justify-between">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Recommended Plan</span>
                  <div className="mt-3">
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-bold border ${getPlanBadgeColor(recommendedPlan)}`}>
                      {recommendedPlan}
                    </span>
                  </div>
                  <span className="mt-2 text-xs text-slate-400">Best cost-efficiency match</span>
                </div>

              </div>
              
              <div className="mt-6 rounded-lg bg-indigo-50/50 border border-indigo-100/50 px-4 py-3 text-xs text-indigo-800 flex items-start gap-2.5">
                <svg className="h-4.5 w-4.5 text-indigo-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="leading-relaxed">
                  <strong className="font-semibold">Recommender Insight:</strong> {recommendation?.reason || "Insights will be available once we gather sufficient usage logs details."}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
