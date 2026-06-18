const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export type ApiOptions = RequestInit & {
  token?: string | null;
};

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { token, headers, ...rest } = options;
  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data as T;
}
