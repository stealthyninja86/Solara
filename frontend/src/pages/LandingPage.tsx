import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { Icon } from "../components/ui/Icon";
import { ParticleNetwork } from "../components/ui/ParticleNetwork";

function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry?.isIntersecting ?? false);
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`landing-reveal ${visible ? "landing-reveal--visible" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function smoothScrollTo(targetY: number, duration = 4500) {
  const startY = window.scrollY;
  const distance = targetY - startY;
  const startTime = performance.now();
  function easeInOutCubic(t: number) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  function step(now: number) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    window.scrollTo(0, startY + distance * easeInOutCubic(progress));
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function handleAnchorClick(event: React.MouseEvent<HTMLAnchorElement>) {
  const href = (event.currentTarget as HTMLAnchorElement).getAttribute("href");
  if (!href?.startsWith("#")) return;
  event.preventDefault();
  const target = document.getElementById(href.slice(1));
  if (!target) return;
  const headerOffset = 80;
  const y = target.getBoundingClientRect().top + window.scrollY - headerOffset;
  smoothScrollTo(y, 4500);
}

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      {/* ── Background Layers ── */}
      <div className="landing-grid-bg" aria-hidden="true" />
      <ParticleNetwork />
      <div className="mesh-gradient" aria-hidden="true" />
      <div className="noise-overlay" aria-hidden="true" />
      <div className="sun-glow" aria-hidden="true" />

      {/* ── Fixed Header ── */}
      <header className="landing-header">
        <button
          onClick={() => smoothScrollTo(0, 4000)}
          className="landing-logo-btn"
        >
          <span className="text-2xl">{"\u2600\uFE0F"}</span>
          <span className="text-sm font-bold tracking-tight">Solara</span>
        </button>

        <nav className="landing-nav">
          <a href="#features" className="landing-nav-link" onClick={handleAnchorClick}>Features</a>
          <a href="#how-it-works" className="landing-nav-link" onClick={handleAnchorClick}>How It Works</a>
          <a href="#privacy" className="landing-nav-link" onClick={handleAnchorClick}>Privacy</a>
        </nav>

        <div className="landing-header-right">
          <button
            onClick={() => navigate("/login")}
            className="landing-cta-btn"
          >
            Get Started
          </button>
          <ThemeToggle />
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="landing-hero">
        <div className="landing-hero-inner">
          <div className="motion-safe:animate-[fade-in_0.6s_ease-out_both]" style={{ animationDelay: "0ms" }}>
            <div className="motion-safe:animate-[float_3s_ease-in-out_infinite] mb-8 flex justify-center">
              <div className="motion-safe:animate-[spin-slow_8s_linear_infinite] text-6xl sm:text-7xl">{"\u2600\uFE0F"}</div>
            </div>
          </div>

          <h1 className="landing-hero-title" style={{ animationDelay: "100ms" }}>
            Your money,<br />clearly understood.
          </h1>

          <p className="landing-hero-sub" style={{ animationDelay: "200ms" }}>
            Import your bank statements. Solara categorizes every
            transaction with AI and tells you exactly what's left to spend.
          </p>

          <div className="landing-hero-actions" style={{ animationDelay: "300ms" }}>
            <button
              onClick={() => navigate("/login")}
              className="landing-cta-btn landing-cta-btn--lg"
            >
              Get Started
              <span className="ml-1.5 inline-block">{"\u2192"}</span>
            </button>
            <button
              onClick={() => window.open("https://github.com/stealthyninja86/Solara", "_blank", "noopener noreferrer")}
              className="landing-ghost-btn"
            >
              View on GitHub
            </button>
          </div>

          <p className="landing-hero-trust" style={{ animationDelay: "400ms" }}>
            No credit card required. Runs locally on your machine.
          </p>
        </div>
      </section>

      {/* ── Problem ── */}
      <Reveal className="landing-section">
        <div className="landing-section-inner">
          <p className="landing-eyebrow">The problem</p>
          <h2 className="landing-section-title">
            You know you spent money.
          </h2>
          <h2 className="landing-section-title" style={{ color: "var(--color-text-muted)" }}>
            You just don't know where it went.
          </h2>

          <div className="landing-problem-grid">
            <ProblemCard
              icon="import"
              title="CSVs in Downloads"
              description="Your bank statement sits in a folder. 200 rows of 'UPI - PAYTM'. You opened it once. You closed it immediately."
              delay={0}
            />
            <ProblemCard
              icon="safe-to-spend"
              title="Balance ≠ Available"
              description="Your banking app shows a balance. But that's not what you can actually spend after rent, subscriptions, and that dinner last week."
              delay={100}
            />
            <ProblemCard
              icon="reports"
              title="No Pattern Visibility"
              description="You're spending more on food this month. You think. Maybe. There's no way to know without manually counting receipts."
              delay={200}
            />
          </div>
        </div>
      </Reveal>

      {/* ── Features ── */}
      <section id="features" className="landing-section">
        <div className="landing-section-inner">
          <Reveal>
            <p className="landing-eyebrow">What Solara does</p>
            <h2 className="landing-section-title">
              See the full picture.
            </h2>
          </Reveal>

          <div className="landing-feature-grid">
            <Reveal delay={0}>
              <FeatureCard
                icon="categorize-transaction"
                title="AI Categorization"
                description="Every transaction automatically sorted. Solara uses a local LLM that learns from your history — nothing leaves your machine."
              />
            </Reveal>
            <Reveal delay={100}>
              <FeatureCard
                icon="safe-to-spend"
                title="Safe to Spend"
                description="A single number that tells you what's left this month. Calculated from your budget, income, and actual spending — updated in real time."
              />
            </Reveal>
            <Reveal delay={150}>
              <FeatureCard
                icon="spending-trend"
                title="Interactive Reports"
                description="Weekly, monthly, and yearly breakdowns with trend charts. Compare periods, track category spending, and spot patterns over time."
              />
            </Reveal>
            <Reveal delay={200}>
              <FeatureCard
                icon="solara-insights"
                title="AI Insights"
                description="Get personalized observations about your spending habits. Solara highlights anomalies and surfaces trends you might have missed."
              />
            </Reveal>
            <Reveal delay={250}>
              <FeatureCard
                icon="import"
                title="Smart Import"
                description="Drop in your bank's CSV. Solara auto-detects the format — date, amount, description. No manual column mapping needed."
              />
            </Reveal>
            <Reveal delay={300}>
              <FeatureCard
                icon="budget"
                title="Budget Tracking"
                description="Set monthly budgets per category. See exactly where you stand with visual progress bars and real-time spent-vs-budget comparisons."
              />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="landing-section">
        <div className="landing-section-inner">
          <Reveal>
            <p className="landing-eyebrow">How it works</p>
            <h2 className="landing-section-title">
              Three steps. That's it.
            </h2>
          </Reveal>

          <div className="landing-steps">
            <Reveal delay={0}>
              <StepCard
                number="01"
                title="Import"
                description="Upload your bank statement or add transactions manually."
              />
            </Reveal>
            <Reveal delay={150}>
              <StepCard
                number="02"
                title="Categorize"
                description="AI reads your transactions, learns your patterns, and sorts everything automatically."
              />
            </Reveal>
            <Reveal delay={300}>
              <StepCard
                number="03"
                title="Understand"
                description="See where your money goes, what's left to spend, and how this month compares to last."
              />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Self-Hosted / Privacy ── */}
      <section id="privacy" className="landing-section">
        <div className="landing-section-inner landing-privacy">
          <Reveal>
            <div className="landing-privacy-card">
              <div className="mb-4 flex justify-center">
                <span className="text-4xl">{"\u2600\uFE0F"}</span>
              </div>
              <h2 className="landing-section-title" style={{ textAlign: "center" }}>
                Your data never leaves your machine.
              </h2>
              <p className="landing-section-sub" style={{ textAlign: "center" }}>
                No cloud. No subscriptions. No third-party access to your financial data.
                Everything runs locally on your machine.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="landing-section">
        <div className="landing-section-inner landing-final-cta">
          <Reveal>
            <h2 className="landing-hero-title" style={{ fontSize: "clamp(1.5rem, 4vw, 2.5rem)" }}>
              Take control of your finances.
            </h2>
            <p className="landing-hero-sub" style={{ maxWidth: "28rem" }}>
              Free, open source, and runs in 30 seconds.
            </p>
            <div className="landing-hero-actions landing-hero-actions--cta" style={{ marginTop: "2rem" }}>
              <button
                onClick={() => navigate("/login")}
                className="landing-cta-btn landing-cta-btn--lg"
              >
                Get Started
              </button>
              <button
                onClick={() => window.open("https://github.com/stealthyninja86/Solara", "_blank", "noopener noreferrer")}
                className="landing-ghost-btn"
              >
                View Source
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">{"\u2600\uFE0F"}</span>
              <span className="text-sm font-bold">Solara</span>
            </div>
            <p className="landing-footer-tagline">
              Personal finance intelligence.<br />Self-hosted and open source.
            </p>
          </div>

          <div className="landing-footer-links">
            <div className="landing-footer-col">
              <h4 className="landing-footer-heading">Product</h4>
              <a href="#features" className="landing-footer-link" onClick={handleAnchorClick}>Features</a>
              <a href="#how-it-works" className="landing-footer-link" onClick={handleAnchorClick}>How It Works</a>
              <a href="#privacy" className="landing-footer-link" onClick={handleAnchorClick}>Privacy</a>
            </div>
            <div className="landing-footer-col">
              <h4 className="landing-footer-heading">Resources</h4>
              <a
                href="https://github.com/stealthyninja86/Solara"
                target="_blank"
                rel="noopener noreferrer"
                className="landing-footer-link"
              >
                GitHub
              </a>
              <a
                href="https://github.com/stealthyninja86/Solara/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
                className="landing-footer-link"
              >
                MIT License
              </a>
            </div>
          </div>
        </div>

        <div className="landing-footer-bottom">
          <p className="landing-footer-copy">&copy; {new Date().getFullYear()} Solara. Built with care.</p>
        </div>
      </footer>
    </div>
  );
}

/* ── Sub-components ── */

function ProblemCard({ icon, title, description, delay }: { icon: string; title: string; description: string; delay: number }) {
  return (
    <Reveal delay={delay} className="landing-problem-card">
      <Icon name={icon} size={18} className="mb-3 opacity-60" />
      <h3 className="mb-1.5 text-sm font-semibold">{title}</h3>
      <p className="text-[0.8rem] leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
        {description}
      </p>
    </Reveal>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="landing-feature-card">
      <div className="landing-feature-icon">
        <Icon name={icon} size={20} />
      </div>
      <h3 className="mb-2 text-[0.9rem] font-semibold">{title}</h3>
      <p className="text-[0.8rem] leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
        {description}
      </p>
    </div>
  );
}

function StepCard({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="landing-step-card">
      <span className="landing-step-number">{number}</span>
      <h3 className="mb-1.5 text-sm font-semibold">{title}</h3>
      <p className="text-[0.8rem] leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
        {description}
      </p>
    </div>
  );
}
