import React from "react";

export default function NotificationBell({ alerts, onClick }) {
  const hasAlert = alerts && alerts.alert && alerts.severity && alerts.severity !== "none";
  const severity = alerts?.severity?.toLowerCase();
  
  let badgeColor = "";
  if (hasAlert) {
    if (severity === "critical") {
      badgeColor = "bg-rose-500 text-white animate-pulse ring-2 ring-white";
    } else if (severity === "warning") {
      badgeColor = "bg-amber-500 text-white ring-2 ring-white";
    }
  }

  return (
    <div className="fixed top-5 right-6 z-50 flex items-center">
      <button
        onClick={onClick}
        aria-label="View billing alerts"
        className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-all duration-200 hover:bg-slate-50 hover:shadow focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      >
        {/* Bell Icon */}
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>

        {/* Badge count */}
        {hasAlert && (
          <span className={`absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${badgeColor}`}>
            1
          </span>
        )}
      </button>
    </div>
  );
}
