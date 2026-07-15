import { useState } from "react";
import { api } from "./api";

const PLANS = [
  {
    name: "Free",
    price: "₹0",
    period: "forever",
    limit: "5 GB storage",
    uploadLimit: "25 MB max upload size",
    color: "zinc",
    badgeColor: "bg-zinc-50 text-zinc-650 border-zinc-200",
    buttonColor: "bg-zinc-800 hover:bg-zinc-900 text-white",
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
    color: "purple",
    badgeColor: "bg-purple-50 text-[#635BFF] border-purple-100",
    buttonColor: "bg-[#635BFF] hover:bg-[#5249f0] text-white",
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
    color: "indigo",
    badgeColor: "bg-zinc-100 text-zinc-800 border-zinc-250",
    buttonColor: "bg-zinc-800 hover:bg-zinc-900 text-white",
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
    <div className="mx-auto max-w-5xl px-4 py-4 text-left">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">
          Subscription Tiers
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Scale your cloud storage footprint with flexible, metered subscription packages.
        </p>
      </div>

      {error && (
        <div className="mx-auto mt-4 max-w-md rounded-lg border border-red-200 bg-red-50/50 p-3 text-xs text-red-700 text-center font-medium">
          {error}
        </div>
      )}

      <div className="mx-auto mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan?.toLowerCase() === plan.name.toLowerCase();
          const isPro = plan.name === "Pro";
          const isEnterprise = plan.name === "Enterprise";

          return (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-xl bg-white p-6 border text-left transition ${
                isCurrent
                  ? "border-[#635BFF] ring-0.5 ring-[#635BFF]"
                  : "border-zinc-200"
              }`}
            >
              {isPro && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-purple-50 border border-purple-150 px-3 py-0.5 text-[10px] font-bold text-[#635BFF]">
                  Most Popular
                </div>
              )}
              {isEnterprise && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-zinc-50 border border-zinc-200 px-3 py-0.5 text-[10px] font-bold text-zinc-600">
                  Recommended for Teams
                </div>
              )}

              <div className="mb-4 flex items-center justify-between mt-2">
                <h3 className="text-sm font-bold text-zinc-900">{plan.name}</h3>
                <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${plan.badgeColor}`}>
                  {plan.limit}
                </span>
              </div>

              <div className="mb-4 flex items-baseline text-zinc-900">
                <span className="text-3xl font-bold tracking-tight">{plan.price}</span>
                {plan.period && (
                  <span className="ml-1 text-xs font-semibold text-zinc-500">
                    /{plan.period}
                  </span>
                )}
              </div>

              <p className="mb-5 text-[11px] text-zinc-500 font-medium">{plan.uploadLimit}</p>

              <button
                type="button"
                onClick={() => handleUpgrade(plan.name)}
                disabled={isCurrent || loadingPlan !== null}
                className={`w-full rounded-lg py-2 text-center text-xs font-semibold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  isCurrent
                    ? "bg-zinc-100 text-zinc-500 border border-zinc-200"
                    : plan.buttonColor
                }`}
              >
                {loadingPlan === plan.name
                  ? "Updating..."
                  : isCurrent
                  ? "Current Active Plan"
                  : `Switch to ${plan.name}`}
              </button>

              <ul role="list" className="mt-6 space-y-3 border-t border-zinc-200 pt-5">
                {plan.features.map((feature, fIdx) => (
                  <li key={fIdx} className="flex items-start">
                    <span className="shrink-0 mt-0.5">
                      {feature.included ? (
                        <svg className="h-3.5 w-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="h-3.5 w-3.5 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </span>
                    <span className={`ml-2.5 text-xs font-medium ${feature.included ? "text-zinc-700" : "text-zinc-400 line-through"}`}>
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
