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

export interface StreamEventsCallbacks {
  onEvent?: (event: string, data: string) => void;
  onDone?: () => void;
  onError?: (status?: number) => void;
}

/**
 * Server-Sent Events over fetch, not EventSource. Native EventSource cannot
 * send an Authorization header, so the gateway (which requires a JWT on every
 * route except /api/v1/auth/**) would 401 it and the caller would see a
 * spurious failure. This keeps the Bearer token + refresh-on-401 semantics of
 * `api()` while still consuming a text/event-stream body. Handles the
 * \r\n line endings Spring's SseEmitter emits.
 */
export async function streamEvents(url: string, callbacks: StreamEventsCallbacks): Promise<void> {
  let response = await fetchWithAuth(url);
  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await fetchWithAuth(url);
    }
  }
  if (!response.ok) {
    callbacks.onError?.(response.status);
    return;
  }
  if (!response.body) {
    callbacks.onError?.();
    return;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const dispatch = (block: string) => {
    let event = "message";
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) {
        event = line.slice("event:".length).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice("data:".length).trimStart());
      }
    }
    if (dataLines.length > 0) {
      callbacks.onEvent?.(event, dataLines.join("\n"));
    }
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        if (block.trim()) dispatch(block);
        boundary = buffer.indexOf("\n\n");
      }
    }
    if (buffer.trim()) dispatch(buffer);
  } catch {
    callbacks.onError?.();
    return;
  }
  callbacks.onDone?.();
}
