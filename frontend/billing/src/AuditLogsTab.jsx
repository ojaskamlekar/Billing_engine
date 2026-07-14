import { useState, useEffect, useCallback } from "react";
import { 
  ShieldAlert, 
  Search, 
  RefreshCw, 
  Info
} from "lucide-react";
import { api } from "./api";

function getRelativeTime(isoString) {
  if (!isoString) return "—";
  const date = new Date(isoString);
  const now = new Date();
  
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec} seconds ago`;
  if (diffMin === 1) return "1 minute ago";
  if (diffMin < 60) return `${diffMin} minutes ago`;
  if (diffHr === 1) return "1 hour ago";
  if (diffHr < 24) return `${diffHr} hours ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function formatAbsoluteDate(isoString) {
  if (!isoString) return "—";
  const date = new Date(isoString);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

const getActionBadge = (action) => {
  const norm = String(action || "").toLowerCase();
  
  if (norm.includes("login") && !norm.includes("failed")) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-100 shadow-xs">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Login
      </span>
    );
  }
  if (norm.includes("upload")) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-100 shadow-xs">
        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
        Upload
      </span>
    );
  }
  if (norm.includes("delete")) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 border border-red-100 shadow-xs">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        Delete
      </span>
    );
  }
  if (norm.includes("invoice")) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700 border border-purple-100 shadow-xs">
        <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
        Invoice
      </span>
    );
  }
  if (norm.includes("subscription")) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-100 shadow-xs">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Subscription
      </span>
    );
  }
  if (norm.includes("failed")) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700 border border-rose-250 shadow-sm animate-pulse">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
        Failed Login
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200">
      {action}
    </span>
  );
};

