import { useState } from "react";
import { Icon } from "../ui/Icon";
import { useAuth } from "../../hooks/useAuth";

interface Props {
  hasIncome: boolean;
  hasTransactions: boolean;
  hasBudget: boolean;
}

interface TutorialSection {
  key: string;
  label: string;
  icon: string;
  items: TutorialItem[];
}

interface TutorialItem {
  label: string;
  description: string;
  targetId?: string;
  action?: "scroll" | "navigate";
  navigateTo?: string;
}

export function OnboardingChecklist({ hasIncome, hasTransactions, hasBudget }: Props) {
  const { aiSettings } = useAuth();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [, rerender] = useState(0);

  function isDone(item: TutorialItem): boolean {
    if (item.label === "Set monthly income" && hasIncome) return true;
    if (item.label === "Add or import transactions" && hasTransactions) return true;
    if (item.label === "Set monthly budget" && hasBudget) return true;
    return localStorage.getItem(`onboarding-${item.label}`) === "done";
  }

  function markDone(item: TutorialItem) {
    if (!isDone(item)) {
      localStorage.setItem(`onboarding-${item.label}`, "done");
      rerender((n) => n + 1);
    }
  }

  const sections: TutorialSection[] = [
    {
      key: "setup",
      label: "Quick Setup",
      icon: "tip",
      items: [
        {
          label: "Set monthly income",
          description: "Your income powers the safe-to-spend calculator, savings rate, and trend charts.",
          targetId: "income-card",
        },
        {
          label: "Add or import transactions",
          description: "Add transactions manually or import your bank CSV (HDFC, ICICI, AXIS, SBI, KOTAK).",
          targetId: "transactions-card",
        },
        {
          label: "Set monthly budget",
          description: "Set a budget to track spending and see your safe-to-spend amount.",
          targetId: "budget-card",
        },
      ],
    },
    {
      key: "overview",
      label: "Overview",
      icon: "overview",
      items: [
        {
          label: "Safe to Spend",
          description: "See how much you can still spend this month after accounting for bills, EMIs, and subscriptions.",
          targetId: "safe-to-spend-card",
        },
        {
          label: "AI Finance Overview",
          description: "AI-generated insights about your spending patterns, savings rate, and what changed. Requires 3+ transactions.",
          targetId: "finance-overview-card",
        },
        {
          label: "AI Recommendations",
          description: "Actionable suggestions like 'Set budget', 'Cancel subscription', 'Cut spending' based on your data.",
          targetId: "recommendations-card",
        },
        {
          label: "Recurring Payments",
          description: "Track subscriptions, bills, rent, and EMIs. See annual costs and get alerts for missed payments.",
          targetId: "subscriptions-card",
        },
        {
          label: "Spending Bubbles",
          description: "Interactive bubble chart showing your top 5 spending categories. Hover to explore.",
          targetId: "expense-nodes-card",
        },
        {
          label: "Transaction Table",
          description: "View, sort, filter, and edit all your transactions. Click any row for details.",
          targetId: "transactions-card",
        },
      ],
    },
    {
      key: "reports",
      label: "Reports",
      icon: "reports",
      items: [
        {
          label: "Financial Snapshot",
          description: "Income, expenses, and savings for the period. Shows your savings rate with a 20% benchmark.",
          navigateTo: "/dashboard/reports",
        },
        {
          label: "Spending Behaviour",
          description: "Bar chart comparing current vs previous period per category. See what changed.",
          navigateTo: "/dashboard/reports",
        },
        {
          label: "Trend Chart",
          description: "Line chart showing income vs expenses over time. Spot trends at a glance.",
          navigateTo: "/dashboard/reports",
        },
        {
          label: "Category Breakdown",
          description: "Donut chart showing where your money goes. Hover to explore each category.",
          navigateTo: "/dashboard/reports",
        },
      ],
    },
    {
      key: "settings",
      label: "Settings",
      icon: "settings",
      items: [
        {
          label: "AI Features",
          description: "Toggle AI categorization and insight generation on or off.",
          navigateTo: "/dashboard/settings",
        },
        {
          label: "Icon Style",
          description: "Switch between playful emojis and clean Lucide icons.",
          navigateTo: "/dashboard/settings",
        },
        {
          label: "Profile & Password",
          description: "Update your name and change your password.",
          navigateTo: "/dashboard/settings",
        },
      ],
    },
  ];

  function handleItemClick(item: TutorialItem) {
    markDone(item);
    if (item.action === "navigate" || item.navigateTo) {
      window.location.href = item.navigateTo!;
    } else if (item.targetId) {
      document.getElementById(item.targetId)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  const totalItems = sections.reduce((sum, section) => sum + section.items.length, 0);
  const completedItems = sections.reduce(
    (sum, section) => sum + section.items.filter((item) => isDone(item)).length,
    0
  );

  return (
    <section
      className="card self-center max-w-[1000px] w-full !p-3 sm:!p-4"
      style={{ "--section-delay": "0ms" } as React.CSSProperties}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="tip" size={14} />
          <span className="text-[0.8rem] font-semibold text-[var(--color-text)]">
            Getting started with Solara
          </span>
        </div>
        <span className="text-[0.7rem] text-[var(--color-text-muted)]">
          {completedItems} of {totalItems} complete
        </span>
      </div>

      <div className="mt-3 h-1 overflow-hidden rounded-full bg-[var(--color-bg-hover)]">
        <div
          className="h-full rounded-full bg-[var(--color-ok)] transition-all duration-500"
          style={{ width: `${(completedItems / totalItems) * 100}%` }}
        />
      </div>

      <div className="mt-3 flex flex-col gap-1 overflow-hidden p-1.5 sm:p-2">
        {sections.map((section) => (
          <div key={section.key} className="flex flex-col p-1">
            <button
              onClick={() => setExpandedSection(expandedSection === section.key ? null : section.key)}
              className="button flex w-full items-center gap-2 rounded-[14px] px-3 py-4 text-left"
            >
              <Icon name={section.icon} size={13} />
              <span className="flex-1 text-[0.78rem] font-medium text-[var(--color-text)]">
                {section.label}
              </span>
              <span className="text-[0.65rem] text-[var(--color-text-muted)]">
                {section.items.filter((item) => isDone(item)).length}/{section.items.length}
              </span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-[var(--color-text-muted)] transition-transform"
                style={{ transform: expandedSection === section.key ? "rotate(180deg)" : "rotate(0deg)" }}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {expandedSection === section.key && (
              <div className="ml-3 mt-1 flex flex-col gap-1 border-l border-[var(--color-border)] p-2 sm:ml-5 sm:p-3">
                {section.items.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => handleItemClick(item)}
                    className="button flex w-full items-start gap-2 rounded-[14px] p-2.5 text-left whitespace-normal sm:p-3"
                  >
                    {isDone(item) ? (
                      <span className="mt-0.5 text-[0.7rem] font-bold text-[var(--color-ok)]">{"\u2713"}</span>
                    ) : (
                      <span className="mt-0.5 inline-block h-3 w-3 rounded-full border border-[var(--color-text-muted)]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <span className={`text-[0.75rem] ${isDone(item) ? "text-[var(--color-ok)] line-through opacity-60" : "text-[var(--color-text)]"}`}>
                        {item.label}
                      </span>
                      <p className="pt-1 text-[0.65rem] leading-snug">
                        {item.description}
                      </p>
                    </div>
                    {(item.targetId || item.navigateTo) && (
                      <span className="mt-0.5 shrink-0 text-[0.6rem] text-[var(--color-accent)]">
                        {item.navigateTo ? "Go" : "View"}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {aiSettings !== null && (
        <div className="mt-2 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg-hover)] p-3">
          <div className="flex items-start gap-2">
            <Icon name="tip" size={13} className="mt-0.5 shrink-0" />
            <ul className="flex min-w-0 list-disc flex-col gap-1 pl-4">
              {aiSettings ? (
                <li className="font-bold text-[0.7rem] leading-snug text-[var(--color-text)]">
                  The AI may not always categorize transactions correctly — review them once the import is done.
                </li>
              ) : (
                <li className="font-semibold text-[0.7rem] leading-snug text-[var(--color-text)]">
                  If AI settings are off, categorization, overview, and recommendations won't be available and
                  imported transactions remain uncategorized — categorize them after the CSV upload for accurate
                  reports. Enable AI settings to view your daily insights.
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
