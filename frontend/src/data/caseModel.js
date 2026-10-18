export const operationalStatusOptions = [
  { code: "received", label: "Recibido" },
  { code: "in_analysis", label: "En análisis" },
  { code: "needs_information", label: "Falta información" },
  { code: "in_progress", label: "En gestión" },
  { code: "completed", label: "Finalizado" },
  { code: "referred", label: "Derivado" },
  { code: "not_applicable", label: "No corresponde" }
];

export const commercialStatusOptions = [
  { code: "analysis", label: "Análisis sin costo" },
  { code: "proposal_sent", label: "Propuesta enviada" },
  { code: "accepted", label: "Aceptada" },
  { code: "payment_pending", label: "Pendiente de pago" },
  { code: "paid", label: "Pagado" }
];

const normalize = (value = "") =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const legacyOperationalLabels = {
  recibido: "Recibido",
  "en analisis": "En análisis",
  "documentacion solicitada": "Falta información",
  "viable (pendiente de pago)": "En análisis",
  "no viable": "No corresponde",
  "presentado ante entidad": "En gestión",
  "en espera de respuesta": "En gestión",
  "respuesta recibida": "En gestión",
  cerrado: "Finalizado"
};

export function getOperationalStatusLabel(value) {
  const current = operationalStatusOptions.find((option) => option.code === value);
  if (current) return current.label;
  return legacyOperationalLabels[normalize(value)] || String(value || "Sin estado");
}

export function getCommercialStatusLabel(value) {
  return commercialStatusOptions.find((option) => option.code === value)?.label || "Análisis sin costo";
}

export function getCaseServiceValue(caseItem) {
  return String(caseItem?.service_code || caseItem?.plan_elegido || "").trim();
}

export function getEffectiveCommercialStatus(caseItem) {
  const explicit = String(caseItem?.commercial_status || "").trim();
  if (commercialStatusOptions.some((option) => option.code === explicit)) return explicit;
  const legacyState = normalize(caseItem?.estado);
  const legacyService = normalize(caseItem?.plan_elegido);
  if (legacyState === "viable (pendiente de pago)" && legacyService && legacyService !== "analysis") {
    return "payment_pending";
  }
  return "analysis";
}

export function formatQuotedAmount(amount, currency = "ARS") {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return "-";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: currency || "ARS",
    maximumFractionDigits: 0
  }).format(value);
}
