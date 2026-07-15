import { useState, useEffect, useMemo } from "react";
import { api } from "./api";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
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

const SUCCESS_COLORS = ["#635BFF", "#ef4444"];

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
      <div className="flex h-96 items-center justify-center text-zinc-500">
        <RefreshCw className="h-5 w-5 animate-spin text-[#635BFF] mr-2" />
        <span className="text-xs font-semibold">Loading API Metrics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50/30 p-6 text-center text-red-800">
        <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-3" />
        <p className="font-bold text-xs">{error}</p>
        <button onClick={fetchMeteringData} className="mt-4 px-4 py-2 bg-red-650 text-white rounded-lg hover:bg-red-700 text-xs font-semibold cursor-pointer border-0">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-1">
      
      {/* Premium Dashboard Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-200 pb-4 text-left">
        <div>
          <h2 className="text-xs font-bold text-zinc-800 uppercase tracking-wider">API Request Metering</h2>
          <p className="text-xs text-zinc-500 mt-1">Real-time enterprise metrics and transaction logs.</p>
        </div>

        {/* Filter controls row */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-zinc-100 p-0.5 rounded-lg border border-zinc-200">
            {["Today", "Last 7 Days", "Last 30 Days", "Custom"].map((t) => (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                  timeframe === t
                    ? "bg-white text-zinc-950 shadow-xs border border-zinc-200/50"
                    : "border border-transparent text-zinc-500 hover:text-zinc-900"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {timeframe === "Custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2 py-1.5 border border-zinc-200 rounded-lg text-[11px] font-medium text-zinc-800 focus:outline-[#635BFF]"
              />
              <span className="text-zinc-400 text-xs font-medium">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2 py-1.5 border border-zinc-200 rounded-lg text-[11px] font-medium text-zinc-800 focus:outline-[#635BFF]"
              />
            </div>
          )}

          <button 
            onClick={fetchMeteringData} 
            disabled={loading}
            className="flex items-center justify-center p-2 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-lg text-zinc-650 disabled:opacity-50 transition cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* SaaS 4 KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Requests */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5 text-left transition-all duration-200 hover:shadow-md hover:border-zinc-300 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider block">Total Requests</span>
          <span className="text-2xl font-bold text-zinc-900 block mt-2">{(summary?.total_requests || 0).toLocaleString()}</span>
          <div className="mt-2.5 flex items-center text-[10px] text-zinc-500 gap-1.5">
            <Activity className="h-3.5 w-3.5 text-[#635BFF]" /> Active queries
          </div>
        </div>

        {/* Card 2: Success Rate */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5 text-left transition-all duration-200 hover:shadow-md hover:border-zinc-300 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider block">Success Rate</span>
          <span className="text-2xl font-bold text-zinc-900 block mt-2">{(summary?.success_rate ?? 100.0).toFixed(1)}%</span>
          <div className="mt-2.5 flex items-center text-[10px] text-emerald-600 gap-1.5 font-semibold">
            <CheckCircle className="h-3.5 w-3.5" /> {summary?.failed_requests || 0} errors
          </div>
        </div>

        {/* Card 3: Avg Latency */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5 text-left transition-all duration-200 hover:shadow-md hover:border-zinc-300 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider block">Avg Latency</span>
          <span className="text-2xl font-bold text-zinc-900 block mt-2">{(summary?.avg_response_time ?? 0.0).toFixed(0)} <span className="text-xs font-semibold text-zinc-400">ms</span></span>
          <div className="mt-2.5 flex items-center text-[10px] text-zinc-500 gap-1.5">
            <Clock className="h-3.5 w-3.5 text-[#635BFF]" /> Response time
          </div>
        </div>

        {/* Card 4: Estimated Cost (HERO CARD WITH GRADIENT) */}
        <div className="bg-gradient-to-br from-[#635BFF]/5 via-white to-white border border-[#635BFF]/20 rounded-xl p-5 text-left transition-all duration-200 hover:shadow-md hover:border-[#635BFF]/30 shadow-[0_2px_4px_rgba(99,91,255,0.04)]">
          <span className="text-[10px] font-bold text-[#635BFF] uppercase tracking-wider block">Metered Cost</span>
          <span className="text-2xl font-bold text-zinc-900 block mt-2">₹{estimatedCost.toFixed(2)}</span>
          <div className="mt-2.5 flex items-center text-[10px] text-[#635BFF] gap-1.5 font-bold">
            <CircleDollarSign className="h-3.5 w-3.5" /> Rate: ₹0.02 / req
          </div>
        </div>
      </div>

      {/* Primary: Request Volume Over Time (Area Chart with clean gradient) */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 text-left shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div>
          <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-[#635BFF]" /> Request Volume Over Time
          </h4>
        </div>
        <div className="mt-4 h-64">
          {dailyData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-zinc-400 text-xs">No metrics found.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#635BFF" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#635BFF" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                <XAxis dataKey="date" stroke="#a1a1aa" fontSize={9} fontWeight={600} />
                <YAxis stroke="#a1a1aa" fontSize={9} fontWeight={600} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #e4e4e7", background: "#ffffff", fontSize: "11px" }}
                  formatter={(value) => [value, "API Requests"]}
                />
                <Area type="monotone" dataKey="requests" stroke="#635BFF" strokeWidth={1.5} fillOpacity={1} fill="url(#purpleGradient)" dot={{ r: 1.5 }} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Side-by-side Visualizations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-left">
        
        {/* Horizontal Bar Chart (Request Distribution) */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5 flex flex-col justify-between shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <div>
            <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4 text-[#635BFF]" /> API Request Distribution
            </h4>
          </div>

          <div className="h-60 mt-4">
            {distributionData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-zinc-400 text-xs">No metrics found.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={distributionData}
                  margin={{ top: 5, right: 10, left: -15, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" horizontal={false} />
                  <XAxis type="number" stroke="#a1a1aa" fontSize={8} fontWeight={600} />
                  <YAxis dataKey="name" type="category" stroke="#71717a" fontSize={9} fontWeight={700} width={95} />
                  <Tooltip contentStyle={{ fontSize: "11px", borderRadius: "6px" }} />
                  <Bar dataKey="requests" name="Total Calls" fill="#635BFF" radius={[0, 3, 3, 0]} barSize={8} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Success vs Failed Requests (Pie Chart) */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5 flex flex-col justify-between shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <div>
            <h4 className="text-xs font-bold text-zinc-850 uppercase tracking-wider flex items-center gap-1.5">
              <PieIcon className="h-4 w-4 text-[#635BFF]" /> Success vs Failed Requests
            </h4>
          </div>

          <div className="h-44 mt-4">
            {successVsFailed.length === 0 ? (
              <div className="flex h-full items-center justify-center text-zinc-400 text-xs">No metrics found.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={successVsFailed}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={62}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {successVsFailed.map((entry, idx) => (
                      <Cell key={entry.name} fill={SUCCESS_COLORS[idx % SUCCESS_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: "11px", borderRadius: "6px" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="flex gap-4 text-[10px] font-bold justify-center border-t border-zinc-150 pt-3">
            <span className="flex items-center gap-1 text-zinc-650">
              <span className="w-2 h-2 rounded-full bg-[#635BFF]" />
              Success ({successVsFailed.find(d => d.name === "Success")?.value || 0})
            </span>
            <span className="flex items-center gap-1 text-zinc-650">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              Failed ({successVsFailed.find(d => d.name === "Failed")?.value || 0})
            </span>
          </div>
        </div>

      </div>

      {/* API Insights Card */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 text-left shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-[#635BFF]" /> API Insights
        </h4>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {insights.length === 0 ? (
            <div className="text-zinc-400 text-xs col-span-2 py-4 text-center">
              Generate more request logs to compile intelligence insights.
            </div>
          ) : (
            insights.map((insight, idx) => (
              <div key={idx} className="flex items-center gap-2.5 bg-zinc-50 border border-zinc-150 p-3.5 rounded-lg shadow-2xs hover:bg-zinc-100/30 transition-colors">
                <span className="w-1.5 h-1.5 rounded-full bg-[#635BFF] shrink-0" />
                <span className="text-xs text-zinc-700 font-semibold leading-normal">{insight}</span>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
