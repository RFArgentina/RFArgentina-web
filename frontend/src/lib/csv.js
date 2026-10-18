const FORMULA_PREFIX = /^[\s\u0000-\u001f\u007f]*[=+\-@]/;

export function neutralizeCsvFormula(value) {
  const text = String(value ?? "");
  return FORMULA_PREFIX.test(text) ? `'${text}` : text;
}

export function escapeCsvCell(value) {
  return `"${neutralizeCsvFormula(value).replace(/"/g, '""')}"`;
}
