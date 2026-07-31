import { useCallback, useEffect, useState } from "react";

let _token: string | null = null;
let _email: string | null = null;
let _userId: string | null = null;

export function getToken() { return _token; }
export function getEmail() { return _email; }
export function getUserId() { return _userId; }

function parseJwtSub(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    const json = JSON.parse(atob(payload!.replace(/-/g, "+").replace(/_/g, "/")));
    return json.sub ?? null;
  } catch {
    return null;
  }
}

function setAuth(token: string, email: string) {
  _token = token;
  _email = email;
  _userId = parseJwtSub(token);
}

function clearAuth() {
  _token = null;
  _email = null;
  _userId = null;
}

export function useAuth() {
  const [token, setToken] = useState<string | null>(_token);
  const [email, setEmail] = useState<string | null>(_email);
  const [userId, setUserId] = useState<string | null>(_userId);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (_token) {
      setIsLoading(false);
      return;
    }
    fetch("/api/v1/auth/token", { method: "POST", credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.accessToken) {
          setAuth(data.accessToken, data.email);
          setToken(_token);
          setEmail(_email);
          setUserId(_userId);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (emailVal: string, password: string) => {
    const res = await fetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email: emailVal, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || "Invalid email or password");
    setAuth(data.accessToken, data.email);
    setToken(_token);
    setEmail(_email);
    setUserId(_userId);
  }, []);

  const register = useCallback(
    async (emailVal: string, password: string, firstName: string, lastName: string) => {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: emailVal, password, firstName, lastName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Registration failed");
      setAuth(data.accessToken, data.email);
      setToken(_token);
      setEmail(_email);
      setUserId(_userId);
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // clear state regardless of network error
    }
    clearAuth();
    setToken(null);
    setEmail(null);
    setUserId(null);
  }, []);

  return { token, email, userId, isAuthenticated: !!token, isLoading, login, register, logout };
}
