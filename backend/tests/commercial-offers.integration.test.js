import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function unusedPort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function request(baseUrl, route, { token, body, method = "GET" } = {}) {
  const isForm = body instanceof FormData;
  const response = await fetch(`${baseUrl}/api${route}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body && !isForm ? { "Content-Type": "application/json" } : {})
    },
    body: body && !isForm ? JSON.stringify(body) : body
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { response, data };
}

async function waitForHealth(baseUrl, child, readOutput) {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Backend exited before health check:\n${readOutput()}`);
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch { /* startup is still in progress */ }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Backend health check timed out:\n${readOutput()}`);
}

function extractActionToken(url) {
  return new URLSearchParams(new URL(url).hash.slice(1)).get("rfa_token");
}

test("individual service offers, immutable acceptance, private receipt history and payment confirmation", { timeout: 240000 }, async (t) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "rfa-commercial-offers-"));
  const clockFile = path.join(tempDir, "clock-offset");
  const clockPreload = path.join(tempDir, "fake-clock.mjs");
  await writeFile(clockFile, "0");
  await writeFile(clockPreload, `import fs from "node:fs";
const RealDate = Date;
const offset = () => Number(fs.readFileSync(process.env.RFA_TEST_CLOCK_FILE, "utf8")) || 0;
globalThis.Date = class TestDate extends RealDate {
  constructor(...args) { super(...(args.length ? args : [RealDate.now() + offset()])); }
  static now() { return RealDate.now() + offset(); }
};\n`);
  const port = await unusedPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let output = "";
  const child = spawn(process.execPath, ["--import", pathToFileURL(clockPreload).href, "server.js"], {
    cwd: backendDir,
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      RFA_TEST_CLOCK_FILE: clockFile,
      SQLITE_PATH: path.join(tempDir, "test.db"),
      UPLOADS_PATH: path.join(tempDir, "uploads"),
      BACKUP_DIR: path.join(tempDir, "backups"),
      JWT_SECRET: "commercial-offers-test-secret-0123456789",
      ADMIN_EMAILS: "admin-offers@test.local",
      ADMIN_BOOTSTRAP_PASSWORD: "TestAdminPassword123",
      DATA_PURGE_ENABLED: "false",
      MIGRATE_TO_PERSISTENT_DISK: "false",
      CORS_ORIGINS: "http://localhost:3000"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", (chunk) => { output = (output + chunk.toString()).slice(-12000); });
  child.stderr.on("data", (chunk) => { output = (output + chunk.toString()).slice(-12000); });

  t.after(async () => {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(resolve, 8000))]);
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  await waitForHealth(baseUrl, child, () => output);
  const login = await request(baseUrl, "/auth/login", {
    method: "POST",
    body: { email: "admin-offers@test.local", password: "TestAdminPassword123" }
  });
  assert.ok([200, 201].includes(login.response.status), JSON.stringify(login.data));
  let adminToken = login.data.token;

  const authenticatedCaseForm = new FormData();
  authenticatedCaseForm.append("nombre_completo", "Caso admin de prueba");
  authenticatedCaseForm.append("email_contacto", "caso-admin-ofertas@test.local");
  authenticatedCaseForm.append("entidad", "Proveedor autenticado");
  authenticatedCaseForm.append("categoria", "Otro problema");
  authenticatedCaseForm.append("relato", "Descripción de prueba creada desde una cuenta administrativa.");
  authenticatedCaseForm.append("acepta_terminos", "true");
  authenticatedCaseForm.append("acepta_privacidad", "true");
  const authenticatedCase = await request(baseUrl, "/cases", {
    token: adminToken,
    method: "POST",
    body: authenticatedCaseForm
  });
  assert.equal(authenticatedCase.response.status, 201, JSON.stringify(authenticatedCase.data));
  const authenticatedCaseDetail = await request(baseUrl, `/cases/${authenticatedCase.data.id}`, { token: adminToken });
  assert.equal(authenticatedCaseDetail.data.commercial_flow_version, 2);
  assert.equal(authenticatedCaseDetail.data.commercial_status, "analysis");

  const createCase = async (email) => {
    const result = await request(baseUrl, "/public/cases", {
      method: "POST",
      body: {
        nombre_completo: "Cliente de prueba",
        email_contacto: email,
        entidad: "Proveedor de prueba",
        categoria: "Otro problema",
        relato: "Descripción de prueba para validar el flujo comercial.",
        acepta_terminos: true,
        acepta_privacidad: true
      }
    });
    assert.equal(result.response.status, 201, JSON.stringify(result.data));
    return result.data;
  };

  const customerCase = await createCase("cliente-ofertas@test.local");
  const otherCase = await createCase("otro-cliente-ofertas@test.local");
  const managementOnlyCase = await createCase("solo-gestion@test.local");
  const initial = await request(baseUrl, `/cases/${customerCase.id}`, { token: adminToken });
  assert.equal(initial.data.commercial_flow_version, 2);
  assert.equal(initial.data.commercial_status, "analysis");
  assert.equal(initial.data.operational_stage, "Recibido");

  const initialHistory = await request(baseUrl, `/cases/${customerCase.id}/updates`, { token: adminToken });
  const noChange = await request(baseUrl, `/cases/${customerCase.id}/updates`, { token: adminToken, method: "POST", body: {} });
  assert.equal(noChange.response.status, 200);
  assert.equal(noChange.data.update, null);
  const historyAfterNoChange = await request(baseUrl, `/cases/${customerCase.id}/updates`, { token: adminToken });
  assert.equal(historyAfterNoChange.data.length, initialHistory.data.length, "saving without changes must not create activity");

  const internalNote = await request(baseUrl, `/cases/${customerCase.id}/updates`, {
    token: adminToken,
    method: "POST",
    body: { observaciones_rfa: "Nota interna de prueba" }
  });
  assert.equal(internalNote.response.status, 201);
  assert.equal(internalNote.data.update.visibility, "rfa_internal");
  const publicLookupWithInternalNote = await request(baseUrl, "/public/case-lookup", {
    method: "POST",
    body: { case_id: customerCase.case_code, identifier: "cliente-ofertas@test.local" }
  });
  assert.equal(publicLookupWithInternalNote.data.updates.length, 1, "internal activity must not appear to the customer");
  assert.equal(publicLookupWithInternalNote.data.case.operational_stage, "Recibido", "internal fields must not change the public stage");

  const startAnalysis = await request(baseUrl, `/cases/${customerCase.id}/updates`, {
    token: adminToken,
    method: "POST",
    body: { estado: "in_analysis", mensaje: "Se inició el análisis interno del expediente.", message_visibility: "rfa_internal" }
  });
  assert.equal(startAnalysis.response.status, 201);
  assert.equal(startAnalysis.data.update.visibility, "rfa_internal");
  assert.equal(startAnalysis.data.case.operational_stage, "En análisis");
  const repeatedAnalysis = await request(baseUrl, `/cases/${customerCase.id}/updates`, {
    token: adminToken,
    method: "POST",
    body: { estado: "in_analysis", mensaje: "Se inició el análisis interno del expediente.", message_visibility: "rfa_internal" }
  });
  assert.equal(repeatedAnalysis.data.update, null, "repeating the same status and message must not duplicate activity");
  const analysisLookup = await request(baseUrl, "/public/case-lookup", {
    method: "POST",
    body: { case_id: customerCase.case_code, identifier: "cliente-ofertas@test.local" }
  });
  assert.equal(analysisLookup.data.case.operational_stage, "Recibido", "internal analysis state must not be exposed as a public advance");
  assert.equal(Object.hasOwn(analysisLookup.data.case, "estado"), false, "internal status must not be in public JSON");
  assert.equal(analysisLookup.data.updates.every((update) => !Object.hasOwn(update, "estado") && !Object.hasOwn(update, "prioridad")), true);
  assert.equal(analysisLookup.data.updates.length, 1, "an internal action must not add a client-visible advance");

  const informationRequest = await request(baseUrl, `/cases/${customerCase.id}/updates`, {
    token: adminToken,
    method: "POST",
    body: { estado: "needs_information", mensaje: "Por favor, adjuntá el resumen de cuenta de marzo.", message_visibility: "public" }
  });
  assert.equal(informationRequest.data.update.visibility, "public");
  assert.equal(informationRequest.data.case.operational_stage, "Falta información");
  const duplicateInformationRequest = await request(baseUrl, `/cases/${customerCase.id}/updates`, {
    token: adminToken,
    method: "POST",
    body: { estado: "needs_information", mensaje: "Por favor, adjuntá el resumen de cuenta de marzo.", message_visibility: "public" }
  });
  assert.equal(duplicateInformationRequest.data.update, null);
  const analysisAgainLookup = await request(baseUrl, "/public/case-lookup", {
    method: "POST",
    body: { case_id: customerCase.case_code, identifier: "cliente-ofertas@test.local" }
  });
  assert.equal(analysisAgainLookup.data.case.operational_stage, "Falta información");
  assert.equal(analysisAgainLookup.data.updates.length, 2);
  assert.equal(analysisAgainLookup.data.updates[0].mensaje, "Por favor, adjuntá el resumen de cuenta de marzo.");

  const terminalCase = await createCase("cierre-interno@test.local");
  for (const [estado, mensaje, expectedStage] of [
    ["completed", "El expediente se marcó como finalizado internamente.", "Finalizado"],
    ["not_applicable", "El expediente se marcó internamente como no correspondiente.", "No corresponde"],
    ["referred", "Se registró internamente la derivación del expediente.", "Derivado"]
  ]) {
    const internalAction = await request(baseUrl, `/cases/${terminalCase.id}/updates`, {
      token: adminToken,
      method: "POST",
      body: { estado, mensaje, message_visibility: "rfa_internal" }
    });
    assert.equal(internalAction.response.status, 201);
    assert.equal(internalAction.data.update.visibility, "rfa_internal");
    assert.equal(internalAction.data.case.operational_stage, expectedStage);
  }
  const terminalLookup = await request(baseUrl, "/public/case-lookup", {
    method: "POST",
    body: { case_id: terminalCase.case_code, identifier: "cierre-interno@test.local" }
  });
  assert.equal(terminalLookup.data.case.operational_stage, "Recibido");
  assert.equal(terminalLookup.data.updates.length, 1, "internal close, non-applicable and referral actions must not be public advances");

  const invalidManagement = await request(baseUrl, `/cases/${customerCase.id}/service-offers`, {
    token: adminToken,
    method: "PUT",
    body: { offers: [{ service_code: "rfa-management", quoted_amount: 1000, quoted_currency: "ARS", quoted_scope: "Alcance", available_communication_modes: [] }] }
  });
  assert.equal(invalidManagement.response.status, 400);
  const unchangedAfterInvalid = await request(baseUrl, `/cases/${customerCase.id}`, { token: adminToken });
  assert.equal(unchangedAfterInvalid.data.commercial_status, "analysis");
  assert.equal(unchangedAfterInvalid.data.service_offers.filter((offer) => offer.status === "published").length, 0);

  const published = await request(baseUrl, `/cases/${customerCase.id}/service-offers`, {
    token: adminToken,
    method: "PUT",
    body: { offers: [
      { service_code: "professional-folder", quoted_amount: 25000, quoted_currency: "ARS", quoted_scope: "Carpeta estructurada", available_communication_modes: [] },
      { service_code: "rfa-management", quoted_amount: 45000, quoted_currency: "ARS", quoted_scope: "Preparación y seguimiento", available_communication_modes: ["rfa_managed", "client_sends"] }
    ] }
  });
  assert.equal(published.response.status, 201, JSON.stringify(published.data));
  assert.equal(published.data.offers.length, 2);
  assert.equal(published.data.case.commercial_status, "proposal_sent");
  assert.equal(published.data.case.operational_stage, "Opciones disponibles");
  const publishedAt = published.data.offers[0].published_at;

  const folderOnly = await request(baseUrl, `/cases/${otherCase.id}/service-offers`, {
    token: adminToken,
    method: "PUT",
    body: { offers: [{ service_code: "professional-folder", quoted_amount: 15000, quoted_currency: "ARS", quoted_scope: "Solo carpeta", available_communication_modes: [] }] }
  });
  assert.equal(folderOnly.response.status, 201, JSON.stringify(folderOnly.data));
  assert.equal(folderOnly.data.offers.length, 1);

  const managementOnly = await request(baseUrl, `/cases/${managementOnlyCase.id}/service-offers`, {
    token: adminToken,
    method: "PUT",
    body: { offers: [{ service_code: "rfa-management", quoted_amount: 32000, quoted_currency: "ARS", quoted_scope: "Gestión administrativa", available_communication_modes: ["rfa_managed"] }] }
  });
  assert.equal(managementOnly.response.status, 201, JSON.stringify(managementOnly.data));
  assert.equal(managementOnly.data.offers.length, 1);

  const publicLookup = await request(baseUrl, "/public/case-lookup", {
    method: "POST",
    body: { case_id: customerCase.case_code, identifier: "cliente-ofertas@test.local" }
  });
  assert.equal(publicLookup.response.status, 200, JSON.stringify(publicLookup.data));
  assert.equal(publicLookup.data.service_offers.length, 2);
  assert.equal("action_grants" in publicLookup.data, false, "lookup must not create or return acceptance grants");
  const clockAdvanceMs = 3 * 24 * 60 * 60 * 1000;
  await writeFile(clockFile, String(clockAdvanceMs));
  const refreshedLogin = await request(baseUrl, "/auth/login", {
    method: "POST",
    body: { email: "admin-offers@test.local", password: "TestAdminPassword123" }
  });
  assert.ok([200, 201].includes(refreshedLogin.response.status), JSON.stringify(refreshedLogin.data));
  adminToken = refreshedLogin.data.token;
  const agedOfferLookup = await request(baseUrl, "/public/case-lookup", {
    method: "POST",
    body: { case_id: customerCase.case_code, identifier: "cliente-ofertas@test.local" }
  });
  assert.equal(agedOfferLookup.response.status, 200, JSON.stringify(agedOfferLookup.data));
  assert.equal(agedOfferLookup.data.service_offers.length, 2, "a proposal published three days earlier must remain available");
  const grantResponse = await request(baseUrl, "/public/case-action-token", {
    method: "POST",
    body: { case_id: customerCase.case_code, identifier: "cliente-ofertas@test.local", action: "proposal_accept" }
  });
  assert.equal(grantResponse.response.status, 200, JSON.stringify(grantResponse.data));
  const acceptGrant = grantResponse.data;
  assert.equal(acceptGrant.action, "proposal_accept");
  assert.ok(acceptGrant.token);
  assert.ok(Date.parse(acceptGrant.expires_at) > Date.now() + clockAdvanceMs);
  assert.ok(Date.parse(acceptGrant.expires_at) - Date.parse(publishedAt) > 2 * 24 * 60 * 60 * 1000,
    "the new authorization must be issued days after publication, independently of proposal age");
  const managementOffer = publicLookup.data.service_offers.find((offer) => offer.service_code === "rfa-management");
  const folderOffer = publicLookup.data.service_offers.find((offer) => offer.service_code === "professional-folder");
  assert.ok(managementOffer && folderOffer);

  const crossCaseAttempt = await request(baseUrl, "/public/case-proposal-accept", {
    method: "POST",
    body: { case_id: otherCase.case_code, identifier: "otro-cliente-ofertas@test.local", action_token: acceptGrant.token, offer_id: folderOnly.data.offers[0].id }
  });
  assert.equal(crossCaseAttempt.response.status, 403);

  const invalidGrant = await request(baseUrl, "/public/case-proposal-accept", {
    method: "POST",
    body: { case_id: customerCase.case_code, identifier: "cliente-ofertas@test.local", action_token: "f".repeat(64), offer_id: managementOffer.id, communication_mode: "client_sends" }
  });
  assert.equal(invalidGrant.response.status, 403);

  const invalidMode = await request(baseUrl, "/public/case-proposal-accept", {
    method: "POST",
    body: { case_id: customerCase.case_code, identifier: "cliente-ofertas@test.local", action_token: acceptGrant.token, offer_id: managementOffer.id, communication_mode: "not-available" }
  });
  assert.equal(invalidMode.response.status, 400);

  const accepted = await request(baseUrl, "/public/case-proposal-accept", {
    method: "POST",
    body: {
      case_id: customerCase.case_code,
      identifier: "cliente-ofertas@test.local",
      action_token: acceptGrant.token,
      offer_id: managementOffer.id,
      communication_mode: "client_sends",
      quoted_amount: 1,
      quoted_scope: "Manipulated"
    }
  });
  assert.equal(accepted.response.status, 200, JSON.stringify(accepted.data));
  assert.equal(accepted.data.commercial_status, "payment_pending");
  const acceptedDetail = await request(baseUrl, `/cases/${customerCase.id}`, { token: adminToken });
  const snapshot = JSON.parse(acceptedDetail.data.accepted_proposal_snapshot);
  assert.equal(snapshot.offer_id, managementOffer.id);
  assert.equal(snapshot.service_code, "rfa-management");
  assert.equal(snapshot.amount, 45000);
  assert.equal(snapshot.scope, "Preparación y seguimiento");
  assert.equal(snapshot.communication_mode, "client_sends");
  assert.equal(snapshot.accepted_at, accepted.data.accepted_at);
  assert.equal(acceptedDetail.data.commercial_status, "payment_pending");
  const acceptedLookup = await request(baseUrl, "/public/case-lookup", {
    method: "POST",
    body: { case_id: customerCase.case_code, identifier: "cliente-ofertas@test.local" }
  });
  assert.equal(acceptedLookup.data.case.operational_stage, "Pendiente de pago");
  assert.equal(acceptedDetail.data.payment_confirmed_at, null);
  const repeatedAccept = await request(baseUrl, "/public/case-proposal-accept", {
    method: "POST",
    body: {
      case_id: customerCase.case_code,
      identifier: "cliente-ofertas@test.local",
      action_token: acceptGrant.token,
      offer_id: managementOffer.id,
      communication_mode: "client_sends"
    }
  });
  assert.equal(repeatedAccept.response.status, 403);

  const immutableAttempt = await request(baseUrl, `/cases/${customerCase.id}/updates`, {
    token: adminToken,
    method: "POST",
    body: { service_code: "professional-folder", quoted_amount: 1, quoted_scope: "Changed", commercial_status: "paid" }
  });
  assert.equal(immutableAttempt.response.status, 400);

  const uploadReceipt = async (filename, { caseId = customerCase.case_code, identifier = "cliente-ofertas@test.local" } = {}) => {
    const lookup = await request(baseUrl, "/public/case-lookup", {
      method: "POST",
      body: { case_id: customerCase.case_code, identifier: "cliente-ofertas@test.local" }
    });
    assert.equal(lookup.response.status, 200, JSON.stringify(lookup.data));
    assert.equal("action_grants" in lookup.data, false);
    const grant = await request(baseUrl, "/public/case-action-token", {
      method: "POST",
      body: { case_id: customerCase.case_code, identifier: "cliente-ofertas@test.local", action: "payment_receipt" }
    });
    assert.equal(grant.response.status, 200, JSON.stringify(grant.data));
    const form = new FormData();
    form.append("case_id", caseId);
    form.append("identifier", identifier);
    form.append("action_token", grant.data.token);
    form.append("comprobante", new File([Buffer.from("%PDF-1.4\nRFA test receipt\n")], filename, { type: "application/pdf" }));
    return request(baseUrl, "/public/case-payment-receipt", { method: "POST", body: form });
  };

  const foreignReceipt = await uploadReceipt("foreign-receipt.pdf", {
    caseId: otherCase.case_code,
    identifier: "otro-cliente-ofertas@test.local"
  });
  assert.equal(foreignReceipt.response.status, 403);

  const receiptOne = await uploadReceipt("receipt-one.pdf");
  assert.equal(receiptOne.response.status, 201, JSON.stringify(receiptOne.data));
  const afterFirstReceipt = await request(baseUrl, `/cases/${customerCase.id}`, { token: adminToken });
  assert.equal(afterFirstReceipt.data.payment_receipt_pending, true);
  assert.equal(afterFirstReceipt.data.payment_receipts.length, 1);
  const unauthorizedReceipt = await request(baseUrl, `/cases/${customerCase.id}/payment-receipts/${afterFirstReceipt.data.payment_receipts[0].id}`);
  assert.equal(unauthorizedReceipt.response.status, 401);
  const authorizedReceipt = await request(baseUrl, `/cases/${customerCase.id}/payment-receipts/${afterFirstReceipt.data.payment_receipts[0].id}`, { token: adminToken });
  assert.equal(authorizedReceipt.response.status, 200);
  const otherCaseReceipt = await request(baseUrl, `/cases/${otherCase.id}/payment-receipts/${afterFirstReceipt.data.payment_receipts[0].id}`, { token: adminToken });
  assert.equal(otherCaseReceipt.response.status, 404);
  const listWithPendingReceipt = await request(baseUrl, "/cases", { token: adminToken });
  assert.equal(listWithPendingReceipt.data.find((item) => item.id === customerCase.id).payment_receipt_pending, 1);

  const receiptTwo = await uploadReceipt("receipt-two.pdf");
  assert.equal(receiptTwo.response.status, 201, JSON.stringify(receiptTwo.data));
  const afterSecondReceipt = await request(baseUrl, `/cases/${customerCase.id}`, { token: adminToken });
  assert.equal(afterSecondReceipt.data.payment_receipts.length, 2);
  assert.equal(afterSecondReceipt.data.payment_receipts.filter((receipt) => receipt.status === "pending").length, 1);
  assert.equal(afterSecondReceipt.data.payment_receipts.filter((receipt) => receipt.status === "superseded").length, 1);

  const publicLookupAfterReceipt = await request(baseUrl, "/public/case-lookup", {
    method: "POST",
    body: { case_id: customerCase.case_code, identifier: "cliente-ofertas@test.local" }
  });
  assert.equal(publicLookupAfterReceipt.data.case.payment_receipt_pending, true);
  assert.equal(publicLookupAfterReceipt.data.case.operational_stage, "Comprobante recibido / verificación de pago");
  assert.equal("payment_receipts" in publicLookupAfterReceipt.data, false);

  const confirmPayment = await request(baseUrl, `/cases/${customerCase.id}/payment-confirm`, {
    token: adminToken,
    method: "POST",
    body: { receipt_id: afterSecondReceipt.data.payment_receipts.find((receipt) => receipt.status === "pending").id }
  });
  assert.equal(confirmPayment.response.status, 200, JSON.stringify(confirmPayment.data));
  assert.equal(confirmPayment.data.case.commercial_status, "paid");
  assert.equal(confirmPayment.data.case.operational_stage, "En gestión");
  assert.ok(confirmPayment.data.case.payment_confirmed_at);
  assert.equal(confirmPayment.data.payment_receipts.find((receipt) => receipt.status === "verified").verified_by, login.data.user.id);

  const otherLookup = await request(baseUrl, "/public/case-lookup", {
    method: "POST",
    body: { case_id: otherCase.case_code, identifier: "otro-cliente-ofertas@test.local" }
  });
  assert.equal(otherLookup.data.service_offers.length, 1);
  assert.equal(otherLookup.data.service_offers[0].service_code, "professional-folder");
  assert.equal(otherLookup.data.service_offers.some((offer) => offer.id === managementOffer.id), false);

  const folderAcceptLink = await request(baseUrl, `/admin/cases/${otherCase.id}/public-action-token`, {
    token: adminToken,
    method: "POST",
    body: { action: "proposal_accept" }
  });
  assert.equal(folderAcceptLink.response.status, 201, JSON.stringify(folderAcceptLink.data));
  assert.equal(extractActionToken(folderAcceptLink.data.url).length, 64);

  const managementOnlyLookup = await request(baseUrl, "/public/case-lookup", {
    method: "POST",
    body: { case_id: managementOnlyCase.case_code, identifier: "solo-gestion@test.local" }
  });
  assert.equal(managementOnlyLookup.data.service_offers.length, 1);
  assert.equal(managementOnlyLookup.data.service_offers[0].service_code, "rfa-management");
  assert.equal("action_grants" in managementOnlyLookup.data, false);
});
