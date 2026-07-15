import { useState, useEffect, useCallback } from "react";
import { api } from "./api";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// ─── Helpers ────────────────────────────────────────────────────────────────
function fmt(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}
function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    year: "numeric", month: "short", day: "numeric",
  });
}

// ─── Health Score Ring ───────────────────────────────────────────────────────
function HealthScoreRing({ score }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDash = (score / 100) * circumference;

  const color = score >= 75 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";
  const label = score >= 75 ? "Excellent" : score >= 40 ? "Needs Attention" : "Critical";

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 flex flex-col items-center justify-center text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-3">Storage Health</p>
      <svg width="120" height="120" viewBox="0 0 140 140">
        {/* background ring */}
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#f4f4f5" strokeWidth="12" />
        {/* progress ring */}
        <circle
          cx="70" cy="70" r={radius} fill="none"
          stroke={color} strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${strokeDash} ${circumference}`}
          strokeDashoffset="0"
          transform="rotate(-90 70 70)"
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
        <text x="70" y="65" textAnchor="middle" fontSize="28" fontWeight="800" fill="#18181b">{score}</text>
        <text x="70" y="84" textAnchor="middle" fontSize="10" fill="#71717a">/100</text>
      </svg>
      <span
        className="mt-3 rounded px-2.5 py-0.5 text-[10px] font-bold border"
        style={{ backgroundColor: `${color}10`, borderColor: `${color}30`, color }}
      >
        {label}
      </span>
    </div>
  );
}

// ─── Summary Stat Card ───────────────────────────────────────────────────────
function SummaryCard({ label, value, sub, icon, accent }) {
  const accents = {
    indigo: "bg-purple-50 text-[#635BFF] border-purple-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    red: "bg-rose-50 text-rose-600 border-rose-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
  };
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 flex flex-col gap-2.5 text-left">
      <div className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${accents[accent] || "bg-zinc-50 border-zinc-200"}`}>
        {icon}
      </div>
      <div>
        <p className="text-xl font-bold text-zinc-900">{value}</p>
        <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-zinc-500 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Recommendation Card ─────────────────────────────────────────────────────
const REC_ICONS = {
  "alert-circle":   <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  "alert-triangle": <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>,
  "copy":           <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>,
  "hard-drive":     <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><line x1="22" y1="12" x2="2" y2="12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>,
  "clock":          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  "download-off":   <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><line x1="1" y1="1" x2="23" y2="23"/><path d="M12 12v4m-4 0h8M3 3h18v18H3z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
};
const SEV_STYLES = {
  critical: "bg-rose-50/50 border-rose-200 text-rose-800",
  warning:  "bg-amber-50/50 border-amber-200 text-amber-800",
  info:     "bg-zinc-50/50 border-zinc-200 text-zinc-800",
};
const SEV_ICON_BG = {
  critical: "bg-rose-100 text-rose-700 border border-rose-200/50",
  warning:  "bg-amber-100 text-amber-700 border border-amber-200/50",
  info:     "bg-zinc-100 text-zinc-700 border border-zinc-200/50",
};
const SEV_BTN = {
  critical: "bg-rose-600 hover:bg-rose-750 text-white",
  warning:  "bg-amber-600 hover:bg-amber-700 text-white",
  info:     "bg-[#635BFF] hover:bg-[#5249f0] text-white",
};

function RecommendationCard({ rec, onAction }) {
  const sev = rec.severity || "info";
  return (
    <div className={`rounded-xl border p-4 flex gap-4 items-start ${SEV_STYLES[sev]}`}>
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${SEV_ICON_BG[sev]}`}>
        {REC_ICONS[rec.icon] || REC_ICONS["alert-circle"]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap text-left">
          <p className="text-xs font-bold text-zinc-900">{rec.title}</p>
          <span className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider border bg-white">
            {sev}
          </span>
        </div>
        <p className="text-xs mt-1 text-zinc-500 leading-relaxed text-left">{rec.description}</p>
        {rec.savings_bytes > 0 && (
          <p className="text-[10px] font-bold mt-1 text-[#635BFF] text-left">
            💾 Potential savings: {fmt(rec.savings_bytes)}
          </p>
        )}
      </div>
      <button
        onClick={() => onAction(rec.action)}
        className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer border-0 ${SEV_BTN[sev]}`}
      >
        {rec.action_label}
      </button>
    </div>
  );
}

