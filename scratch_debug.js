
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area
} from "recharts";
import {
  TrendingUp,
  HardDrive,
  Files,
  Database,
  Calendar,
  AlertCircle,
  Sparkles,
  Info
} from "lucide-react";


const CATEGORY_COLORS = {
  "Images": "#6366f1",
  "Videos": "#8b5cf6",
  "Documents": "#10b981",
  "Archives": "#eab308",
  "Executables": "#f97316",
  "Other": "#64748b"
};

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function getFileCategory(filename) {
  if (!filename) return "Other";
  const ext = filename.split(".").pop().toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "svg", "webp", "bmp"].includes(ext)) return "Images";
  if (["mp4", "mkv", "avi", "mov", "wmv", "flv", "webm"].includes(ext)) return "Videos";
  if (["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "md", "csv", "rtf"].includes(ext)) return "Documents";
  if (["zip", "rar", "7z", "tar", "gz", "bz2"].includes(ext)) return "Archives";
  if (["exe", "msi", "apk", "bat", "sh", "bin", "app", "dmg"].includes(ext)) return "Executables";
  return "Other";
}

function safeParseDate(value) {
  if (!value) return new Date();
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export default function AnalyticsTab({ usage = [], loading, plan = "Free", onUpgradeClick }) {
  const [timeframe, setTimeframe] = useState("30 Days");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  if (plan === "Free") {
    return (
      <PremiumLockOverlay
        message="Upgrade to a Pro or Enterprise subscription to unlock detailed storage analytics and file type breakdown charts."
        onUpgradeClick={onUpgradeClick}
      />
    );
  }

  // Parse file dates and categories safely
  const parsedFiles = useMemo(() => {
    return (usage || []).map(f => {
      const date = safeParseDate(f.uploaded_at);
      return {
        ...f,
        date,
        category: getFileCategory(f.filename || f.original_filename)
      };
    }).sort((a, b) => a.date - b.date);
  }, [usage]);

  // Boundaries & timeframe dataset filter
  const filteredData = useMemo(() => {
    const now = new Date();
    let startLimit = new Date();
    let isCustom = false;

    if (timeframe === "Today") {
      startLimit.setHours(0, 0, 0, 0);
    } else if (timeframe === "7 Days") {
      startLimit.setDate(now.getDate() - 7);
    } else if (timeframe === "30 Days") {
      startLimit.setDate(now.getDate() - 30);
    } else if (timeframe === "90 Days") {
      startLimit.setDate(now.getDate() - 90);
    } else if (timeframe === "Custom") {
      isCustom = true;
    }

    if (isCustom) {
      if (!customStart || !customEnd) return parsedFiles;
      const s = new Date(customStart);
      const e = new Date(customEnd);
      e.setHours(23, 59, 59, 999);
      return parsedFiles.filter(f => f.date >= s && f.date <= e);
    } else {
      return parsedFiles.filter(f => f.date >= startLimit);
    }
  }, [parsedFiles, timeframe, customStart, customEnd]);

  // Previous Period filter data for comparisons
  const prevPeriodData = useMemo(() => {
    const now = new Date();
    let days = 30;
    if (timeframe === "Today") days = 1;
    else if (timeframe === "7 Days") days = 7;
    else if (timeframe === "90 Days") days = 90;

    if (timeframe === "Custom" && customStart && customEnd) {
      const s = new Date(customStart);
      const e = new Date(customEnd);
      days = Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)));
    }

    const curStart = new Date();
    curStart.setDate(now.getDate() - days);
    const prevStart = new Date();
    prevStart.setDate(now.getDate() - (days * 2));

    return parsedFiles.filter(f => f.date >= prevStart && f.date < curStart);
  }, [parsedFiles, timeframe, customStart, customEnd]);

  // Summary Metrics calculations
  const summary = useMemo(() => {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalActiveFiles = parsedFiles.length;
    const currentStorage = parsedFiles.reduce((acc, f) => acc + (f.filesize || 0), 0);
    const largestFile = parsedFiles.length > 0 ? Math.max(...parsedFiles.map(f => f.filesize || 0)) : 0;

    // Growth in selected timeframe
    const periodStorageAdded = filteredData.reduce((acc, f) => acc + (f.filesize || 0), 0);

    const growthThisMonth = parsedFiles
      .filter(f => f.date >= currentMonthStart)
      .reduce((acc, f) => acc + (f.filesize || 0), 0);

    return {
      totalActiveFiles,
      currentStorage,
      largestFile,
      periodStorageAdded,
      growthThisMonth
    };
  }, [parsedFiles, filteredData]);

  // File Type Distribution list
  const distribution = useMemo(() => {
    const cats = {
      "Images": { count: 0, size: 0 },
      "Videos": { count: 0, size: 0 },
      "Documents": { count: 0, size: 0 },
      "Archives": { count: 0, size: 0 },
      "Executables": { count: 0, size: 0 },
      "Other": { count: 0, size: 0 }
    };

    filteredData.forEach(f => {
      if (cats[f.category]) {
        cats[f.category].count += 1;
        cats[f.category].size += f.filesize || 0;
      }
    });

    const totalSize = Math.max(1, filteredData.reduce((acc, f) => acc + (f.filesize || 0), 0));
    
    return Object.entries(cats).map(([name, val]) => ({
      name,
      count: val.count,
      size: val.size,
      percentage: (val.size / totalSize) * 100
    })).sort((a, b) => b.size - a.size);
  }, [filteredData]);

  // Deterministic observations & recommendations
  const insights = useMemo(() => {
    const list = [];
    const now = new Date();

    // 1. Month growth percentage
    const totalBeforeMonth = Math.max(1, summary.currentStorage - summary.growthThisMonth);
    const monthlyPct = ((summary.growthThisMonth / totalBeforeMonth) * 100).toFixed(0);
    if (parseInt(monthlyPct) > 0) {
      list.push(`Storage increased by ${monthlyPct}% this month.`);
    }

    // 2. Primary category concentration
    const dominantCategory = distribution[0];
    if (dominantCategory && dominantCategory.percentage > 10 && dominantCategory.size > 0) {
      list.push(`${dominantCategory.name} occupy ${dominantCategory.percentage.toFixed(0)}% of your storage.`);
    }

    // 3. Largest file share
    if (summary.largestFile > 0 && summary.currentStorage > 0) {
      const largestFilePct = ((summary.largestFile / summary.currentStorage) * 100).toFixed(0);
      list.push(`The largest file consumes ${largestFilePct}% of total storage.`);
    }

    // 4. Duplicate files count (by SHA-256 hash match)
    const hashCounts = {};
    parsedFiles.forEach(f => {
      if (f.sha256_hash) {
        hashCounts[f.sha256_hash] = (hashCounts[f.sha256_hash] || 0) + 1;
      }
    });
    const duplicateCount = Object.values(hashCounts).reduce((acc, count) => {
      if (count > 1) acc += (count - 1);
      return acc;
    }, 0);
    if (duplicateCount > 0) {
      list.push(`${duplicateCount} duplicate file${duplicateCount > 1 ? "s" : ""} detected.`);
    }

    // 5. Stale files older than 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(now.getDate() - 90);
    const hasStaleFiles = parsedFiles.some(f => f.date < ninetyDaysAgo);
    if (hasStaleFiles) {
      list.push("Consider archiving files older than 90 days.");
    }

    return list;
  }, [summary, distribution, parsedFiles]);

  // Timelines for charts
  const chartsData = useMemo(() => {
    // 1. Uploads timeline (daily counts & sizes)
    const dailyMap = {};
    filteredData.forEach(f => {
      const dateKey = f.date.toISOString().slice(0, 10);
      if (!dailyMap[dateKey]) dailyMap[dateKey] = { date: dateKey, count: 0, size: 0 };
      dailyMap[dateKey].count += 1;
      dailyMap[dateKey].size += f.filesize || 0;
    });

    const uploadsTimeline = Object.values(dailyMap).map(v => ({
      ...v,
      sizeMB: parseFloat((v.size / (1024 * 1024)).toFixed(2)),
      label: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(v.date + "T00:00:00"))
    })).sort((a, b) => a.date.localeCompare(b.date));

    // 2. Storage Growth timeline (cumulative MB over time)
    let cumulative = 0;
    const growthTimeline = parsedFiles.map(f => {
      cumulative += f.filesize || 0;
      return {
        date: f.date.toISOString().slice(0, 10),
        sizeMB: parseFloat((cumulative / (1024 * 1024)).toFixed(1)),
        label: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(f.date)
      };
    });

    return {
      uploadsTimeline,
      growthTimeline
    };
  }, [filteredData, parsedFiles]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center text-slate-500">
        <AlertCircle className="h-5 w-5 animate-pulse text-indigo-500 mr-2" />
        <span>Generating storage intelligence profiles...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-355 max-w-7xl mx-auto px-1">
      
      {/* simplified Controls Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5 text-left">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Storage Trend Analysis</h2>
          <p className="text-xs text-slate-500 mt-1">Monitor historical capacities and size distribution trends.</p>
        </div>

        {/* Timeframe filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/50">
            {["Today", "7 Days", "30 Days", "90 Days", "Custom"].map((t) => (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  timeframe === t
                    ? "bg-white text-indigo-600 shadow-sm font-bold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {timeframe === "Custom" && (
            <div className="flex items-center gap-2 animate-in slide-in-from-right duration-200">
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="px-2 py-1 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-800"
              />
              <span className="text-slate-400 text-xs font-medium">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="px-2 py-1 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-800"
              />
            </div>
          )}
        </div>
      </div>

      {/* Stripe-like 4 Summary Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Current Storage Used */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm text-left">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Current Storage Used</span>
          <span className="text-2xl font-black text-slate-850 block mt-2">{formatBytes(summary.currentStorage)}</span>
          <div className="mt-2 flex items-center text-[9px] text-slate-450 gap-1 font-semibold">
            <HardDrive className="h-3 w-3 text-indigo-500" /> Active storage volume
          </div>
        </div>

        {/* Card 2: Storage Growth */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm text-left">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Storage Growth</span>
          <span className="text-2xl font-black text-slate-850 block mt-2">+{formatBytes(summary.periodStorageAdded)}</span>
          <div className="mt-2 flex items-center text-[9px] text-emerald-600 gap-1 font-semibold">
            <TrendingUp className="h-3 w-3 text-emerald-500" /> Added in range
          </div>
        </div>

        {/* Card 3: Total Active Files */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm text-left">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Active Files</span>
          <span className="text-2xl font-black text-slate-850 block mt-2">{summary.totalActiveFiles}</span>
          <div className="mt-2 flex items-center text-[9px] text-slate-450 gap-1 font-semibold">
            <Files className="h-3 w-3 text-indigo-500" /> Active entities
          </div>
        </div>

        {/* Card 4: Largest File */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm text-left">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Largest File</span>
          <span className="text-2xl font-black text-slate-850 block mt-2 truncate" title={formatBytes(summary.largestFile)}>
            {formatBytes(summary.largestFile)}
          </span>
          <div className="mt-2 flex items-center text-[9px] text-slate-455 gap-1 font-semibold">
            <Database className="h-3 w-3 text-indigo-500" /> Max file size
          </div>
        </div>
      </div>

      {/* Storage Insights Callouts */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm text-left">
        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-indigo-500" /> Storage Insights
        </h4>
        <p className="text-xs text-slate-400 mt-0.5">Observations of your storage footprint and capacity velocity.</p>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights.length === 0 ? (
            <div className="text-slate-400 text-xs col-span-2">
              Generate more file activity to compile storage insights.
            </div>
          ) : (
            insights.map((insight, idx) => (
              <div key={idx} className="flex items-center gap-3 bg-slate-50 border border-slate-100 p-3 rounded-lg">
                <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                <span className="text-xs text-slate-750 font-semibold">{insight}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chart: Storage Growth Timeline (Cumulative Size) */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm text-left">
        <div>
          <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-indigo-500" /> Storage Growth Timeline
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">Cumulative storage size trend of active files over time.</p>
        </div>
        
        <div className="mt-6 h-64">
          {chartsData.growthTimeline.length === 0 ? (
            <div className="flex h-full items-center justify-center text-slate-400 text-xs">No active file timeline metrics.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartsData.growthTimeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSize" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" />
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={9} fontWeight={600} />
                <YAxis stroke="#94a3b8" fontSize={9} fontWeight={600} unit=" MB" />
                <Tooltip formatter={(val) => [`${val} MB`, "Total Storage"]} />
                <Area type="monotone" dataKey="sizeMB" stroke="#6366f1" fillOpacity={1} fill="url(#colorSize)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Side-by-side: Upload Activity & File Type Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-left">
        
        {/* Upload Activity Timeline */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Files className="h-4 w-4 text-indigo-500" /> Upload Activity Timeline
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">Daily upload frequency and size breakdown.</p>
          </div>

          <div className="mt-6 h-60">
            {chartsData.uploadsTimeline.length === 0 ? (
              <div className="flex h-full items-center justify-center text-slate-400 text-xs">No upload logs found.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartsData.uploadsTimeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={9} fontWeight={600} />
                  <YAxis yAxisId="left" stroke="#94a3b8" fontSize={9} fontWeight={600} />
                  <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" fontSize={9} fontWeight={600} unit="M" />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10, fontWeight: 600 }} />
                  <Bar yAxisId="left" dataKey="count" name="Upload Count" fill="#6366f1" radius={[3, 3, 0, 0]} />
                  <Bar yAxisId="right" dataKey="sizeMB" name="Size (MB)" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* File Type Distribution */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-850 flex items-center gap-1.5">
              <PieIcon className="h-4 w-4 text-indigo-500" /> File Type Shares
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">Proportion of active categories by size.</p>
          </div>

          <div className="h-48 mt-4">
            {filteredData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-slate-400 text-xs">No files uploaded in range.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distribution.filter(d => d.size > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="size"
                  >
                    {distribution.filter(d => d.size > 0).map((entry) => (
                      <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] || "#64748b"} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatBytes(value)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="flex flex-wrap gap-2 text-[9px] font-bold text-slate-500 justify-center border-t border-slate-50 pt-3">
            {distribution.map((d) => (
              <span key={d.name} className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[d.name] }} />
                {d.name} ({d.percentage.toFixed(0)}%)
              </span>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}

// Export for test runner
export { safeParseDate, getFileCategory, AnalyticsTab };
