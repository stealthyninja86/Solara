import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";

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
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: "420px",
          margin: "0 auto",
          padding: "2.5rem 2rem",
        }}
      >
        <button
          onClick={() => navigate("/")}
          style={{
            background: "none",
            border: "none",
            color: "#888",
            cursor: "pointer",
            fontSize: "0.8rem",
            padding: 0,
            marginBottom: "0.75rem",
            display: "flex",
            alignItems: "center",
            gap: "0.3rem",
            fontFamily: "inherit",
          }}
        >
          ← Back
        </button>
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "2.5rem", lineHeight: 1, marginBottom: "0.5rem" }}>☀️</div>
          <h1 style={{ fontSize: "1.25rem", marginBottom: "0.25rem" }}>Solara</h1>
          <p style={{ fontSize: "0.75rem", color: "#666" }}>
            {mode === "login" ? "Sign in to your account" : "Create a new account"}
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {mode === "register" && (
            <div className="row" style={{ marginBottom: "0.75rem" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="firstName">First Name</label>
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
                />
                {fe("firstName") && (
                  <p id="firstName-err" role="alert" style={{ fontSize: "0.65rem", color: "#ff4444", marginTop: "0.25rem" }}>
                    {fe("firstName")}
                  </p>
                )}
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="lastName">Last Name</label>
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
                />
                {fe("lastName") && (
                  <p id="lastName-err" role="alert" style={{ fontSize: "0.65rem", color: "#ff4444", marginTop: "0.25rem" }}>
                    {fe("lastName")}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
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
            />
            {fe("email") && (
              <p id="email-err" role="alert" style={{ fontSize: "0.65rem", color: "#ff4444", marginTop: "0.25rem" }}>
                {fe("email")}
              </p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div style={{ position: "relative" }}>
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
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Hide password" : "Show password"}
                style={{
                  position: "absolute",
                  right: "8px",
                  top: "50%",
                  translate: "0 -50%",
                  width: "auto",
                  margin: 0,
                  padding: "0.25rem 0.4rem",
                  fontSize: "0.6rem",
                  background: "transparent",
                  color: "#888",
                  border: "1px solid #1e1e1e",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
            {fe("password") && (
              <p id="pw-err" role="alert" style={{ fontSize: "0.65rem", color: "#ff4444", marginTop: "0.25rem" }}>
                {fe("password")}
              </p>
            )}
          </div>

          {mode === "register" && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
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
              />
              {fe("confirmPassword") && (
                <p id="confirm-err" role="alert" style={{ fontSize: "0.65rem", color: "#ff4444", marginTop: "0.25rem" }}>
                  {fe("confirmPassword")}
                </p>
              )}
            </div>
          )}

          {error && (
            <div role="alert" style={{ fontSize: "0.75rem", color: "#ff4444", padding: "0.5rem 0.75rem", background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.2)", borderRadius: "6px", marginBottom: "0.75rem" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
            }}
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

        <div style={{ textAlign: "center", marginTop: "1.25rem", fontSize: "0.75rem", color: "#666" }}>
          {mode === "login" ? (
            <>
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("register")}
                style={{ all: "unset", color: "#fff", cursor: "pointer", textDecoration: "underline", width: "auto", margin: 0, fontSize: "0.75rem" }}
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
                style={{ all: "unset", color: "#fff", cursor: "pointer", textDecoration: "underline", width: "auto", margin: 0, fontSize: "0.75rem" }}
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
