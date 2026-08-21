import type { TrackedSubscription, SubscriptionFrequency, SubscriptionKind } from "../../types/reports";
import { annualCost } from "../../hooks/useDashboard";
import { HowItWorks, type HowItWorksItem } from "../ui/HowItWorks";
import { Icon } from "../ui/Icon";

interface Props {
  subscriptions: TrackedSubscription[];
  totalAnnual: number;
  onTrack?: () => void;
  onEstimate?: () => void;
  onManage?: (subscription: TrackedSubscription) => void;
}

const FREQUENCY_SUFFIX: Record<SubscriptionFrequency, string> = {
  DAILY: "/day",
  WEEKLY: "/wk",
  MONTHLY: "/mo",
  YEARLY: "/yr",
};

const KIND_ORDER: SubscriptionKind[] = ["SUBSCRIPTION", "BILL", "RENT", "EMI"];
const KIND_LABEL: Record<SubscriptionKind, string> = {
  SUBSCRIPTION: "Subscriptions",
  BILL: "Bills",
  RENT: "Rent",
  EMI: "EMIs",
};

const KIND_BADGE: Record<SubscriptionKind, { label: string; color: string; border: string; background: string }> = {
  SUBSCRIPTION: { label: "SUBSCRIPTION", color: "var(--color-badge-subscription)", border: "var(--color-badge-subscription-border)", background: "var(--color-badge-subscription-bg)" },
  BILL: { label: "BILL", color: "var(--color-badge-bill)", border: "var(--color-badge-bill-border)", background: "var(--color-badge-bill-bg)" },
  RENT: { label: "RENT", color: "var(--color-badge-rent)", border: "var(--color-badge-rent-border)", background: "var(--color-badge-rent-bg)" },
  EMI: { label: "EMI", color: "var(--color-badge-emi)", border: "var(--color-badge-emi-border)", background: "var(--color-badge-emi-bg)" },
};

function daysBetween(from: string, to: string, fallback: number): number {
  const start = new Date(from + "T00:00:00").getTime();
  const end = new Date(to + "T00:00:00").getTime();
  if (Number.isFinite(start) && Number.isFinite(end)) {
    return Math.max(fallback, Math.round((end - start) / 86_400_000));
  }
  return fallback;
}

function cyclesOverdue(subscription: TrackedSubscription): number {
  if (!subscription.lastChargeDate) return 2;
  const days = daysBetween(subscription.lastChargeDate, new Date().toISOString().slice(0, 10), 30);
  switch (subscription.frequency) {
    case "DAILY":
      return Math.max(2, days);
    case "WEEKLY":
      return Math.max(2, Math.floor(days / 7));
    case "MONTHLY":
      return Math.max(2, Math.floor(days / 30));
    case "YEARLY":
      return Math.max(2, Math.floor(days / 365));
  }
}

interface StatusVisual {
  dot: string;
  pulseClass: string;
  line: string;
}

function daysUntilRenewal(subscription: TrackedSubscription): number {
  if (!subscription.nextExpectedDate) return Number.POSITIVE_INFINITY;
  const target = new Date(subscription.nextExpectedDate + "T00:00:00").getTime();
  const now = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00").getTime();
  return Math.round((target - now) / 86_400_000);
}

function statusVisual(subscription: TrackedSubscription): StatusVisual {
  if (subscription.status === "CANCELLED") {
    return { dot: "var(--color-text-muted)", pulseClass: "", line: "cancelled" };
  }
  if (subscription.status === "PAID_OFF") {
    return { dot: "var(--color-text-muted)", pulseClass: "", line: "paid off" };
  }
  if (subscription.cycleState === "NOT_SEEN") {
    return {
      dot: "var(--color-bad)",
      pulseClass: "animate-radar",
      line: `Not charged in ${cyclesOverdue(subscription)} cycles — still active?`,
    };
  }
  const kind = subscription.kind ?? "SUBSCRIPTION";
  const daysLeft = daysUntilRenewal(subscription);
  let dot: string;
  let pulseClass: string;
  if (daysLeft > 5) {
    dot = "var(--color-ok)";
    pulseClass = "animate-radar-slow";
  } else if (daysLeft >= 1) {
    dot = "var(--color-warn)";
    pulseClass = "animate-radar";
  } else {
    dot = "var(--color-bad)";
    pulseClass = "animate-radar";
  }
  const dueWord = kind === "SUBSCRIPTION" ? "renews" : "due";
  const pastWord = kind === "SUBSCRIPTION" ? "exceeded renewal date by" : "exceeded due date by";
  let line: string;
  if (daysLeft < 0) {
    line = `${pastWord} ${-daysLeft}d`;
  } else if (daysLeft === 0) {
    line = `${dueWord} today`;
  } else {
    line = `${dueWord} in ${daysLeft}d`;
  }
  return { dot, pulseClass, line };
}

