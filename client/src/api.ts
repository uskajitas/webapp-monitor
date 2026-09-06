// Tiny fetch wrapper. Always relative — Vite proxy handles routing to backend in dev,
// Cloudflare tunnel handles it in prod.
//
// We stash the signed-in email at module scope so every request can attach
// the `x-user-email` header. UserContext calls setCurrentEmail() after sign-in
// and clears it on sign-out.

let currentEmail: string | null = null;

export function setCurrentEmail(email: string | null) {
  currentEmail = email ? email.toLowerCase() : null;
}

/** Carries the HTTP status so callers can tell "rejected" (403) from "unreachable" (network/server down, status 0). */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> || {}),
  };
  if (currentEmail) headers['x-user-email'] = currentEmail;

  let res: Response;
  try {
    res = await fetch(path, { ...init, headers });
  } catch (e: any) {
    throw new ApiError(0, e?.message || 'network error');
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ApiError(res.status, `${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

export const api = {
  get:  <T>(path: string)            => request<T>(path),
  post: <T>(path: string, body: any) => request<T>(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:  <T>(path: string, body: any) => request<T>(path, { method: 'PUT',    body: JSON.stringify(body) }),
  del:  <T>(path: string)            => request<T>(path, { method: 'DELETE' }),
};
