
export default function AlertPopover({ alerts, onClose }) {
  if (!alerts) return null;

  const hasAlert = alerts.alert && alerts.severity && alerts.severity !== "none";
  const { severity, current_plan, plan_limit_mb, forecasted_storage_mb, recommended_plan, message } = alerts;
  const isCritical = severity?.toLowerCase() === "critical";

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
    <div className="fixed top-16 right-6 z-50 w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-2xl ring-1 ring-black/5 transition-all duration-300">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h4 className="text-sm font-semibold text-slate-900">Billing Alerts</h4>
        <button
          onClick={onClose}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          aria-label="Close popover"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="mt-4">
        {hasAlert ? (
          <div className="space-y-4 text-left">
            <div className={`rounded-lg border p-3 text-xs ${isCritical ? "bg-red-50 border-red-100 text-red-950" : "bg-amber-50 border-amber-100 text-amber-950"}`}>
              <div className="flex items-center gap-2 font-bold mb-1">
                {isCritical ? (
                  <svg className="h-4 w-4 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                )}
                <span>
                  {isCritical
                    ? "Predictive Overage: Plan Limit Exceeded"
                    : "Billing Advisory: Approaching Limits"}
                </span>
              </div>
              <p className="leading-relaxed opacity-90">{message}</p>
            </div>

            <div className="divide-y divide-slate-100 rounded-lg border border-slate-100 bg-slate-50/50 p-1 text-[13px]">
              <div className="flex justify-between py-2 px-3">
                <span className="text-slate-500">Current Plan</span>
                <span className="font-semibold text-slate-900">{current_plan}</span>
              </div>
              <div className="flex justify-between py-2 px-3">
                <span className="text-slate-500">Plan Limit</span>
                <span className="font-semibold text-slate-900">
                  {plan_limit_mb >= 1024 * 1024 ? `${(plan_limit_mb / (1024 * 1024)).toFixed(0)} TB` : plan_limit_mb >= 1024 ? `${(plan_limit_mb / 1024).toFixed(0)} GB` : `${plan_limit_mb} MB`}
                </span>
              </div>
              <div className="flex justify-between py-2 px-3">
                <span className="text-slate-500">Forecasted Storage</span>
                <span className="font-bold text-red-600">
                  {forecasted_storage_mb >= 1024 * 1024 ? `${(forecasted_storage_mb / (1024 * 1024)).toFixed(2)} TB` : forecasted_storage_mb >= 1024 ? `${(forecasted_storage_mb / 1024).toFixed(2)} GB` : `${forecasted_storage_mb} MB`}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 px-3">
                <span className="text-slate-500">Recommended Upgrade</span>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border ${getBadgeStyles(recommended_plan)}`}>
                  {recommended_plan}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-slate-500">
            <svg className="mx-auto h-8 w-8 text-emerald-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-semibold text-slate-900">No Billing Alerts</p>
            <p className="text-xs text-slate-400 mt-1">Usage is well within plan limits.</p>
          </div>
        )}
      </div>
    </div>
  );
}
