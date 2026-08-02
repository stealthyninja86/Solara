import { useState } from "react";
import type { Subscription, TimePeriod } from "../types/reports";
import { CATEGORY_EMOJIS } from "../constants";
import { PeriodSelect } from "./PeriodSelect";
import { Icon } from "./Icon";

interface Props {
  data: Subscription[];
  totalAnnual: number;
}

export function SubscriptionCard({ data, totalAnnual }: Props) {
  const [period, setPeriod] = useState<TimePeriod>("monthly");

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-[0.8rem] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            <Icon name="recurring-payments" size={14} /> Recurring Payments
          </h2>
          <p className="mt-0.5 text-[0.7rem] text-[var(--color-text-muted)]">Detected subscriptions and regular charges</p>
        </div>
        <PeriodSelect value={period} onChange={setPeriod} />
      </div>

      <div className="flex flex-col gap-3">
        {data.map((sub) => (
          <div
            key={sub.merchant}
            className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-deep)] px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <span className="text-[0.8rem]">{CATEGORY_EMOJIS[sub.category] ?? ""}</span>
              <span className="text-[0.8rem] font-medium text-[var(--color-text)]">{sub.merchant}</span>
            </div>
            <div className="text-right">
              <div className="text-[0.8rem] font-medium text-[var(--color-text)]">
                {'\u20B9'}{sub.amount.toLocaleString("en-IN")}
              </div>
              <div className="text-[0.65rem] text-[var(--color-text-muted)]">{sub.interval}</div>
            </div>
          </div>
        ))}
      </div>

      {totalAnnual > 0 && (
        <div className="mt-4 rounded-lg border border-[var(--color-warn)]/20 bg-[var(--color-warn)]/5 px-4 py-3">
          <div className="text-[0.65rem] font-medium uppercase tracking-wider text-[var(--color-warn)]">
            Annual cost
          </div>
          <div className="text-[0.85rem] font-bold text-[var(--color-text)]">
            {'\u20B9'}{totalAnnual.toLocaleString("en-IN")}/year
          </div>
        </div>
      )}
    </div>
  );
}