function SubscriptionRow({
  subscription,
  cancelled,
  onManage,
}: {
  subscription: TrackedSubscription;
  cancelled: boolean;
  onManage?: (subscription: TrackedSubscription) => void;
}) {
  const visual = statusVisual(subscription);
  const manageable = !cancelled && Boolean(onManage);
  const kind = subscription.kind ?? "SUBSCRIPTION";
  const totalCost = annualCost(subscription);
  const badge = KIND_BADGE[kind];
  const emiProgress =
    kind === "EMI" && subscription.tenureMonths != null && subscription.tenureMonths > 0
      ? {
          paid: subscription.paidMonths ?? 0,
          tenure: subscription.tenureMonths,
          pct: Math.min(100, Math.round(((subscription.paidMonths ?? 0) / subscription.tenureMonths) * 100)),
        }
      : null;
  return (
    <div
      role={manageable ? "button" : undefined}
      tabIndex={manageable ? 0 : undefined}
      onClick={manageable ? () => onManage?.(subscription) : undefined}
      onKeyDown={
        manageable
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onManage?.(subscription);
              }
            }
          : undefined
      }
      className={`flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-deep)] px-4 py-3 ${
        cancelled ? "opacity-50" : ""
      } ${manageable ? "cursor-pointer transition-colors hover:border-[var(--color-border-emphasis)] hover:bg-[var(--color-bg-hover)]" : ""}`}
    >
      <div className="flex items-center gap-2">
        {cancelled ? (
          <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-text-muted)]" />
        ) : (
          <span className="relative flex h-2 w-2 shrink-0">
            <span
              className={`absolute inline-flex h-full w-full rounded-full motion-reduce:animate-none ${visual.pulseClass}`}
              style={{ background: visual.dot, opacity: 0.75 }}
            />
            <span
              className="relative inline-flex h-full w-full rounded-full"
              style={{ background: visual.dot }}
            />
          </span>
        )}
        <span className="text-caption font-medium text-[var(--color-text)]">{subscription.merchant}</span>
        {badge && (
          <span
            className="tx-badge"
            style={{ color: badge.color, borderColor: badge.border, background: badge.background }}
          >
            {badge.label}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="flex items-center gap-1.5 justify-end text-caption font-medium text-[var(--color-text)]">
            {'\u20B9'}
            {kind === "BILL" && subscription.amountTolerancePercent != null
              ? `${subscription.amount.toLocaleString("en-IN")} \u00B1${subscription.amountTolerancePercent}%`
              : subscription.amount.toLocaleString("en-IN")}
            <span className="text-small">
              {cancelled ? "\u00D7" : FREQUENCY_SUFFIX[subscription.frequency]}
            </span>
          </div>
          <div className="text-small flex items-center justify-end gap-1">{cancelled ? (subscription.status === "PAID_OFF" ? "paid off" : "cancelled") : visual.line}</div>
          {!cancelled && totalCost > 0 && (
            <div className="text-small text-[var(--color-text-muted)]">
              {'\u2248'} {'\u20B9'}
              {totalCost.toLocaleString("en-IN")}
              {kind === "EMI" ? " remaining" : "/yr"}
            </div>
          )}
          {emiProgress &&
            <div className="mt-1 flex items-center justify-end gap-1.5">
              <div className="h-1 w-16 overflow-hidden rounded-full bg-[var(--color-border)]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${emiProgress.pct}%`, background: "var(--color-cat-4)" }}
                />
              </div>
              <span className="text-[0.6rem] text-[var(--color-text-muted)]">
                {emiProgress.paid} of {emiProgress.tenure} paid
              </span>
            </div>
          }
        </div>
        {manageable && (
          <span className="text-[var(--color-text-tertiary)]" aria-hidden="true">
            {'\u22EF'}
          </span>
        )}
      </div>
    </div>
  );
}