export default function AuditLogsTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter States
  const [search, setSearch] = useState("");
  const [tempSearch, setTempSearch] = useState("");
  const [action, setAction] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortBy, setSortBy] = useState("Newest");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const limit = 10;

  // Fetch function
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit,
        sort_by: sortBy
      };
      if (search.trim()) params.search = search.trim();
      if (action !== "All") params.action = action;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const response = await api.get("/audit-logs", { params });
      setLogs(response.data.items || []);
      setTotalPages(response.data.total_pages || 1);
      setTotalItems(response.data.total_items || 0);
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
      setError("Unable to load audit logs. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [page, search, action, startDate, endDate, sortBy]);

  // Fetch when dependency inputs trigger
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(tempSearch);
      setPage(1); // Reset page to 1
    }, 500);
    return () => clearTimeout(handler);
  }, [tempSearch]);

  const handleReset = () => {
    setTempSearch("");
    setSearch("");
    setAction("All");
    setStartDate("");
    setEndDate("");
    setSortBy("Newest");
    setPage(1);
  };

  const isFilterActive = search !== "" || action !== "All" || startDate !== "" || endDate !== "" || sortBy !== "Newest";

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      
      {/* Tab card */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm text-left">
        
        {/* Header */}
        <div className="border-b border-slate-200 px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-indigo-600" />
              Enterprise Audit Logs
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Detailed history of all major security actions, resource modifications, and user access records.
            </p>
          </div>
          
          <button
            type="button"
            onClick={fetchLogs}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition cursor-pointer select-none disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
            
            {/* Search Bar */}
            <div className="lg:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 text-left">Search Logs</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search description, resource..."
                  value={tempSearch}
                  onChange={(e) => setTempSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4 py-2.5 text-sm text-slate-800 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600 outline-none transition"
                />
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              </div>
            </div>

            {/* Action Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 text-left">Action Type</label>
              <select
                value={action}
                onChange={(e) => { setAction(e.target.value); setPage(1); }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600 outline-none transition cursor-pointer"
              >
                <option value="All">All Actions</option>
                <option value="User Registration">User Registration</option>
                <option value="User Login">User Login</option>
                <option value="Failed Login Attempt">Failed Login</option>
                <option value="Logout">Logout</option>
                <option value="File Upload">File Upload</option>
                <option value="File Delete">File Delete</option>
                <option value="Subscription Change">Subscription Change</option>
                <option value="Invoice Download">Invoice Download</option>
              </select>
            </div>

            {/* From Date */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 text-left">From Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600 outline-none transition cursor-pointer"
              />
            </div>

            {/* To Date */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 text-left">To Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600 outline-none transition cursor-pointer"
              />
            </div>

            {/* Sort Order */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 text-left">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600 outline-none transition cursor-pointer"
              >
                <option value="Newest">Newest First</option>
                <option value="Oldest">Oldest First</option>
              </select>
            </div>

          </div>

          {/* Reset button */}
          {isFilterActive && (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="py-24 text-center text-sm text-slate-500 animate-pulse flex flex-col items-center justify-center">
            <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin mb-3" />
            Loading security audit logs…
          </div>
        ) : error ? (
          <div className="py-16 text-center text-sm text-red-500 bg-red-50/50 border-b border-slate-150">
            {error}
          </div>
        ) : logs.length === 0 ? (
          <div className="py-20 text-center text-slate-500 bg-white flex flex-col items-center justify-center animate-in fade-in duration-300">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-400 mb-4 shadow-inner">
              <Info className="h-8 w-8 text-slate-350" />
            </div>
            <p className="text-base font-semibold text-slate-900">No logs found</p>
            <p className="text-sm text-slate-500 mt-1 max-w-sm">
              There are no audit events matching your current search parameters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 text-left">Time</th>
                  <th scope="col" className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 text-left">Action</th>
                  <th scope="col" className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 text-left">Resource</th>
                  <th scope="col" className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 text-left">Description</th>
                  <th scope="col" className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 text-left">IP Address</th>
                  <th scope="col" className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {logs.map((log) => {
                  const isFailed = String(log.action || "").toLowerCase().includes("failed");
                  return (
                    <tr
                      key={log.id}
                      className="transition-all duration-200 ease-out hover:bg-slate-50/70 hover:shadow-xs border-l-2 border-transparent hover:border-indigo-500"
                    >
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600 text-left">
                        <div className="font-semibold text-slate-800">{getRelativeTime(log.created_at)}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{formatAbsoluteDate(log.created_at)}</div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-left">
                        {getActionBadge(log.action)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-left font-medium text-slate-800 max-w-xs truncate" title={log.resource_name}>
                        <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-0.5">{log.resource_type || "General"}</div>
                        <div className="truncate font-bold text-slate-700">{log.resource_name || "—"}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 text-left max-w-sm truncate" title={log.description}>
                        {log.description || "—"}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-650 text-left">
                        <div className="font-mono text-slate-700">{log.ip_address || "Local"}</div>
                        <div className="text-[10px] text-slate-400 max-w-[120px] truncate" title={log.user_agent}>{log.user_agent || "N/A"}</div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-left">
                        {isFailed ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700 border border-red-200 shadow-xs">
                            Failed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200 shadow-xs">
                            Success
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {logs.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/30">
            <div className="text-xs text-slate-500">
              Showing <span className="font-semibold text-slate-800">{(page - 1) * limit + 1}</span> to{" "}
              <span className="font-semibold text-slate-800">{Math.min(page * limit, totalItems)}</span> of{" "}
              <span className="font-semibold text-slate-800">{totalItems}</span> events
              {isFilterActive && " (filtered)"}
            </div>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className={`rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition cursor-pointer select-none ${
                  page === 1 ? "opacity-50 cursor-not-allowed bg-slate-50" : "hover:bg-slate-50 hover:text-slate-950"
                }`}
              >
                Previous
              </button>
              
              <span className="text-xs text-slate-500 font-medium px-2">
                Page <span className="font-semibold text-slate-800">{page}</span> of{" "}
                <span className="font-semibold text-slate-800">{totalPages}</span>
              </span>

              <button
                type="button"
                disabled={page === totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className={`rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition cursor-pointer select-none ${
                  page === totalPages ? "opacity-50 cursor-not-allowed bg-slate-50" : "hover:bg-slate-50 hover:text-slate-955"
                }`}
              >
                Next
              </button>
            </div>
          </div>
        )}

      </section>
      
    </div>
  );
}
