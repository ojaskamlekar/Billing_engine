import { useCallback, useEffect, useState } from "react";
import axios from "axios";

// Tabs & notification components
import DashboardTabs from "./DashboardTabs";
import NotificationBell from "./NotificationBell";
import AlertPopover from "./AlertPopover";
import OverviewTab from "./OverviewTab";
import ForecastingTab from "./ForecastingTab";
import AnalyticsTab from "./AnalyticsTab";
import UsageLogsTab from "./UsageLogsTab";
import InvoiceTab from "./InvoiceTab";

const API_BASE = "http://127.0.0.1:8000";

export default function StorageDashboard() {
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
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsError, setAlertsError] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [invoiceLoading, setInvoiceLoading] = useState(true);
  const [invoiceError, setInvoiceError] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUsage = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/usage`);
      setUsage(res.data);
    } catch (err) {
      console.error("Error fetching usage:", err);
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/summary`);
      setSummary(res.data);
    } catch (err) {
      console.error("Error fetching summary:", err);
    }
  }, []);

  const fetchForecast = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/forecast`);
      setForecast(res.data);
    } catch (err) {
      console.error("Error fetching forecast:", err);
    }
  }, []);

  const fetchRecommendation = useCallback(async () => {
    setRecLoading(true);
    setRecError(null);
    try {
      const res = await axios.get(`${API_BASE}/recommend-tier`);
      setRecommendation(res.data);
    } catch (err) {
      console.error("Error fetching recommendation:", err);
      setRecError(err.message || "Failed to load tier recommendation");
    } finally {
      setRecLoading(false);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    setAlertsLoading(true);
    setAlertsError(null);
    try {
      const res = await axios.get(`${API_BASE}/alerts`);
      setAlerts(res.data);
    } catch (err) {
      console.error("Error fetching alerts:", err);
      setAlertsError(err.message || "Failed to load predictive alerts");
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  const fetchInvoice = useCallback(async () => {
    setInvoiceLoading(true);
    setInvoiceError(null);
    try {
      const res = await axios.get(`${API_BASE}/invoice`);
      setInvoice(res.data);
    } catch (err) {
      console.error("Error fetching invoice:", err);
      setInvoiceError(err.message || "Failed to load invoice details");
    } finally {
      setInvoiceLoading(false);
    }
  }, []);

  const refreshDashboard = useCallback(async () => {
    await Promise.all([
      fetchUsage(),
      fetchSummary(),
      fetchForecast(),
      fetchRecommendation(),
      fetchAlerts(),
      fetchInvoice(),
    ]);
  }, [fetchUsage, fetchSummary, fetchForecast, fetchRecommendation, fetchAlerts, fetchInvoice]);

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
          />
        );
      case "Forecasting":
        return (
          <ForecastingTab
            forecast={forecast}
            usage={usage}
            recommendation={recommendation}
            loading={loading}
            recLoading={recLoading}
            recError={recError}
            onRetryRecommendation={fetchRecommendation}
          />
        );
      case "Analytics":
        return <AnalyticsTab usage={usage} loading={loading} />;
      case "Usage Logs":
        return (
          <UsageLogsTab
            usage={usage}
            loading={loading}
          />
        );
      case "Invoice":
        return (
          <InvoiceTab
            invoice={invoice}
            loading={invoiceLoading}
            error={invoiceError}
            onRetry={fetchInvoice}
          />
        );
      default:
        return null;
    }
  };

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
          <div className="flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 sm:self-center">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
            Billing engine active
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
