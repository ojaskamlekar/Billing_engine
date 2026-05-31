import React, { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function parseUploadDate(value) {
  if (!value) return null;
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

function getForecastChartData(files, forecastData) {
  if (!files || files.length === 0) {
    return [
      { name: "Current", storage: 0, forecast: 0 },
      { name: "Forecast", storage: null, forecast: forecastData?.predicted_storage_mb ?? 0 },
    ];
  }

  const sorted = [...files].sort((a, b) => {
    const dA = parseUploadDate(a.uploaded_at) || new Date(0);
    const dB = parseUploadDate(b.uploaded_at) || new Date(0);
    return dA - dB;
  });

  let runningSumBytes = 0;
  const history = sorted.map((file, idx) => {
    runningSumBytes += file.filesize;
    const mb = runningSumBytes / (1024 * 1024);
    return {
      name: `Upload ${idx + 1}`,
      storage: Number(mb.toFixed(2)),
      forecast: null,
    };
  });

  // Connect the last historical point to the forecast
  const lastHistoryPoint = history[history.length - 1];
  lastHistoryPoint.forecast = lastHistoryPoint.storage;

  history.push({
    name: "30d Forecast",
    storage: null,
    forecast: forecastData?.predicted_storage_mb ?? lastHistoryPoint.storage,
  });

  return history;
}

function ForecastChartCard({ forecast, usage, loading }) {
  const chartData = useMemo(() => {
    if (loading) return [];
    return getForecastChartData(usage, forecast);
  }, [usage, forecast, loading]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md flex flex-col justify-between h-[380px] text-left">
      <div>
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Forecast Trend Chart</h3>
            <p className="text-xs text-slate-500 mt-0.5">Historical storage trend vs. 30-day projection</p>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
        </div>
      </div>

      <div className="mt-6 flex-1 h-56">
        {loading ? (
          <p className="flex h-full items-center justify-center text-sm text-slate-500">
            Loading chart…
          </p>
        ) : chartData.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-slate-500">
            No upload history yet.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                tick={{ fill: "#64748b", fontSize: 10 }}
                axisLine={{ stroke: "#e2e8f0" }}
                tickLine={{ stroke: "#e2e8f0" }}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 10 }}
                axisLine={{ stroke: "#e2e8f0" }}
                tickLine={{ stroke: "#e2e8f0" }}
                unit="MB"
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
                formatter={(value, name) => [
                  `${value} MB`,
                  name === "storage" ? "History" : "Forecast",
                ]}
              />
              <Line
                type="monotone"
                dataKey="storage"
                name="storage"
                stroke="#4f46e5"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="forecast"
                name="forecast"
                stroke="#10b981"
                strokeWidth={2}
                strokeDasharray="3 3"
                dot={{ r: 3, fill: "#10b981" }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export default function ForecastingTab({
  forecast,
  usage,
  recommendation,
  loading,
  recLoading,
  recError,
  onRetryRecommendation
}) {
  const predictedStorage = forecast?.predicted_storage_mb ?? 0;
  const predictedCost = forecast?.predicted_cost ?? 0;
  const recommendedPlan = recommendation?.recommended_plan ?? "—";
  
  const getBadgeColor = (plan) => {
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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left Column: Forecast Trend Chart */}
      <div className="lg:col-span-2">
        <ForecastChartCard forecast={forecast} usage={usage} loading={loading} />
      </div>

      {/* Right Column: Forecast Details & Tier Recommendation */}
      <div className="space-y-6 flex flex-col justify-between">
        
        {/* Card 1: Forecast Details */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex-1 text-left">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-semibold text-slate-900">Forecast Details</h3>
            <svg className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Projected 30-Day Storage</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{loading ? "—" : `${predictedStorage} MB`}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Projected Cost</p>
              <p className="text-2xl font-bold text-indigo-600 mt-1">{loading ? "—" : `₹${predictedCost}`}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Calculated at current baseline rate (₹2/MB)</p>
            </div>
            
            <div className="border-t border-slate-100 pt-3">
              <span className="text-[11px] text-slate-500 leading-relaxed block">
                Predictions are powered by a linear regression estimator tracking the growth rate of uploaded files sizes over time.
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Tier Recommendation Insights */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex-1 text-left">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-semibold text-slate-900">Tier Recommendation</h3>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </span>
          </div>

          {recLoading ? (
            <div className="mt-4 animate-pulse space-y-3">
              <div className="h-6 w-20 bg-slate-100 rounded" />
              <div className="h-4 w-full bg-slate-100 rounded" />
              <div className="h-4 w-2/3 bg-slate-100 rounded" />
            </div>
          ) : recError ? (
            <div className="mt-4 text-xs text-red-600">
              <p>Failed to load tier recommendations.</p>
              <button
                onClick={onRetryRecommendation}
                className="mt-1 font-semibold underline text-red-800"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Recommended Plan</p>
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-bold border ${getBadgeColor(recommendedPlan)}`}>
                  {recommendedPlan}
                </span>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Reason & Insight</p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {recommendation?.reason || "Insufficient data for detailed tier recommendation."}
                </p>
              </div>

              {/* Threshold Plan limit references */}
              <div className="border-t border-slate-100 pt-3 text-[11px] text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>Free Tier Limit</span>
                  <span>100 MB</span>
                </div>
                <div className="flex justify-between">
                  <span>Pro Tier Limit</span>
                  <span>500 MB</span>
                </div>
                <div className="flex justify-between">
                  <span>Enterprise Limit</span>
                  <span>1,000 MB+</span>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
