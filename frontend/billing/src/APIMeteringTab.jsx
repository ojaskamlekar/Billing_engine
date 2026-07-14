import { useState, useEffect, useMemo } from "react";
import { api } from "./api";
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
  Legend
} from "recharts";
import {
  Activity,
  CheckCircle,
  AlertTriangle,
  Clock,
  CircleDollarSign,
  TrendingUp,
  Cpu,
  Filter,
  BarChart3,
  RefreshCw,
  Sparkles,
  PieChart as PieIcon
} from "lucide-react";

const SUCCESS_COLORS = ["#10b981", "#ef4444"];

export default function APIMeteringTab() {
  const [timeframe, setTimeframe] = useState("Last 30 Days");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  const [summaryData, setSummaryData] = useState(null);
  const [chartsData, setChartsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const costPerRequest = 0.02; // Fixed ₹0.02 rate per requirement

  async function fetchMeteringData() {
    setLoading(true);
    setError(null);
    try {
      let params = { timeframe };
      if (timeframe === "Custom") {
        params.start_date = startDate;
        params.end_date = endDate;
      }
      
      const [sumRes, chartRes] = await Promise.all([
        api.get("/api-metering/summary", { params }),
        api.get("/api-metering/charts", { params })
      ]);
      
      setSummaryData(sumRes.data);
      setChartsData(chartRes.data);
    } catch (err) {
      console.error("Failed to load API metering metrics:", err);
      setError("Failed to fetch metering logs. Please ensure you are logged in.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (timeframe !== "Custom" || (startDate && endDate)) {
      fetchMeteringData();
    }
  }, [timeframe, startDate, endDate]);

  const { summary, breakdown } = summaryData || {};
  const estimatedCost = (summary?.total_requests || 0) * costPerRequest;

  // Reformat chart data
  const dailyData = chartsData?.daily_volume || [];
  const successVsFailed = chartsData?.success_vs_failed || [];
  const peakHours = chartsData?.peak_hours || [];

  // 1. Horizontal Bar Chart data mapping
  const distributionData = useMemo(() => {
    if (!breakdown) return [];
    const labelMapping = {
      "UPLOAD": "Uploads",
      "DOWNLOAD": "Downloads",
      "DELETE": "Deletes",
      "LIST FILES": "List Requests",
      "LOGIN": "Login",
      "REGISTER": "Register",
      "EMAIL VERIFICATION": "OTP Verification",
      "OTP RESEND": "OTP Resend",
      "ADMIN ACTIONS": "Admin Actions",
      "OTHER": "Other"
    };

    return Object.entries(breakdown).map(([key, count]) => ({
      name: labelMapping[key] || key,
      requests: count
    })).sort((a, b) => b.requests - a.requests);
  }, [breakdown]);

  // 2. Deterministic insights calculations
  const insights = useMemo(() => {
    const list = [];
    if (!summary || !distributionData.length) return list;

    // Insight 1: Success Rate
    list.push(`${(summary.success_rate ?? 100.0).toFixed(0)}% of API requests were successful.`);

    // Insight 2: Primary traffic generator
    const maxCat = distributionData[0];
    if (maxCat && maxCat.requests > 0 && summary.total_requests > 0) {
      const pct = ((maxCat.requests / summary.total_requests) * 100).toFixed(0);
      list.push(`${maxCat.name} generated ${pct}% of all API traffic.`);
    }

    // Insight 3: Response latency status
    const avgLatency = summary.avg_response_time || 0;
    if (avgLatency > 0) {
      if (avgLatency < 50) {
        list.push(`Average response time is extremely fast at ${avgLatency.toFixed(1)} ms.`);
      } else {
        list.push(`Average response time is healthy at ${avgLatency.toFixed(1)} ms.`);
      }
    }

    // Insight 4: Peak usage hours
    const peakHourItem = peakHours.length > 0 ? [...peakHours].sort((a, b) => b.requests - a.requests)[0] : null;
    if (peakHourItem && peakHourItem.requests > 0) {
      list.push(`Most requests occurred around ${peakHourItem.hour} peak interval.`);
    }

    return list;
  }, [summary, distributionData, peakHours]);

  if (loading && !summaryData) {
    return (
      <div className="flex h-96 items-center justify-center text-slate-500">
        <RefreshCw className="h-6 w-6 animate-spin text-indigo-600 mr-2" />
        <span className="font-semibold">Loading API Metrics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-800">
        <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-3" />
        <p className="font-bold">{error}</p>
        <button onClick={fetchMeteringData} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-350 max-w-7xl mx-auto px-1">
      
      {/* Premium Dashboard Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5 text-left">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">API Request Metering</h2>
          <p className="text-xs text-slate-500 mt-1">Real-time enterprise metrics and transaction logs.</p>
        </div>

        {/* Filter controls row */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/50">
            {["Today", "Last 7 Days", "Last 30 Days", "Custom"].map((t) => (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  timeframe === t
                    ? "bg-white text-indigo-600 shadow-sm"
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
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2 py-1 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-800"
              />
              <span className="text-slate-400 text-xs font-medium">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2 py-1 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-800"
              />
            </div>
          )}

          <button 
            onClick={fetchMeteringData} 
            disabled={loading}
            className="flex items-center justify-center p-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-650 disabled:opacity-50 transition cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Stripe-like 5 Summary Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Total Requests */}
        <div className="bg-white border border-slate-200/85 rounded-xl p-5 shadow-sm text-left">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Requests</span>
          <span className="text-2xl font-black text-slate-850 block mt-2">{summary?.total_requests || 0}</span>
          <div className="mt-2 flex items-center text-[9px] text-slate-450 gap-1 font-semibold">
            <Activity className="h-3 w-3 text-indigo-500" /> Platform calls
          </div>
        </div>

        {/* Card 2: Success Rate */}
        <div className="bg-white border border-slate-200/85 rounded-xl p-5 shadow-sm text-left">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Success Rate</span>
          <span className="text-2xl font-black text-slate-850 block mt-2">{(summary?.success_rate ?? 100.0).toFixed(1)}%</span>
          <div className="mt-2 flex items-center text-[9px] text-emerald-600 gap-1 font-semibold">
            <CheckCircle className="h-3 w-3 text-emerald-500" /> Successful queries
          </div>
        </div>

        {/* Card 3: Avg Response Time */}
        <div className="bg-white border border-slate-200/85 rounded-xl p-5 shadow-sm text-left">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Avg Latency</span>
          <span className="text-2xl font-black text-slate-850 block mt-2">{(summary?.avg_response_time ?? 0.0).toFixed(0)} <span className="text-xs font-semibold text-slate-400">ms</span></span>
          <div className="mt-2 flex items-center text-[9px] text-slate-450 gap-1 font-semibold">
            <Clock className="h-3 w-3 text-indigo-500" /> Response speed
          </div>
        </div>

        {/* Card 4: Failed Requests */}
        <div className="bg-white border border-slate-200/85 rounded-xl p-5 shadow-sm text-left">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Failed Requests</span>
          <span className="text-2xl font-black text-rose-650 block mt-2">{summary?.failed_requests || 0}</span>
          <div className="mt-2 flex items-center text-[9px] text-rose-600 gap-1 font-semibold">
            <AlertTriangle className="h-3 w-3 text-rose-500" /> Error codes &ge; 400
          </div>
        </div>

        {/* Card 5: Estimated Cost */}
        <div className="bg-white border border-slate-200/85 rounded-xl p-5 shadow-sm text-left">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Simulated Cost</span>
          <span className="text-2xl font-black text-slate-850 block mt-2">₹{estimatedCost.toFixed(2)}</span>
          <div className="mt-2 flex items-center text-[9px] text-indigo-650 gap-1 font-semibold">
            <CircleDollarSign className="h-3 w-3 text-indigo-550" /> Rate: ₹0.02 / req
          </div>
        </div>
      </div>

      {/* Primary: Request Volume Over Time (Line Chart) */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm text-left">
        <div>
          <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-indigo-500" /> Request Volume Over Time
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">The daily transaction volume logs profile.</p>
        </div>
        <div className="mt-6 h-64">
          {dailyData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-slate-400 text-xs">No metrics found.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={9} fontWeight={600} />
                <YAxis stroke="#94a3b8" fontSize={9} fontWeight={600} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", background: "#ffffff" }}
                  formatter={(value) => [value, "API Requests"]}
                />
                <Line type="monotone" dataKey="requests" stroke="#6366f1" strokeWidth={2} dot={{ r: 2.5 }} activeDot={{ r: 4.5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Side-by-side Visualizations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-left">
        
        {/* Horizontal Bar Chart (Request Distribution) */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4 text-indigo-500" /> API Request Distribution
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">Category share of request traffic.</p>
          </div>

          <div className="h-60 mt-6">
            {distributionData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-slate-400 text-xs">No metrics found.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={distributionData}
                  margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" />
                  <XAxis type="number" stroke="#94a3b8" fontSize={8} fontWeight={600} />
                  <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={9} fontWeight={700} width={95} />
                  <Tooltip />
                  <Bar dataKey="requests" name="Total Calls" fill="#6366f1" radius={[0, 3, 3, 0]} barSize={10} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Success vs Failed Requests (Pie Chart) */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-805 flex items-center gap-1.5">
              <PieIcon className="h-4 w-4 text-indigo-500" /> Success vs Failed Requests
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">Proportion of healthy versus error-status transactions.</p>
          </div>

          <div className="h-48 mt-4">
            {successVsFailed.length === 0 ? (
              <div className="flex h-full items-center justify-center text-slate-400 text-xs">No metrics found.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={successVsFailed}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {successVsFailed.map((entry, idx) => (
                      <Cell key={entry.name} fill={SUCCESS_COLORS[idx % SUCCESS_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="flex gap-4 text-[10px] font-bold justify-center border-t border-slate-50 pt-3">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Success ({successVsFailed.find(d => d.name === "Success")?.value || 0})
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              Failed ({successVsFailed.find(d => d.name === "Failed")?.value || 0})
            </span>
          </div>
        </div>

      </div>

      {/* API Insights Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm text-left">
        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-indigo-500" /> API Insights
        </h4>
        <p className="text-xs text-slate-450 mt-0.5">Automated observations of platform API consumption.</p>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights.length === 0 ? (
            <div className="text-slate-400 text-xs col-span-2">
              Generate more request logs to compile intelligence insights.
            </div>
          ) : (
            insights.map((insight, idx) => (
              <div key={idx} className="flex items-center gap-3 bg-slate-50 border border-slate-100 p-3 rounded-lg">
                <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                <span className="text-xs text-slate-700 font-semibold">{insight}</span>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
