import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "./Dashboard";
import { apiRequest } from "@/lib/api";

jest.mock("@/lib/api", () => ({
  apiRequest: jest.fn()
}));

const makeCase = (overrides = {}) => ({
  id: "case-1",
  case_code: "RFA-TEST01",
  nombre_completo: "Persona de prueba",
  email_contacto: "persona@example.test",
  entidad: "Proveedor de prueba",
  categoria: "Compra no entregada",
  estado: "received",
  service_code: "analysis",
  plan_elegido: "analysis",
  commercial_status: "analysis",
  commercial_flow_version: 2,
  prioridad: "Pendiente",
  riesgo: "Pendiente",
  created_at: "2026-10-20T12:00:00.000Z",
  updated_at: "2026-10-20T12:00:00.000Z",
  ...overrides
});

async function openCase(caseItem) {
  localStorage.setItem("rfa_token", "test-token");
  apiRequest.mockImplementation(async (url, options = {}) => {
    if (url === "/me") return { id: "admin-1", email: "admin@example.test", role: "admin" };
    if (url === "/cases") return [caseItem];
    if (url === "/enterprise" || url === "/enterprise-users") return [];
    if (url === "/cases/" + caseItem.id) return { ...caseItem, service_offers: caseItem.service_offers || [] };
    if (url === "/cases/" + caseItem.id + "/updates" && options.method === "POST") {
      const payload = JSON.parse(options.body);
      return {
        update: { id: "update-1", ...payload, visibility: payload.message_visibility || "rfa_internal" },
        case: { ...caseItem, ...payload, operational_stage: "En análisis" }
      };
    }
    if (url === "/cases/" + caseItem.id + "/updates") return [];
    throw new Error("Unexpected request: " + url);
  });

  render(<MemoryRouter initialEntries={["/panel"]}><Dashboard /></MemoryRouter>);
  await screen.findByText(caseItem.case_code);
  if (!caseItem.enterprise_user_id && Number(caseItem.commercial_flow_version) >= 2) {
    expect(screen.queryByText(/R: Pendiente/)).not.toBeInTheDocument();
  }
  fireEvent.click(screen.getByRole("button", { name: /Abrir/ }));
  await screen.findByText("Volver a casos");
}

async function renderAdminCases(caseItems) {
  localStorage.setItem("rfa_token", "test-token");
  apiRequest.mockImplementation(async (url) => {
    if (url === "/me") return { id: "admin-1", email: "admin@example.test", role: "admin" };
    if (url === "/cases") return caseItems;
    if (url === "/enterprise" || url === "/enterprise-users") return [];
    throw new Error("Unexpected request: " + url);
  });

  render(<MemoryRouter initialEntries={["/panel"]}><Dashboard /></MemoryRouter>);
  await screen.findByText(caseItems[0].case_code);
}

