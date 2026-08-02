import { useCallback, useEffect, useState } from "react";
import { api } from "../utils/api";

let _token: string | null = null;
let _email: string | null = null;
let _userId: string | null = null;
let _firstName: string | null = null;
let _lastName: string | null = null;

export function getToken() { return _token; }
export function getEmail() { return _email; }
export function getUserId() { return _userId; }
export function getFirstName() { return _firstName; }
export function getLastName() { return _lastName; }

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

function setProfile(firstName: string | null, lastName: string | null) {
  _firstName = firstName;
  _lastName = lastName;
}

function clearAuth() {
  _token = null;
  _email = null;
  _userId = null;
  _firstName = null;
  _lastName = null;
}

export function useAuth() {
  const [token, setToken] = useState<string | null>(_token);
  const [email, setEmail] = useState<string | null>(_email);
  const [userId, setUserId] = useState<string | null>(_userId);
  const [firstName, setFirstName] = useState<string | null>(_firstName);
  const [lastName, setLastName] = useState<string | null>(_lastName);
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
          return api("/api/v1/auth/profile").then((r) => (r.ok ? r.json() : null));
        }
        return null;
      })
      .then((profile) => {
        if (profile?.firstName !== undefined) {
          setProfile(profile.firstName, profile.lastName);
          setFirstName(_firstName);
          setLastName(_lastName);
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
    const profileRes = await api("/api/v1/auth/profile");
    if (profileRes.ok) {
      const profile = await profileRes.json();
      setProfile(profile.firstName, profile.lastName);
      setFirstName(_firstName);
      setLastName(_lastName);
    }
  }, []);

  const register = useCallback(
    async (emailVal: string, password: string, firstNameVal: string, lastNameVal: string) => {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: emailVal, password, firstName: firstNameVal, lastName: lastNameVal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Registration failed");
      setAuth(data.accessToken, data.email);
      setToken(_token);
      setEmail(_email);
      setUserId(_userId);
      setProfile(firstNameVal, lastNameVal);
      setFirstName(_firstName);
      setLastName(_lastName);
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
    setFirstName(null);
    setLastName(null);
  }, []);

  const updateProfile = useCallback(async (firstNameVal: string | null, lastNameVal: string | null) => {
    const res = await api("/api/v1/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: firstNameVal, lastName: lastNameVal }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to update profile");
    }
    const profile = await res.json();
    setProfile(profile.firstName, profile.lastName);
    setFirstName(_firstName);
    setLastName(_lastName);
    return profile;
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string, confirmPassword: string) => {
    const res = await api("/api/v1/auth/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to change password");
    }
  }, []);

  return {
    token,
    email,
    userId,
    firstName,
    lastName,
    isAuthenticated: !!token,
    isLoading,
    login,
    register,
    logout,
    updateProfile,
    changePassword,
  };
}
