import { getToken } from "./auth";

const API_BASE = process.env.REACT_APP_BACKEND_URL
  ? `${process.env.REACT_APP_BACKEND_URL}/api`
  : "/api";
const CSRF_COOKIE = process.env.REACT_APP_CSRF_COOKIE_NAME || "rfa_csrf_token";

function getCookieValue(name) {
  if (typeof document === "undefined") return "";
  const source = `; ${document.cookie || ""}`;
  const parts = source.split(`; ${name}=`);
  if (parts.length < 2) return "";
  return decodeURIComponent(parts.pop().split(";").shift() || "");
}

export async function apiRequest(path, options = {}) {
  const token = getToken();
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const method = String(options.method || "GET").toUpperCase();
  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {})
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    const csrfToken = getCookieValue(CSRF_COOKIE);
    if (csrfToken && !headers["X-CSRF-Token"]) {
      headers["X-CSRF-Token"] = csrfToken;
    }
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
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
    if (data && data.code) err.code = data.code;
    throw err;
  }

  // Prefer JSON, but allow non-JSON successful responses (rare).
  return data ?? (text || null);
}
