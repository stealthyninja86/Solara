import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { ThemeToggle } from "../components/ui/ThemeToggle";

interface Props {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  error: string | null;
  clearError: () => void;
}

type Mode = "login" | "register";

function validate(vals: Record<string, string>, mode: Mode) {
  const e: Record<string, string> = {};
  if (!vals.email?.trim()) e.email = "Email is required";
  else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(vals.email)) e.email = "Enter a valid email";
  if (!vals.password) e.password = "Password is required";
  else if (mode === "register" && vals.password.length < 8) e.password = "Min 8 characters";
  if (mode === "register") {
    if (!vals.firstName?.trim()) e.firstName = "First name is required";
    if (!vals.lastName?.trim()) e.lastName = "Last name is required";
    if (vals.password !== vals.confirmPassword) e.confirmPassword = "Passwords do not match";
  }
  return e;
}

export function LoginPage({ onLogin, onRegister, error, clearError }: Props) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();

  function handleBlur(name: string) {
    setTouched((t) => ({ ...t, [name]: true }));
    const all = { email, password, confirmPassword, firstName, lastName };
    setFieldErrors(validate(all, mode));
  }

  function handleChange(name: string, value: string) {
    if (error) clearError();
    if (name === "email") setEmail(value);
    else if (name === "password") setPassword(value);
    else if (name === "confirmPassword") setConfirmPassword(value);
    else if (name === "firstName") setFirstName(value);
    else if (name === "lastName") setLastName(value);
    if (touched[name]) {
      const all = { email, password, confirmPassword, firstName, lastName, [name]: value };
      setFieldErrors(validate(all, mode));
    }
  }

  function switchMode(m: Mode) {
    clearError();
    setMode(m);
    setFieldErrors({});
    setTouched({});
    setShowPw(false);
  }

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const all = { email, password, confirmPassword, firstName, lastName };
      const errs = validate(all, mode);
      setFieldErrors(errs);
      setTouched({ email: true, password: true, confirmPassword: true, firstName: true, lastName: true });
      if (Object.keys(errs).length) return;
      setLoading(true);
      try {
        if (mode === "login") {
          await onLogin(email.trim(), password);
        } else {
          await onRegister(email.trim(), password, firstName.trim(), lastName.trim());
        }
      } catch {
        // error displayed via parent
      } finally {
        setLoading(false);
      }
    },
    [email, password, confirmPassword, firstName, lastName, mode, onLogin, onRegister]
  );

  const fe = (name: string) => (touched[name] && fieldErrors[name] ? fieldErrors[name] : null);

  return (
    <div className="flex min-h-screen w-full items-center justify-center px-4 py-8 sm:px-6">
      <div className="fixed right-4 top-4 z-50">
        <ThemeToggle />
      </div>

      <div className="card w-full max-w-sm px-6 py-8 sm:px-8 sm:py-10">
        <button
          onClick={() => navigate("/")}
          className="text-button mb-4"
        >
          {"\u2190"} Back
        </button>

        <div className="mb-6 text-center">
          <div className="mb-2 text-4xl">{"\u2600\uFE0F"}</div>
          <h1 className="text-lg font-bold sm:text-xl">Solara</h1>
          <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
            {mode === "login" ? "Sign in to your account" : "Create a new account"}
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          {mode === "register" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="firstName" className="text-[0.7rem] font-medium" style={{ color: "var(--color-text-secondary)" }}>First Name</label>
                <input
                  id="firstName"
                  type="text"
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) => handleChange("firstName", e.target.value)}
                  onBlur={() => handleBlur("firstName")}
                  aria-invalid={!!fe("firstName")}
                  aria-describedby={fe("firstName") ? "firstName-err" : undefined}
                  placeholder="Alice"
                  className="rounded-md border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-text-secondary)]"
                  style={{ background: "var(--color-bg)", color: "var(--color-text)", borderColor: "var(--color-border)" }}
                />
                {fe("firstName") && (
                  <p id="firstName-err" role="alert" className="text-[0.65rem]" style={{ color: "var(--color-error)" }}>
                    {fe("firstName")}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="lastName" className="text-[0.7rem] font-medium" style={{ color: "var(--color-text-secondary)" }}>Last Name</label>
                <input
                  id="lastName"
                  type="text"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(e) => handleChange("lastName", e.target.value)}
                  onBlur={() => handleBlur("lastName")}
                  aria-invalid={!!fe("lastName")}
                  aria-describedby={fe("lastName") ? "lastName-err" : undefined}
                  placeholder="Smith"
                  className="rounded-md border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-text-secondary)]"
                  style={{ background: "var(--color-bg)", color: "var(--color-text)", borderColor: "var(--color-border)" }}
                />
                {fe("lastName") && (
                  <p id="lastName-err" role="alert" className="text-[0.65rem]" style={{ color: "var(--color-error)" }}>
                    {fe("lastName")}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-[0.7rem] font-medium" style={{ color: "var(--color-text-secondary)" }}>Email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => handleChange("email", e.target.value)}
              onBlur={() => handleBlur("email")}
              aria-invalid={!!fe("email")}
              aria-describedby={fe("email") ? "email-err" : undefined}
              placeholder="alice@example.com"
              className="rounded-md border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-text-secondary)]"
              style={{ background: "var(--color-bg)", color: "var(--color-text)", borderColor: "var(--color-border)" }}
            />
            {fe("email") && (
              <p id="email-err" role="alert" className="text-[0.65rem]" style={{ color: "var(--color-error)" }}>
                {fe("email")}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-[0.7rem] font-medium" style={{ color: "var(--color-text-secondary)" }}>Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPw ? "text" : "password"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => handleChange("password", e.target.value)}
                onBlur={() => handleBlur("password")}
                aria-invalid={!!fe("password")}
                aria-describedby={fe("password") ? "pw-err" : undefined}
                placeholder={mode === "login" ? "Enter password" : "At least 8 characters"}
                className="w-full rounded-md border px-3 py-2 pr-16 text-sm outline-none transition-colors focus:border-[var(--color-text-secondary)]"
                style={{ background: "var(--color-bg)", color: "var(--color-text)", borderColor: "var(--color-border)" }}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Hide password" : "Show password"}
                className="button absolute right-2 top-[42%] !h-7 !w-7 -translate-y-1/2 !rounded-full !p-0 text-[var(--color-text-secondary)]!"
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {fe("password") && (
              <p id="pw-err" role="alert" className="text-[0.65rem]" style={{ color: "var(--color-error)" }}>
                {fe("password")}
              </p>
            )}
          </div>

          {mode === "register" && (
            <div className="flex flex-col gap-1">
              <label htmlFor="confirmPassword" className="text-[0.7rem] font-medium" style={{ color: "var(--color-text-secondary)" }}>Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => handleChange("confirmPassword", e.target.value)}
                onBlur={() => handleBlur("confirmPassword")}
                aria-invalid={!!fe("confirmPassword")}
                aria-describedby={fe("confirmPassword") ? "confirm-err" : undefined}
                placeholder="Re-enter password"
                className="rounded-md border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-text-secondary)]"
                style={{ background: "var(--color-bg)", color: "var(--color-text)", borderColor: "var(--color-border)" }}
              />
              {fe("confirmPassword") && (
                <p id="confirm-err" role="alert" className="text-[0.65rem]" style={{ color: "var(--color-error)" }}>
                  {fe("confirmPassword")}
                </p>
              )}
            </div>
          )}

          {error && (
            <div role="alert" className="rounded-md px-3 py-2 text-[0.75rem]" style={{ color: "var(--color-error)", background: "var(--color-error-bg)", border: "1px solid var(--color-error-border)" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="button button-primary mt-1 flex w-full items-center justify-center gap-2"
          >
            {loading ? (
              <span className="spinner spinner--light" />
            ) : mode === "login" ? (
              "Sign In"
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        <div className="mt-4 text-center text-[0.75rem]" style={{ color: "var(--color-text-muted)" }}>
          {mode === "login" ? (
            <>
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("register")}
                className="text-button text-[0.75rem] font-semibold underline"
              >
                Create one
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="text-button text-[0.75rem] font-semibold underline"
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
