const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export class ApiError extends Error {
  status: number;
  details?: Array<{ path: string; message: string }>;

  constructor(message: string, status: number, details?: Array<{ path: string; message: string }>) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function getToken(): string | null {
  return localStorage.getItem('leadflow_token');
}

export function setToken(token: string | null): void {
  if (token) {
    localStorage.setItem('leadflow_token', token);
  } else {
    localStorage.removeItem('leadflow_token');
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  raw?: boolean;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 204) {
    return undefined as T;
  }

  if (options.raw) {
    if (!res.ok) {
      throw new ApiError('Request failed', res.status);
    }
    return (await res.text()) as unknown as T;
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    const body = data as { error?: string; details?: Array<{ path: string; message: string }> };
    throw new ApiError(body.error || 'Something went wrong', res.status, body.details);
  }

  return data as T;
}
