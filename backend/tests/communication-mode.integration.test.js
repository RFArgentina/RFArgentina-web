import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

test("communication mode is particular-only and accepted proposals retain a snapshot", { timeout: 240000 }, async (t) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "rfa-communication-mode-"));
  const port = await unusedPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let output = "";
  const child = spawn(process.execPath, ["server.js"], {
    cwd: backendDir,
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      SQLITE_PATH: path.join(tempDir, "test.db"),
      UPLOADS_PATH: path.join(tempDir, "uploads"),
      BACKUP_DIR: path.join(tempDir, "backups"),
      JWT_SECRET: "communication-mode-test-secret-0123456789",
      ADMIN_EMAILS: "admin-communication@test.local",
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
    body: { email: "admin-communication@test.local", password: "TestAdminPassword123" }
  });
  assert.equal(login.response.status, 200, JSON.stringify(login.data));
  const adminToken = login.data.token;

  const created = await request(baseUrl, "/public/cases", {
    method: "POST",
    body: {
      nombre_completo: "Cliente prueba",
      dni_cuit: "12345678",
      email_contacto: "cliente-communication@test.local",
      entidad: "Proveedor de prueba",
      categoria: "Otro problema",
      relato: "Descripcion de prueba suficientemente extensa.",
      acepta_terminos: true,
      acepta_privacidad: true
    }
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.data));
  const caseId = created.data.id;
  const initial = await request(baseUrl, `/cases/${caseId}`, { token: adminToken });
  assert.equal(initial.data.communication_mode, null);
  assert.equal(initial.data.service_code, "analysis");

  let update = await request(baseUrl, `/cases/${caseId}/updates`, {
    token: adminToken,
    method: "POST",
    body: { communication_mode: "rfa_managed" }
  });
  assert.equal(update.response.status, 400);

  const invalid = await request(baseUrl, `/cases/${caseId}/updates`, {
    token: adminToken,
    method: "POST",
    body: { communication_mode: "automatic_conversations" }
  });
  assert.equal(invalid.response.status, 400);

  update = await request(baseUrl, `/cases/${caseId}/service-offers`, {
    token: adminToken,
    method: "PUT",
    body: { offers: [{
      service_code: "rfa-management",
      quoted_amount: 120000,
      quoted_currency: "ARS",
      quoted_scope: "Preparacion y seguimiento administrativo",
      available_communication_modes: ["rfa_managed", "client_sends"]
    }] }
  });
  assert.equal(update.response.status, 201, JSON.stringify(update.data));

  const publicOptions = await request(baseUrl, "/public/case-lookup", {
    method: "POST",
    body: { case_id: caseId, identifier: "cliente-communication@test.local" }
  });
  assert.equal(publicOptions.data.service_offers.length, 1);
  assert.equal("action_grants" in publicOptions.data, false);
  const grant = await request(baseUrl, "/public/case-action-token", {
    method: "POST",
    body: { case_id: caseId, identifier: "cliente-communication@test.local", action: "proposal_accept" }
  });
  assert.equal(grant.response.status, 200, JSON.stringify(grant.data));
  const actionToken = grant.data.token;
  assert.ok(actionToken);
  const offerId = publicOptions.data.service_offers[0].id;
  const invalidModeAccept = await request(baseUrl, "/public/case-proposal-accept", {
    method: "POST",
    body: {
      case_id: caseId,
      identifier: "cliente-communication@test.local",
      action_token: actionToken,
      offer_id: offerId,
      communication_mode: "automatic_conversations"
    }
  });
  assert.equal(invalidModeAccept.response.status, 400);
  const accept = await request(baseUrl, "/public/case-proposal-accept", {
    method: "POST",
    body: {
      case_id: caseId,
      identifier: "cliente-communication@test.local",
      action_token: actionToken,
      offer_id: offerId,
      communication_mode: "client_sends"
    }
  });
  assert.equal(accept.response.status, 200, JSON.stringify(accept.data));
  assert.equal(accept.data.commercial_status, "payment_pending");

  const changedAfterAccept = await request(baseUrl, `/cases/${caseId}/updates`, {
    token: adminToken,
    method: "POST",
    body: { communication_mode: "rfa_managed" }
  });
  assert.equal(changedAfterAccept.response.status, 400);

  const lookup = await request(baseUrl, "/public/case-lookup", {
    method: "POST",
    body: { case_id: caseId, identifier: "cliente-communication@test.local" }
  });
  assert.equal(lookup.response.status, 200, JSON.stringify(lookup.data));
  assert.equal(lookup.data.case.proposal.communication_mode, "client_sends");
  assert.equal(lookup.data.case.proposal.amount, 120000);
  assert.equal(lookup.data.case.proposal.scope, "Preparacion y seguimiento administrativo");

  const manuallyAcceptedCase = await request(baseUrl, "/public/cases", {
    method: "POST",
    body: {
      nombre_completo: "Cliente aceptacion directa",
      dni_cuit: "87654321",
      email_contacto: "cliente-directo@test.local",
      entidad: "Proveedor de prueba",
      categoria: "Otro problema",
      relato: "Descripcion de prueba suficientemente extensa.",
      acepta_terminos: true,
      acepta_privacidad: true
    }
  });
  assert.equal(manuallyAcceptedCase.response.status, 201, JSON.stringify(manuallyAcceptedCase.data));
  const directAcceptanceUpdate = await request(baseUrl, `/cases/${manuallyAcceptedCase.data.id}/updates`, {
    token: adminToken,
    method: "POST",
    body: {
      service_code: "rfa-management",
      quoted_amount: 120000,
      quoted_currency: "ARS",
      quoted_scope: "Alcance acordado en el expediente",
      communication_mode: "rfa_managed",
      commercial_status: "accepted"
    }
  });
  assert.equal(directAcceptanceUpdate.response.status, 400);

  const enterprise = await request(baseUrl, "/enterprise-users", {
    token: adminToken,
    method: "POST",
    body: { email: "empresa-communication@test.local", password: "EnterpriseTest123" }
  });
  assert.equal(enterprise.response.status, 201, JSON.stringify(enterprise.data));
  const csv = "Nombre completo,Email,Entidad,Tipo de Reclamo,Descripcion,Documentacion\nCliente empresa,cliente-empresa@test.local,Proveedor,Otros,Reclamo importado,Completa\n";
  const form = new FormData();
  form.append("enterprise_user_id", enterprise.data.user.id);
  form.append("files", new File([csv], "cases.csv", { type: "text/csv" }));
  const imported = await request(baseUrl, "/cases/import", { token: adminToken, method: "POST", body: form });
  assert.equal(imported.response.status, 201, JSON.stringify(imported.data));
  assert.equal(imported.data.imported, 1);
  const enterpriseCase = (await request(baseUrl, "/cases", { token: adminToken })).data
    .find((item) => item.enterprise_user_id === enterprise.data.user.id);
  assert.ok(enterpriseCase);
  assert.equal(enterpriseCase.communication_mode, null);

  const enterpriseModeAttempt = await request(baseUrl, `/cases/${enterpriseCase.id}/updates`, {
    token: adminToken,
    method: "POST",
    body: { communication_mode: "client_sends" }
  });
  assert.equal(enterpriseModeAttempt.response.status, 403);

  const conversation = await request(baseUrl, `/cases/${caseId}/conversations`, { token: adminToken });
  assert.equal(conversation.response.status, 200);
  assert.equal(conversation.data.enabled, false);
});
