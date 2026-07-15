import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

// Tabs & notification components
import DashboardTabs from "./DashboardTabs";
import NotificationBell from "./NotificationBell";
import AlertPopover from "./AlertPopover";
import OverviewTab from "./OverviewTab";
import APIMeteringTab from "./APIMeteringTab";
import AnalyticsTab from "./AnalyticsTab";
import UsageLogsTab from "./UsageLogsTab";
import InvoiceTab from "./InvoiceTab";
import SubscriptionPage from "./SubscriptionPage";
import AuditLogsTab from "./AuditLogsTab";
import StorageOptimizationTab from "./StorageOptimizationTab";

export default function StorageDashboard({ onLogout, userName }) {
  const [activeTab, setActiveTab] = useState("Overview");
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  // Core API states
  const [usage, setUsage] = useState([]);
  const [summary, setSummary] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [recLoading, setRecLoading] = useState(true);
  const [recError, setRecError] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [invoiceLoading, setInvoiceLoading] = useState(true);
  const [invoiceError, setInvoiceError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Lifted Usage Logs Filters State
  const [usageFilters, setUsageFilters] = useState({
    searchQuery: "",
    fileType: "All",
    planFilter: "All",
    fromDate: "",
    toDate: "",
    sortBy: "Newest",
    currentPage: 1
  });

  const fetchUsage = useCallback(async () => {
    try {
      const res = await api.get("/usage");
      setUsage(res.data);
    } catch (err) {
      console.error("Error fetching usage:", err);
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await api.get("/summary");
      setSummary(res.data);
    } catch (err) {
      console.error("Error fetching summary:", err);
    }
  }, []);

  const fetchForecast = useCallback(async () => {
    try {
      const res = await api.get("/forecast");
      setForecast(res.data);
    } catch (err) {
      console.error("Error fetching forecast:", err);
    }
  }, []);

  const fetchRecommendation = useCallback(async () => {
    setRecLoading(true);
    setRecError(null);
    try {
      const res = await api.get("/recommend-tier");
      setRecommendation(res.data);
    } catch (err) {
      console.error("Error fetching recommendation:", err);
      setRecError(err.message || "Failed to load tier recommendation");
    } finally {
      setRecLoading(false);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await api.get("/alerts");
      setAlerts(res.data);
    } catch (err) {
      console.error("Error fetching alerts:", err);
    }
  }, []);

  const fetchInvoice = useCallback(async () => {
    setInvoiceLoading(true);
    setInvoiceError(null);
    try {
      const res = await api.get("/invoice");
      setInvoice(res.data);
    } catch (err) {
      console.error("Error fetching invoice:", err);
      setInvoiceError(err.message || "Failed to load invoice details");
    } finally {
      setInvoiceLoading(false);
    }
  }, []);

  const refreshDashboard = useCallback(async () => {
    let activePlan = "Free";
    try {
      const userRes = await api.get("/me");
      setUser(userRes.data);
      activePlan = userRes.data.plan;
    } catch (err) {
      console.error("Error loading user profile:", err);
    }

    const isFree = activePlan === "Free";
    const fetches = [
      fetchUsage(),
      fetchSummary(),
    ];

    if (!isFree) {
      fetches.push(
        fetchForecast(),
        fetchRecommendation(),
        fetchAlerts(),
        fetchInvoice()
      );
    } else {
      // Reset premium states
      setForecast(null);
      setRecommendation(null);
      setAlerts(null);
      setInvoice(null);
    }

    await Promise.all(fetches);
  }, [fetchUsage, fetchSummary, fetchForecast, fetchRecommendation, fetchAlerts, fetchInvoice]);

  const handlePlanUpdated = () => {
    // Refresh user state and dashboard queries
    refreshDashboard();
  };

  useEffect(() => {
    const load = async () => {
      try {
        await refreshDashboard();
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [refreshDashboard]);

  // Render content of active tab
  const renderTabContent = () => {
    const plan = user?.plan || "Free";
    const onUpgradeClick = () => setActiveTab("Subscription");

    switch (activeTab) {
      case "Overview":
        return (
          <OverviewTab
            usage={usage}
            summary={summary}
            forecast={forecast}
            recommendation={recommendation}
            alerts={alerts}
            loading={loading}
            recLoading={recLoading}
            recError={recError}
            onRetryRecommendation={fetchRecommendation}
            onUploaded={refreshDashboard}
            plan={plan}
            onUpgradeClick={onUpgradeClick}
          />
        );
      case "API Metering":
        return (
          <APIMeteringTab />
        );
      case "Analytics":
        return (
          <AnalyticsTab
            usage={usage}
            loading={loading}
            plan={plan}
            onUpgradeClick={onUpgradeClick}
          />
        );
      case "Storage Explorer":
        return (
          <UsageLogsTab
            usage={usage}
            loading={loading}
            filters={usageFilters}
            onFiltersChange={setUsageFilters}
            onUploadClick={() => setActiveTab("Overview")}
            onDelete={async (fileId) => {
              // 1. Keep a backup for rollback on failure
              const originalUsage = [...usage];
              const originalSummary = summary ? { ...summary } : null;

              // 2. Perform optimistic UI updates on counters/summary immediately
              const fileToDelete = usage.find((f) => f.id === fileId);
              if (fileToDelete) {
                if (summary) {
                  const newStorage = Math.max(0, summary.total_storage_bytes - fileToDelete.filesize);
                  const rates = {
                    "Free": 0.0,
                    "Pro": 2.0,
                    "Enterprise": 1.5
                  };
                  const activePlan = user?.plan || "Free";
                  const rate = rates[activePlan] !== undefined ? rates[activePlan] : 2.0;
                  const newCost = (newStorage / (1024 * 1024)) * rate;
                  setSummary({
                    total_storage_bytes: newStorage,
                    total_cost: Number(newCost.toFixed(2))
                  });
                }
              }

              try {
                // 3. Make delete request to backend
                await api.delete(`/files/${fileId}`);

                // 4. Delay state removal slightly to let the 500ms fade/blur row animation finish
                await new Promise((resolve) => setTimeout(resolve, 500));

                // 5. Remove from local list
                setUsage((prev) => prev.filter((f) => f.id !== fileId));

                // 6. Refresh all other dashboard queries/states (rec, alerts, forecast, etc.)
                await refreshDashboard();
                
                return { success: true };
              } catch (err) {
                console.error("Failed to delete file:", err);
                
                // Rollback state on error
                setUsage(originalUsage);
                setSummary(originalSummary);
                
                return { success: false };
              }
            }}
          />
        );
      case "Invoice":
        return (
          <InvoiceTab
            invoice={invoice}
            loading={invoiceLoading}
            error={invoiceError}
            onRetry={fetchInvoice}
            plan={plan}
            onUpgradeClick={onUpgradeClick}
          />
        );
      case "Subscription":
        return (
          <SubscriptionPage
            currentPlan={plan}
            onPlanUpdated={handlePlanUpdated}
          />
        );
      case "Audit Logs":
        return (
          <AuditLogsTab
            plan={plan}
          />
        );
      case "Optimization":
        return (
          <StorageOptimizationTab
            onNavigate={setActiveTab}
          />
        );
      default:
        return null;
    }
  };

  const isFromCache = !!(
    summary?.from_cache ||
    forecast?.from_cache ||
    recommendation?.from_cache ||
    invoice?.from_cache
  );

  return (
    <div className="min-h-screen bg-zinc-50/60 relative pb-16 font-sans antialiased text-zinc-900">
      
      {/* Header section */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur-md shadow-[0_1px_3px_rgba(0,0,0,0.015)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="text-left flex items-baseline gap-2">
            <h1 className="text-xl font-extrabold text-zinc-900 tracking-tight">
              WeCloud<span className="text-[#635BFF]">.</span>
            </h1>
            <span className="hidden md:inline-block text-[11px] text-zinc-400 font-medium border-l border-zinc-200 pl-2">
              Cloud Storage Console
            </span>
          </div>
          {/* Right side: user identity + status + logout */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>

            {/* Cache serving status badge */}
            {isFromCache && (
              <div className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50/80 px-2.5 py-1 text-[10px] font-bold text-amber-700 animate-pulse">
                <span>⚡ Cached</span>
              </div>
            )}

            {/* Billing engine status */}
            <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold text-zinc-650">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden />
              Live billing
            </div>

            {/* Welcome chip */}
            {(user?.name || userName) && (
              <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-zinc-700">
                <div className="w-5 h-5 rounded-full bg-[#635BFF] flex items-center justify-center shadow-sm">
                  <span className="text-white text-[9px] font-bold">
                    {(user?.name || userName).charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-[11px] font-semibold">
                  {user?.name || userName}
                </span>
              </div>
            )}

            {/* Plan Badge in Header */}
            {user?.plan && (
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold border ${
                user.plan === "Enterprise"
                  ? "bg-purple-50 text-purple-700 border-purple-200/80"
                  : user.plan === "Pro"
                  ? "bg-indigo-50/60 text-[#635BFF] border-purple-200/40"
                  : "bg-zinc-50 text-zinc-700 border-zinc-200"
              }`}>
                {user.plan}
              </span>
            )}

            {/* Logout button */}
            <button
              id="logout-btn"
              onClick={onLogout}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-600 text-xs font-semibold cursor-pointer hover:bg-zinc-50 hover:text-zinc-900 transition-colors shadow-xs"
              aria-label="Sign out"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign out
            </button>

          </div>
        </div>
      </header>

      {/* Floating persistent alert indicator */}
      <NotificationBell
        alerts={alerts}
        onClick={() => setIsNotificationOpen((prev) => !prev)}
      />

      {/* Alert Popover */}
      {isNotificationOpen && (
        <AlertPopover
          alerts={alerts}
          onClose={() => setIsNotificationOpen(false)}
        />
      )}

      {/* Tabs navigation */}
      <DashboardTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Tab content area */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {renderTabContent()}
      </main>
      
    </div>
  );
}
