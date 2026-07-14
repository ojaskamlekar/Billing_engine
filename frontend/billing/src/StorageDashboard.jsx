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
    <div className="min-h-screen bg-slate-50 relative pb-16 font-sans">
      
      {/* Header section */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              Object Storage
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900 sm:text-3xl">
              Usage Metering & Billing
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Monitor storage consumption and estimated charges across your buckets.
            </p>
          </div>
          {/* Right side: user identity + status + logout */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>

            {/* Cache serving status badge */}
            {isFromCache && (
              <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 animate-pulse">
                <span>⚡ Served from Cache</span>
              </div>
            )}

            {/* Billing engine status */}
            <div className="hidden sm:flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
              Billing engine active
            </div>

            {/* Welcome chip */}
            {(user?.name || userName) && (
              <div style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "6px 12px",
                background: "linear-gradient(135deg, #eef2ff, #f5f3ff)",
                border: "1px solid #e0e7ff",
                borderRadius: "40px",
              }}>
                {/* Avatar circle */}
                <div style={{
                  width: "26px", height: "26px", borderRadius: "50%",
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <span style={{ color: "white", fontSize: "0.65rem", fontWeight: 700 }}>
                    {(user?.name || userName).charAt(0).toUpperCase()}
                  </span>
                </div>
                <span style={{ fontSize: "0.82rem", color: "#4338ca", fontWeight: 600, whiteSpace: "nowrap" }}>
                  Welcome, {user?.name || userName}
                </span>
              </div>
            )}

            {/* Plan Badge in Header */}
            {user?.plan && (
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold border ${
                user.plan === "Enterprise"
                  ? "bg-purple-50 text-purple-700 border-purple-200"
                  : user.plan === "Pro"
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : "bg-slate-100 text-slate-700 border-slate-200"
              }`}>
                {user.plan} Plan
              </span>
            )}

            {/* Logout button */}
            <button
              id="logout-btn"
              onClick={onLogout}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "7px 14px", borderRadius: "8px",
                background: "transparent",
                border: "1px solid #e2e8f0",
                color: "#64748b", fontSize: "0.8rem", fontWeight: 600,
                cursor: "pointer", transition: "background 0.15s, color 0.15s, border-color 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#fef2f2"; e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.borderColor = "#fecaca"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#64748b"; e.currentTarget.style.borderColor = "#e2e8f0"; }}
              aria-label="Sign out"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
