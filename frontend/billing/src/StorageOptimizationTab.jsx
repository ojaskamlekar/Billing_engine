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

  const color = score >= 75 ? "#22c55e" : score >= 40 ? "#f59e0b" : "#ef4444";
  const label = score >= 75 ? "Excellent" : score >= 40 ? "Needs Attention" : "Critical";
  const bg    = score >= 75 ? "from-emerald-50 to-green-50 border-emerald-100"
              : score >= 40 ? "from-amber-50 to-yellow-50 border-amber-100"
              : "from-red-50 to-rose-50 border-red-100";

  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${bg} p-6 flex flex-col items-center justify-center`}>
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Storage Health Score</p>
      <svg width="140" height="140" viewBox="0 0 140 140">
        {/* background ring */}
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="12" />
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
        <text x="70" y="65" textAnchor="middle" fontSize="28" fontWeight="800" fill={color}>{score}</text>
        <text x="70" y="84" textAnchor="middle" fontSize="10" fill="#94a3b8">/100</text>
      </svg>
      <span
        className="mt-2 rounded-full px-3 py-1 text-xs font-bold"
        style={{ background: `${color}22`, color }}
      >
        {label}
      </span>
    </div>
  );
}

// ─── Summary Stat Card ───────────────────────────────────────────────────────
function SummaryCard({ label, value, sub, icon, accent }) {
  const accents = {
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    red: "bg-red-50 text-red-600 border-red-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col gap-3 text-left">
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${accents[accent]}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-extrabold text-slate-800">{value}</p>
        <p className="text-xs font-semibold text-slate-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Recommendation Card ─────────────────────────────────────────────────────
const REC_ICONS = {
  "alert-circle":   <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  "alert-triangle": <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>,
  "copy":           <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>,
  "hard-drive":     <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><line x1="22" y1="12" x2="2" y2="12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>,
  "clock":          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  "download-off":   <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><line x1="1" y1="1" x2="23" y2="23"/><path d="M12 12v4m-4 0h8M3 3h18v18H3z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
};
const SEV_STYLES = {
  critical: "bg-red-50 border-red-200 text-red-700",
  warning:  "bg-amber-50 border-amber-200 text-amber-700",
  info:     "bg-blue-50 border-blue-200 text-blue-700",
};
const SEV_ICON_BG = {
  critical: "bg-red-100 text-red-600",
  warning:  "bg-amber-100 text-amber-600",
  info:     "bg-blue-100 text-blue-600",
};
const SEV_BTN = {
  critical: "bg-red-600 hover:bg-red-700 text-white",
  warning:  "bg-amber-500 hover:bg-amber-600 text-white",
  info:     "bg-indigo-600 hover:bg-indigo-700 text-white",
};

function RecommendationCard({ rec, onAction }) {
  const sev = rec.severity || "info";
  return (
    <div className={`rounded-xl border p-4 flex gap-4 items-start ${SEV_STYLES[sev]}`}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${SEV_ICON_BG[sev]}`}>
        {REC_ICONS[rec.icon] || REC_ICONS["alert-circle"]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap text-left">
          <p className="text-sm font-bold">{rec.title}</p>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${SEV_STYLES[sev]}`}>
            {sev}
          </span>
        </div>
        <p className="text-xs mt-1 opacity-80 text-left">{rec.description}</p>
        {rec.savings_bytes > 0 && (
          <p className="text-xs font-bold mt-1.5 text-left">
            💾 Potential savings: {fmt(rec.savings_bytes)}
          </p>
        )}
      </div>
      <button
        onClick={() => onAction(rec.action)}
        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${SEV_BTN[sev]}`}
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
      <div className="rounded-xl border border-slate-100 bg-slate-50 py-10 text-center">
        <p className="text-sm font-semibold text-slate-400">No duplicate files detected 🎉</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {groups.map((g, i) => (
        <div key={g.hash} className="rounded-xl border border-amber-100 bg-amber-50/50 overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === i ? null : i)}
            className="w-full flex items-center justify-between px-4 py-3 text-left cursor-pointer hover:bg-amber-50 transition"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700 text-xs font-bold">{g.files.length}</span>
              <div>
                <p className="text-sm font-semibold text-slate-700">{g.files.length} identical files</p>
                <p className="text-xs text-amber-700 font-medium">Wasted: {fmt(g.wasted_bytes)}</p>
              </div>
            </div>
            <svg className={`h-4 w-4 text-slate-400 transition-transform ${expanded === i ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expanded === i && (
            <div className="border-t border-amber-100 px-4 pb-3 pt-2 space-y-1.5">
              {g.files.map((f) => (
                <div key={f.id} className="flex items-center justify-between rounded-lg bg-white border border-amber-100 px-3 py-2">
                  <span className="text-sm font-medium text-slate-700 truncate max-w-[50%]">{f.filename}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-500">{fmt(f.filesize)} · {fmtDate(f.uploaded_at)}</span>
                    <button
                      disabled={actionInProgress}
                      onClick={() => onDelete(f.id)}
                      className="rounded border border-red-200 hover:bg-red-50 hover:text-red-700 text-red-600 px-2.5 py-1 text-xs font-semibold cursor-pointer transition disabled:opacity-50"
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
      <div className="rounded-xl border border-slate-100 bg-slate-50 py-10 text-center">
        <p className="text-sm font-semibold text-slate-400">No compressible files found. All files are already optimized! 🎉</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50">
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 font-sans">File Name</th>
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 font-sans">Original Size</th>
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 font-sans">Est. Compressed Size</th>
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 font-sans">Est. Savings</th>
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 font-sans">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {files.map((f) => (
            <tr key={f.id} className="bg-white hover:bg-slate-50 transition">
              <td className="px-4 py-3 font-medium text-slate-700 truncate max-w-[220px]" title={f.filename}>{f.filename}</td>
              <td className="px-4 py-3 text-slate-600 font-mono text-xs">{fmt(f.filesize)}</td>
              <td className="px-4 py-3 text-emerald-600 font-mono text-xs font-semibold">{fmt(f.est_compressed_size)}</td>
              <td className="px-4 py-3 text-emerald-700 text-xs font-bold bg-emerald-50/50">💾 Save {fmt(f.est_space_saving)}</td>
              <td className="px-4 py-3">
                <button
                  disabled={actionInProgress}
                  onClick={() => onCompress(f.id)}
                  className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 text-xs font-bold cursor-pointer transition disabled:opacity-50"
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
      <div className="rounded-xl border border-slate-100 bg-slate-55 py-10 text-center">
        <p className="text-sm font-semibold text-slate-400">No inactive files found. Great activity score! 📈</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50">
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 font-sans">File Name</th>
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 font-sans">Size</th>
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 font-sans">Days Inactive</th>
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 font-sans">AWS Glacier Saving</th>
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 font-sans">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {files.map((f) => (
            <tr key={f.id} className="bg-white hover:bg-slate-50 transition">
              <td className="px-4 py-3 font-medium text-slate-700 truncate max-w-[220px]" title={f.filename}>{f.filename}</td>
              <td className="px-4 py-3 text-slate-600 font-mono text-xs">{fmt(f.filesize)}</td>
              <td className="px-4 py-3 text-slate-500 text-xs font-bold">{f.days_inactive} days</td>
              <td className="px-4 py-3 text-purple-700 text-xs font-semibold bg-purple-50">{fmt(f.filesize)} (99% cost reduction)</td>
              <td className="px-4 py-3 flex gap-2">
                {f.storage_class === "GLACIER" ? (
                  <span className="rounded bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-1 uppercase tracking-wider">Archived in Glacier</span>
                ) : (
                  <button
                    disabled={actionInProgress}
                    onClick={() => onArchive(f.id)}
                    className="rounded bg-purple-600 hover:bg-purple-700 text-white px-2.5 py-1.5 text-xs font-semibold cursor-pointer transition disabled:opacity-50"
                  >
                    Archive (future AWS)
                  </button>
                )}
                <button
                  disabled={actionInProgress}
                  onClick={() => onDelete(f.id)}
                  className="rounded border border-red-200 hover:bg-red-50 hover:text-red-700 text-red-600 px-2.5 py-1.5 text-xs font-semibold cursor-pointer transition disabled:opacity-50"
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
      <div className="rounded-xl border border-slate-100 bg-slate-50 py-10 text-center">
        <p className="text-sm font-semibold text-slate-400">No large files (&gt;100 MB) found. Great! 🎉</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50">
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 font-sans">File Name</th>
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 font-sans">Size</th>
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 font-sans">Alert Severity</th>
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 font-sans">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {files.slice(0, 10).map((f) => {
            const size = f.filesize;
            let badge = null;
            if (size >= 1024 * 1024 * 1024) {
              badge = <span className="rounded bg-red-100 text-red-800 text-[10px] font-bold px-2 py-1 uppercase tracking-wider border border-red-200">1GB+ Critical Size</span>;
            } else if (size >= 500 * 1024 * 1024) {
              badge = <span className="rounded bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-1 uppercase tracking-wider border border-amber-200">500MB+ Large Size</span>;
            } else if (size >= 100 * 1024 * 1024) {
              badge = <span className="rounded bg-yellow-100 text-yellow-800 text-[10px] font-bold px-2 py-1 uppercase tracking-wider border border-yellow-200">100MB+ Alert Size</span>;
            }
            return (
              <tr key={f.id} className="bg-white hover:bg-slate-50 transition">
                <td className="px-4 py-3 font-medium text-slate-700 truncate max-w-[220px]" title={f.filename}>{f.filename}</td>
                <td className="px-4 py-3 text-slate-600 font-mono text-xs">{fmt(f.filesize)}</td>
                <td className="px-4 py-3">{badge || <span className="text-slate-400 text-xs">—</span>}</td>
                <td className="px-4 py-3">
                  <button
                    disabled={actionInProgress}
                    onClick={() => onDelete(f.id)}
                    className="rounded border border-red-200 hover:bg-red-50 hover:text-red-700 text-red-600 px-2.5 py-1.5 text-xs font-semibold cursor-pointer transition disabled:opacity-50"
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
  Images: "#6366f1", Videos: "#8b5cf6", Documents: "#06b6d4",
  Archives: "#f59e0b", Other: "#94a3b8",
};
function FileTypeDonut({ dist }) {
  const data = Object.entries(dist || {})
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));
  if (!data.length) return (
    <div className="flex items-center justify-center h-48 text-sm text-slate-400">No files uploaded yet</div>
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
  return <div className={`animate-pulse rounded-xl bg-slate-200 ${className}`} />;
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
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Storage Optimization Center</h2>
          <p className="text-sm text-slate-500 mt-1 font-medium">Intelligent enterprise metrics to reduce storage consumption and reclaim cloud costs.</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-700 border border-slate-200 bg-white rounded-xl hover:bg-slate-50 transition cursor-pointer disabled:opacity-50 shadow-sm"
        >
          <svg className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Sync Data
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-750 font-bold text-left">
          {error}
        </div>
      )}

      {/* Top row: health score + summary cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Skeleton className="h-52" />
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-slate-800">
          <HealthScoreRing score={data.health_score} />
          
          <SummaryCard
            label="Potential Space Savings"
            value={fmt(data.potential_savings_bytes)}
            sub="Across duplicates & compressible"
            accent="emerald"
            icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>}
          />
          <SummaryCard
            label="Duplicate Files"
            value={data.duplicate_groups?.reduce((a, g) => a + g.files.length - 1, 0) ?? 0}
            sub={`${data.duplicate_groups?.length ?? 0} identical hash groups`}
            accent="amber"
            icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>}
          />
          <SummaryCard
            label="Files to Archive"
            value={data.old_files?.days_30?.length ?? 0}
            sub="Inactive since 30+ days"
            accent="purple"
            icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5" rx="1"/><line x1="10" y1="12" x2="14" y2="12"/></svg>}
          />
          <SummaryCard
            label="Compressible Files"
            value={data.compressible_files?.length ?? 0}
            sub="Benefit from text compression"
            accent="indigo"
            icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M4 14h6v6H4zm10 0h6v6h-6zM4 4h6v6H4zm10 0h6v6h-6z" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          />
        </div>
      ) : null}

      {/* Section Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`whitespace-nowrap px-4 py-3 text-sm font-semibold border-b-2 transition cursor-pointer ${
                activeSection === s.id
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              {s.label}
              {s.id === "recommendations" && data?.recommendations?.length > 0 && (
                <span className="ml-1.5 rounded-full bg-indigo-100 text-indigo-700 px-1.5 py-0.5 text-[10px] font-bold">
                  {data.recommendations.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Section Content */}
      {loading ? (
        <Skeleton className="h-64" />
      ) : data ? (
        <div className="text-left">
          {activeSection === "recommendations" && (
            <div className="space-y-3">
              {data.recommendations?.length === 0 ? (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 py-16 text-center">
                  <div className="text-4xl mb-3">🎉</div>
                  <p className="text-base font-bold text-emerald-700 font-sans">Storage health is excellent!</p>
                  <p className="text-sm text-emerald-600 mt-1">WeCloud detected no significant files to clean up or optimize.</p>
                </div>
              ) : (
                data.recommendations.map((rec) => (
                  <RecommendationCard key={rec.id} rec={rec} onAction={handleAction} />
                ))
              )}
            </div>
          )}

          {activeSection === "inactive" && (
            <div className="space-y-6">
              <div className="rounded-xl border border-purple-100 bg-purple-50/20 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-purple-700 font-sans">S3 Intelligent Glacier Tiering</h3>
                <p className="text-xs text-purple-600 mt-1 leading-relaxed">
                  Moving files to AWS S3 Glacier storage class reduces standard costs by 90% to 99%. Inactive files are candidates for archiving.
                </p>
              </div>

              {[
                { key: "days_180", label: "180+ Days Inactive", color: "red" },
                { key: "days_90",  label: "90+ Days Inactive",  color: "amber" },
                { key: "days_30",  label: "30+ Days Inactive",  color: "blue" },
              ].map(({ key, label, color }) => {
                const files = data.old_files?.[key] || [];
                const badge = color === "red" ? "bg-red-50 text-red-600" : color === "amber" ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600";
                return (
                  <div key={key}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${badge}`}>{label}</span>
                      <span className="text-xs text-slate-450 font-semibold">{files.length} file{files.length !== 1 ? "s" : ""} detected</span>
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
              <div className="rounded-xl border border-indigo-150 bg-indigo-50/30 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 font-sans">Text Compression Insights</h3>
                <p className="text-xs text-indigo-650 mt-1 leading-relaxed">
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
              <p className="text-sm font-semibold text-slate-700">
                Duplicate File Detection <span className="text-slate-400 font-normal">— Grouped securely by SHA-256 signatures</span>
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
              <p className="text-sm font-semibold text-slate-700">
                Top 10 Largest Uploads <span className="text-slate-400 font-normal">— Highlighted by size parameters</span>
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
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-4 font-sans">Storage by File Type</h3>
                <FileTypeDonut dist={data.file_type_distribution} />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-4 font-sans">Breakdown</h3>
                <div className="space-y-3">
                  {Object.entries(data.file_type_distribution || {}).map(([type, bytes]) => {
                    const total = Object.values(data.file_type_distribution).reduce((a, b) => a + b, 0);
                    const pct = total > 0 ? (bytes / total * 100) : 0;
                    return (
                      <div key={type}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full inline-block" style={{ background: TYPE_COLORS[type] || "#94a3b8" }} />
                            {type}
                          </span>
                          <span className="text-xs font-bold text-slate-700">{fmt(bytes)} <span className="text-slate-450 font-normal">({pct.toFixed(1)}%)</span></span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100">
                          <div
                            className="h-1.5 rounded-full transition-all duration-700"
                            style={{ width: `${pct}%`, background: TYPE_COLORS[type] || "#94a3b8" }}
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
