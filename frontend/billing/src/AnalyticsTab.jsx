import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import PremiumLockOverlay from "./PremiumLockOverlay";

function ChartIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function parseUploadDate(value) {
  if (!value) return null;
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

function groupUploadsByDate(files) {
  const counts = {};
  for (const file of files) {
    const parsed = parseUploadDate(file.uploaded_at);
    if (!parsed) continue;
    const date = parsed.toISOString().slice(0, 10);
    counts[date] = (counts[date] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([date, uploads]) => ({
      date,
      uploads,
      label: new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
      }).format(new Date(`${date}T00:00:00`)),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function getFileExtension(filename) {
  const dot = filename.lastIndexOf(".");
  if (dot <= 0 || dot === filename.length - 1) return "other";
  return filename.slice(dot + 1).toLowerCase();
}

function groupByExtension(files) {
  const counts = {};
  for (const file of files) {
    const ext = getFileExtension(file.filename);
    counts[ext] = (counts[ext] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([extension, count]) => ({ extension, count }))
    .sort((a, b) => b.count - a.count);
}

function UploadsOverTimeChart({ usage, loading }) {
  const chartData = useMemo(() => groupUploadsByDate(usage), [usage]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm text-left">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Uploads Over Time</h2>
          <p className="mt-1 text-sm text-slate-500">
            Daily upload volume from usage API logs.
          </p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          <ChartIcon />
        </div>
      </div>

      <div className="mt-6 h-80">
        {loading ? (
          <p className="flex h-full items-center justify-center text-sm text-slate-500">
            Loading chart…
          </p>
        ) : chartData.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-slate-500">
            No upload history yet.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="label"
                tick={{ fill: "#64748b", fontSize: 12 }}
                axisLine={{ stroke: "#e2e8f0" }}
                tickLine={{ stroke: "#e2e8f0" }}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "#64748b", fontSize: 12 }}
                axisLine={{ stroke: "#e2e8f0" }}
                tickLine={{ stroke: "#e2e8f0" }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.date ?? ""
                }
              />
              <Line
                type="monotone"
                dataKey="uploads"
                name="Uploads"
                stroke="#4f46e5"
                strokeWidth={2.5}
                dot={{ fill: "#4f46e5", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function FileTypeAnalyticsCard({ usage, loading }) {
  const fileTypes = useMemo(() => groupByExtension(usage), [usage]);
  const maxCount = fileTypes[0]?.count ?? 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm text-left">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">File Type Analytics</h2>
          <p className="mt-1 text-sm text-slate-500">
            Files grouped by extension from usage data.
          </p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          <ChartIcon />
        </div>
      </div>

      <div className="mt-6">
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500 animate-pulse">Loading analytics…</p>
        ) : fileTypes.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500 animate-pulse">
            No files to analyze yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {fileTypes.map(({ extension, count }) => (
              <div key={extension} className="flex flex-col justify-center">
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700 uppercase">
                    .{extension}
                  </span>
                  <span className="tabular-nums text-slate-500 font-semibold">
                    {count} {count === 1 ? "file" : "files"}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                    style={{ width: `${maxCount ? (count / maxCount) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AnalyticsTab({ usage, loading, plan = "Free", onUpgradeClick }) {
  if (plan === "Free") {
    return (
      <PremiumLockOverlay
        message="Upgrade to a Pro or Enterprise subscription to unlock detailed storage analytics and file type breakdown charts."
        onUpgradeClick={onUpgradeClick}
      />
    );
  }
  return (
    <div className="space-y-6">
      {/* Uploads Over Time (Large format) */}
      <UploadsOverTimeChart usage={usage} loading={loading} />

      {/* File Type Analytics (Large grid format) */}
      <FileTypeAnalyticsCard usage={usage} loading={loading} />
    </div>
  );
}