// ─── Duplicate Groups ────────────────────────────────────────────────────────
function DuplicateGroups({ groups, onDelete, actionInProgress }) {
  const [expanded, setExpanded] = useState(null);
  if (!groups || groups.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50/30 py-10 text-center">
        <p className="text-xs font-semibold text-zinc-400">No duplicate files detected 🎉</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {groups.map((g, i) => (
        <div key={g.hash} className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === i ? null : i)}
            className="w-full flex items-center justify-between px-4 py-3 text-left cursor-pointer hover:bg-zinc-50 transition"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-zinc-100 text-zinc-700 text-xs font-semibold border border-zinc-200">{g.files.length}</span>
              <div>
                <p className="text-xs font-bold text-zinc-800">{g.files.length} identical files</p>
                <p className="text-[10px] text-zinc-500 font-medium mt-0.5">Total wasted storage: {fmt(g.wasted_bytes)}</p>
              </div>
            </div>
            <svg className={`h-4 w-4 text-zinc-400 transition-transform ${expanded === i ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expanded === i && (
            <div className="border-t border-zinc-200 px-4 pb-3 pt-2 space-y-2 bg-zinc-50/10">
              {g.files.map((f) => (
                <div key={f.id} className="flex items-center justify-between rounded-lg bg-white border border-zinc-200 px-3 py-2">
                  <span className="text-xs font-semibold text-zinc-700 truncate max-w-[50%]">{f.filename}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-zinc-500">{fmt(f.filesize)} · {fmtDate(f.uploaded_at)}</span>
                    <button
                      disabled={actionInProgress}
                      onClick={() => onDelete(f.id)}
                      className="rounded border border-red-200 hover:bg-red-50 hover:text-red-750 text-red-600 px-2 py-1 text-xs font-semibold cursor-pointer transition disabled:opacity-50"
                    >
                      Delete Duplicate
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Compressible Files View ──────────────────────────────────────────────────
function CompressibleTable({ files, onCompress, actionInProgress }) {
  if (!files || files.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50/30 py-10 text-center">
        <p className="text-xs font-semibold text-zinc-400">All files are optimized! 🎉</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50/50">
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500 font-sans">File Name</th>
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500 font-sans">Original Size</th>
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500 font-sans">Est. Compressed Size</th>
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500 font-sans">Est. Savings</th>
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500 font-sans">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-150 bg-white">
          {files.map((f) => (
            <tr key={f.id} className="hover:bg-zinc-50/50 transition-colors">
              <td className="px-4 py-3 font-semibold text-zinc-800 truncate max-w-[220px]" title={f.filename}>{f.filename}</td>
              <td className="px-4 py-3 text-zinc-600 font-mono">{fmt(f.filesize)}</td>
              <td className="px-4 py-3 text-emerald-600 font-mono font-semibold">{fmt(f.est_compressed_size)}</td>
              <td className="px-4 py-3 text-emerald-700 font-semibold bg-emerald-50/20">Save {fmt(f.est_space_saving)}</td>
              <td className="px-4 py-3">
                <button
                  disabled={actionInProgress}
                  onClick={() => onCompress(f.id)}
                  className="rounded-lg bg-[#635BFF] hover:bg-[#5249f0] text-white px-3 py-1.5 text-xs font-semibold cursor-pointer transition border-0 disabled:opacity-50"
                >
                  Compress
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Inactive Files View ───────────────────────────────────────────────────────
function InactiveTable({ files, onArchive, onDelete, actionInProgress }) {
  if (!files || files.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50/30 py-10 text-center">
        <p className="text-xs font-semibold text-zinc-400">No inactive files found. Great activity score! 📈</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50/50">
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500 font-sans">File Name</th>
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500 font-sans">Size</th>
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500 font-sans">Days Inactive</th>
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500 font-sans">S3 Glacier Saving</th>
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500 font-sans">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-150 bg-white">
          {files.map((f) => (
            <tr key={f.id} className="hover:bg-zinc-50/50 transition-colors">
              <td className="px-4 py-3 font-semibold text-zinc-800 truncate max-w-[220px]" title={f.filename}>{f.filename}</td>
              <td className="px-4 py-3 text-zinc-650 font-mono">{fmt(f.filesize)}</td>
              <td className="px-4 py-3 text-zinc-550 font-semibold">{f.days_inactive} days</td>
              <td className="px-4 py-3 text-purple-700 font-medium bg-purple-50/50">{fmt(f.filesize)} (99% cost reduction)</td>
              <td className="px-4 py-3 flex gap-2">
                {f.storage_class === "GLACIER" ? (
                  <span className="rounded bg-purple-100 text-purple-800 text-[10px] font-semibold px-2.5 py-1 uppercase tracking-wider">Archived in Glacier</span>
                ) : (
                  <button
                    disabled={actionInProgress}
                    onClick={() => onArchive(f.id)}
                    className="rounded bg-[#635BFF] hover:bg-[#5249f0] text-white px-2.5 py-1 text-xs font-semibold cursor-pointer transition border-0 disabled:opacity-50"
                  >
                    Archive
                  </button>
                )}
                <button
                  disabled={actionInProgress}
                  onClick={() => onDelete(f.id)}
                  className="rounded border border-red-205 hover:bg-red-50 hover:text-red-700 text-red-600 px-2.5 py-1 text-xs font-semibold cursor-pointer transition disabled:opacity-50"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Large Files Table ────────────────────────────────────────────────────────
function LargeFilesTable({ files, onDelete, actionInProgress }) {
  if (!files || files.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50/30 py-10 text-center">
        <p className="text-xs font-semibold text-zinc-400">No large files (&gt;100 MB) found. Great! 🎉</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50/50">
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500 font-sans">File Name</th>
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500 font-sans">Size</th>
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500 font-sans">Alert Severity</th>
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500 font-sans">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-150 bg-white">
          {files.slice(0, 10).map((f) => {
            const size = f.filesize;
            let badge = null;
            if (size >= 1024 * 1024 * 1024) {
              badge = <span className="rounded bg-rose-50 text-rose-700 text-[10px] font-bold px-2 py-0.5 border border-rose-200">1GB+ Critical Size</span>;
            } else if (size >= 500 * 1024 * 1024) {
              badge = <span className="rounded bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 border border-amber-200">500MB+ Large Size</span>;
            } else if (size >= 100 * 1024 * 1024) {
              badge = <span className="rounded bg-zinc-100 text-zinc-700 text-[10px] font-bold px-2 py-0.5 border border-zinc-200">100MB+ Alert Size</span>;
            }
            return (
              <tr key={f.id} className="hover:bg-zinc-50/50 transition-colors">
                <td className="px-4 py-3 font-semibold text-zinc-850 truncate max-w-[220px]" title={f.filename}>{f.filename}</td>
                <td className="px-4 py-3 text-zinc-600 font-mono">{fmt(f.filesize)}</td>
                <td className="px-4 py-3">{badge || <span className="text-zinc-400 text-xs">—</span>}</td>
                <td className="px-4 py-3">
                  <button
                    disabled={actionInProgress}
                    onClick={() => onDelete(f.id)}
                    className="rounded border border-red-200 hover:bg-red-50 hover:text-red-750 text-red-600 px-2.5 py-1 text-xs font-semibold cursor-pointer transition disabled:opacity-50"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── File Type Donut ─────────────────────────────────────────────────────────
const TYPE_COLORS = {
  Images: "#635BFF", Videos: "#8b5cf6", Documents: "#71717a",
  Archives: "#a1a1aa", Other: "#d4d4d8",
};
function FileTypeDonut({ dist }) {
  const data = Object.entries(dist || {})
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));
  if (!data.length) return (
    <div className="flex items-center justify-center h-48 text-xs text-zinc-400">No files uploaded yet</div>
  );
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={TYPE_COLORS[entry.name] || "#94a3b8"} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => fmt(v)} />
        <Legend formatter={(v) => v} iconType="circle" />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-xl bg-zinc-100 ${className}`} />;
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function StorageOptimizationTab({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState("recommendations");
  const [actionInProgress, setActionInProgress] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/storage-optimization");
      setData(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to load optimization data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAction = (action) => {
    if (action === "upgrade") onNavigate?.("Subscription");
    else if (action === "view_files") onNavigate?.("Storage Explorer");
    else if (action === "view_duplicates") setActiveSection("duplicates");
    else if (action === "view_large") setActiveSection("large");
    else if (action === "view_old") setActiveSection("inactive");
    else if (action === "view_compressible") setActiveSection("compressible");
  };

  const handleCompress = async (fileId) => {
    setActionInProgress(true);
    try {
      const res = await api.post(`/files/${fileId}/compress`);
      alert(res.data.message || "File compressed successfully!");
      load();
    } catch (e) {
      alert(e.response?.data?.detail || "Failed to compress file.");
    } finally {
      setActionInProgress(false);
    }
  };

  const handleArchive = async (fileId) => {
    setActionInProgress(true);
    try {
      const res = await api.post(`/files/${fileId}/archive`);
      alert(res.data.message || "File archived successfully to AWS S3 Glacier!");
      load();
    } catch (e) {
      alert(e.response?.data?.detail || "Failed to archive file.");
    } finally {
      setActionInProgress(false);
    }
  };

  const handleDelete = async (fileId) => {
    if (!window.confirm("Are you sure you want to delete this file? This action is permanent and cannot be undone.")) return;
    setActionInProgress(true);
    try {
      await api.delete(`/files/${fileId}`);
      load();
    } catch (e) {
      alert(e.response?.data?.detail || "Failed to delete file.");
    } finally {
      setActionInProgress(false);
    }
  };

  const SECTIONS = [
    { id: "recommendations", label: "Smart Recommendations" },
    { id: "inactive",        label: "Inactive Files" },
    { id: "compressible",    label: "Compressible Files" },
    { id: "duplicates",      label: "Duplicate Detection" },
    { id: "large",           label: "Large File Analysis" },
    { id: "types",           label: "Storage Breakdown" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between text-left">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 tracking-tight">Storage Optimization Center</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Intelligent enterprise metrics to reduce storage consumption and reclaim cloud costs.</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-700 border border-zinc-200 bg-white rounded-lg hover:bg-zinc-50 transition cursor-pointer disabled:opacity-50"
        >
          <svg className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Sync Data
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50/50 px-4 py-3 text-xs text-red-750 font-bold text-left">
          {error}
        </div>
      )}

      {/* Top row: health score + summary cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Skeleton className="h-44" />
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-zinc-800">
          <HealthScoreRing score={data.health_score} />
          
          <SummaryCard
            label="Space Savings"
            value={fmt(data.potential_savings_bytes)}
            sub="Across duplicates & compressible"
            accent="emerald"
            icon={<svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>}
          />
          <SummaryCard
            label="Duplicate Files"
            value={data.duplicate_groups?.reduce((a, g) => a + g.files.length - 1, 0) ?? 0}
            sub={`${data.duplicate_groups?.length ?? 0} identical hash groups`}
            accent="amber"
            icon={<svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>}
          />
          <SummaryCard
            label="Files to Archive"
            value={data.old_files?.days_30?.length ?? 0}
            sub="Inactive since 30+ days"
            accent="purple"
            icon={<svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5" rx="1"/><line x1="10" y1="12" x2="14" y2="12"/></svg>}
          />
          <SummaryCard
            label="Compressible Files"
            value={data.compressible_files?.length ?? 0}
            sub="Benefit from text compression"
            accent="indigo"
            icon={<svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M4 14h6v6H4zm10 0h6v6h-6zM4 4h6v6H4zm10 0h6v6h-6z" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          />
        </div>
      ) : null}

      {/* Section Tabs */}
      <div className="border-b border-zinc-200">
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`whitespace-nowrap px-3.5 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
                activeSection === s.id
                  ? "border-[#635BFF] text-[#635BFF]"
                  : "border-transparent text-zinc-550 hover:text-zinc-800 hover:border-zinc-300"
              }`}
            >
              {s.label}
              {s.id === "recommendations" && data?.recommendations?.length > 0 && (
                <span className="ml-1.5 rounded bg-purple-50 text-[#635BFF] border border-purple-100 px-1 py-0.5 text-[9px] font-bold">
                  {data.recommendations.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Section Content */}
      {loading ? (
        <Skeleton className="h-48" />
      ) : data ? (
        <div className="text-left">
          {activeSection === "recommendations" && (
            <div className="space-y-3">
              {data.recommendations?.length === 0 ? (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/10 py-16 text-center">
                  <div className="text-3xl mb-2">🎉</div>
                  <p className="text-xs font-bold text-zinc-800">Storage health is excellent!</p>
                  <p className="text-xs text-zinc-550 mt-0.5">WeCloud detected no significant files to clean up or optimize.</p>
                </div>
              ) : (
                data.recommendations.map((rec) => (
                  <RecommendationCard key={rec.id} rec={rec} onAction={handleAction} />
                ))
              )}
            </div>
          )}

          {activeSection === "inactive" && (
            <div className="space-y-5">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/10 p-3.5">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Glacier Tiering</h3>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  Moving files to AWS S3 Glacier storage class reduces standard costs by 90% to 99%. Inactive files are candidates for archiving.
                </p>
              </div>

              {[
                { key: "days_180", label: "180+ Days Inactive", color: "red" },
                { key: "days_90",  label: "90+ Days Inactive",  color: "amber" },
                { key: "days_30",  label: "30+ Days Inactive",  color: "blue" },
              ].map(({ key, label, color }) => {
                const files = data.old_files?.[key] || [];
                const badge = color === "red" ? "bg-rose-50 text-rose-700 border-rose-200" : color === "amber" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200";
                return (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`rounded border px-2 py-0.5 text-[10px] font-bold ${badge}`}>{label}</span>
                      <span className="text-xs text-zinc-450 font-semibold">{files.length} file{files.length !== 1 ? "s" : ""}</span>
                    </div>
                    <InactiveTable
                      files={files}
                      onArchive={handleArchive}
                      onDelete={handleDelete}
                      actionInProgress={actionInProgress}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {activeSection === "compressible" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/10 p-3.5">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Text Compression</h3>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  Text formats like CSV, TXT, JSON, and MD can be compressed directly to reclaim standard disk space. Media formats (JPEG, PNG, MP4) and binary archives do not benefit from compression.
                </p>
              </div>
              <CompressibleTable
                files={data.compressible_files}
                onCompress={handleCompress}
                actionInProgress={actionInProgress}
              />
            </div>
          )}

          {activeSection === "duplicates" && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-zinc-700">
                Duplicate File Detection <span className="text-zinc-450 font-normal">— Grouped securely by SHA-256 signatures</span>
              </p>
              <DuplicateGroups
                groups={data.duplicate_groups}
                onDelete={handleDelete}
                actionInProgress={actionInProgress}
              />
            </div>
          )}

          {activeSection === "large" && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-zinc-700">
                Top 10 Largest Uploads <span className="text-zinc-450 font-normal">— Highlighted by size parameters</span>
              </p>
              <LargeFilesTable
                files={data.large_files}
                onDelete={handleDelete}
                actionInProgress={actionInProgress}
              />
            </div>
          )}

          {activeSection === "types" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-xl border border-zinc-200 bg-white p-5">
                <h3 className="text-xs font-bold text-zinc-800 mb-3 uppercase tracking-wider">Storage by File Type</h3>
                <FileTypeDonut dist={data.file_type_distribution} />
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-5">
                <h3 className="text-xs font-bold text-zinc-800 mb-3 uppercase tracking-wider">Breakdown Details</h3>
                <div className="space-y-3.5">
                  {Object.entries(data.file_type_distribution || {}).map(([type, bytes]) => {
                    const total = Object.values(data.file_type_distribution).reduce((a, b) => a + b, 0);
                    const pct = total > 0 ? (bytes / total * 100) : 0;
                    return (
                      <div key={type}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-zinc-650 flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full inline-block" style={{ background: TYPE_COLORS[type] || "#d4d4d8" }} />
                            {type}
                          </span>
                          <span className="text-xs font-bold text-zinc-700">{fmt(bytes)} <span className="text-zinc-400 font-normal">({pct.toFixed(1)}%)</span></span>
                        </div>
                        <div className="h-1 rounded-full bg-zinc-100">
                          <div
                            className="h-1 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, background: TYPE_COLORS[type] || "#d4d4d8" }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
