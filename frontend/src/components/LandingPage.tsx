import { useNavigate } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center px-6 py-12 sm:px-8">
      <div className="fixed right-4 top-4 z-50">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm text-center">
        <div className="motion-safe:animate-[fade-in_0.6s_ease-out_both]" style={{ animationDelay: "0ms" }}>
          <div className="motion-safe:animate-[float_3s_ease-in-out_infinite]">
            <div className="motion-safe:animate-[spin-slow_8s_linear_infinite] text-5xl sm:text-6xl">{"\u2600\uFE0F"}</div>
          </div>
        </div>
        <h1
          className="motion-safe:animate-[fade-in_0.6s_ease-out_both] text-2xl font-bold tracking-tight sm:text-3xl"
          style={{ animationDelay: "150ms" }}
        >
          Solara
        </h1>
        <p
          className="motion-safe:animate-[fade-in_0.6s_ease-out_both] mx-auto mt-2 max-w-sm text-sm leading-relaxed sm:text-base"
          style={{ animationDelay: "300ms", color: "var(--color-text-muted)" }}
        >
          Personal finance intelligence. Track spending, categorize transactions, and get AI-powered insights.
        </p>
      </div>

      <div
        className="motion-safe:animate-[fade-in_0.6s_ease-out_both] mt-8 flex w-full max-w-sm flex-col gap-3 sm:flex-row"
        style={{ animationDelay: "450ms" }}
      >
        <button
          onClick={() => navigate("/login")}
          className="flex-1 cursor-pointer rounded-md border-none px-4 py-3 text-sm font-semibold transition-colors sm:text-[0.85rem]"
          style={{
            background: "var(--color-text)",
            color: "var(--color-bg)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
        >
          Let's Go!
        </button>
        <button
          onClick={() => window.open("https://github.com/stealthyninja86/service_categorizer", "_blank", "noopener noreferrer")}
          className="flex-1 cursor-pointer rounded-md border px-4 py-3 text-sm font-semibold transition-colors sm:text-[0.85rem]"
          style={{
            background: "transparent",
            color: "var(--color-text-secondary)",
            borderColor: "var(--color-border)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--color-text-secondary)"; e.currentTarget.style.color = "var(--color-text)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; e.currentTarget.style.color = "var(--color-text-secondary)"; }}
        >
          View Source
        </button>
      </div>

      <p
        className="motion-safe:animate-[fade-in_0.6s_ease-out_both] mt-4 text-xs"
        style={{ animationDelay: "600ms", color: "var(--color-text-muted)" }}
      >
        <a
          href="/login"
          onClick={(e) => { e.preventDefault(); navigate("/login"); }}
          className="underline transition-colors hover:text-[var(--color-text)]"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Create an account
        </a>
      </p>
    </div>
  );
}
