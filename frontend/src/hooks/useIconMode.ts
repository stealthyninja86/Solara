import { useCallback } from "react";
import { useAuth, type IconMode } from "./useAuth";

export function useIconMode() {
  const { iconMode, updateSettings } = useAuth();
  const isEmoji = iconMode === "emoji";
  const mode: IconMode = iconMode ?? "icons";

  const setMode = useCallback(
    (next: IconMode) => {
      void updateSettings({ iconMode: next }).catch(() => {});
    },
    [updateSettings]
  );

  const toggle = useCallback(() => {
    setMode(isEmoji ? "icons" : "emoji");
  }, [isEmoji, setMode]);

  return { mode, setMode, toggle, isEmoji };
}