export function SubscriptionCard({ subscriptions, totalAnnual, onTrack, onEstimate, onManage }: Props) {
  const active = subscriptions.filter((subscription) => subscription.status === "ACTIVE");
  const inactive = subscriptions.filter((subscription) => subscription.status !== "ACTIVE");
  const groups = KIND_ORDER.map((kind) => ({
    kind,
    rows: active.filter((subscription) => (subscription.kind ?? "SUBSCRIPTION") === kind),
  })).filter((group) => group.rows.length > 0);
  const empty = active.length === 0 && inactive.length === 0;

  return (
    <div className="card">
      <div className="mb-4 flex flex-col items-center">
        <h2 className="text-card">
          <Icon name="recurring-payments" size={16} /> Recurring Payments
        </h2>
        <p className="mt-1 text-caption text-[var(--color-text)]">
          {empty
            ? "Track the payments you know about — we'll watch every charge"
            : `Tracking ${active.length} payment${active.length === 1 ? "" : "s"} for you`}
        </p>
        {(onEstimate || onTrack) && (
          <div className="mt-4 flex items-center gap-2">
            {onEstimate && (
              <button
                onClick={onEstimate}
                className="button flex-1 justify-center whitespace-nowrap"
              >
                <Icon name="tip" size={14} /> Estimate cost
              </button>
            )}
            {onTrack && (
              <button
                onClick={onTrack}
                className="button button-primary flex-1 justify-center whitespace-nowrap"
              >
                <Icon name="add" size={14} /> Track a payment
              </button>
            )}
          </div>
        )}
      </div>

      {empty ? (
        <p className="text-center text-body text-[var(--color-text)]">
          Track your payments so we can watch every charge for you. Not sure what one costs? Use{" "}
            <button
              onClick={onEstimate}
              className="button !w-auto !bg-transparent! !border-transparent! !shadow-none! !p-0! !font-normal text-[var(--color-text)] underline decoration-dotted underline-offset-2"
            >
            Estimate cost
          </button>{" "}
          to check before you commit.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <div key={group.kind} className="flex flex-col gap-2">
              <p className="text-label text-[var(--color-text-muted)]">
                {KIND_LABEL[group.kind]} <span className="text-[var(--color-text-tertiary)]">({group.rows.length})</span>
              </p>
              {group.rows.map((subscription) => (
                <SubscriptionRow
                  key={subscription.id}
                  subscription={subscription}
                  cancelled={false}
                  onManage={onManage}
                />
              ))}
            </div>
          ))}

          {inactive.length > 0 && (
            <div className="flex flex-col gap-2 pt-1">
              <p className="text-label text-[var(--color-text-muted)]">
                Inactive <span className="text-[var(--color-text-tertiary)]">({inactive.length})</span>
              </p>
              {inactive.map((subscription) => (
                <SubscriptionRow key={subscription.id} subscription={subscription} cancelled />
              ))}
            </div>
          )}
        </div>
      )}

      {totalAnnual > 0 && (
        <div className="mt-4 rounded-lg border border-[var(--color-warn)]/20 bg-[var(--color-warn)]/5 px-4 py-3">
          <div className="text-section text-[var(--color-text)]">
            {subscriptions.some((subscription) => subscription.kind === "EMI" && subscription.status === "ACTIVE")
              ? "Costs ahead"
              : "Annual cost"}
          </div>
          <div className="text-body font-semibold text-[var(--color-text)]">
            {'\u20B9'}
            {totalAnnual.toLocaleString("en-IN")}
            {subscriptions.some((subscription) => subscription.kind === "EMI" && subscription.status === "ACTIVE")
              ? " remaining"
              : "/year"}
          </div>
        </div>
      )}

      <HowItWorks items={HOW_IT_WORKS} />
    </div>
  );
}

const HOW_IT_WORKS: HowItWorksItem[] = [
  {
    title: "Estimate cost",
    description: "Thinking of subscribing? Check what it would cost you per year and over 5 years before you commit.",
  },
  {
    title: "Track a payment",
    description: "Subscriptions, bills, rent or EMIs — we match every charge and flag late or missed ones. EMIs auto-flip to paid off.",
  },
  {
    title: "Annual cost",
    description:
      "Subscriptions, bills and rent roll up as their yearly cost. EMIs count only what's left to pay — remaining installments, not a full year.",
  },
];