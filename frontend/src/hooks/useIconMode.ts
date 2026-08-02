import { useCallback, useState } from "react";

const ICON_MODE_KEY = "solara-icon-mode";

export type IconMode = "emoji" | "icons";

function readMode(): IconMode {
  try {
    const stored = localStorage.getItem(ICON_MODE_KEY);
    if (stored === "emoji" || stored === "icons") return stored;
  } catch {}
  return "icons";
}

export function useIconMode() {
  const [mode, setModeState] = useState<IconMode>(readMode);

  const setMode = useCallback((next: IconMode) => {
    setModeState(next);
    try {
      localStorage.setItem(ICON_MODE_KEY, next);
    } catch {}
  }, []);

  const toggle = useCallback(() => {
    setMode(mode === "emoji" ? "icons" : "emoji");
  }, [mode, setMode]);

  return { mode, setMode, toggle, isEmoji: mode === "emoji" };
}
