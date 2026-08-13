import { getToken, setAuth } from "../hooks/useAuth";

let refreshPromise: Promise<boolean> | null = null;

function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch("/api/v1/auth/token", {
      method: "POST",
      credentials: "include",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.accessToken) {
          setAuth(data.accessToken, data.email);
          return true;
        }
        return false;
      })
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

function redirectToLogin() {
  if (window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}

function fetchWithAuth(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
}

export async function api(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const response = await fetchWithAuth(input, init);
  if (response.status !== 401) {
    return response;
  }
  const refreshed = await refreshAccessToken();
  if (refreshed) {
    const retry = await fetchWithAuth(input, init);
    if (retry.status !== 401) {
      return retry;
    }
  }
  redirectToLogin();
  return response;
}
