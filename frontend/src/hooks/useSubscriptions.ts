import { useCallback, useEffect, useState } from "react";
import { DEFAULT_USER_ID } from "../constants";
import { api } from "../utils/api";
import { getUserId } from "./useAuth";
import type { TrackedSubscription, SubscriptionFrequency } from "../types/reports";

const CYCLES_PER_YEAR: Record<SubscriptionFrequency, number> = {
  DAILY: 365,
  WEEKLY: 52,
  MONTHLY: 12,
  YEARLY: 1,
};

export function annualCost(subscription: TrackedSubscription): number {
  const cycles = CYCLES_PER_YEAR[subscription.frequency];
  if (
    subscription.kind === "EMI" &&
    subscription.tenureMonths != null &&
    subscription.tenureMonths > 0
  ) {
    const remainingMonths = Math.max(0, subscription.tenureMonths - (subscription.paidMonths ?? 0));
    return Math.round(subscription.amount * cycles * (remainingMonths / 12));
  }
  return subscription.amount * cycles;
}

export function useSubscriptions(refreshKey = 0) {
  const [subscriptions, setSubscriptions] = useState<TrackedSubscription[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSubscriptions = useCallback(async () => {
    const params = new URLSearchParams({ userId: getUserId() ?? DEFAULT_USER_ID });
    try {
      const res = await api(`/api/v1/insights/tracked-subscriptions?${params}`);
      if (res.ok) {
        setSubscriptions((await res.json()) as TrackedSubscription[]);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions, refreshKey]);

  const totalSubscriptions = subscriptions.reduce(
    (sum, subscription) =>
      subscription.status === "ACTIVE" ? sum + annualCost(subscription) : sum,
    0,
  );

  return { subscriptions, totalSubscriptions, loading, refresh: fetchSubscriptions };
}
