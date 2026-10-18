import { getToken, setToken } from "./auth";

const BACKEND_FALLBACK_URL = "https://rfa-backend-1.onrender.com";

function resolveApiBase() {
  const envBase = process.env.REACT_APP_BACKEND_URL;
  if (envBase) return `${envBase}/api`;
  if (typeof window !== "undefined") {
    const host = String(window.location.hostname || "").toLowerCase();
    const isLocal = host === "localhost" || host === "127.0.0.1";
    if (!isLocal) return `${BACKEND_FALLBACK_URL}/api`;
  }
  return "/api";
}

const API_BASE = resolveApiBase();
const CSRF_COOKIE = process.env.REACT_APP_CSRF_COOKIE_NAME || "rfa_csrf_token";
let refreshPromise = null;

function getCookieValue(name) {
  if (typeof document === "undefined") return "";
  const source = `; ${document.cookie || ""}`;
  const parts = source.split(`; ${name}=`);
  if (parts.length < 2) return "";
  return decodeURIComponent(parts.pop().split(";").shift() || "");
}

async function refreshAccessToken(signal) {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const csrfToken = getCookieValue(CSRF_COOKIE);
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
    const csrfToken = getCookieValue(CSRF_COOKIE);
    if (csrfToken && !headers["X-CSRF-Token"]) {
      headers["X-CSRF-Token"] = csrfToken;
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
