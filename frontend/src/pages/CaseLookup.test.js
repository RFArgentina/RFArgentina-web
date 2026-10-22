import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CaseLookup from "./CaseLookup";
import { apiRequest } from "@/lib/api";

jest.mock("@/lib/api", () => ({ apiRequest: jest.fn() }));
jest.mock("@/components/CaseConversations", () => () => null);

const v2OffersLookup = {
  case: {
    id: "case-1",
    case_code: "RFA-TEST01",
    estado: "received",
    categoria: "Compra no entregada",
    entidad: "Proveedor",
    commercial_status: "proposal_sent",
    commercial_flow_version: 2,
    updated_at: "2026-10-20T12:00:00.000Z"
  },
  service_offers: [{
    id: "offer-1",
    service_code: "professional-folder",
    quoted_amount: 12000,
    quoted_currency: "ARS",
    quoted_scope: "Organización documental",
    available_communication_modes: []
  }],
  updates: [],
  conversation: { enabled: false }
};

beforeEach(() => {
  apiRequest.mockReset();
  window.history.replaceState(null, "", "/consultar-caso");
});

test("v2 client requests a fresh acceptance token only when accepting", async () => {
  apiRequest
    .mockResolvedValueOnce(v2OffersLookup)
    .mockResolvedValueOnce({ token: "a".repeat(64), expires_at: "2026-10-21T12:15:00.000Z" })
    .mockResolvedValueOnce({ commercial_status: "payment_pending" })
    .mockResolvedValueOnce({
      ...v2OffersLookup,
      case: {
        ...v2OffersLookup.case,
        commercial_status: "payment_pending",
        proposal: { service_code: "professional-folder", amount: 12000, currency: "ARS", scope: "OrganizaciÃ³n documental", status: "payment_pending" }
      },
      service_offers: []
    });

  render(<CaseLookup />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "cliente@example.test" } });
  fireEvent.change(screen.getByLabelText("Número de caso"), { target: { value: "RFA-TEST01" } });
  fireEvent.click(screen.getByRole("button", { name: "Ver seguimiento" }));

  fireEvent.click(await screen.findByRole("button", { name: "Elegir esta opción" }));
  fireEvent.click(screen.getByRole("button", { name: "Aceptar propuesta" }));

  await waitFor(() => expect(apiRequest.mock.calls.some(([url]) => url === "/public/case-proposal-accept")).toBe(true));
  expect(apiRequest).toHaveBeenNthCalledWith(2, "/public/case-action-token", expect.objectContaining({
    method: "POST",
    body: JSON.stringify({ identifier: "cliente@example.test", case_id: "RFA-TEST01", action: "proposal_accept" })
  }));
  expect("action_grants" in v2OffersLookup).toBe(false);
  const acceptRequest = apiRequest.mock.calls.find(([url]) => url === "/public/case-proposal-accept");
  expect(JSON.parse(acceptRequest[1].body)).toEqual(expect.objectContaining({
    identifier: "cliente@example.test",
    case_id: "RFA-TEST01",
    action_token: "a".repeat(64),
    offer_id: "offer-1"
  }));
  expect(await screen.findByText(/Pago pendiente/)).toBeInTheDocument();
  expect(screen.queryByText(/abrí el enlace seguro que RFA te compartió/i)).not.toBeInTheDocument();
});

test("v2 client accepts RFA Management with a selected communication mode", async () => {
  const managementLookup = {
    ...v2OffersLookup,
    service_offers: [{
      id: "offer-management",
      service_code: "rfa-management",
      quoted_amount: 45000,
      quoted_currency: "ARS",
      quoted_scope: "PreparaciÃ³n y seguimiento",
      available_communication_modes: ["rfa_managed", "client_sends"]
    }]
  };
  apiRequest
    .mockResolvedValueOnce(managementLookup)
    .mockResolvedValueOnce({ token: "b".repeat(64), expires_at: "2026-10-21T12:15:00.000Z" })
    .mockResolvedValueOnce({ commercial_status: "payment_pending" })
    .mockResolvedValueOnce({
      ...managementLookup,
      case: {
        ...managementLookup.case,
        commercial_status: "payment_pending",
        proposal: { service_code: "rfa-management", amount: 45000, currency: "ARS", scope: "PreparaciÃ³n y seguimiento", communication_mode: "client_sends", status: "payment_pending" }
      },
      service_offers: []
    });

  render(<CaseLookup />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "cliente@example.test" } });
  fireEvent.change(document.getElementById("lookup-case-id"), { target: { value: "RFA-TEST01" } });
  fireEvent.click(screen.getByRole("button", { name: "Ver seguimiento" }));
  fireEvent.click(await screen.findByRole("button", { name: /Elegir esta opci/ }));
  fireEvent.click(screen.getAllByRole("radio")[1]);
  fireEvent.click(screen.getByRole("button", { name: "Aceptar propuesta" }));

  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith("/public/case-proposal-accept", expect.any(Object)));
  const tokenRequest = apiRequest.mock.calls.find(([url]) => url === "/public/case-action-token");
  const acceptRequest = apiRequest.mock.calls.find(([url]) => url === "/public/case-proposal-accept");
  expect(JSON.parse(tokenRequest[1].body).action).toBe("proposal_accept");
  expect(JSON.parse(acceptRequest[1].body)).toEqual(expect.objectContaining({
    action_token: "b".repeat(64),
    offer_id: "offer-management",
    communication_mode: "client_sends"
  }));
  expect(await screen.findByText(/Pago pendiente/)).toBeInTheDocument();
});

