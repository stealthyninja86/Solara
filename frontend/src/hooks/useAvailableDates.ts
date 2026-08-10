import { useEffect, useState } from "react";
import { DEFAULT_USER_ID } from "../constants";
import { api } from "../utils/api";
import { getUserId } from "./useAuth";

interface Period {
  year: number;
  month: number;
}

export function useAvailableDates(refreshKey: number = 0) {
  const [periods, setPeriods] = useState<Period[]>([]);

  useEffect(() => {
    const userId = getUserId() ?? DEFAULT_USER_ID;
    api(`/api/v1/insights/available-dates?userId=${userId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Period[] | null) => {
        if (data) setPeriods(data);
      })
      .catch(() => {});
  }, [refreshKey]);

  return periods;
}
