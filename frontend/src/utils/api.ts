import { getToken } from "../hooks/useAuth";

export function api(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
}
