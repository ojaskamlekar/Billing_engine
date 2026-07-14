
export default function BillShockAlert({ alertData, loading, error }) {
  if (loading) {
    return (
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm animate-pulse flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 rounded-full bg-slate-100 shrink-0" />
          <div className="h-4 w-64 rounded bg-slate-100" />
        </div>
        <div className="h-4 w-20 rounded bg-slate-100" />
      </div>
    );
  }

  // Gracefully hide banner if there is an API error or if no alert exists
  if (error || !alertData || !alertData.alert || alertData.severity === "none") {
    return null;
  }

  const { severity, current_plan, plan_limit_mb, forecasted_storage_mb, recommended_plan, message } = alertData;

  const isCritical = severity?.toLowerCase() === "critical";

  // Color theme definitions matching SaaS standards
  const bannerStyles = isCritical
    ? "bg-red-50 border-red-200 text-red-900"
    : "bg-amber-50 border-amber-200 text-amber-900";

  const getBadgeStyles = (plan) => {
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

  return (
    <div className={`mb-6 rounded-xl border p-4 shadow-sm ${bannerStyles} transition-all duration-300`}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left Side: Icon, Title, and Message */}
        <div className="flex items-start gap-3 text-left">
          <div className="mt-0.5 shrink-0">
            {isCritical ? (
              // Critical Circle Exclamation Icon
              <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              // Warning Triangle Icon
              <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
          </div>
          <div>
            <h4 className="text-sm font-semibold tracking-tight">
              {isCritical ? "Predictive Overage Alert: Plan Limit Exceeded" : "Billing Advisory: Approaching Plan Limits"}
            </h4>
            <p className="mt-1 text-xs opacity-90 leading-relaxed font-normal">{message}</p>
          </div>
        </div>

        {/* Right Side: Usage Details Metrics */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs lg:text-right shrink-0 lg:self-center">
          <div className="flex items-center gap-2">
            <span className="opacity-80">Plan:</span>
            <span className="font-semibold">
              {current_plan} ({plan_limit_mb >= 1024 * 1024 ? `${(plan_limit_mb / (1024 * 1024)).toFixed(0)} TB` : plan_limit_mb >= 1024 ? `${(plan_limit_mb / 1024).toFixed(0)} GB` : `${plan_limit_mb} MB`} limit)
            </span>
          </div>

          <div className="flex items-center gap-2 border-l border-slate-300 lg:border-current/20 pl-4">
            <span className="opacity-80">Forecasted usage:</span>
            <span className="font-bold underline decoration-wavy decoration-red-500/80">
              {forecasted_storage_mb >= 1024 * 1024 ? `${(forecasted_storage_mb / (1024 * 1024)).toFixed(2)} TB` : forecasted_storage_mb >= 1024 ? `${(forecasted_storage_mb / 1024).toFixed(2)} GB` : `${forecasted_storage_mb} MB`}
            </span>
          </div>

          <div className="flex items-center gap-2 border-l border-slate-300 lg:border-current/20 pl-4">
            <span className="opacity-80">Recommended Upgrade:</span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${getBadgeStyles(recommended_plan)}`}>
              {recommended_plan}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
