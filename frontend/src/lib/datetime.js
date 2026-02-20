function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const raw = String(value).trim();
  if (!raw) return null;

  // SQLite CURRENT_TIMESTAMP -> "YYYY-MM-DD HH:MM:SS" (UTC, sin zona).
  // Lo normalizamos a ISO UTC para evitar desfases en cliente.
  const sqliteUtcMatch = raw.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  const normalized = sqliteUtcMatch ? `${raw.replace(" ", "T")}Z` : raw;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const AR_TIMEZONE = "America/Argentina/Buenos_Aires";

export function formatDateAr(value) {
  const date = toDate(value);
  if (!date) return "-";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: AR_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function formatDateTimeAr(value) {
  const date = toDate(value);
  if (!date) return "-";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: AR_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
}

