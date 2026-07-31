import { useNavigate } from "react-router-dom";

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <div className="motion-safe:animate-[fade-in_0.6s_ease-out_both]" style={{ animationDelay: "0ms" }}>
          <div className="motion-safe:animate-[float_3s_ease-in-out_infinite]">
            <div className="motion-safe:animate-[spin-slow_8s_linear_infinite]" style={{ fontSize: "4rem", lineHeight: 1 }}>☀️</div>
          </div>
        </div>
        <h1 className="motion-safe:animate-[fade-in_0.6s_ease-out_both]" style={{ animationDelay: "150ms", fontSize: "2rem", marginBottom: "0.5rem", letterSpacing: "-0.02em" }}>
          Solara
        </h1>
        <p className="motion-safe:animate-[fade-in_0.6s_ease-out_both]" style={{ animationDelay: "300ms", fontSize: "0.85rem", color: "#666", maxWidth: "360px", lineHeight: 1.6 }}>
          Personal finance intelligence. Track spending, categorize transactions, and get AI-powered insights.
        </p>
      </div>

      <div className="motion-safe:animate-[fade-in_0.6s_ease-out_both]" style={{ animationDelay: "450ms", display: "flex", gap: "0.75rem", maxWidth: "480px" }}>
        <button
          onClick={() => navigate("/login")}
          style={{
            flex: 1,
            padding: "0.85rem",
            fontSize: "0.85rem",
            fontWeight: 600,
            fontFamily: "inherit",
            background: "#fff",
            color: "#000",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#ddd"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; }}
        >
          Let's Go!
        </button>
        <button
          onClick={() => window.open("https://github.com/stealthyninja86/service_categorizer", "_blank", "noopener noreferrer")}
          style={{
            flex: 1,
            padding: "0.85rem",
            fontSize: "0.85rem",
            fontWeight: 600,
            fontFamily: "inherit",
            background: "transparent",
            color: "#ccc",
            border: "1px solid #444",
            borderRadius: "6px",
            cursor: "pointer",
            transition: "border-color 0.15s, color 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#888"; e.currentTarget.style.color = "#fff"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#444"; e.currentTarget.style.color = "#ccc"; }}
        >
          View Source
        </button>
      </div>

      <p className="motion-safe:animate-[fade-in_0.6s_ease-out_both]" style={{ animationDelay: "600ms", marginTop: "1rem", fontSize: "0.7rem", color: "#555" }}>
        <a
          href="/login"
          onClick={(e) => { e.preventDefault(); navigate("/login"); }}
          style={{ color: "#888", textDecoration: "underline" }}
        >
          Create an account
        </a>
      </p>
    </div>
  );
}
