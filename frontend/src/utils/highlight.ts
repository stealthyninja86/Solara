import { createElement, type ReactNode } from "react";

const STRONG_CLASS = "font-semibold text-[var(--color-text)]";

function bold(key: string | number, text: string): ReactNode {
  return createElement("strong", { key, className: STRONG_CLASS }, text);
}

function highlightQuotes(text: string): ReactNode {
  if (!text || !text.includes("\u201c")) return text;
  const parts = text.split(/(\u201c[^\u201d]*\u201d)/g);
  if (parts.length === 1) return text;
  return parts.map((part, index) => (part.startsWith("\u201c") ? bold(index, part) : part));
}

/**
 * Bolds every occurrence of the card's category label, then bolds any
 * quoted merchant/transaction names (typographic quotes) in the remaining
 * text. Returns a ReactNode — the card text may become mixed plain text
 * and <strong> segments.
 */
export function highlightText(text: string, label: string): ReactNode {
  if (!text) return text;
  let result: ReactNode = text;
  if (label) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = text.split(new RegExp(`(${escaped})`, "gi"));
    if (parts.length > 1) {
      result = parts.map((part, index) =>
        part.toLowerCase() === label.toLowerCase() ? bold(index, part) : part,
      );
    }
  }
  if (!Array.isArray(result)) {
    return highlightQuotes(result as string);
  }
  return result.map((part, index) =>
    typeof part === "string" ? highlightQuotes(part) : createElement("span", { key: `n${index}` }, part),
  );
}
