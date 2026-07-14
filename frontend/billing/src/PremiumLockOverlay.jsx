
export default function PremiumLockOverlay({ message, onUpgradeClick }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      {/* Blurred background placeholder mimicking a live dashboard layout */}
      <div className="select-none opacity-20 filter blur-[4px] pointer-events-none">
        <div className="h-8 bg-slate-200 rounded w-1/4 mb-4" />
        <div className="h-4 bg-slate-200 rounded w-full mb-2" />
        <div className="h-4 bg-slate-200 rounded w-5/6 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-32 bg-slate-100 rounded-xl" />
          <div className="h-32 bg-slate-100 rounded-xl" />
        </div>
      </div>

      {/* Centered glassmorphic locks panel */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/5 backdrop-blur-[1px] p-6 text-center">
        <div className="max-w-md rounded-2xl border border-slate-200/60 bg-white/95 p-8 shadow-xl backdrop-blur-md">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="mt-5 text-lg font-bold text-slate-900">🔒 Upgrade to Pro</h3>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            {message || "Upgrade to a Pro or Enterprise subscription to unlock cost forecasting, advanced analytics, custom PDF invoice downloads, and intelligent cloud tier recommendation insights."}
          </p>
          <button
            type="button"
            onClick={onUpgradeClick}
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-150 hover:bg-indigo-500 transition cursor-pointer"
          >
            Upgrade Now
          </button>
        </div>
      </div>
    </div>
  );
}
