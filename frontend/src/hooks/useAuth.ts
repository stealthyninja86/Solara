import { useCallback, useEffect, useState } from "react";
import { api } from "../utils/api";

export type IconMode = "emoji" | "icons";

type Profile = {
  firstName: string | null;
  lastName: string | null;
  iconMode: string | null;
  llmEnabled: boolean | null;
};

let _token: string | null = null;
let _email: string | null = null;
let _userId: string | null = null;
let _profile: Profile = { firstName: null, lastName: null, iconMode: null, llmEnabled: null };

export function getToken() { return _token; }
export function getEmail() { return _email; }
export function getUserId() { return _userId; }
export function getFirstName() { return _profile.firstName; }
export function getLastName() { return _profile.lastName; }
export function getIconMode(): IconMode | null { return _profile.iconMode === "emoji" || _profile.iconMode === "icons" ? _profile.iconMode : null; }

function parseJwtSub(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    const json = JSON.parse(atob(payload!.replace(/-/g, "+").replace(/_/g, "/")));
    return json.sub ?? null;
  } catch {
    return null;
  }
}

export function setAuth(token: string, email: string) {
  _token = token;
  _email = email;
  _userId = parseJwtSub(token);
}

function applyProfile(profile: Profile) {
  _profile = profile;
}

function clearAuth() {
  _token = null;
  _email = null;
  _userId = null;
  _profile = { firstName: null, lastName: null, iconMode: null, llmEnabled: null };
}

export function useAuth() {
  const [token, setToken] = useState<string | null>(_token);
  const [email, setEmail] = useState<string | null>(_email);
  const [userId, setUserId] = useState<string | null>(_userId);
  const [firstName, setFirstName] = useState<string | null>(_profile.firstName);
  const [lastName, setLastName] = useState<string | null>(_profile.lastName);
  const [iconMode, setIconModeState] = useState<IconMode | null>(getIconMode());
  const [llmEnabled, setLlmEnabled] = useState<boolean | null>(_profile.llmEnabled);
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
          applyProfile(profile);
          setFirstName(_profile.firstName);
          setLastName(_profile.lastName);
          setIconModeState(getIconMode());
          setLlmEnabled(_profile.llmEnabled);
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
      applyProfile(profile);
      setFirstName(_profile.firstName);
      setLastName(_profile.lastName);
      setIconModeState(getIconMode());
      setLlmEnabled(_profile.llmEnabled);
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
      applyProfile({ firstName: firstNameVal, lastName: lastNameVal, iconMode: null, llmEnabled: null });
      setFirstName(_profile.firstName);
      setLastName(_profile.lastName);
      setIconModeState(getIconMode());
      setLlmEnabled(_profile.llmEnabled);
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
    setIconModeState(null);
    setLlmEnabled(null);
  }, []);

  const updateProfile = useCallback(async (firstNameVal: string | null, lastNameVal: string | null) => {
    const res = await api("/api/v1/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: firstNameVal, lastName: lastNameVal }),
    });
    if (!res.ok) {
      let message = "Failed to update profile";
      try {
        const data = await res.json();
        message = data.error || message;
      } catch {
        // Response body is empty or not JSON
      }
      throw new Error(message);
    }
    const profile = await res.json();
    applyProfile(profile);
    setFirstName(_profile.firstName);
    setLastName(_profile.lastName);
    setIconModeState(getIconMode());
    setLlmEnabled(_profile.llmEnabled);
    return profile;
  }, []);

  const updateSettings = useCallback(async (next: { iconMode?: IconMode; llmEnabled?: boolean }) => {
    const res = await api("/api/v1/auth/profile/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    if (!res.ok) {
      let message = "Failed to update settings";
      try {
        const data = await res.json();
        message = data.error || message;
      } catch {
        // Response body is empty or not JSON — keep default message
      }
      throw new Error(message);
    }
    const profile = await res.json();
    applyProfile(profile);
    setIconModeState(getIconMode());
    setLlmEnabled(_profile.llmEnabled);
    return profile;
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string, confirmPassword: string) => {
    const res = await api("/api/v1/auth/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    });
    if (!res.ok) {
      let message = "Failed to change password";
      try {
        const data = await res.json();
        message = data.error || message;
      } catch {
        // Response body is empty or not JSON
      }
      throw new Error(message);
    }
  }, []);

  return {
    token,
    email,
    userId,
    firstName,
    lastName,
    iconMode,
    llmEnabled,
    isAuthenticated: !!token,
    isLoading,
    login,
    register,
    logout,
    updateProfile,
    updateSettings,
    changePassword,
  };
}