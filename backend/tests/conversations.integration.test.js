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

async function waitForHealth(baseUrl, child, readOutput) {
  const deadline = Date.now() + 30000;
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

async function request(baseUrl, route, { token, body, method = "GET", headers = {} } = {}) {
  const response = await fetch(`${baseUrl}/api${route}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...headers
    },
    body: body && !(body instanceof FormData) ? JSON.stringify(body) : body
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { response, data };
}

function txt(name, content = "evidence text\n") {
  return new File([content], name, { type: "text/plain" });
}

test("conversation API enforces scope, immutable history, attention and private files", { timeout: 180000 }, async (t) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "rfa-conversations-"));
  const port = await unusedPort();
  const baseUrl = `http://localhost:${port}`;
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
      TRUST_PROXY: "true",
      JWT_SECRET: "conversation-integration-test-secret-0123456789",
      ADMIN_EMAILS: "admin-conversations@test.local",
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
    body: { email: "admin-conversations@test.local", password: "TestAdminPassword123" }
  });
  assert.equal(login.response.status, 200, JSON.stringify(login.data));
  const adminToken = login.data.token;

  const createCase = async (email, name) => {
    const created = await request(baseUrl, "/public/cases", {
      method: "POST",
      body: {
        nombre_completo: name,
        dni_cuit: "12345678",
        email_contacto: email,
        entidad: "Proveedor de prueba",
        categoria: "Otro problema",
        relato: "Descripción de prueba suficientemente extensa.",
        acepta_terminos: true,
        acepta_privacidad: true
      }
    });
    assert.equal(created.response.status, 201, JSON.stringify(created.data));
    return created.data;
  };
  const first = await createCase("cliente-a@test.local", "Cliente A");
  const second = await createCase("cliente-b@test.local", "Cliente B");

  let lookup = await request(baseUrl, "/public/case-lookup", {
    method: "POST", body: { identifier: "cliente-a@test.local", case_id: first.id }
  });
  assert.equal(lookup.response.status, 200);
  assert.equal(lookup.data.conversation.enabled, false);
  assert.equal(lookup.data.conversation.access_token, undefined);

  let result = await request(baseUrl, `/cases/${first.id}/conversations`, {
    token: adminToken, method: "PATCH", body: { enabled: true }
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.data.enabled, true);
  assert.equal(result.data.client_reply_enabled, false);
  const legacyDniLookup = await request(baseUrl, "/public/case-lookup", {
    method: "POST", body: { identifier: "12345678", case_id: first.case_code }
  });
  assert.equal(legacyDniLookup.response.status, 404);

  for (const payload of [
    { identifier: "incorrecto@test.local", case_id: first.id },
    { identifier: "cliente-a@test.local", case_id: "RFA-INVALIDO" }
  ]) {
    const denied = await request(baseUrl, "/public/case-lookup", { method: "POST", body: payload });
    assert.equal(denied.response.status, 404);
  }

  lookup = await request(baseUrl, "/public/case-lookup", {
    method: "POST", body: { identifier: "cliente-a@test.local", case_id: first.case_code }
  });
  assert.equal(lookup.response.status, 200);
  const clientToken = lookup.data.conversation.access_token;
  assert.match(clientToken, /^[a-f0-9]{64}$/);
  assert.match(lookup.response.headers.get("cache-control"), /no-store/);

  const invalidToken = await request(baseUrl, "/public/case-conversations", {
    headers: { "X-RFA-Conversation-Token": "a".repeat(64) }
  });
  assert.equal(invalidToken.response.status, 404);
  let publicHeaders = { "X-RFA-Conversation-Token": clientToken };
  const disabledOrInvalid = await request(baseUrl, "/public/case-conversations", { headers: publicHeaders });
  assert.equal(disabledOrInvalid.response.status, 200);
  assert.deepEqual(disabledOrInvalid.data.messages, []);
  assert.equal(disabledOrInvalid.data.pending_admin_attention, undefined);

  const adminMessage = new FormData();
  adminMessage.append("body", "<script>alert(1)</script>\nMensaje preparado por RFA.");
  adminMessage.append("channel", "Portal autenticado");
  for (let index = 1; index <= 5; index += 1) adminMessage.append("adjuntos", txt(`prueba-${index}.txt`));
  result = await request(baseUrl, `/cases/${first.id}/conversations/messages`, {
    token: adminToken, method: "POST", body: adminMessage
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.data));
  assert.equal(result.data.messages[0].sender_type, "rfa");
  assert.equal(result.data.messages[0].message_type, "prepared_message");
  assert.equal(result.data.messages[0].channel, "Portal autenticado");
  assert.equal(result.data.messages[0].attachments.length, 5);
  const attachmentId = result.data.messages[0].attachments[0].id;

  result = await request(baseUrl, `/cases/${first.id}/conversations`, {
    token: adminToken, method: "PATCH", body: { client_reply_enabled: true }
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.data.client_reply_enabled, true);

  const emptyReply = await request(baseUrl, "/public/case-conversations/messages", {
    method: "POST", headers: publicHeaders, body: { body: "" }
  });
  assert.equal(emptyReply.response.status, 400);
  const openTurnAfterFailure = await request(baseUrl, "/public/case-conversations", { headers: publicHeaders });
  assert.equal(openTurnAfterFailure.data.client_reply_enabled, true);

  const clientThread = await request(baseUrl, "/public/case-conversations", { headers: publicHeaders });
  assert.equal(clientThread.data.messages[0].body.replace(/\r\n/g, "\n"), "<script>alert(1)</script>\nMensaje preparado por RFA.");
  assert.equal(clientThread.data.messages[0].sender_type, "rfa");
  assert.equal(clientThread.data.client_reply_enabled, true);
  const clientPretendsRfa = await request(baseUrl, `/cases/${first.id}/conversations/messages`, {
    method: "POST",
    headers: publicHeaders,
    body: { body: "Mensaje falso", sender_type: "rfa", message_type: "prepared_message" }
  });
  assert.equal(clientPretendsRfa.response.status, 401);
  const clientCannotMarkAttended = await request(baseUrl, `/cases/${first.id}/conversations/mark-attended`, {
    method: "POST", headers: publicHeaders, body: {}
  });
  assert.equal(clientCannotMarkAttended.response.status, 401);
  const clientCannotToggle = await request(baseUrl, `/cases/${first.id}/conversations`, {
    method: "PATCH", headers: publicHeaders, body: { enabled: false }
  });
  assert.equal(clientCannotToggle.response.status, 401);
  const download = await fetch(`${baseUrl}/api/public/case-conversations/attachments/${attachmentId}`, { headers: publicHeaders });
  assert.equal(download.status, 200);
  assert.equal(download.headers.get("content-type"), "application/octet-stream");
  assert.match(download.headers.get("content-disposition"), /^attachment;/);
  const adminDownload = await fetch(`${baseUrl}/api/cases/${first.id}/conversations/attachments/${attachmentId}`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.equal(adminDownload.status, 200);

  const replyForm = new FormData();
  replyForm.append("body", "Respuesta pegada por el cliente.");
  replyForm.append("sender_type", "rfa");
  replyForm.append("message_type", "prepared_message");
  replyForm.append("adjuntos", txt("respuesta-cliente.txt", "Adjunto de respuesta del cliente."));
  const clientReply = await request(baseUrl, "/public/case-conversations/messages", {
    method: "POST",
    headers: publicHeaders,
    body: replyForm
  });
  assert.equal(clientReply.response.status, 201);
  assert.equal(clientReply.data.messages.at(-1).sender_type, "client");
  assert.equal(clientReply.data.messages.at(-1).message_type, "received_reply");
  assert.equal(clientReply.data.messages.at(-1).attachments.length, 1);
  assert.equal(clientReply.data.client_reply_enabled, false);
  assert.equal(clientReply.data.pending_admin_attention, undefined);
  const duplicateReply = await request(baseUrl, "/public/case-conversations/messages", {
    method: "POST", headers: publicHeaders, body: { body: "Segundo envío no permitido." }
  });
  assert.equal(duplicateReply.response.status, 409);
  result = await request(baseUrl, `/cases/${first.id}/conversations`, { token: adminToken });
  assert.equal(result.data.pending_admin_attention, true);
  let cases = await request(baseUrl, "/cases", { token: adminToken });
  assert.equal(Number(cases.data.find((item) => item.id === first.id).conversation_pending_admin_attention), 1);

  result = await request(baseUrl, `/cases/${first.id}/conversations/mark-attended`, { token: adminToken, method: "POST", body: {} });
  assert.equal(result.data.pending_admin_attention, false);
  assert.equal(result.data.client_reply_enabled, false);
  const stillClosedReply = await request(baseUrl, "/public/case-conversations/messages", {
    method: "POST", headers: publicHeaders, body: { body: "Atender no debe habilitar un turno." }
  });
  assert.equal(stillClosedReply.response.status, 409);

  result = await request(baseUrl, `/cases/${first.id}/conversations`, {
    token: adminToken, method: "PATCH", body: { client_reply_enabled: true }
  });
  assert.equal(result.data.client_reply_enabled, true);
  const attachmentOnlyReply = new FormData();
  attachmentOnlyReply.append("body", "");
  attachmentOnlyReply.append("adjuntos", txt("respuesta-solo-adjunto.txt", "Respuesta adjunta."));
  const attachmentOnlyResult = await request(baseUrl, "/public/case-conversations/messages", {
    method: "POST", headers: publicHeaders, body: attachmentOnlyReply
  });
  assert.equal(attachmentOnlyResult.response.status, 201, JSON.stringify(attachmentOnlyResult.data));
  assert.equal(attachmentOnlyResult.data.messages.at(-1).body, "");
  assert.equal(attachmentOnlyResult.data.messages.at(-1).attachments.length, 1);
  assert.equal(attachmentOnlyResult.data.client_reply_enabled, false);

  result = await request(baseUrl, `/cases/${first.id}/conversations`, {
    token: adminToken, method: "PATCH", body: { client_reply_enabled: true }
  });
  const concurrentPayload = { body: "Envío concurrente." };
  const concurrentBase = `http://127.0.0.2:${port}`;
  const concurrentHeaders = { ...publicHeaders, "X-Forwarded-For": "203.0.113.10" };
  const concurrentReplies = await Promise.all([
    request(concurrentBase, "/public/case-conversations/messages", { method: "POST", headers: concurrentHeaders, body: concurrentPayload }),
    request(concurrentBase, "/public/case-conversations/messages", { method: "POST", headers: concurrentHeaders, body: concurrentPayload })
  ]);
  assert.deepEqual(concurrentReplies.map((reply) => reply.response.status).sort(), [201, 409]);
  result = await request(baseUrl, `/cases/${first.id}/conversations`, { token: adminToken });
  assert.equal(result.data.pending_admin_attention, true);
  assert.equal(result.data.client_reply_enabled, false);
  assert.equal(result.data.messages.length, 4);

  const wrongCaseAttachment = await fetch(`${baseUrl}/api/public/case-conversations/attachments/${attachmentId}`, {
    headers: { "X-RFA-Conversation-Token": "not-a-valid-token" }
  });
  assert.equal(wrongCaseAttachment.status, 404);

  const noEditRoute = await request(baseUrl, `/public/case-conversations/messages/1`, { method: "PATCH", headers: publicHeaders, body: { body: "changed" } });
  assert.equal(noEditRoute.response.status, 404);
  const noDeleteRoute = await request(baseUrl, "/public/case-conversations", { method: "DELETE", headers: publicHeaders });
  assert.equal(noDeleteRoute.response.status, 404);
  const noAdminEditRoute = await request(baseUrl, `/cases/${first.id}/conversations/messages/1`, {
    token: adminToken, method: "PATCH", body: { body: "changed" }
  });
  assert.equal(noAdminEditRoute.response.status, 404);

  result = await request(baseUrl, `/cases/${first.id}/conversations`, { token: adminToken, method: "PATCH", body: { enabled: false } });
  assert.equal(result.data.enabled, false);
  assert.equal(result.data.client_reply_enabled, false);
  assert.equal(result.data.messages.length, 4);
  const revokedToken = await request(baseUrl, "/public/case-conversations", { headers: publicHeaders });
  assert.equal(revokedToken.response.status, 404);
  result = await request(`http://127.0.0.1:${port}`, `/cases/${first.id}/conversations`, { token: adminToken, method: "PATCH", body: { enabled: true } });
  assert.equal(result.response.status, 200);
  assert.equal(result.data.messages.length, 4);
  const renewedLookup = await request(baseUrl, "/public/case-lookup", {
    method: "POST", body: { identifier: "cliente-a@test.local", case_id: first.case_code }
  });
  publicHeaders = { "X-RFA-Conversation-Token": renewedLookup.data.conversation.access_token };

  const secondLookup = await request(baseUrl, "/public/case-lookup", {
    method: "POST", body: { identifier: "cliente-b@test.local", case_id: second.id }
  });
  assert.equal(secondLookup.response.status, 200);
  assert.equal(secondLookup.data.conversation.enabled, false);
  const enableSecond = await request(`http://127.0.0.1:${port}`, `/cases/${second.id}/conversations`, {
    token: adminToken, method: "PATCH", body: { enabled: true }
  });
  assert.equal(enableSecond.response.status, 200);
  const secondLookupEnabled = await request(baseUrl, "/public/case-lookup", {
    method: "POST", body: { identifier: "cliente-b@test.local", case_id: second.id }
  });
  const secondToken = secondLookupEnabled.data.conversation.access_token;
  const crossCaseDownload = await fetch(`${baseUrl}/api/public/case-conversations/attachments/${attachmentId}`, {
    headers: { "X-RFA-Conversation-Token": secondToken }
  });
  assert.equal(crossCaseDownload.status, 404);

  const enterprise = await request(baseUrl, "/enterprise-users", {
    token: adminToken,
    method: "POST",
    body: { email: "enterprise-conversations@test.local", password: "EnterprisePass123" }
  });
  assert.equal(enterprise.response.status, 201);
  const csv = new Blob(["email,nombre_completo,entidad,tipo_reclamo,descripcion\ncontacto@test.local,Cliente Empresa,Proveedor,Consulta,Prueba de caso empresa\n"], { type: "text/csv" });
  const importForm = new FormData();
  importForm.append("enterprise_user_id", enterprise.data.user.id);
  importForm.append("files", csv, "enterprise.csv");
  const imported = await request(baseUrl, "/cases/import", { token: adminToken, method: "POST", body: importForm });
  assert.equal(imported.response.status, 201, JSON.stringify(imported.data));
  assert.equal(imported.data.imported, 1);
  cases = await request(baseUrl, "/cases", { token: adminToken });
  const enterpriseCase = cases.data.find((item) => item.enterprise_user_id === enterprise.data.user.id);
  assert.ok(enterpriseCase);
  const enterprisePublicLookup = await request(baseUrl, "/public/case-lookup", {
    method: "POST", body: { identifier: "contacto@test.local", case_id: enterpriseCase.case_code }
  });
  assert.equal(enterprisePublicLookup.response.status, 404);
  const enterpriseConversation = await request(baseUrl, `/cases/${enterpriseCase.id}/conversations`, { token: adminToken });
  assert.equal(enterpriseConversation.response.status, 404);
  const enterpriseLogin = await request(baseUrl, "/auth/login", {
    method: "POST", body: { email: "enterprise-conversations@test.local", password: "EnterprisePass123" }
  });
  assert.equal(enterpriseLogin.response.status, 200);
  const enterpriseCannotUseAdminConversation = await request(baseUrl, `/cases/${first.id}/conversations`, { token: enterpriseLogin.data.token });
  assert.equal(enterpriseCannotUseAdminConversation.response.status, 403);

  const limitBase = `http://127.0.0.1:${port}`;
  const limitedPost = async (files, targetBase = limitBase, forwardedFor = "198.51.100.10") => {
    const form = new FormData();
    form.append("body", "Prueba de validación de adjuntos.");
    files.forEach((file) => form.append("adjuntos", file));
    return request(targetBase, "/public/case-conversations/messages", {
      method: "POST", headers: { ...publicHeaders, "X-Forwarded-For": forwardedFor }, body: form
    });
  };
  const invalidFormat = await limitedPost([new File(["bad"], "script.exe", { type: "application/octet-stream" })], limitBase, "198.51.100.11");
  assert.equal(invalidFormat.response.status, 400);
  assert.match(invalidFormat.data.error, /script\.exe/);
  const invalidContent = await limitedPost([new File(["not a PDF"], "bad.pdf", { type: "application/pdf" })], limitBase, "198.51.100.12");
  assert.equal(invalidContent.response.status, 400);
  assert.match(invalidContent.data.error, /bad\.pdf/);
  const tooMany = await limitedPost(Array.from({ length: 6 }, (_, index) => txt(`exceso-${index}.txt`)), limitBase, "198.51.100.13");
  assert.equal(tooMany.response.status, 400);
  assert.match(tooMany.data.error, /5 archivos/);
  const tooLarge = await limitedPost([txt("grande.txt", Buffer.alloc(26 * 1024 * 1024, 97))], limitBase, "198.51.100.14");
  assert.equal(tooLarge.response.status, 413);
  assert.match(tooLarge.data.error, /25 MB/);
  const tooMuchTotal = await limitedPost(Array.from({ length: 3 }, (_, index) => txt(`total-${index}.txt`, Buffer.alloc(17 * 1024 * 1024, 97))), limitBase, "198.51.100.15");
  assert.equal(tooMuchTotal.response.status, 413);
  assert.match(tooMuchTotal.data.error, /total de archivos/);

  const stillAlive = await fetch(`${baseUrl}/health`);
  assert.equal(stillAlive.status, 200);
});
