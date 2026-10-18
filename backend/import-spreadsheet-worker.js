import { parentPort, workerData } from "worker_threads";
import { readSheet } from "read-excel-file/node";

const stringifyCell = (value) => {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (["string", "number", "boolean"].includes(typeof value)) return String(value);
  return "";
};

try {
  const rows = await readSheet(workerData.filePath);
  if (!Array.isArray(rows) || rows.length < 2) {
    parentPort.postMessage({ rows: [] });
  } else if (rows.length - 1 > workerData.maxRows) {
    parentPort.postMessage({ error: "IMPORT_ROW_LIMIT" });
  } else {
    const headers = (rows[0] || []).map(stringifyCell);
    if (headers.length > workerData.maxColumns) {
      parentPort.postMessage({ error: "IMPORT_COLUMN_LIMIT" });
    } else {
      const result = [];
      for (const row of rows.slice(1)) {
        if (!Array.isArray(row) || row.every((value) => value == null || value === "")) continue;
        const record = Object.create(null);
        headers.forEach((header, index) => {
          if (header.trim()) record[header] = stringifyCell(row[index]).trim();
        });
        result.push(record);
      }
      parentPort.postMessage({ rows: result });
    }
  }
} catch {
  parentPort.postMessage({ error: "IMPORT_FILE_INVALID" });
}