test("acceptance hides raw HTML route errors behind a controlled message", async () => {
  apiRequest
    .mockResolvedValueOnce(v2OffersLookup)
    .mockRejectedValueOnce(Object.assign(new Error("<!DOCTYPE html><pre>Cannot POST /api/public/case-action-token</pre>"), { status: 404 }));

  render(<CaseLookup />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "cliente@example.test" } });
  fireEvent.change(document.getElementById("lookup-case-id"), { target: { value: "RFA-TEST01" } });
  fireEvent.click(screen.getByRole("button", { name: "Ver seguimiento" }));
  fireEvent.click(await screen.findByRole("button", { name: /Elegir esta opci/ }));
  fireEvent.click(screen.getByRole("button", { name: "Aceptar propuesta" }));

  expect(await screen.findByText(/No pudimos aceptar la propuesta/)).toBeInTheDocument();
  expect(screen.queryByText(/Cannot POST/)).not.toBeInTheDocument();
});

test("v2 follow-up displays the derived stage without repeating status metadata", async () => {
  apiRequest.mockResolvedValueOnce({
    ...v2OffersLookup,
    case: { ...v2OffersLookup.case, operational_stage: "Falta información" },
    updates: [
      {
        id: "update-needs-info",
        estado: "needs_information",
        mensaje: "Necesitamos el resumen de cuenta de marzo.",
        visibility: "public",
        created_at: "2026-10-21T12:00:00.000Z"
      },
      {
        id: "internal-update",
        estado: "completed",
        mensaje: "El expediente se marcó como finalizado internamente.",
        visibility: "rfa_internal",
        created_at: "2026-10-21T12:01:00.000Z"
      }
    ]
  });

  render(<CaseLookup />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "cliente@example.test" } });
  fireEvent.change(screen.getByLabelText("Número de caso"), { target: { value: "RFA-TEST01" } });
  fireEvent.click(screen.getByRole("button", { name: "Ver seguimiento" }));

  await screen.findByText(/Estado actual:/);
  expect(screen.getByText("Falta información")).toBeInTheDocument();
  expect(screen.getByText("Necesitamos el resumen de cuenta de marzo.")).toBeInTheDocument();
  expect(screen.queryByText("El expediente se marcó como finalizado internamente.")).not.toBeInTheDocument();
  expect(screen.queryByText(/Estado: Falta información/)).not.toBeInTheDocument();
});

test("v2 payment-pending client can upload a receipt from lookup", async () => {
  const paymentLookup = {
    case: {
      ...v2OffersLookup.case,
      commercial_status: "payment_pending",
      proposal: {
        service_code: "professional-folder",
        amount: 12000,
        currency: "ARS",
        scope: "Organización documental",
        status: "payment_pending"
      },
      payment_receipt_uploaded_at: null
    },
    service_offers: [],
    updates: [],
    conversation: { enabled: false }
  };
  apiRequest
    .mockResolvedValueOnce(paymentLookup)
    .mockResolvedValueOnce({ token: "c".repeat(64), expires_at: "2026-10-21T12:15:00.000Z" })
    .mockResolvedValueOnce({ message: "Comprobante cargado correctamente." })
    .mockResolvedValueOnce(paymentLookup);

  render(<CaseLookup />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "cliente@example.test" } });
  fireEvent.change(screen.getByLabelText("Número de caso"), { target: { value: "RFA-TEST01" } });
  fireEvent.click(screen.getByRole("button", { name: "Ver seguimiento" }));
  const file = new File(["test receipt"], "comprobante.pdf", { type: "application/pdf" });
  fireEvent.change(await screen.findByLabelText("Comprobante"), { target: { files: [file] } });
  fireEvent.click(screen.getByRole("button", { name: "Subir comprobante" }));

  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith("/public/case-action-token", expect.objectContaining({
    method: "POST",
    body: JSON.stringify({ identifier: "cliente@example.test", case_id: "RFA-TEST01", action: "payment_receipt" })
  })));
  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith("/public/case-payment-receipt", expect.objectContaining({ method: "POST" })));
  const uploadRequest = apiRequest.mock.calls.find(([url]) => url === "/public/case-payment-receipt");
  expect(uploadRequest[1].body.get("action_token")).toBe("c".repeat(64));
  expect(screen.queryByText(/abrí el enlace seguro para comprobantes/i)).not.toBeInTheDocument();
});
