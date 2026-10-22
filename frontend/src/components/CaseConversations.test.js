import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CaseConversations from "./CaseConversations";
import { apiRequest } from "@/lib/api";

jest.mock("@/lib/api", () => ({ apiRequest: jest.fn(), apiDownload: jest.fn() }));

beforeEach(() => apiRequest.mockReset());

test("client sees prepared messages as text and receives no admin controls", async () => {
  apiRequest.mockResolvedValue({
    enabled: true,
    pending_admin_attention: false,
    messages: [{
      id: 1,
      sender_type: "rfa",
      message_type: "prepared_message",
      body: "<script>alert(1)</script>",
      channel: "Email",
      created_at: "2026-10-19T12:00:00.000Z",
      attachments: []
    }]
  });

  render(React.createElement(CaseConversations, { mode: "client", accessToken: "a".repeat(64) }));

  expect(await screen.findByText("<script>alert(1)</script>")).toBeInTheDocument();
  expect(document.querySelector("script")).toBeNull();
  expect(screen.getByRole("button", { name: "Copiar mensaje" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /habilitar|deshabilitar/i })).not.toBeInTheDocument();
  expect(apiRequest).toHaveBeenCalledWith("/public/case-conversations", expect.objectContaining({
    headers: { "X-RFA-Conversation-Token": "a".repeat(64) },
    skipAuthRefresh: true
  }));
});

test("admin can enable a disabled conversation without losing the thread", async () => {
  apiRequest
    .mockResolvedValueOnce({ enabled: false, pending_admin_attention: false, messages: [] })
    .mockResolvedValueOnce({ enabled: true, pending_admin_attention: false, messages: [] });

  render(React.createElement(CaseConversations, { mode: "admin", caseId: "case-123" }));
  fireEvent.click(await screen.findByRole("button", { name: "Habilitar conversaciones" }));

  await waitFor(() => expect(apiRequest).toHaveBeenLastCalledWith("/cases/case-123/conversations", expect.objectContaining({
    method: "PATCH",
    body: JSON.stringify({ enabled: true })
  })));
  expect(await screen.findByText("Conversaciones habilitada para este caso.")).toBeInTheDocument();
});

test("marking a reply attended does not enable another client response", async () => {
  apiRequest
    .mockResolvedValueOnce({ enabled: true, client_reply_enabled: false, pending_admin_attention: true, messages: [] })
    .mockResolvedValueOnce({ enabled: true, client_reply_enabled: false, pending_admin_attention: false, messages: [] })
    .mockResolvedValueOnce({ enabled: true, client_reply_enabled: true, pending_admin_attention: false, messages: [] });

  render(React.createElement(CaseConversations, { mode: "admin", caseId: "case-123" }));
  fireEvent.click(await screen.findByRole("button", { name: "Marcar como atendida" }));
  expect(await screen.findByText("Respuesta marcada como atendida.")).toBeInTheDocument();
  expect(screen.getByText("Respuesta del cliente: no habilitada")).toBeInTheDocument();

  const enableReply = screen.getByRole("button", { name: "Habilitar respuesta del cliente" });
  await waitFor(() => expect(enableReply).toBeEnabled());
  fireEvent.click(enableReply);
  await waitFor(() => expect(apiRequest).toHaveBeenLastCalledWith("/cases/case-123/conversations", expect.objectContaining({
    method: "PATCH",
    body: JSON.stringify({ client_reply_enabled: true })
  })));
  expect(screen.getByText(/Respuesta del cliente:/)).toHaveTextContent("habilitada");
});

test("client submission consumes the turn and hides the response form while keeping history", async () => {
  apiRequest
    .mockResolvedValueOnce({ enabled: true, client_reply_enabled: true, pending_admin_attention: false, messages: [] })
    .mockResolvedValueOnce({
      enabled: true,
      client_reply_enabled: false,
      messages: [{ id: 1, sender_type: "client", message_type: "received_reply", body: "La empresa respondio.", created_at: "2026-10-21T12:00:00Z", attachments: [] }]
    });

  render(React.createElement(CaseConversations, { mode: "client", accessToken: "c".repeat(64) }));
  fireEvent.change(await screen.findByLabelText("Respuesta de la entidad"), { target: { value: "La empresa respondio." } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar respuesta" }));

  expect(await screen.findByText("Respuesta enviada a RFA. Estamos revisando la información. Podrás enviar una nueva respuesta cuando RFA la habilite.")).toBeInTheDocument();
  expect(screen.getByText("La empresa respondio.")).toBeInTheDocument();
  expect(screen.queryByLabelText("Respuesta de la entidad")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Enviar respuesta" })).not.toBeInTheDocument();
  expect(apiRequest).toHaveBeenLastCalledWith("/public/case-conversations/messages", expect.objectContaining({ method: "POST" }));
});

test("client reply field clearly asks for the entity response", async () => {
  apiRequest.mockResolvedValue({ enabled: true, client_reply_enabled: true, pending_admin_attention: false, messages: [] });

  render(React.createElement(CaseConversations, { mode: "client", accessToken: "b".repeat(64) }));

  expect(await screen.findByLabelText("Respuesta de la entidad")).toBeInTheDocument();
  expect(screen.getByText("Pegá o escribí acá la respuesta que recibiste de la empresa, banco o entidad reclamada. RFA la revisará para indicarte cómo continuar.")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("Escribí o pegá acá la respuesta que recibiste...")).toBeInTheDocument();
  expect(screen.getByText("También podés adjuntar capturas o documentos relacionados con la respuesta.")).toBeInTheDocument();
});
