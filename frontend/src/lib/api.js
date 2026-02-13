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

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = (data && data.error) || "Error en la solicitud";
    const err = new Error(message);
    if (data && data.code) err.code = data.code;
    throw err;
  }
  return data;
}
