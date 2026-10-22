export const COMMUNICATION_MODE_CODES = new Set(["rfa_managed", "client_sends"]);

export function isValidCommunicationMode(value) {
  return value == null || COMMUNICATION_MODE_CODES.has(value);
}

export function serializeAcceptedProposalSnapshot(caseRecord) {
  return JSON.stringify({
    version: 1,
    service_code: String(caseRecord.service_code || "").trim(),
    amount: Number(caseRecord.quoted_amount),
    currency: String(caseRecord.quoted_currency || "ARS").trim().toUpperCase(),
    scope: String(caseRecord.quoted_scope || "").trim(),
    communication_mode: caseRecord.communication_mode || null,
    ...(caseRecord.offer_id ? { offer_id: String(caseRecord.offer_id) } : {}),
    ...(caseRecord.accepted_at ? { accepted_at: String(caseRecord.accepted_at) } : {})
  });
}

export function parseAcceptedProposalSnapshot(serialized) {
  if (typeof serialized !== "string" || !serialized.trim()) return null;
  try {
    const value = JSON.parse(serialized);
    if (
      value?.version !== 1 ||
      typeof value.service_code !== "string" || !value.service_code.trim() ||
      !Number.isSafeInteger(value.amount) || value.amount < 1 ||
      !["ARS", "USD"].includes(value.currency) ||
      typeof value.scope !== "string" || !value.scope.trim() ||
      !isValidCommunicationMode(value.communication_mode)
    ) return null;
    return {
      service_code: value.service_code,
      amount: value.amount,
      currency: value.currency,
      scope: value.scope,
      communication_mode: value.communication_mode,
      ...(typeof value.offer_id === "string" && value.offer_id ? { offer_id: value.offer_id } : {}),
      ...(typeof value.accepted_at === "string" && value.accepted_at ? { accepted_at: value.accepted_at } : {})
    };
  } catch {
    return null;
  }
}
