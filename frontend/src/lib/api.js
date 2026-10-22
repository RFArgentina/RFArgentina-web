import { getToken, setToken } from "./auth";

function resolveApiBase() {
  const envBase = String(process.env.REACT_APP_BACKEND_URL || "").trim().replace(/\/+$/, "");
  return envBase ? `${envBase}/api` : "/api";
}

const API_BASE = resolveApiBase();
let refreshPromise = null;

async function getCsrfToken(signal) {
  const response = await fetch(`${API_BASE}/auth/csrf`, { credentials: "include", signal });
  if (!response.ok) return "";
  const data = await response.json();
  return data?.csrf_token || "";
}

async function refreshAccessToken(signal) {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const csrfToken = await getCsrfToken(signal);
      if (!csrfToken) return false;
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {})
        },
        credentials: "include",
        signal
      });
      if (!response.ok) return false;
      const data = await response.json();
      if (!data?.token) return false;
      setToken(data.token);
      return true;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function apiRequest(path, options = {}) {
  const { skipAuthRefresh = false, ...requestOptions } = options;
  const token = getToken();
  const isFormData = typeof FormData !== "undefined" && requestOptions.body instanceof FormData;
  const method = String(requestOptions.method || "GET").toUpperCase();
  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(requestOptions.headers || {})
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    // Only cookie-authenticated refresh/logout require CSRF; the API reads it from its own origin.
    if (path === "/auth/logout" && !headers["X-CSRF-Token"]) {
      const csrfToken = await getCsrfToken(requestOptions.signal);
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
    }
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...requestOptions,
    headers,
    credentials: "include"
  });

  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();
  let data = null;
  if (text && contentType.includes("application/json")) {
    try {
      data = JSON.parse(text);
    } catch {
      // If the server/proxy returned invalid JSON, fall back to raw text.
      data = null;
    }
  }

  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/auth/") && !skipAuthRefresh) {
      try {
        if (await refreshAccessToken(requestOptions.signal)) {
          const retryOptions = { ...requestOptions, skipAuthRefresh: true };
          return apiRequest(path, retryOptions);
        }
      } catch (refreshError) {
        if (refreshError?.name === "AbortError") throw refreshError;
      }
    }
    let message = (data && data.error) || "Error en la solicitud";
    if (!data && text) {
      // CRA dev proxy returns plain text like: "Proxy error: Could not proxy request ..."
      if (/^proxy error/i.test(text.trim())) {
        message = "Backend no disponible o proxy mal configurado (verifica que el backend este corriendo).";
      } else {
        message = text.slice(0, 300);
      }
    }
    const err = new Error(message);
    err.status = response.status;
    if (data && data.code) err.code = data.code;
    throw err;
  }

  // Prefer JSON, but allow non-JSON successful responses (rare).
  return data ?? (text || null);
}

export async function apiDownload(path, options = {}) {
  const fetchOptions = { ...options };
  delete fetchOptions.skipAuthRefresh;
  const token = getToken();
  const headers = { ...(fetchOptions.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers,
    credentials: "include"
  });
  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    let message = "No se pudo descargar el archivo";
    if (contentType.includes("application/json")) {
      const data = await response.json().catch(() => null);
      if (data?.error) message = data.error;
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return response.blob();
}
