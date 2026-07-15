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
      <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-100">
        Login
      </span>
    );
  }
  if (norm.includes("upload")) {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-100">
        Upload
      </span>
    );
  }
  if (norm.includes("delete")) {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 border border-rose-100">
        Delete
      </span>
    );
  }
  if (norm.includes("invoice")) {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700 border border-purple-100">
        Invoice
      </span>
    );
  }
  if (norm.includes("subscription")) {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-100">
        Subscription
      </span>
    );
  }
  if (norm.includes("failed")) {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 border border-red-150">
        Failed Login
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-700 border border-zinc-200">
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
    <div className="space-y-6">
      
      {/* Tab card */}
      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white text-left">
        
        {/* Header */}
        <div className="border-b border-zinc-200 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
              <ShieldAlert className="h-4.5 w-4.5 text-[#635BFF]" />
              Enterprise Audit Logs
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Detailed history of all major security actions, resource modifications, and user access records.
            </p>
          </div>
          
          <button
            type="button"
            onClick={fetchLogs}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950 transition cursor-pointer select-none disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-zinc-500 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/20">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
            
            {/* Search Bar */}
            <div className="lg:col-span-2">
              <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 text-left">Search Logs</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search description, resource..."
                  value={tempSearch}
                  onChange={(e) => setTempSearch(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white pl-8 pr-3 py-2 text-xs text-zinc-805 focus:border-[#635BFF] focus:ring-1 focus:ring-[#635BFF] outline-none transition"
                />
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
              </div>
            </div>

            {/* Action Filter */}
            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 text-left">Action Type</label>
              <select
                value={action}
                onChange={(e) => { setAction(e.target.value); setPage(1); }}
                className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs text-zinc-850 focus:border-[#635BFF] focus:ring-1 focus:ring-[#635BFF] outline-none transition cursor-pointer"
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
              <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 text-left">From Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-800 focus:border-[#635BFF] focus:ring-1 focus:ring-[#635BFF] outline-none transition cursor-pointer"
              />
            </div>

            {/* To Date */}
            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 text-left">To Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-800 focus:border-[#635BFF] focus:ring-1 focus:ring-[#635BFF] outline-none transition cursor-pointer"
              />
            </div>

            {/* Sort Order */}
            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 text-left">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
                className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs text-zinc-850 focus:border-[#635BFF] focus:ring-1 focus:ring-[#635BFF] outline-none transition cursor-pointer"
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
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950 transition cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="py-20 text-center text-xs text-zinc-500 animate-pulse flex flex-col items-center justify-center">
            <RefreshCw className="h-6 w-6 text-[#635BFF] animate-spin mb-3" />
            Loading security audit logs…
          </div>
        ) : error ? (
          <div className="py-16 text-center text-xs text-red-500 bg-red-50/50 border-b border-zinc-200">
            {error}
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-zinc-550 bg-white flex flex-col items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-50 border border-zinc-200 text-zinc-400 mb-4 animate-pulse">
              <Info className="h-8 w-8 text-zinc-400" />
            </div>
            <p className="text-sm font-bold text-zinc-900">No logs found</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-xs">
              There are no audit events matching your current search parameters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200">
              <thead className="bg-zinc-50/50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 text-left">Time</th>
                  <th scope="col" className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 text-left">Action</th>
                  <th scope="col" className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 text-left">Resource</th>
                  <th scope="col" className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 text-left">Description</th>
                  <th scope="col" className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 text-left">IP Address</th>
                  <th scope="col" className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {logs.map((log) => {
                  const isFailed = String(log.action || "").toLowerCase().includes("failed");
                  return (
                    <tr
                      key={log.id}
                      className="transition-colors hover:bg-zinc-50/50"
                    >
                      <td className="whitespace-nowrap px-6 py-3.5 text-xs text-zinc-600 text-left">
                        <div className="font-semibold text-zinc-800">{getRelativeTime(log.created_at)}</div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">{formatAbsoluteDate(log.created_at)}</div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-3.5 text-left">
                        {getActionBadge(log.action)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3.5 text-xs text-left font-medium text-zinc-800 max-w-xs truncate" title={log.resource_name}>
                        <div className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider mb-0.5">{log.resource_type || "General"}</div>
                        <div className="truncate font-bold text-zinc-700">{log.resource_name || "—"}</div>
                      </td>
                      <td className="px-6 py-3.5 text-xs text-zinc-650 text-left max-w-sm truncate" title={log.description}>
                        {log.description || "—"}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3.5 text-xs text-zinc-650 text-left">
                        <div className="font-mono text-zinc-705">{log.ip_address || "Local"}</div>
                        <div className="text-[9px] text-zinc-400 max-w-[120px] truncate" title={log.user_agent}>{log.user_agent || "N/A"}</div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-3.5 text-left">
                        {isFailed ? (
                          <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                            Failed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
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
          <div className="px-5 py-4 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-50/10">
            <div className="text-[11px] text-zinc-500">
              Showing <span className="font-semibold text-zinc-800">{(page - 1) * limit + 1}</span> to{" "}
              <span className="font-semibold text-zinc-800">{Math.min(page * limit, totalItems)}</span> of{" "}
              <span className="font-semibold text-zinc-800">{totalItems}</span> events
              {isFilterActive && " (filtered)"}
            </div>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className={`rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 transition cursor-pointer select-none ${
                  page === 1 ? "opacity-50 cursor-not-allowed bg-zinc-50" : "hover:bg-zinc-50 hover:text-zinc-955"
                }`}
              >
                Previous
              </button>
              
              <span className="text-xs text-zinc-500 font-medium px-1">
                Page <span className="font-semibold text-zinc-800">{page}</span> of{" "}
                <span className="font-semibold text-zinc-800">{totalPages}</span>
              </span>

              <button
                type="button"
                disabled={page === totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className={`rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 transition cursor-pointer select-none ${
                  page === totalPages ? "opacity-50 cursor-not-allowed bg-zinc-50" : "hover:bg-zinc-50 hover:text-zinc-955"
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