describe("admin Dashboard case flow controls", () => {
  beforeEach(() => {
    localStorage.clear();
    apiRequest.mockReset();
  });

  test("new individual analysis case hides legacy selectors and risk", async () => {
    await openCase(makeCase());

    fireEvent.click(screen.getByRole("button", { name: "Gestion" }));
    expect(screen.queryByLabelText("Estado operativo")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Iniciar análisis" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Solicitar información" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Riesgo")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Comercial" }));
    expect(screen.getByText("Opciones para este caso")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publicar opciones" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Situacion comercial")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Modalidad de comunicaciones")).not.toBeInTheDocument();
  });

  test("analysis action is internal and does not publish an advance to the client", async () => {
    const item = makeCase();
    await openCase(item);
    fireEvent.click(screen.getByRole("button", { name: "Gestion" }));
    fireEvent.click(screen.getByRole("button", { name: "Iniciar análisis" }));

    expect(await screen.findByText("Acción registrada como actividad interna de RFA.")).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith("/cases/" + item.id + "/updates", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        estado: "in_analysis",
        mensaje: "Se inició el análisis interno del expediente.",
        message_visibility: "rfa_internal"
      })
    }));
    fireEvent.click(screen.getByRole("button", { name: "Actividad" }));
    expect(await screen.findByText("Interna RFA · Solo RFA")).toBeInTheDocument();
    expect(screen.queryByText("Visible al cliente")).not.toBeInTheDocument();
  });

  test("requesting information requires custom text and explicitly publishes only that text", async () => {
    const item = makeCase();
    await openCase(item);
    fireEvent.click(screen.getByRole("button", { name: "Gestion" }));
    fireEvent.click(screen.getByRole("button", { name: "Solicitar información" }));

    expect(apiRequest).not.toHaveBeenCalledWith("/cases/" + item.id + "/updates", expect.objectContaining({ method: "POST" }));
    const sendButton = screen.getByRole("button", { name: "Enviar solicitud al cliente" });
    expect(sendButton).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "Información solicitada al cliente" }), {
      target: { value: "Por favor, adjuntá el resumen de cuenta de marzo." }
    });
    fireEvent.click(sendButton);

    expect(await screen.findByText("Solicitud enviada y registrada en los avances del cliente.")).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith("/cases/" + item.id + "/updates", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        estado: "needs_information",
        mensaje: "Por favor, adjuntá el resumen de cuenta de marzo.",
        message_visibility: "public"
      })
    }));
  });

  test("a public advance is recorded only after RFA writes and saves its message", async () => {
    const item = makeCase();
    await openCase(item);
    fireEvent.click(screen.getByRole("button", { name: "Actividad" }));
    fireEvent.change(screen.getByPlaceholderText("Solo este texto sera visible en Consultar caso"), {
      target: { value: "Ya revisamos la documentación que enviaste." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios del caso" }));

    expect(await screen.findByText("Visible al cliente")).toBeInTheDocument();
    const updateCall = apiRequest.mock.calls.find(([url, options]) => url === "/cases/" + item.id + "/updates" && options?.method === "POST");
    expect(JSON.parse(updateCall[1].body)).toEqual(expect.objectContaining({
      mensaje: "Ya revisamos la documentación que enviaste.",
      message_visibility: "public"
    }));
  });

  test("published new-flow options are read-only while awaiting the client", async () => {
    const item = makeCase({
      commercial_status: "proposal_sent",
      service_code: "rfa-management",
      published_offer_count: 1,
      service_offers: [{
        id: "offer-1",
        service_code: "rfa-management",
        quoted_amount: 12000,
        quoted_currency: "ARS",
        quoted_scope: "Alcance publicado",
        available_communication_modes: ["client_sends"],
        status: "published"
      }]
    });
    await openCase(item);

    fireEvent.click(screen.getByRole("button", { name: "Comercial" }));
    expect(screen.getByText("Opciones publicadas")).toBeInTheDocument();
    expect(screen.getByText("Esperando elección del cliente.")).toBeInTheDocument();
    expect(screen.getByText("Alcance publicado")).toBeInTheDocument();
    expect(screen.queryByText("Opciones para este caso")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publicar opciones" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Generar enlace para aceptar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Generar enlace para comprobante" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Situacion comercial")).not.toBeInTheDocument();
  });

  test("historical individual case keeps manual action links", async () => {
    await openCase(makeCase({
      commercial_flow_version: 1,
      commercial_status: "proposal_sent",
      service_code: "rfa-management",
      quoted_amount: 25000,
      quoted_scope: "Alcance histórico"
    }));

    fireEvent.click(screen.getByRole("button", { name: "Comercial" }));
    expect(screen.getByRole("button", { name: "Generar enlace para aceptar" })).toBeInTheDocument();
  });

  test("enterprise risk and priority controls remain available", async () => {
    const item = makeCase({
      id: "enterprise-case-1",
      case_code: "RFA-EMP001",
      enterprise_user_id: "enterprise-1",
      enterprise_email: "empresa@example.test",
      commercial_flow_version: 1
    });
    await openCase(item);

    fireEvent.click(screen.getByRole("button", { name: "Gestion" }));
    expect(screen.getByLabelText("Estado operativo")).toBeInTheDocument();
    expect(screen.getByLabelText("Prioridad")).toBeInTheDocument();
    expect(screen.getByLabelText("Riesgo")).toBeInTheDocument();
  });

  test("historical individual case keeps legacy commercial controls", async () => {
    await openCase(makeCase({ commercial_flow_version: 1 }));

    fireEvent.click(screen.getByRole("button", { name: "Gestion" }));
    expect(screen.getByLabelText("Estado operativo")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Comercial" }));
    expect(screen.getByLabelText("Servicio")).toBeInTheDocument();
    expect(screen.getByLabelText("Situacion comercial")).toBeInTheDocument();
    expect(screen.getByLabelText("Modalidad de comunicaciones")).toBeInTheDocument();
  });

  test("offer drafts stay local through global save and publish together from the commercial tab", async () => {
    const item = makeCase();
    let publishedOffers = [];
    apiRequest.mockImplementation(async (url, options = {}) => {
      if (url === "/me") return { id: "admin-1", email: "admin@example.test", role: "admin" };
      if (url === "/cases") return [item];
      if (url === "/enterprise" || url === "/enterprise-users") return [];
      if (url === "/cases/" + item.id) return { ...item, service_offers: [] };
      if (url === "/cases/" + item.id + "/updates") return [];
      if (url === "/cases/" + item.id + "/service-offers") {
        publishedOffers = JSON.parse(options.body).offers;
        return {
          offers: publishedOffers.map((offer, index) => ({ ...offer, id: `offer-${index}`, status: "published" })),
          case: { ...item, commercial_status: "proposal_sent", operational_stage: "Opciones disponibles", published_offer_count: publishedOffers.length }
        };
      }
      throw new Error("Unexpected request: " + url);
    });

    localStorage.setItem("rfa_token", "test-token");
    render(<MemoryRouter initialEntries={["/panel"]}><Dashboard /></MemoryRouter>);
    await screen.findByText(item.case_code);
    fireEvent.click(screen.getByRole("button", { name: /Abrir/ }));
    await screen.findByText("Volver a casos");
    fireEvent.click(screen.getByRole("button", { name: "Comercial" }));

    const folder = screen.getByRole("checkbox", { name: "Carpeta Profesional" });
    const management = screen.getByRole("checkbox", { name: "Gestión RFA" });
    fireEvent.click(folder);
    fireEvent.click(management);
    const prices = screen.getAllByLabelText("Precio");
    const scopes = screen.getAllByLabelText("Alcance");
    fireEvent.change(prices[0], { target: { value: "25000" } });
    fireEvent.change(prices[1], { target: { value: "45000" } });
    fireEvent.change(scopes[0], { target: { value: "Carpeta estructurada" } });
    fireEvent.change(scopes[1], { target: { value: "Preparación y seguimiento" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /RFA gestiona las comunicaciones/ }));

    expect(screen.queryByRole("button", { name: "Guardar cambios" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Resumen" }));
    const globalSave = await screen.findByRole("button", { name: "Guardar cambios" });
    fireEvent.click(globalSave);
    expect(apiRequest).not.toHaveBeenCalledWith("/cases/" + item.id + "/service-offers", expect.anything());
    expect(apiRequest).not.toHaveBeenCalledWith("/cases/" + item.id + "/updates", expect.objectContaining({ method: "POST" }));

    fireEvent.click(screen.getByRole("button", { name: "Comercial" }));
    expect(screen.getByRole("checkbox", { name: "Carpeta Profesional" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Gestión RFA" })).toBeChecked();
    expect(screen.getAllByLabelText("Precio")[0]).toHaveValue(25000);
    expect(screen.getAllByLabelText("Precio")[1]).toHaveValue(45000);

    fireEvent.click(screen.getByRole("button", { name: "Publicar opciones" }));
    expect(await screen.findByText("Opciones publicadas")).toBeInTheDocument();
    expect(screen.getAllByText("Opciones disponibles").length).toBeGreaterThanOrEqual(2);
    expect(publishedOffers).toHaveLength(2);
    expect(publishedOffers.map((offer) => offer.service_code)).toEqual(["professional-folder", "rfa-management"]);
    expect(screen.getByText("Esperando elección del cliente.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publicar opciones" })).not.toBeInTheDocument();
  });

  test("incomplete enabled offer shows an error without sending a partial publication", async () => {
    const item = makeCase();
    await openCase(item);
    fireEvent.click(screen.getByRole("button", { name: "Comercial" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Carpeta Profesional" }));

    fireEvent.click(screen.getByRole("button", { name: "Publicar opciones" }));

    expect(await screen.findByText("Completá un precio válido, moneda y alcance para cada opción habilitada.")).toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalledWith("/cases/" + item.id + "/service-offers", expect.anything());
  });

  test("enterprise access generator is visible only in the admin Empresas view", async () => {
    await openCase(makeCase());

    expect(screen.queryByRole("heading", { name: "Generar usuario empresa" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Empresas" }));
    expect(await screen.findByRole("heading", { name: "Generar usuario empresa" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Personas" }));
    expect(screen.queryByRole("heading", { name: "Generar usuario empresa" })).not.toBeInTheDocument();
  });

  test("admin can create an enterprise-only account and view its credentials once", async () => {
    const item = makeCase();
    apiRequest.mockImplementation(async (url, options = {}) => {
      if (url === "/me") return { id: "admin-1", email: "admin@example.test", role: "admin" };
      if (url === "/cases") return [item];
      if (url === "/enterprise") return [];
      if (url === "/enterprise-users" && options.method === "POST") {
        return {
          user: { id: "enterprise-2", email: "acme@example.test", role: "enterprise" },
          generated_password: "StrongGenerated123"
        };
      }
      if (url === "/enterprise-users") return [];
      throw new Error("Unexpected request: " + url);
    });
    localStorage.setItem("rfa_token", "test-token");
    render(<MemoryRouter initialEntries={["/panel"]}><Dashboard /></MemoryRouter>);
    await screen.findByText(item.case_code);
    fireEvent.click(screen.getByRole("button", { name: "Empresas" }));

    fireEvent.change(screen.getByRole("textbox", { name: "Email del usuario empresa" }), {
      target: { value: "acme@example.test" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Generar usuario empresa" }));

    expect(await screen.findByText("StrongGenerated123")).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith("/enterprise-users", {
      method: "POST",
      body: JSON.stringify({ email: "acme@example.test", password: undefined })
    });

    fireEvent.click(screen.getByRole("button", { name: "Personas" }));
    expect(screen.queryByText("StrongGenerated123")).not.toBeInTheDocument();
  });

  test("existing enterprise access is shown and duplicate creation is disabled", async () => {
    const item = makeCase();
    apiRequest.mockImplementation(async (url) => {
      if (url === "/me") return { id: "admin-1", email: "admin@example.test", role: "admin" };
      if (url === "/cases") return [item];
      if (url === "/enterprise") return [];
      if (url === "/enterprise-users") return [{ id: "enterprise-1", email: "acme@example.test" }];
      throw new Error("Unexpected request: " + url);
    });
    localStorage.setItem("rfa_token", "test-token");
    render(<MemoryRouter initialEntries={["/panel"]}><Dashboard /></MemoryRouter>);
    await screen.findByText(item.case_code);
    fireEvent.click(screen.getByRole("button", { name: "Empresas" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Email del usuario empresa" }), {
      target: { value: "ACME@example.test" }
    });

    expect(screen.getByText(/Ya existe un acceso de empresa para acme@example.test/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generar usuario empresa" })).toBeDisabled();
  });

  test("summary indicators use the selected complete case context and preserve their predicates", async () => {
    const items = [
      makeCase({ id: "p-active", case_code: "RFA-P001", documentacion_estado: "completa" }),
      makeCase({
        id: "p-attention",
        case_code: "RFA-P002",
        service_code: "rfa-management",
        plan_elegido: "rfa-management",
        prioridad: "Alta",
        documentacion_estado: "parcial"
      }),
      makeCase({
        id: "p-closed",
        case_code: "RFA-P003",
        estado: "completed",
        service_code: "rfa-management",
        plan_elegido: "rfa-management",
        documentacion_estado: "completa"
      }),
      makeCase({
        id: "e-active",
        case_code: "RFA-E001",
        enterprise_user_id: "enterprise-1",
        documentacion_estado: "completa"
      }),
      makeCase({
        id: "e-attention",
        case_code: "RFA-E002",
        enterprise_user_id: "enterprise-1",
        riesgo: "Crítico",
        documentacion_estado: "completa"
      }),
      makeCase({
        id: "e-closed",
        case_code: "RFA-E003",
        enterprise_user_id: "enterprise-1",
        estado: "completed",
        documentacion_estado: "parcial"
      })
    ];
    await renderAdminCases(items);

    const count = (label) => {
      const labelNode = screen.getByText(label);
      return within(labelNode.closest("button")).getByText(/^\d+$/).textContent;
    };
    const view = (label) => within(screen.getByRole("navigation", { name: "Vistas de casos" }))
      .getByRole("button", { name: label });

    expect([count("Activos"), count(/Requieren atenci/), count(/Documentaci/), count("Cerrados"), count("Nuevos")])
      .toEqual(["4", "2", "2", "2", "1"]);

    fireEvent.click(view("Personas"));
    expect([count("Activos"), count(/Requieren atenci/), count(/Documentaci/), count("Cerrados"), count("Nuevos")])
      .toEqual(["2", "1", "1", "1", "1"]);

    fireEvent.click(view("Empresas"));
    expect([count("Activos"), count(/Requieren atenci/), count(/Documentaci/), count("Cerrados"), count("Nuevos")])
      .toEqual(["2", "1", "1", "1", "0"]);

    fireEvent.click(view(/Atenci/));
    expect([count("Activos"), count(/Requieren atenci/), count(/Documentaci/), count("Cerrados"), count("Nuevos")])
      .toEqual(["2", "2", "1", "0", "0"]);

    fireEvent.click(view("Cerrados"));
    expect([count("Activos"), count(/Requieren atenci/), count(/Documentaci/), count("Cerrados"), count("Nuevos")])
      .toEqual(["0", "0", "1", "2", "0"]);
  });
});
