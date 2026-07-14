import { useState } from "react";
import { api } from "./api";

const PLANS = [
  {
    name: "Free",
    price: "₹0",
    period: "forever",
    limit: "5 GB storage",
    uploadLimit: "25 MB max upload size",
    color: "slate",
    badgeColor: "bg-slate-100 text-slate-800 border-slate-200",
    buttonColor: "bg-slate-800 hover:bg-slate-700 text-white",
    features: [
      { text: "File upload support", included: true },
      { text: "Basic dashboard metrics", included: true },
      { text: "Usage history logs", included: true },
      { text: "Cost forecasting", included: false },
      { text: "Advanced analytics charts", included: false },
      { text: "PDF invoice generation", included: false },
      { text: "Predictive billing alerts", included: false },
      { text: "AI storage tier recommendation", included: false },
    ],
  },
  {
    name: "Pro",
    price: "₹499",
    period: "month",
    limit: "100 GB storage",
    uploadLimit: "500 MB max upload size",
    color: "indigo",
    badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
    buttonColor: "bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-100",
    features: [
      { text: "File upload support", included: true },
      { text: "Basic dashboard metrics", included: true },
      { text: "Usage history logs", included: true },
      { text: "Cost forecasting (AI-driven)", included: true },
      { text: "Advanced analytics charts", included: true },
      { text: "PDF invoice generation", included: true },
      { text: "Predictive billing alerts", included: true },
      { text: "AI storage tier recommendation", included: true },
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "pricing",
    limit: "5 TB storage",
    uploadLimit: "5 GB max upload size",
    color: "purple",
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
    buttonColor: "bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-100",
    features: [
      { text: "Everything in Pro plan", included: true },
      { text: "5 TB total storage", included: true },
      { text: "5 GB upload size limit", included: true },
      { text: "Multi-user account scoping", included: true },
      { text: "Priority processing queues", included: true },
      { text: "Enterprise billing reports", included: true },
      { text: "SLA-ready infrastructure", included: true },
    ],
  },
];

export default function SubscriptionPage({ currentPlan, onPlanUpdated }) {
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [error, setError] = useState(null);

  const handleUpgrade = async (planName) => {
    if (planName === currentPlan) return;
    setLoadingPlan(planName);
    setError(null);
    try {
      const res = await api.post("/subscription/upgrade", { plan: planName });
      onPlanUpdated?.(res.data.plan);
    } catch (err) {
      console.error(err);
      setError("Failed to update subscription. Please try again.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 text-left">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          SaaS Subscription Billing Tiers
        </h2>
        <p className="mt-2 text-lg text-slate-500">
          Scale your cloud storage footprint with flexible, metered subscription packages.
        </p>
      </div>

      {error && (
        <div className="mx-auto mt-6 max-w-md rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 text-center">
          {error}
        </div>
      )}

      <div className="mx-auto mt-12 grid max-w-md grid-cols-1 gap-8 lg:max-w-5xl lg:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan?.toLowerCase() === plan.name.toLowerCase();
          const isPro = plan.name === "Pro";
          const isEnterprise = plan.name === "Enterprise";

          return (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl bg-white p-8 border shadow-sm transition-all duration-200 hover:shadow-md ${
                isCurrent
                  ? "border-indigo-600 ring-1 ring-indigo-600 scale-[1.02]"
                  : "border-slate-200"
              }`}
            >
              {isPro && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-4 py-1 text-xs font-semibold text-white shadow-sm">
                  Most Popular
                </div>
              )}
              {isEnterprise && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-purple-600 px-4 py-1 text-xs font-semibold text-white shadow-sm">
                  Recommended for Teams
                </div>
              )}

              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border ${plan.badgeColor}`}>
                  {plan.limit}
                </span>
              </div>

              <div className="mb-6 flex items-baseline text-slate-900">
                <span className="text-4xl font-extrabold tracking-tight">{plan.price}</span>
                {plan.period && (
                  <span className="ml-1 text-sm font-semibold text-slate-500">
                    /{plan.period}
                  </span>
                )}
              </div>

              <p className="mb-6 text-sm text-slate-500">{plan.uploadLimit}</p>

              <button
                type="button"
                onClick={() => handleUpgrade(plan.name)}
                disabled={isCurrent || loadingPlan !== null}
                className={`w-full rounded-xl py-3 text-center text-sm font-semibold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  isCurrent
                    ? "bg-slate-100 text-slate-500 border border-slate-200"
                    : plan.buttonColor
                }`}
              >
                {loadingPlan === plan.name
                  ? "Updating..."
                  : isCurrent
                  ? "Current Active Plan"
                  : `Switch to ${plan.name}`}
              </button>

              <ul role="list" className="mt-8 space-y-4 border-t border-slate-100 pt-6">
                {plan.features.map((feature, fIdx) => (
                  <li key={fIdx} className="flex items-start">
                    <span className="shrink-0">
                      {feature.included ? (
                        <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </span>
                    <span className={`ml-3 text-sm ${feature.included ? "text-slate-700" : "text-slate-400 line-through"}`}>
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
