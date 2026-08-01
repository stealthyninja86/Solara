import { useEffect, useRef } from "react";

export function usePullToRefresh(
  onTrigger: () => void,
  setRefreshing: (v: boolean) => void
) {
  const pullRef = useRef<HTMLDivElement>(null);
  const setRefreshingRef = useRef(setRefreshing);
  setRefreshingRef.current = setRefreshing;

  useEffect(() => {
    const el = pullRef.current;
    if (!el) return;

    let startY = 0;
    let dist = 0;
    let pulling = false;
    let styled = false;
    let indicatorEl: HTMLDivElement | null = null;
    let wheelAccum = 0;
    let wheelTimer: ReturnType<typeof setTimeout> | undefined;
    let activeThreshold = 60;
    const POINTER_THRESHOLD = 60;
    const WHEEL_THRESHOLD = 300;
    const WHEEL_SETTLE_MS = 400;
    const PEEK_THRESHOLD = 20;

    function spring(y: number): number {
      const MAX = 120;
      const k = 0.5;
      return MAX * (1 - Math.exp((-k * y) / MAX));
    }

    function getThemeVars() {
      const s = getComputedStyle(document.documentElement);
      return {
        surface: s.getPropertyValue("--color-surface").trim(),
        border: s.getPropertyValue("--color-border").trim(),
        textMuted: s.getPropertyValue("--color-text-muted").trim(),
        text: s.getPropertyValue("--color-text").trim(),
      };
    }

    function addIndicator(distance: number) {
      if (!indicatorEl) {
        const t = getThemeVars();
        indicatorEl = document.createElement("div");
        indicatorEl.className =
          "fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none";
        indicatorEl.innerHTML = `<div style="background:${t.surface};border:1px solid ${t.border};border-radius:999px;padding:0.4rem 0.75rem;display:flex;align-items:center;gap:0.5rem"><div style="width:12px;height:12px;border:2px solid ${t.textMuted}33;border-top-color:transparent;border-radius:50%"></div><span style="font-size:0.65rem;color:${t.textMuted}">\u21C5 Pull to refresh</span></div>`;
        document.body.appendChild(indicatorEl);
      }
      const snapped = Math.min(distance, activeThreshold);
      const inner = indicatorEl.firstChild as HTMLElement;
      const spinner = inner.firstChild as HTMLElement;
      const label = inner.lastChild as HTMLElement;
      if (distance >= activeThreshold) {
        const t = getThemeVars();
        label.textContent = "\u21C5 Release to refresh";
        spinner.style.animation = "spin 0.6s linear infinite";
        spinner.style.borderTopColor = t.text;
      } else {
        label.textContent = "\u21C5 Pull to refresh";
        spinner.style.animation = "none";
        spinner.style.borderTopColor = "transparent";
      }
      indicatorEl.style.transform = `translateY(${snapped}px)`;
    }

    function removeIndicator() {
      if (indicatorEl) {
        indicatorEl.remove();
        indicatorEl = null;
      }
    }

    function clearElStyles() {
      styled = false;
      el!.style.transition = "";
      el!.style.transform = "";
    }

    function snapBack() {
      if (styled) {
        el!.style.transition = "transform 0.3s ease-out";
        el!.style.transform = "translateY(0)";
        el!.addEventListener(
          "transitionend",
          function cleanup() {
            clearElStyles();
            el!.removeEventListener("transitionend", cleanup);
          },
          { once: true }
        );
      }
      removeIndicator();
    }

    function triggerRefresh() {
      snapBack();
      setRefreshingRef.current(true);
      onTrigger();
    }

    function getScrollTop(): number {
      let node: HTMLElement | null = el;
      while (node) {
        const overflowY = getComputedStyle(node).overflowY;
        if (
          (overflowY === "auto" || overflowY === "scroll") &&
          node.scrollHeight > node.clientHeight
        ) {
          return node.scrollTop;
        }
        node = node.parentElement;
      }
      return document.documentElement.scrollTop;
    }

    function updateTouchAction() {
      const atTop = getScrollTop() <= 0;
      el!.style.touchAction = atTop ? "pan-x pan-down" : "pan-x pan-y";
    }

    updateTouchAction();
    document.addEventListener("scroll", updateTouchAction, { capture: true, passive: true });

    function onPointerDown(e: PointerEvent) {
      if (!e.isPrimary || e.button !== 0) return;
      if (getScrollTop() > 0) return;
      const target = e.target as HTMLElement;
      if (target?.closest("input, select, textarea, button")) return;
      clearTimeout(wheelTimer);
      wheelAccum = 0;
      startY = e.clientY;
      dist = 0;
      pulling = true;
      styled = false;
      activeThreshold = POINTER_THRESHOLD;
      el!.setPointerCapture(e.pointerId);
    }

    function onPointerMove(e: PointerEvent) {
      if (!pulling) return;
      const dy = e.clientY - startY;
      if (dy < 0) {
        dist = 0;
        removeIndicator();
        clearElStyles();
        return;
      }
      dist = dy;
      if (!styled) styled = true;
      const resisted = spring(dy);
      el!.style.transform = `translateY(${resisted}px)`;
      el!.style.transition = "none";
      addIndicator(resisted);
    }

    function onPointerEnd() {
      if (!pulling) return;
      pulling = false;
      const wasPast = dist >= activeThreshold;
      if (wasPast) triggerRefresh();
      else snapBack();
    }

    function onWheel(e: WheelEvent) {
      if (getScrollTop() > 0) return;
      if (e.deltaY > 0) {
        if (wheelAccum > 0 || styled) {
          wheelAccum = 0;
          dist = 0;
          clearTimeout(wheelTimer);
          snapBack();
        }
        return;
      }
      if (e.deltaY === 0) return;
      e.preventDefault();
      activeThreshold = WHEEL_THRESHOLD;
      wheelAccum += Math.abs(e.deltaY);
      if (wheelAccum > PEEK_THRESHOLD) {
        dist = wheelAccum;
        styled = true;
        const resisted = spring(wheelAccum);
        el!.style.transform = `translateY(${resisted}px)`;
        el!.style.transition = "none";
        addIndicator(wheelAccum);
      }
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => {
        const wasPast = wheelAccum >= activeThreshold;
        wheelAccum = 0;
        dist = 0;
        if (wasPast) triggerRefresh();
        else snapBack();
      }, WHEEL_SETTLE_MS);
    }

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerEnd);
    el.addEventListener("pointercancel", onPointerEnd);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("dragstart", (e: Event) => e.preventDefault());

    return () => {
      clearTimeout(wheelTimer);
      document.removeEventListener("scroll", updateTouchAction, { capture: true });
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerEnd);
      el.removeEventListener("pointercancel", onPointerEnd);
      el.removeEventListener("wheel", onWheel);
      removeIndicator();
    };
  }, [onTrigger]);

  return { pullRef };
}
