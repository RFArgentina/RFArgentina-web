import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { apiRequest } from "@/lib/api";
import CaseConversations from "@/components/CaseConversations";
import { escapeCsvCell } from "@/lib/csv";
import { clearToken, getToken } from "@/lib/auth";
import { formatDateAr, formatDateTimeAr } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import {
  analysisService,
  getServiceDisplayName,
  historicalPlans,
  plans
} from "@/data/plans";
import {
  commercialStatusOptions,
  formatQuotedAmount,
  getCaseServiceValue,
  getCommercialStatusLabel,
  getEffectiveCommercialStatus,
  getOperationalStatusLabel,
  operationalStatusOptions
} from "@/data/caseModel";

const PUBLIC_INTAKE_EMAIL = "intake.publico@rfargentina.com";
const PUBLIC_CASE_ATTACHMENT_MAX_FILES = 5;
const PUBLIC_CASE_ATTACHMENT_MAX_FILE_BYTES = 25 * 1024 * 1024;
const PUBLIC_CASE_ATTACHMENT_MAX_TOTAL_BYTES = 50 * 1024 * 1024;
const PUBLIC_CASE_ATTACHMENT_TYPES = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain"
};
const publicCaseCategories = [
  "Compra no entregada",
  "Producto defectuoso o distinto al ofrecido",
  "Garantía incumplida",
  "Devolución o reintegro pendiente",
  "Cobro indebido o duplicado",
  "Baja o cancelación que continúa facturándose",
  "Transferencia o pago con inconvenientes",
  "Servicio o suscripción",
  "Problema con seguro",
  "Problema con viaje o turismo",
  "Otro problema"
];

const isNewAdminCase = (caseItem) =>
  !caseItem.enterprise_user_id && caseItem.service_code === analysisService.code;

const emptyServiceOfferDrafts = () => ({
  "professional-folder": { enabled: false, quoted_amount: "", quoted_currency: "ARS", quoted_scope: "", available_communication_modes: [] },
  "rfa-management": { enabled: false, quoted_amount: "", quoted_currency: "ARS", quoted_scope: "", available_communication_modes: [] }
});

const serviceOfferDraftsFromOffers = (offers = []) => {
  const drafts = emptyServiceOfferDrafts();
  (offers || []).filter((offer) => offer.status === "published").forEach((offer) => {
    if (!drafts[offer.service_code]) return;
    drafts[offer.service_code] = {
      enabled: true,
      quoted_amount: String(offer.quoted_amount || ""),
      quoted_currency: offer.quoted_currency || "ARS",
      quoted_scope: offer.quoted_scope || "",
      available_communication_modes: offer.available_communication_modes || []
    };
  });
  return drafts;
};

function validatePublicCaseAttachments(files) {
  if (files.length > PUBLIC_CASE_ATTACHMENT_MAX_FILES) {
    return `Podés adjuntar hasta ${PUBLIC_CASE_ATTACHMENT_MAX_FILES} archivos. Seleccionaste ${files.length}.`;
  }

  let totalBytes = 0;
  for (const file of files) {
    const extension = `.${String(file.name || "").split(".").pop()}`.toLowerCase();
    if (!PUBLIC_CASE_ATTACHMENT_TYPES[extension] || PUBLIC_CASE_ATTACHMENT_TYPES[extension] !== file.type.toLowerCase()) {
      return `El archivo "${file.name}" tiene un formato no permitido. Usá PDF, PNG, JPG/JPEG, DOC, DOCX o TXT.`;
    }
    if (file.size > PUBLIC_CASE_ATTACHMENT_MAX_FILE_BYTES) {
      return `El archivo "${file.name}" supera el límite de 25 MB.`;
    }
    totalBytes += file.size;
    if (totalBytes > PUBLIC_CASE_ATTACHMENT_MAX_TOTAL_BYTES) {
      return `Los archivos seleccionados superan el límite total de 50 MB; revisá "${file.name}".`;
    }
  }

  return "";
}

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = getToken();
  const isPublicCreateMode = !token && location.pathname === "/crear-caso";
  const isCreateCasePage = location.pathname === "/crear-caso";
  const [cases, setCases] = useState([]);
  const [user, setUser] = useState(null);
  const [categoria, setCategoria] = useState("");
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [dniCuit, setDniCuit] = useState("");
  const [emailContacto, setEmailContacto] = useState("");
  const [telefono, setTelefono] = useState("");
  const [entidad, setEntidad] = useState("");
  const [tipoEntidad, setTipoEntidad] = useState("");
  const [montoValor, setMontoValor] = useState("");
  const [montoEscala, setMontoEscala] = useState("");
  const [montoMoneda, setMontoMoneda] = useState("ARS");
  const [relato, setRelato] = useState("");
  const [autorizacion, setAutorizacion] = useState(false);
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [aceptaPrivacidad, setAceptaPrivacidad] = useState(false);
  const [adjuntos, setAdjuntos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [publicActionLink, setPublicActionLink] = useState(null);
  const [creatingPublicActionLink, setCreatingPublicActionLink] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updates, setUpdates] = useState({});
  const [expandedCaseId, setExpandedCaseId] = useState(null);
  const [adminDetailTab, setAdminDetailTab] = useState("summary");
  const [expandedInquiryId, setExpandedInquiryId] = useState(null);
  const [infoPlanId, setInfoPlanId] = useState(null);
  const [enterpriseInquiries, setEnterpriseInquiries] = useState([]);
  const [enterpriseUsers, setEnterpriseUsers] = useState([]);
  const [newEnterpriseEmail, setNewEnterpriseEmail] = useState("");
  const [newEnterprisePassword, setNewEnterprisePassword] = useState("");
  const [creatingEnterpriseUser, setCreatingEnterpriseUser] = useState(false);
  const [generatedEnterpriseCredentials, setGeneratedEnterpriseCredentials] = useState(null);
  const [copiedCredentials, setCopiedCredentials] = useState(false);
  const [selectedEnterpriseUserId, setSelectedEnterpriseUserId] = useState("");
  const [importFiles, setImportFiles] = useState([]);
  const [importSummary, setImportSummary] = useState(null);
  const [importing, setImporting] = useState(false);
  const [enterpriseStatusDrafts, setEnterpriseStatusDrafts] = useState({});
  const [enterprisePriorityDrafts, setEnterprisePriorityDrafts] = useState({});
  const [enterpriseInternalNotesDrafts, setEnterpriseInternalNotesDrafts] = useState({});
  const [enterpriseSearchQuery, setEnterpriseSearchQuery] = useState("");
  const [enterpriseFilterStatus, setEnterpriseFilterStatus] = useState("");
  const [enterpriseFilterPriority, setEnterpriseFilterPriority] = useState("");
  const [enterpriseRetentionChoice, setEnterpriseRetentionChoice] = useState("manual");
  const [enterpriseRetentionSaved, setEnterpriseRetentionSaved] = useState(null);
  const [savingRetention, setSavingRetention] = useState(false);
  const [expandedEnterpriseCaseDetailId, setExpandedEnterpriseCaseDetailId] = useState(null);
  const [enterpriseColumnWidths, setEnterpriseColumnWidths] = useState({
    codigo: 150,
    consulta: 220,
    tipo: 180,
    descripcion: 260,
    estado: 180,
    prioridad: 150,
    riesgo: 130,
    documentacion: 170,
    dias: 120,
    ultima: 190,
    obsEmpresa: 300,
    accion: 160
  });
  const [showNewCaseForm, setShowNewCaseForm] = useState(true);
  const [publicCaseCode, setPublicCaseCode] = useState("");
  const [copiedPublicCaseCode, setCopiedPublicCaseCode] = useState(false);
  const [adminNote, setAdminNote] = useState("");
  const [adminPublicMessage, setAdminPublicMessage] = useState("");
  const [personaV2InfoRequestCaseId, setPersonaV2InfoRequestCaseId] = useState("");
  const [personaV2InfoRequestText, setPersonaV2InfoRequestText] = useState("");
  const [adminStatus, setAdminStatus] = useState("");
  const [adminPriority, setAdminPriority] = useState("");
  const [adminRisk, setAdminRisk] = useState("");
  const [adminServiceCode, setAdminServiceCode] = useState("");
  const [adminQuotedAmount, setAdminQuotedAmount] = useState("");
  const [adminQuotedScope, setAdminQuotedScope] = useState("");
  const [adminCommercialStatus, setAdminCommercialStatus] = useState("");
  const [adminCommunicationMode, setAdminCommunicationMode] = useState("");
  const [adminOfferDrafts, setAdminOfferDrafts] = useState(emptyServiceOfferDrafts);
  const [adminOffersDirty, setAdminOffersDirty] = useState(false);
  const [adminSaveNotice, setAdminSaveNotice] = useState("");
  const [adminCaseSourceFilter, setAdminCaseSourceFilter] = useState("todos");
  const [adminListFilter, setAdminListFilter] = useState("all");
  const [adminEnterpriseFilter, setAdminEnterpriseFilter] = useState("");
  const [adminOnlyUnclassified, setAdminOnlyUnclassified] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterPlan, setFilterPlan] = useState("");
  const [filterMoneda, setFilterMoneda] = useState("");
  const [filterEntidad, setFilterEntidad] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [downloadingReceiptCaseId, setDownloadingReceiptCaseId] = useState(null);
  const [showAdminAdvancedFilters, setShowAdminAdvancedFilters] = useState(false);
  const [adminImportOpen, setAdminImportOpen] = useState(false);
  const loadRequestRef = useRef(null);
  const loadRequestIdRef = useRef(0);

  const statusOptions = operationalStatusOptions;
  const enterpriseStatusOptions = ["Pendiente", "En análisis", "Respondido", "Cerrado"];
  const priorityOptions = ["Pendiente", "Baja", "Media", "Alta", "Crítica"];
  const riskOptions = ["Bajo", "Medio", "Alto", "Crítico"];
  const enterpriseRetentionOptions = [
    { value: "manual", label: "Manual (sin purga automatica)" },
    { value: "30", label: "Eliminar a los 30 días" },
    { value: "60", label: "Eliminar a los 60 días" },
    { value: "90", label: "Eliminar a los 90 días" }
  ];

  const statusTemplates = {
    received: "Caso recibido correctamente. En breve iniciamos el análisis.",
    in_analysis: "Estamos revisando la información y la documentación disponible.",
    needs_information: "Necesitamos información o documentación adicional para continuar.",
    in_progress: "El caso se encuentra en gestión administrativa.",
    completed: "La gestión administrativa fue finalizada.",
    referred: "El caso requiere continuar por otra vía. Te informaremos los próximos pasos.",
    not_applicable: "Con la información disponible, RFA no puede intervenir en este caso."
  };
  const isNewCase = (c) => {
    if (!c) return false;
    return c.estado === "received" || c.estado === "Recibido";
  };

  const educationPosts = [

    {
      id: "bloqueo-cuenta",
      title: "¿Te bloquearon la cuenta o billetera",
      category: "Bancos y billeteras",
      excerpt: "Guardá capturas, comprobantes y fechas. El primer reclamo formal deja un antecedente claro para el seguimiento.",
      checklist: ["Captura del error o bloqueo", "Últimos movimientos", "Reclamo inicial por escrito"]
    },
    {
      id: "consumo-desconocido",
      title: "Consumo desconocido en tarjeta",
      category: "Tarjetas",
      excerpt: "Desconocer rápido y documentar todo evita rechazos por plazos o falta de evidencia.",
      checklist: ["Fecha del consumo", "Número de operación", "Denuncia en canal oficial"]
    },
    {
      id: "plataforma-inversion",
      title: "Problemas para retirar en plataforma",
      category: "Inversiones",
      excerpt: "Compará términos del servicio con la respuesta recibida y pedí constancia de gestión.",
      checklist: ["Términos vigentes", "Solicitud de retiro", "Respuesta de soporte"]
    }
  ];

  const isAdmin = user?.role === "admin";
  const isEnterprise = user?.role === "enterprise";
  const isRfaUser = user?.role === "user";
  const showNewClaimSection = isPublicCreateMode || isRfaUser;

  useEffect(() => {
    if (user?.email) setEmailContacto((current) => current || user.email);
  }, [user?.email]);
  const hasUnsavedChanges = useMemo(() => {
    const hasDraftMap = (obj) => obj && Object.keys(obj).length > 0;
    return (
      hasDraftMap(enterpriseStatusDrafts) ||
      hasDraftMap(enterprisePriorityDrafts) ||
      hasDraftMap(enterpriseInternalNotesDrafts) ||
      Boolean(
        adminNote || adminPublicMessage || adminStatus || adminPriority || adminRisk || adminServiceCode ||
        adminQuotedAmount || adminQuotedScope || adminCommercialStatus || adminCommunicationMode || adminOffersDirty
      )
    );
  }, [
    enterpriseStatusDrafts,
    enterprisePriorityDrafts,
    enterpriseInternalNotesDrafts,
    adminNote,
    adminPublicMessage,
    adminStatus,
    adminPriority,
    adminRisk,
    adminServiceCode,
    adminQuotedAmount,
    adminQuotedScope,
    adminCommercialStatus,
    adminCommunicationMode,
    adminOffersDirty
  ]);
  const casesById = useMemo(() => {
    const map = new Map();
    (cases || []).forEach((c) => {
      if (c?.id) map.set(c.id, c);
    });
    return map;
  }, [cases]);
  const expandedCase = expandedCaseId ? casesById.get(expandedCaseId) : null;
  const isNewCommercialCase = Boolean(
    isAdmin && expandedCase && !expandedCase.enterprise_user_id && Number(expandedCase.commercial_flow_version) >= 2
  );
  const isNewCommercialTab = isNewCommercialCase && adminDetailTab === "commercial";
  const hasAdminCaseEdits = Boolean(
    adminNote || adminPublicMessage || adminStatus || adminPriority || adminRisk || adminServiceCode ||
    adminQuotedAmount || adminQuotedScope || adminCommercialStatus || adminCommunicationMode
  );
  const getDashboardCommercialStatusLabel = (status, caseItem) =>
    !caseItem?.enterprise_user_id && Number(caseItem?.commercial_flow_version) >= 2 && status === "proposal_sent"
      ? "Opciones disponibles"
      : getCommercialStatusLabel(status);
  const getDashboardCaseStageLabel = (caseItem) =>
    !caseItem?.enterprise_user_id && Number(caseItem?.commercial_flow_version) >= 2
      ? caseItem.operational_stage || "Recibido"
      : getOperationalStatusLabel(caseItem?.estado);

  const personaV2OperationalActions = [
    { status: "in_analysis", label: "Iniciar análisis", internalMessage: "Se inició el análisis interno del expediente." },
    { status: "needs_information", label: "Solicitar información", requiresClientMessage: true },
    { status: "completed", label: "Finalizar caso", internalMessage: "El expediente se marcó como finalizado internamente." },
    { status: "not_applicable", label: "Marcar como no corresponde", internalMessage: "El expediente se marcó internamente como no correspondiente." },
    { status: "referred", label: "Registrar derivación", internalMessage: "Se registró internamente la derivación del expediente." }
  ];

  const handlePersonaV2OperationalAction = async (caseItem, status, clientMessage = "") => {
    const action = personaV2OperationalActions.find((item) => item.status === status);
    const isClientCommunication = Boolean(action?.requiresClientMessage);
    const message = isClientCommunication ? String(clientMessage || "").trim() : action?.internalMessage;
    if (!action || !isAdmin || caseItem?.enterprise_user_id || Number(caseItem?.commercial_flow_version) < 2) return;
    if (!message) {
      setError("Escribí qué información necesitás antes de enviar la solicitud.");
      return;
    }
    setSubmitting(true);
    setError("");
    setAdminSaveNotice("");
    try {
      const result = await apiRequest(`/cases/${encodeURIComponent(caseItem.id)}/updates`, {
        method: "POST",
        body: JSON.stringify({
          estado: status,
          mensaje: message,
          message_visibility: isClientCommunication ? "public" : "rfa_internal"
        })
      });
      if (result?.case) {
        setCases((current) => current.map((item) => item.id === caseItem.id ? { ...item, ...result.case } : item));
      }
      if (result?.update) {
        setUpdates((current) => ({
          ...current,
          [caseItem.id]: [result.update, ...(current[caseItem.id] || [])]
        }));
      }
      setAdminSaveNotice(result?.update
        ? isClientCommunication ? "Solicitud enviada y registrada en los avances del cliente." : "Acción registrada como actividad interna de RFA."
        : "La acción ya estaba registrada.");
      if (isClientCommunication) {
        setPersonaV2InfoRequestCaseId("");
        setPersonaV2InfoRequestText("");
      }
    } catch (err) {
      setError(err.message || "No se pudo actualizar la etapa.");
    } finally {
      setSubmitting(false);
    }
  };

  function isAdminClosedCase(caseItem) {
    const status = normalizeCompare(getOperationalStatusLabel(caseItem?.estado));
    return status === "finalizado" || status === "cerrado" || status === "no corresponde";
  }

  function isAdminAttentionCase(caseItem) {
    const priority = normalizeCompare(caseItem?.prioridad);
    const risk = normalizeCompare(caseItem?.riesgo);
    return Boolean(caseItem?.conversation_pending_admin_attention) ||
      Boolean(caseItem?.payment_receipt_pending) ||
      ["alta", "critica", "alto", "critico"].includes(priority) || ["alto", "critico"].includes(risk);
  }

  function getAdminNextStep(caseItem) {
    if (hasPendingConversationReply(caseItem)) return "Revisar nueva respuesta";
    if (caseItem?.payment_receipt_pending) return "Verificar pago";
    const status = getEffectiveCommercialStatus(caseItem);
    if (status === "analysis") return "Revisar caso";
    if (status === "proposal_sent") return Number(caseItem?.published_offer_count || 0) > 0
      ? "Esperando elección del cliente"
      : "Completar opciones para el cliente";
    if (status === "accepted" || status === "payment_pending") return "Esperando comprobante";
    if (status === "paid") return "Gestión activa";
    return "Sin acción pendiente";
  }

  function hasPendingConversationReply(caseItem) {
    return caseItem?.conversation_pending_admin_attention === true ||
      Number(caseItem?.conversation_pending_admin_attention) === 1;
  }

  function isAdminDocumentationPendingCase(caseItem) {
    const status = normalizeCompare(getOperationalStatusLabel(caseItem?.estado));
    const documentation = normalizeCompare(caseItem?.documentacion_estado);
    const normalizedDocumentation = documentation === "completa"
      ? "completa"
      : ["incompleta", "parcial"].includes(documentation)
        ? "parcial"
        : "sin documentacion";
    return status === "falta informacion" || ["parcial", "incompleta", "sin documentacion"].includes(normalizedDocumentation);
  }

  // La carga de casos ya no depende del nombre de un plan comercial.
  const canSubmitCase = true;
  const serviceFilterOptions = useMemo(() => {
    const options = [
      { value: analysisService.code, label: `${analysisService.name} (sin costo)` },
      { value: "Primer contacto (sin cargo)", label: "Primer contacto (sin cargo)" },
      ...plans.map((service) => ({ value: service.code, label: service.name })),
      ...historicalPlans.map((service) => ({ value: service.name, label: `${service.name} (histórico)` }))
    ];
    const seen = new Set(options.map((option) => option.value));
    (cases || []).forEach((caseItem) => {
      const value = getCaseServiceValue(caseItem);
      if (value && !seen.has(value)) {
        options.push({ value, label: getServiceDisplayName(value) || value });
        seen.add(value);
      }
    });
    return options;
  }, [cases]);

  const adminFilteredCases = useMemo(() => {
    if (!isAdmin) return cases;
    const query = searchQuery.trim().toLowerCase();
    return cases.filter((c) => {
      const matchStatus = !filterStatus || c.estado === filterStatus;
      const matchPriority = adminCaseSourceFilter === "rfa" || !filterPriority || normalizeCompare(c.prioridad) === normalizeCompare(filterPriority);
      const matchPlan = !filterPlan || getCaseServiceValue(c) === filterPlan;
      const matchMoneda = !filterMoneda || c.monto_moneda === filterMoneda;
      const entidadText = (c.entidad || "").toLowerCase();
      const matchEntidad = !filterEntidad || entidadText.includes(filterEntidad.toLowerCase());
      const isEnterpriseCase = Boolean(c.enterprise_user_id);
      const matchSource =
        adminCaseSourceFilter === "todos" ||
        (adminCaseSourceFilter === "empresa" && isEnterpriseCase) ||
        (adminCaseSourceFilter === "rfa" && !isEnterpriseCase);
      const caseEnterpriseId = String(c.enterprise_user_id || "");
      const matchEnterprise =
        adminCaseSourceFilter === "rfa" || !adminEnterpriseFilter || caseEnterpriseId === adminEnterpriseFilter;
      const caseRisk = normalizeRiskValue(c.riesgo);
      const isUnclassifiedRisk = !caseRisk || caseRisk === "Pendiente";
      const matchUnclassified = !adminOnlyUnclassified || isUnclassifiedRisk;
      const matchListFilter =
        adminListFilter === "all" ||
        (adminListFilter === "active" && !isAdminClosedCase(c)) ||
        (adminListFilter === "attention" && isAdminAttentionCase(c)) ||
        (adminListFilter === "documentation" && isAdminDocumentationPendingCase(c)) ||
        (adminListFilter === "closed" && isAdminClosedCase(c)) ||
        (adminListFilter === "new" && isNewAdminCase(c));
      if (!query) {
        return (
          matchStatus &&
          matchPriority &&
          matchPlan &&
          matchMoneda &&
          matchEntidad &&
          matchSource &&
          matchEnterprise &&
          matchUnclassified &&
          matchListFilter
        );
      }
      const haystack = [
        c.id,
        c.nombre_completo,
        c.dni_cuit,
        c.email_contacto,
        c.telefono,
        c.entidad,
        c.tipo_entidad,
        c.user_email,
        c.estado,
        getCaseServiceValue(c),
        c.commercial_status
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchSearch = haystack.includes(query);
      return (
        matchStatus &&
        matchPriority &&
        matchPlan &&
        matchMoneda &&
        matchEntidad &&
        matchSource &&
        matchEnterprise &&
        matchUnclassified &&
        matchListFilter &&
        matchSearch
      );
    });
  }, [
    cases,
    filterStatus,
    filterPriority,
    filterPlan,
    filterMoneda,
    filterEntidad,
    searchQuery,
    adminCaseSourceFilter,
    adminListFilter,
    adminEnterpriseFilter,
    adminOnlyUnclassified,
    isAdmin
  ]);

  const sortedCases = useMemo(() => {
    if (!isAdmin) return adminFilteredCases;
    const sorted = [...adminFilteredCases];
    const dir = sortDir === "asc" ? 1 : -1;
    sorted.sort((a, b) => {
      const aClosed = String(a?.estado || "").trim().toLowerCase() === "cerrado";
      const bClosed = String(b?.estado || "").trim().toLowerCase() === "cerrado";
      if (aClosed !== bClosed) return aClosed ? 1 : -1;
      const va = sortKey === "service_code" ? getCaseServiceValue(a) : a[sortKey] ?? "";
      const vb = sortKey === "service_code" ? getCaseServiceValue(b) : b[sortKey] ?? "";
      if (sortKey.includes("at")) {
        return (new Date(va).getTime() - new Date(vb).getTime()) * dir;
      }
      return String(va).localeCompare(String(vb), "es", { sensitivity: "base" }) * dir;
    });
    return sorted;
  }, [adminFilteredCases, sortKey, sortDir, isAdmin]);

  const totalPages = isAdmin ? Math.max(1, Math.ceil(sortedCases.length / pageSize)) : 1;
  const paginatedCases = useMemo(() => {
    if (!isAdmin) return sortedCases;
    const start = (page - 1) * pageSize;
    return sortedCases.slice(start, start + pageSize);
  }, [sortedCases, page, pageSize, isAdmin]);
  const adminPaymentCases = useMemo(
    () => (isAdmin ? sortedCases.filter((c) => c.payment_receipt_filename) : []),
    [sortedCases, isAdmin]
  );

  const visibleCases = isAdmin ? sortedCases : cases;
  const enterpriseVisibleCases = useMemo(() => {
    if (!isEnterprise) return [];
    const query = enterpriseSearchQuery.trim().toLowerCase();
    const filtered = cases.filter((c) => {
      const statusValue = toEnterpriseStatus(c.estado);
      const priorityValue = toEnterprisePriority(c.prioridad);
      const selectedStatus = toEnterpriseStatus(enterpriseFilterStatus);
      const selectedPriority = toEnterprisePriority(enterpriseFilterPriority);
      const matchStatus =
        !enterpriseFilterStatus || normalizeCompare(statusValue) === normalizeCompare(selectedStatus);
      const matchPriority =
        !enterpriseFilterPriority || normalizeCompare(priorityValue) === normalizeCompare(selectedPriority);
      if (!query) return matchStatus && matchPriority;
      const haystack = [
        c.case_code,
        c.nombre_completo,
        c.id,
        c.email_contacto,
        c.dni_cuit,
        c.entidad,
        c.categoria,
        c.detalle
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchStatus && matchPriority && haystack.includes(query);
    });
    return filtered.sort((a, b) => {
      const aClosed = String(a?.estado || "").trim().toLowerCase() === "cerrado";
      const bClosed = String(b?.estado || "").trim().toLowerCase() === "cerrado";
      if (aClosed !== bClosed) return aClosed ? 1 : -1;
      return new Date(b?.updated_at || b?.created_at || 0).getTime() - new Date(a?.updated_at || a?.created_at || 0).getTime();
    });
  }, [cases, enterpriseSearchQuery, enterpriseFilterStatus, enterpriseFilterPriority, isEnterprise]);

  const getStatusBadge = (status) => {
    const map = {
      received: "bg-slate-600/40 text-slate-200",
      in_analysis: "bg-sky-500/30 text-sky-200",
      needs_information: "bg-amber-500/30 text-amber-200",
      in_progress: "bg-blue-500/30 text-blue-200",
      completed: "bg-emerald-500/40 text-emerald-100",
      referred: "bg-violet-500/30 text-violet-200",
      not_applicable: "bg-rose-500/30 text-rose-200",
      "Recibido": "bg-slate-600/40 text-slate-200",
      "En análisis": "bg-sky-500/30 text-sky-200",
      "Documentación solicitada": "bg-amber-500/30 text-amber-200",
      "Viable (pendiente de pago)": "bg-emerald-500/60 text-emerald-100",
      "No viable": "bg-rose-500/40 text-rose-200",
      "Presentado ante entidad": "bg-violet-500/40 text-violet-200",
      "En espera de respuesta": "bg-amber-400/40 text-amber-200",
      "Respuesta recibida": "bg-cyan-500/40 text-cyan-200",
      "Cerrado": "bg-slate-800/70 text-slate-200"
    };
    return map[status] || "bg-white/10 text-slate-300";
  };

  const getPriorityBadge = (priority) => {
    const map = {
      Pendiente: "bg-slate-500/35 text-slate-200",
      Normal: "bg-emerald-500/30 text-emerald-200",
      Alta: "bg-rose-500/40 text-rose-200",
      Crítica: "bg-rose-600/60 text-rose-100",
      // compatibilidad
      Media: "bg-amber-500/40 text-amber-200",
      Baja: "bg-emerald-500/30 text-emerald-200"
    };
    return map[priority] || "bg-white/10 text-slate-300";
  };

  const getStatusBoxClass = (status) => {
    const map = {
      Pendiente: "border-slate-400/50 bg-slate-500/20",
      "En análisis": "border-sky-400/60 bg-sky-500/20",
      Respondido: "border-cyan-400/60 bg-cyan-500/20",
      "Pendiente de revisión": "border-slate-400/50 bg-slate-500/20",
      "En análisis interno": "border-sky-400/60 bg-sky-500/20",
      "Falta documentación": "border-amber-400/60 bg-amber-500/20",
      "A la espera de respuesta de la entidad": "border-violet-400/60 bg-violet-500/20",
      "Observación interna": "border-cyan-400/60 bg-cyan-500/20",
      Resuelto: "border-emerald-400/60 bg-emerald-500/20",
      // compatibilidad
      Recibido: "border-slate-400/50 bg-slate-500/20",
      "En analisis": "border-sky-400/60 bg-sky-500/20",
      "En análisis": "border-sky-400/60 bg-sky-500/20",
      "Pendiente interno": "border-amber-400/60 bg-amber-500/20",
      Cerrado: "border-slate-400/60 bg-slate-500/20"
    };
    return map[status] || "border-white/20 bg-white/5";
  };

  const getPriorityBoxClass = (priority, status) => {
    if (status === "Cerrado") {
      return "border-slate-400/60 bg-slate-500/20";
    }
    const map = {
      Pendiente: "border-slate-400/60 bg-slate-500/20",
      Normal: "border-emerald-400/60 bg-emerald-500/20",
      Alta: "border-rose-400/60 bg-rose-500/20",
      Crítica: "border-rose-500/70 bg-rose-600/30",
      // compatibilidad
      Media: "border-amber-400/60 bg-amber-500/20",
      Baja: "border-emerald-400/60 bg-emerald-500/20"
    };
    return map[priority] || "border-white/20 bg-white/5";
  };

  const getRiskBadge = (risk) => {
    const map = {
      Pendiente: "bg-slate-500/35 text-slate-200",
      Bajo: "bg-emerald-500/25 text-emerald-200",
      Medio: "bg-amber-500/30 text-amber-200",
      Alto: "bg-orange-500/35 text-orange-200",
      Crítico: "bg-rose-600/55 text-rose-100"
    };
    return map[risk] || "bg-white/10 text-slate-300";
  };

  function normalizeRiskValue(value) {
    const v = normalizeCompare(value);
    if (v === "pendiente") return "Pendiente";
    if (v === "bajo") return "Bajo";
    if (v === "medio") return "Medio";
    if (v === "alto") return "Alto";
    if (v === "critico" || v === "critica" || v.includes("critic")) return "Crítico";
    return "";
  }

  const getDocumentationLabel = (value) => {
    const normalized = String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
    if (normalized === "completa") return "Completa";
    if (normalized === "incompleta" || normalized === "parcial") return "Parcial";
    return "Sin documentación";
  };

  const adminSummary = useMemo(() => {
    if (!isAdmin) return [];
    return [
      { label: "Activos", value: cases.filter((caseItem) => !isAdminClosedCase(caseItem)).length, tone: "blue", filter: "active" },
      { label: "Requieren atención", value: cases.filter(isAdminAttentionCase).length, tone: "amber", filter: "attention" },
      { label: "Documentación pendiente", value: cases.filter(isAdminDocumentationPendingCase).length, tone: "gold", filter: "documentation" },
      { label: "Cerrados", value: cases.filter(isAdminClosedCase).length, tone: "slate", filter: "closed" },
      { label: "Nuevos", value: cases.filter(isNewAdminCase).length, tone: "blue", filter: "new", source: "rfa" }
    ];
  }, [cases, isAdmin]);

  function normalizeCompare(value) {
    return String(value || "")
      .replace(/Ã¡/g, "a")
      .replace(/Ã©/g, "e")
      .replace(/Ã­/g, "i")
      .replace(/Ã³/g, "o")
      .replace(/Ãº/g, "u")
      .replace(/Ã±/g, "n")
      .replace(/Ã/g, "a")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
  }

  function toEnterpriseStatus(value) {
    const v = normalizeCompare(value);
    if (!v) return "Pendiente";
    if (v === "pendiente" || v === "pendiente de revision" || v === "recibido" || v === "abierto") return "Pendiente";
    if (v === "en analisis" || v === "en analisis interno" || v.includes("analisis")) return "En análisis";
    if (v === "respondido" || v === "resuelto" || v === "respuesta recibida") return "Respondido";
    if (v === "cerrado") return "Cerrado";
    return String(value || "");
  }

  function toEnterprisePriority(value) {
    const v = normalizeCompare(value);
    if (!v) return "Media";
    if (v === "pendiente") return "Pendiente";
    if (v === "baja") return "Baja";
    if (v === "media" || v === "normal") return "Media";
    if (v === "alta") return "Alta";
    if (v === "critica" || v === "critico" || v.includes("critic")) return "Crítica";
    return String(value || "");
  }


  useEffect(() => {
    if (!token) {
      if (isPublicCreateMode) {
        setLoading(false);
        return;
      }
      // El access token puede no estar disponible tras una recarga; /me
      // permite que apiRequest restaure la sesión mediante refresh-token.
      loadCases();
    } else {
      loadCases();
    }
    return () => {
      loadRequestRef.current?.controller.abort();
    };
  }, [token, isPublicCreateMode, navigate]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__RFA_UNSAVED_CHANGES__ = hasUnsavedChanges;
    }
    const handleBeforeUnload = (event) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (typeof window !== "undefined") {
        window.__RFA_UNSAVED_CHANGES__ = false;
      }
    };
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!isAdmin) return;
    const raw = localStorage.getItem("rfa_admin_filters");
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      setFilterStatus(saved.filterStatus || "");
      setFilterPriority(saved.filterPriority || "");
      setFilterPlan(saved.filterPlan || "");
      setFilterMoneda(saved.filterMoneda || "");
      setFilterEntidad(saved.filterEntidad || "");
      setSearchQuery(saved.searchQuery || "");
      setAdminCaseSourceFilter(saved.adminCaseSourceFilter || "todos");
      setAdminListFilter(saved.adminListFilter || "all");
      setAdminEnterpriseFilter(saved.adminEnterpriseFilter || "");
      setAdminOnlyUnclassified(Boolean(saved.adminOnlyUnclassified));
      setSortKey(saved.sortKey || "created_at");
      setSortDir(saved.sortDir || "desc");
      setPageSize(saved.pageSize || 10);
    } catch {
      localStorage.removeItem("rfa_admin_filters");
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return undefined;
    let active = true;
    const refreshPendingConversations = async () => {
      try {
        const pendingIds = await apiRequest("/admin/conversations/pending");
        if (!active || !Array.isArray(pendingIds)) return;
        const pending = new Set(pendingIds.map(String));
        setCases((current) => {
          let changed = false;
          const next = current.map((caseItem) => {
            if (caseItem.enterprise_user_id) return caseItem;
            const nextValue = pending.has(String(caseItem.id)) ? 1 : 0;
            if (Number(caseItem.conversation_pending_admin_attention || 0) === nextValue) return caseItem;
            changed = true;
            return { ...caseItem, conversation_pending_admin_attention: nextValue };
          });
          return changed ? next : current;
        });
      } catch {
        // A polling failure should not interrupt the admin's current work.
      }
    };
    refreshPendingConversations();
    const intervalId = window.setInterval(refreshPendingConversations, 30000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    if (page !== 1) setPage(1);
  }, [
    filterStatus,
    filterPriority,
    filterPlan,
    filterMoneda,
    filterEntidad,
    searchQuery,
    adminCaseSourceFilter,
    adminEnterpriseFilter,
    adminOnlyUnclassified,
    pageSize,
    sortKey,
    sortDir,
    isAdmin
  ]);

  useEffect(() => {
    if (!isAdmin) return;
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages, isAdmin]);

  useEffect(() => {
    if (!isAdmin || !expandedCaseId) return;
    setAdminDetailTab("summary");
    setAdminNote("");
    setAdminPublicMessage("");
    setPersonaV2InfoRequestCaseId("");
    setPersonaV2InfoRequestText("");
    setAdminStatus("");
    setAdminPriority("");
    setAdminRisk("");
    setAdminServiceCode("");
    setAdminQuotedAmount("");
    setAdminQuotedScope("");
    setAdminCommercialStatus("");
    setAdminCommunicationMode("");
    setAdminSaveNotice("");
  }, [expandedCaseId, isAdmin]);

  const loadCases = async () => {
    loadRequestRef.current?.controller.abort();
    const request = {
      id: ++loadRequestIdRef.current,
      controller: new AbortController(),
      timedOut: false
    };
    loadRequestRef.current = request;
    const timeoutId = window.setTimeout(() => {
      request.timedOut = true;
      request.controller.abort();
    }, 15000);
    setLoading(true);
    setError("");
    try {
      const requestOptions = { signal: request.controller.signal };
      const me = await apiRequest("/me", requestOptions);
      if (loadRequestRef.current?.id !== request.id) return;
      setUser(me);
      const data = await apiRequest("/cases", requestOptions);
      if (loadRequestRef.current?.id !== request.id) return;
      const orderedCases = [...(data || [])].sort((a, b) => {
        const aClosed = String(a?.estado || "").trim().toLowerCase() === "cerrado";
        const bClosed = String(b?.estado || "").trim().toLowerCase() === "cerrado";
        if (aClosed !== bClosed) return aClosed ? 1 : -1;
        return new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime();
      });
      setCases(orderedCases);
      if (me.role === "admin") {
        const inquiries = await apiRequest("/enterprise", requestOptions);
        if (loadRequestRef.current?.id !== request.id) return;
        setEnterpriseInquiries(inquiries || []);
        const enterpriseUsersData = await apiRequest("/enterprise-users", requestOptions);
        if (loadRequestRef.current?.id !== request.id) return;
        setEnterpriseUsers(enterpriseUsersData || []);
      } else if (me.role === "enterprise") {
        const retentionConfig = await apiRequest("/enterprise-retention", requestOptions);
        if (loadRequestRef.current?.id !== request.id) return;
        const mode = retentionConfig?.retention_mode;
        const days = Number(retentionConfig?.retention_days || 0);
        if (mode === "auto" && [30, 60, 90].includes(days)) {
          setEnterpriseRetentionChoice(String(days));
        } else {
          setEnterpriseRetentionChoice("manual");
        }
        setEnterpriseRetentionSaved(retentionConfig || null);
      }
    } catch (err) {
      if (loadRequestRef.current?.id !== request.id) return;
      if (request.timedOut) {
        setError("No se pudo cargar el panel. El servidor no respondió a tiempo. Reintentá.");
      } else if (err.name === "AbortError") {
        return;
      } else if (err.status === 401 || err.status === 403) {
        clearToken();
        setUser(null);
        navigate("/login", { replace: true });
      } else {
        setError(err.message || "No se pudieron cargar los casos.");
      }
    } finally {
      window.clearTimeout(timeoutId);
      if (loadRequestRef.current?.id === request.id) {
        loadRequestRef.current = null;
        setLoading(false);
      }
    }
  };

  const parseServices = (value) => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const parseArray = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const handleToggleEnterpriseCaseDetails = async (caseId) => {
    if (expandedEnterpriseCaseDetailId === caseId) {
      setExpandedEnterpriseCaseDetailId(null);
      return;
    }
    setExpandedEnterpriseCaseDetailId(caseId);
    if (!updates[caseId]) {
      try {
        const data = await apiRequest(`/cases/${caseId}/updates`);
        setUpdates((prev) => ({ ...prev, [caseId]: data || [] }));
      } catch (err) {
        setError(err.message || "No se pudo cargar el historial del caso.");
      }
    }
  };

  const handleDownloadAttachment = async (caseId, file) => {
    const filename = file?.filename;
    if (!filename) return;
    try {
      const token = getToken();
      const baseUrl = process.env.REACT_APP_BACKEND_URL || "";
      const response = await fetch(
        `${baseUrl}/api/cases/${caseId}/files/${encodeURIComponent(filename)}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
      );
      if (!response.ok) {
        throw new Error("No se pudo descargar el archivo");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.originalName || file.filename || "adjunto";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || "Error al descargar adjunto");
    }
  };

  const handleSort = (key) => {
    if (!isAdmin) return;
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const saveFilters = () => {
    const payload = {
      filterStatus,
      filterPriority,
      filterPlan,
      filterMoneda,
      filterEntidad,
      searchQuery,
      adminCaseSourceFilter,
      adminListFilter,
      adminEnterpriseFilter,
      adminOnlyUnclassified,
      sortKey,
      sortDir,
      pageSize
    };
    localStorage.setItem("rfa_admin_filters", JSON.stringify(payload));
  };

  const clearFilters = () => {
    setFilterStatus("");
    setFilterPriority("");
    setFilterPlan("");
    setFilterMoneda("");
    setFilterEntidad("");
    setSearchQuery("");
    setAdminCaseSourceFilter("todos");
    setAdminListFilter("all");
    setAdminEnterpriseFilter("");
    setAdminOnlyUnclassified(false);
  };

  const handleAdminListFilter = (filter, source = "todos") => {
    setAdminListFilter(filter);
    setAdminCaseSourceFilter(source);
    if (source === "rfa") setFilterPriority("");
    setPage(1);
  };

  const generatePublicActionLink = async (caseId, action) => {
    setCreatingPublicActionLink(true);
    setError("");
    setPublicActionLink(null);
    try {
      const result = await apiRequest(`/admin/cases/${encodeURIComponent(caseId)}/public-action-token`, {
        method: "POST",
        body: JSON.stringify({ action })
      });
      setPublicActionLink({ caseId, url: result.url, expiresAt: result.expires_at });
      try { await navigator.clipboard.writeText(result.url); } catch { /* link remains selectable below */ }
    } catch (err) {
      setError(err.message || "No se pudo generar el enlace seguro.");
    } finally {
      setCreatingPublicActionLink(false);
    }
  };

  const exportCsv = () => {
    if (!sortedCases.length) return;
    const headers = [
      "ID",
      "Codigo",
      "Empresa",
      "Cliente",
      "Email",
      "Entidad",
      "Servicio",
      "Estado",
      "Prioridad",
      "Moneda",
      "Escala",
      "Monto",
      "Creado"
    ];
    const rows = sortedCases.map((c) => [
      c.id,
      c.case_code || "",
      c.empresa || c.enterprise_email || "",
      c.nombre_completo || "",
      getCaseContactEmail(c) || "",
      c.entidad || "",
      getServiceDisplayName(getCaseServiceValue(c)) || "",
      c.estado || "",
      c.prioridad || "",
      c.monto_moneda || "",
      c.monto_escala || "",
      c.monto_valor || "",
      c.created_at || ""
    ]);
    const csvBody = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
    // BOM + "sep=," mejora compatibilidad con Excel/Sheets y evita problemas de tildes.
    const csv = `\uFEFFsep=,\r\n${csvBody}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "casos_rfa.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getCaseContactEmail = (caseItem) => {
    const emailContacto = String(caseItem?.email_contacto || "").trim();
    if (emailContacto) return emailContacto;
    const userEmail = String(caseItem?.user_email || "").trim();
    if (!userEmail || userEmail.toLowerCase() === PUBLIC_INTAKE_EMAIL) return "";
    return userEmail;
  };

  const handleDownloadPaymentReceipt = async (caseItem) => {
    if (!caseItem?.id) return;
    setDownloadingReceiptCaseId(caseItem.id);
    try {
      const tokenValue = getToken();
      const apiBase = process.env.REACT_APP_BACKEND_URL ? `${process.env.REACT_APP_BACKEND_URL}/api` : "/api";
      const response = await fetch(`${apiBase}/cases/${encodeURIComponent(caseItem.id)}/payment-receipt`, {
        headers: tokenValue ? { Authorization: `Bearer ${tokenValue}` } : {},
        credentials: "include"
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "No se pudo descargar el comprobante");
      }
      const blob = await response.blob();
      const fileUrl = URL.createObjectURL(blob);
      const downloadName = caseItem.payment_receipt_original_name || `comprobante_${caseItem.case_code || caseItem.id}`;
      const link = document.createElement("a");
      link.href = fileUrl;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(fileUrl);
    } catch (err) {
      setError(err.message || "No se pudo descargar el comprobante");
    } finally {
      setDownloadingReceiptCaseId(null);
    }
  };

  const handleDownloadReceiptHistory = async (caseId, receipt) => {
    if (!caseId || !receipt?.id) return;
    setDownloadingReceiptCaseId(caseId);
    setError("");
    try {
      const token = getToken();
      const apiBase = process.env.REACT_APP_BACKEND_URL ? `${process.env.REACT_APP_BACKEND_URL}/api` : "/api";
      const response = await fetch(`${apiBase}/cases/${encodeURIComponent(caseId)}/payment-receipts/${encodeURIComponent(receipt.id)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!response.ok) throw new Error("No se pudo descargar el comprobante.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = receipt.original_filename || `comprobante_${receipt.id}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || "No se pudo descargar el comprobante.");
    } finally {
      setDownloadingReceiptCaseId(null);
    }
  };

  const confirmCasePayment = async (caseId, receiptId) => {
    setSubmitting(true);
    setError("");
    try {
      const result = await apiRequest(`/cases/${encodeURIComponent(caseId)}/payment-confirm`, {
        method: "POST",
        body: JSON.stringify(receiptId ? { receipt_id: receiptId } : {})
      });
      setCases((current) => current.map((item) => item.id === caseId
        ? { ...item, ...(result.case || {}), payment_receipts: result.payment_receipts || item.payment_receipts, payment_receipt_pending: false }
        : item));
      setAdminSaveNotice("Pago confirmado correctamente.");
      await loadCases();
    } catch (err) {
      setError(err.message || "No se pudo confirmar el pago.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCase = async (event) => {
    event.preventDefault();
    if (!String(emailContacto || "").trim()) {
      setError("Debes completar tu correo electrónico para poder consultar el caso luego.");
      return;
    }
    setSubmitting(true);
    setError("");
    setPublicCaseCode("");
    try {
      const formData = new FormData();
      formData.append("categoria", categoria);
      formData.append("nombre_completo", nombreCompleto);
      formData.append("dni_cuit", dniCuit);
      formData.append("email_contacto", emailContacto);
      formData.append("telefono", telefono);
      formData.append("entidad", entidad);
      formData.append("tipo_entidad", tipoEntidad);
      formData.append("monto_valor", montoValor);
      formData.append("monto_escala", montoEscala);
      formData.append("monto_moneda", montoMoneda);
      formData.append("relato", relato);
      formData.append("autorizacion", autorizacion ? "true" : "false");
      formData.append("acepta_terminos", aceptaTerminos ? "true" : "false");
      formData.append("acepta_privacidad", aceptaPrivacidad ? "true" : "false");
      Array.from(adjuntos || []).forEach((file) => formData.append("adjuntos", file));

      const endpoint = isPublicCreateMode ? "/public/cases" : "/cases";
      const created = await apiRequest(endpoint, {
        method: "POST",
        body: formData
      });
      setCategoria("");
      setNombreCompleto("");
      setDniCuit("");
      setEmailContacto("");
      setTelefono("");
      setEntidad("");
      setTipoEntidad("");
      setMontoValor("");
      setMontoEscala("");
      setMontoMoneda("ARS");
      setRelato("");
      setAutorizacion(false);
      setAceptaTerminos(false);
      setAceptaPrivacidad(false);
      setAdjuntos([]);
      if (isPublicCreateMode) {
        setPublicCaseCode(created?.case_code || "");
        setCopiedPublicCaseCode(false);
      } else {
        await loadCases();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const copyPublicCaseCode = async () => {
    if (!publicCaseCode) return;
    try {
      await navigator.clipboard.writeText(publicCaseCode);
      setCopiedPublicCaseCode(true);
    } catch {
      setError("No se pudo copiar automáticamente. Seleccioná y copiá el número de caso.");
    }
  };

  const runImportCases = async (filesToImport) => {
    const targetEnterpriseUserId = isEnterprise ? user?.id : selectedEnterpriseUserId;
    if (!targetEnterpriseUserId) {
      setError("Selecciona un usuario empresa para importar.");
      return false;
    }
    if (!Array.isArray(filesToImport) || filesToImport.length === 0) {
      setError("Debes adjuntar al menos un archivo.");
      return false;
    }
    setImporting(true);
    setError("");
    setImportSummary(null);
    try {
      const formData = new FormData();
      formData.append("enterprise_user_id", targetEnterpriseUserId);
      filesToImport.forEach((file) => formData.append("files", file));
      const result = await apiRequest("/cases/import", {
        method: "POST",
        body: formData
      });
      setImportSummary(result);
      setImportFiles([]);
      await loadCases();
      return true;
    } catch (err) {
      setError(err.message || "No se pudo importar casos.");
      return false;
    } finally {
      setImporting(false);
    }
  };

  const handleImportCases = async (event) => {
    event.preventDefault();
    await runImportCases(importFiles);
  };

  const handleImportFileChange = (event) => {
    const files = Array.from(event.target.files || []);
    const allowedExt = [".csv", ".xlsx"];
    const accepted = files.filter((file) => {
      const name = String(file.name || "").toLowerCase();
      return allowedExt.some((ext) => name.endsWith(ext));
    });
    if (accepted.length !== files.length) {
      setError("Algunos archivos fueron omitidos. Formatos permitidos: CSV y XLSX.");
    } else {
      setError("");
    }
    setImportFiles(accepted);
  };

  const handleCreateEnterpriseUser = async (event) => {
    event.preventDefault();
    if (!newEnterpriseEmail.trim()) {
      setError("Debes ingresar un email para el usuario empresa.");
      return;
    }
    setCreatingEnterpriseUser(true);
    setError("");
    setGeneratedEnterpriseCredentials(null);
    try {
      const result = await apiRequest("/enterprise-users", {
        method: "POST",
        body: JSON.stringify({
          email: newEnterpriseEmail.trim(),
          password: newEnterprisePassword.trim() || undefined
        })
      });
      setGeneratedEnterpriseCredentials({
        email: result?.user?.email || newEnterpriseEmail.trim(),
        password: result?.generated_password || newEnterprisePassword.trim()
      });
      setNewEnterpriseEmail("");
      setNewEnterprisePassword("");
      await loadCases();
    } catch (err) {
      setError(err.message || "No se pudo crear el usuario empresa.");
    } finally {
      setCreatingEnterpriseUser(false);
    }
  };

  const handleCopyEnterpriseCredentials = async () => {
    if (!generatedEnterpriseCredentials) return;
    const payload = [
      `Email: ${generatedEnterpriseCredentials.email}`,
      `Contrasena: ${generatedEnterpriseCredentials.password}`
    ].join("\n");
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = payload;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedCredentials(true);
      setTimeout(() => setCopiedCredentials(false), 1800);
    } catch {
      setError("No se pudieron copiar las credenciales.");
    }
  };

  const handleEnterpriseUpdateCase = async (caseItem) => {
    const caseId = caseItem.id;
    const nextStatus = enterpriseStatusDrafts[caseId];
    const nextPriority = enterprisePriorityDrafts[caseId];
    const nextInternalNotes = enterpriseInternalNotesDrafts[caseId];

    const hasChange =
      nextStatus !== undefined ||
      nextPriority !== undefined ||
      nextInternalNotes !== undefined;
    if (!hasChange) {
      setError("Debes modificar al menos un campo para guardar.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        mensaje: "Actualización interna de empresa.",
        estado: toEnterpriseStatus(nextStatus ?? caseItem.estado ?? "Pendiente"),
        prioridad: toEnterprisePriority(nextPriority ?? caseItem.prioridad ?? "Pendiente"),
        observaciones_empresa: nextInternalNotes ?? caseItem.observaciones_empresa ?? ""
      };
      await apiRequest(`/cases/${caseId}/updates`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      await loadCases();
      setEnterpriseStatusDrafts((prev) => {
        const next = { ...prev };
        delete next[caseId];
        return next;
      });
      setEnterprisePriorityDrafts((prev) => {
        const next = { ...prev };
        delete next[caseId];
        return next;
      });
      setEnterpriseInternalNotesDrafts((prev) => {
        const next = { ...prev };
        delete next[caseId];
        return next;
      });
    } catch (err) {
      setError(err.message || "No se pudo actualizar el caso.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEnterpriseRetention = async () => {
    setSavingRetention(true);
    setError("");
    try {
      const isManual = enterpriseRetentionChoice === "manual";
      const payload = {
        retention_mode: isManual ? "manual" : "auto",
        retention_days: isManual ? null : Number(enterpriseRetentionChoice)
      };
      const saved = await apiRequest("/enterprise-retention", {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      setEnterpriseRetentionSaved(saved || null);
    } catch (err) {
      setError(err.message || "No se pudo guardar la política de purga.");
    } finally {
      setSavingRetention(false);
    }
  };

  const handleSaveAllPendingChanges = async () => {
    if (!hasUnsavedChanges) return;
    if (isAdmin && !hasAdminCaseEdits && !isEnterprise) return;
    setSubmitting(true);
    setError("");
    try {
      if (isEnterprise) {
        const dirtyCaseIds = Array.from(
          new Set([
            ...Object.keys(enterpriseStatusDrafts || {}),
            ...Object.keys(enterprisePriorityDrafts || {}),
            ...Object.keys(enterpriseInternalNotesDrafts || {})
          ])
        );
        for (const caseId of dirtyCaseIds) {
          const caseItem = casesById.get(caseId);
          if (!caseItem) continue;
          const payload = {
            mensaje: "Actualización interna de empresa.",
            estado: enterpriseStatusDrafts[caseId] ?? caseItem.estado ?? "Pendiente",
            prioridad: enterprisePriorityDrafts[caseId] ?? caseItem.prioridad ?? "Pendiente",
            observaciones_empresa:
              enterpriseInternalNotesDrafts[caseId] ?? caseItem.observaciones_empresa ?? ""
          };
          await apiRequest(`/cases/${caseId}/updates`, {
            method: "POST",
            body: JSON.stringify(payload)
          });
        }
        setEnterpriseStatusDrafts({});
        setEnterprisePriorityDrafts({});
        setEnterpriseInternalNotesDrafts({});
      }

      if (isAdmin && expandedCaseId && hasUnsavedChanges) {
        await apiRequest(`/cases/${expandedCaseId}/updates`, {
          method: "POST",
          body: JSON.stringify(buildAdminUpdatePayload())
        });
        setAdminNote("");
        setAdminPublicMessage("");
        setPersonaV2InfoRequestCaseId("");
        setPersonaV2InfoRequestText("");
        setAdminStatus("");
        setAdminPriority("");
        setAdminRisk("");
        setAdminServiceCode("");
        setAdminQuotedAmount("");
        setAdminQuotedScope("");
        setAdminCommercialStatus("");
        setAdminCommunicationMode("");
      }

      await loadCases();
    } catch (err) {
      setError(err.message || "No se pudieron guardar todos los cambios pendientes.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleUpdates = async (caseId) => {
    if (isAdmin && hasUnsavedChanges) {
      setError("Guardá los cambios del caso abierto antes de cerrar o gestionar otro caso.");
      return;
    }
    if (expandedCaseId === caseId) {
      setExpandedCaseId(null);
      return;
    }
    if (isAdmin) {
      setAdminNote("");
      setAdminPublicMessage("");
      setPersonaV2InfoRequestCaseId("");
      setPersonaV2InfoRequestText("");
      setAdminStatus("");
      setAdminPriority("");
      setAdminRisk("");
      setAdminServiceCode("");
      setAdminQuotedAmount("");
      setAdminQuotedScope("");
      setAdminCommercialStatus("");
      setAdminCommunicationMode("");
      setAdminOfferDrafts(emptyServiceOfferDrafts());
      setAdminOffersDirty(false);
      setAdminSaveNotice("");
    }
    setError("");
    setAdminDetailTab("summary");
    setExpandedCaseId(caseId);
    try {
      const caseRequest = isAdmin ? apiRequest(`/cases/${caseId}`) : Promise.resolve(null);
      const updatesRequest = updates[caseId]
        ? Promise.resolve(updates[caseId])
        : apiRequest(`/cases/${caseId}/updates`);
      const [caseData, updatesData] = await Promise.all([caseRequest, updatesRequest]);
      if (caseData) {
        setCases((prev) => prev.map((item) => item.id === caseId ? { ...item, ...caseData } : item));
        setAdminOfferDrafts(serviceOfferDraftsFromOffers(caseData.service_offers || []));
      }
      if (!updates[caseId]) {
        setUpdates((prev) => ({ ...prev, [caseId]: updatesData || [] }));
      }
    } catch (err) {
      setError(err.message || "No se pudo abrir el expediente.");
    }
  };

  const handleLogout = () => {
    clearToken();
    navigate("/");
  };

  const handleAdminUpdate = async (caseId) => {
    setSubmitting(true);
    setError("");
    setAdminSaveNotice("");
    try {
      const result = await apiRequest(`/cases/${caseId}/updates`, {
        method: "POST",
        body: JSON.stringify(buildAdminUpdatePayload())
      });
      setAdminNote("");
      setAdminPublicMessage("");
      setPersonaV2InfoRequestCaseId("");
      setPersonaV2InfoRequestText("");
      setAdminStatus("");
      setAdminPriority("");
      setAdminRisk("");
      setAdminServiceCode("");
      setAdminQuotedAmount("");
      setAdminQuotedScope("");
      setAdminCommercialStatus("");
      setAdminCommunicationMode("");
      if (result?.case) {
        setCases((prev) => prev.map((item) => item.id === caseId ? { ...item, ...result.case } : item));
      }
      if (result?.update) {
        setUpdates((prev) => ({
          ...prev,
          [caseId]: [result.update, ...(prev[caseId] || [])]
        }));
      }
      setAdminSaveNotice("Cambios guardados correctamente.");
    } catch (err) {
      setError(err.message || "No se pudieron guardar los cambios.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSharePost = (post) => {
    const shareText = `${post.title} - ${post.excerpt}`;
    const shareUrl = `${window.location.origin}/panel#educacion-${post.id}`;
    if (navigator.share) {
      navigator
        .share({ title: post.title, text: shareText, url: shareUrl })
        .catch(() => {});
    }
  };

  const startEnterpriseColumnResize = (columnKey, event) => {
    event.preventDefault();
    const startX = event.clientX;
    const initialWidth = enterpriseColumnWidths[columnKey] || 180;
    const minWidth = 100;
    const maxWidth = 700;

    const onMouseMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      const nextWidth = Math.max(minWidth, Math.min(maxWidth, initialWidth + delta));
      setEnterpriseColumnWidths((prev) => ({ ...prev, [columnKey]: nextWidth }));
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const buildAdminUpdatePayload = (caseItem = casesById.get(expandedCaseId)) => {
    const publicMessage = String(adminPublicMessage || "").trim();
    const isNewCommercialFlow = Number(caseItem?.commercial_flow_version) >= 2;
    const payload = {
      mensaje: publicMessage || undefined,
      message_visibility: publicMessage ? "public" : "rfa_internal",
      ...(!isNewCommercialFlow || caseItem?.enterprise_user_id ? { estado: adminStatus || null } : {}),
      observaciones_rfa: adminNote !== "" ? adminNote : undefined
    };
    if (!isNewCommercialFlow || caseItem?.enterprise_user_id) payload.riesgo = adminRisk || null;
    if (caseItem?.enterprise_user_id) payload.prioridad = adminPriority || null;
    if (!isNewCommercialFlow && !caseItem?.enterprise_user_id) {
      Object.assign(payload, {
        service_code: adminServiceCode || undefined,
        quoted_amount: adminQuotedAmount !== "" ? adminQuotedAmount : undefined,
        quoted_scope: adminQuotedScope !== "" ? adminQuotedScope : undefined,
        commercial_status: adminCommercialStatus || undefined,
        communication_mode: adminCommunicationMode === "__unset" ? null : adminCommunicationMode || undefined,
        quoted_currency: adminServiceCode || adminQuotedAmount || adminQuotedScope || adminCommercialStatus ? "ARS" : undefined
      });
    }
    return payload;
  };

  const setServiceOfferDraftValue = (serviceCode, key, value) => {
    setAdminOfferDrafts((current) => ({
      ...current,
      [serviceCode]: { ...current[serviceCode], [key]: value }
    }));
    setAdminOffersDirty(true);
  };

  const publishServiceOffers = async (caseId) => {
    const offers = Object.entries(adminOfferDrafts)
      .filter(([, draft]) => draft.enabled)
      .map(([service_code, draft]) => ({
        service_code,
        quoted_amount: draft.quoted_amount,
        quoted_currency: draft.quoted_currency,
        quoted_scope: draft.quoted_scope,
        available_communication_modes: service_code === "rfa-management" ? draft.available_communication_modes : []
      }));
    if (!offers.length) {
      setError("Habilitá al menos una opción antes de publicar.");
      return false;
    }
    const invalidOffer = offers.find((offer) => {
      const amount = Number(offer.quoted_amount);
      return !Number.isFinite(amount) || amount <= 0 ||
        !["ARS", "USD"].includes(offer.quoted_currency) ||
        !String(offer.quoted_scope || "").trim() ||
        (offer.service_code === "rfa-management" && offer.available_communication_modes.length === 0);
    });
    if (invalidOffer) {
      const message = invalidOffer.service_code === "rfa-management" && !invalidOffer.available_communication_modes.length
        ? "Elegí al menos una modalidad para Gestión RFA."
        : "Completá un precio válido, moneda y alcance para cada opción habilitada.";
      setError(message);
      return false;
    }
    setSubmitting(true);
    setError("");
    setAdminSaveNotice("");
    try {
      const result = await apiRequest(`/cases/${encodeURIComponent(caseId)}/service-offers`, {
        method: "PUT",
        body: JSON.stringify({ offers })
      });
      setCases((current) => current.map((item) => item.id === caseId
        ? { ...item, ...(result.case || {}), service_offers: result.offers || offers.map((offer) => ({ ...offer, status: "published" })) }
        : item));
      setAdminOfferDrafts(serviceOfferDraftsFromOffers(result.offers));
      setAdminOffersDirty(false);
      setAdminSaveNotice("Opciones publicadas correctamente.");
      return true;
    } catch (err) {
      setError(err.message || "No se pudieron publicar las opciones.");
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const renderAdminManagementPanel = (c) => {
    const isEnterpriseCase = Boolean(c.enterprise_user_id);
    const isNewCommercialFlow = !isEnterpriseCase && Number(c.commercial_flow_version) >= 2;
    const currentService = getCaseServiceValue(c) || analysisService.code;
    const currentCommercialStatus = getEffectiveCommercialStatus(c);
    const proposalAlreadyAccepted = Boolean(c.proposal_accepted_at) || ["accepted", "payment_pending", "paid"].includes(currentCommercialStatus);
    const attachments = parseArray(c.adjuntos);

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-amber-200">Expediente</p>
            <h3 className="text-xl font-semibold">{c.case_code || c.id}</h3>
          </div>
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200">
            {isEnterpriseCase ? "Caso empresa" : "Caso particular"}
          </span>
        </div>

        <section className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h4 className="mb-3 text-sm font-semibold text-amber-100">A. Resumen</h4>
          <div className="grid gap-3 text-sm text-slate-300 md:grid-cols-3">
            <div><span className="text-slate-500">Cliente</span><p className="text-slate-100">{c.nombre_completo || "-"}</p></div>
            <div><span className="text-slate-500">DNI/CUIT</span><p className="text-slate-100">{c.dni_cuit || "-"}</p></div>
            <div><span className="text-slate-500">Contacto</span><p className="text-slate-100 break-all">{getCaseContactEmail(c) || c.telefono || "-"}</p></div>
            <div><span className="text-slate-500">Empresa reclamada</span><p className="text-slate-100">{c.entidad || "-"}</p></div>
            <div><span className="text-slate-500">Categoría</span><p className="text-slate-100">{c.categoria || "-"}</p></div>
            <div><span className="text-slate-500">Ingreso</span><p className="text-slate-100">{formatDateTimeAr(c.created_at)}</p></div>
            <div className="md:col-span-3"><span className="text-slate-500">Descripción completa</span><p className="mt-1 whitespace-pre-wrap leading-relaxed text-slate-100">{c.relato || c.detalle || "-"}</p></div>
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h4 className="mb-3 text-sm font-semibold text-amber-100">B. Documentación</h4>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              {attachments.length === 0 && <p className="text-sm text-slate-400">Sin archivos adjuntos.</p>}
              {attachments.map((file) => (
                <div key={file.filename || file.originalName} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 px-3 py-2">
                  <span className="truncate text-xs text-slate-200">{file.originalName || file.filename}</span>
                  <Button className="h-auto bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20" onClick={() => handleDownloadAttachment(c.id, file)}>Descargar</Button>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-white/10 p-3 text-sm text-slate-300">
              <p><span className="text-slate-500">Estado documental:</span> {c.documentacion_estado || "Sin clasificar"}</p>
              <p className="mt-2"><span className="text-slate-500">Comprobante:</span> {c.payment_receipt_uploaded_at ? formatDateTimeAr(c.payment_receipt_uploaded_at) : "No recibido"}</p>
              {c.payment_receipt_filename && (
                <Button className="mt-3 bg-white/10 text-white hover:bg-white/20" onClick={() => handleDownloadPaymentReceipt(c)} disabled={downloadingReceiptCaseId === c.id}>
                  {downloadingReceiptCaseId === c.id ? "Descargando..." : "Descargar comprobante"}
                </Button>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h4 className="mb-3 text-sm font-semibold text-amber-100">C. Análisis RFA</h4>
          <div className="grid gap-3 md:grid-cols-3">
            {!isNewCommercialFlow && <label className="text-xs text-slate-300">Estado operativo
              <select className="mt-1 w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-white" value={adminStatus} onChange={(event) => { const value = event.target.value; setAdminStatus(value); if (!isEnterpriseCase && statusTemplates[value]) setAdminPublicMessage(statusTemplates[value]); }}>
                <option value="">Mantener: {getOperationalStatusLabel(c.estado)}</option>
                {(isEnterpriseCase ? enterpriseStatusOptions.map((label) => ({ code: label, label })) : statusOptions).map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
              </select>
            </label>}
            <label className="text-xs text-slate-300">Prioridad
              <select className="mt-1 w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-white" value={adminPriority} onChange={(event) => setAdminPriority(event.target.value)}>
                <option value="">Mantener: {c.prioridad || "Pendiente"}</option>
                {priorityOptions.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-300">Riesgo
              <select className="mt-1 w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-white" value={adminRisk} onChange={(event) => setAdminRisk(event.target.value)}>
                <option value="">Mantener: {normalizeRiskValue(c.riesgo) || "Sin clasificar"}</option>
                {riskOptions.map((risk) => <option key={risk} value={risk}>{risk}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-300 md:col-span-3">Observación interna RFA
              <textarea className="mt-1 min-h-[110px] w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-white placeholder:text-slate-500" value={adminNote} onChange={(event) => setAdminNote(event.target.value)} placeholder={c.observaciones_rfa || "Solo visible para administración RFA"} />
            </label>
          </div>
        </section>

        {!isEnterpriseCase && (
          <section className="rounded-xl border border-amber-300/25 bg-amber-300/5 p-4">
            <h4 className="mb-1 text-sm font-semibold text-amber-100">D. Servicio / propuesta</h4>
            <p className="mb-3 text-xs text-slate-400">El monto corresponde al precio del servicio RFA, no al importe reclamado.</p>
            <div className="mb-4 grid gap-2 text-sm text-slate-300 md:grid-cols-4">
              <p><span className="text-slate-500">Servicio actual:</span><br />{getServiceDisplayName(currentService)}</p>
              <p><span className="text-slate-500">Precio:</span><br />{formatQuotedAmount(c.quoted_amount, c.quoted_currency)}</p>
              <p><span className="text-slate-500">Situación:</span><br />{getCommercialStatusLabel(currentCommercialStatus)}</p>
              <p><span className="text-slate-500">Propuesta enviada:</span><br />{c.quoted_at ? formatDateTimeAr(c.quoted_at) : "-"}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-xs text-slate-300">Servicio
                <select className="mt-1 w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60" value={adminServiceCode} disabled={proposalAlreadyAccepted} onChange={(event) => setAdminServiceCode(event.target.value)}>
                  <option value="">Mantener: {getServiceDisplayName(currentService)}</option>
                  <option value={analysisService.code}>{analysisService.name}</option>
                  {plans.map((service) => <option key={service.code} value={service.code}>{service.name}</option>)}
                </select>
              </label>
              <label className="text-xs text-slate-300">Precio del servicio (ARS)
                <input type="number" min="1" step="1" className="mt-1 w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60" value={adminQuotedAmount} disabled={proposalAlreadyAccepted} onChange={(event) => setAdminQuotedAmount(event.target.value)} placeholder={c.quoted_amount ? String(c.quoted_amount) : "Ej.: 65000"} />
              </label>
              <label className="text-xs text-slate-300 md:col-span-2">Alcance acordado para este caso
                <textarea className="mt-1 min-h-[120px] w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-white placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-60" value={adminQuotedScope} disabled={proposalAlreadyAccepted} onChange={(event) => setAdminQuotedScope(event.target.value)} placeholder={c.quoted_scope || "Detallá entregables, seguimiento y límites del servicio"} />
              </label>
              <label className="text-xs text-slate-300 md:col-span-2">Situación comercial
                <select className="mt-1 w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-white" value={adminCommercialStatus} onChange={(event) => setAdminCommercialStatus(event.target.value)}>
                  <option value="">Mantener: {getCommercialStatusLabel(currentCommercialStatus)}</option>
                  {commercialStatusOptions.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
                </select>
              </label>
            </div>
          </section>
        )}

        <section className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h4 className="mb-3 text-sm font-semibold text-amber-100">E. Comunicaciones / seguimiento</h4>
          {!isEnterpriseCase && (
            <label className="mb-4 block text-xs text-slate-300">Mensaje público para el cliente
              <textarea className="mt-1 min-h-[100px] w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-white placeholder:text-slate-500" value={adminPublicMessage} onChange={(event) => setAdminPublicMessage(event.target.value)} placeholder="Solo este texto será visible en Consultar caso" />
            </label>
          )}
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {(updates[c.id] || []).length === 0 && <p className="text-sm text-slate-400">Sin actualizaciones registradas.</p>}
            {(updates[c.id] || []).map((update) => (
              <div key={update.id} className="rounded-lg border border-white/10 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-slate-200">{update.mensaje}</p>
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">{update.visibility === "rfa_internal" ? "Interna RFA" : update.visibility === "enterprise_internal" ? "Interna empresa" : "Pública"}</span>
                </div>
                <p className="mt-2 text-xs text-slate-500">{formatDateTimeAr(update.created_at)}</p>
              </div>
            ))}
          </div>
        </section>

        <Button className="bg-emerald-500 text-white hover:bg-emerald-600" onClick={() => handleAdminUpdate(c.id)} disabled={submitting || (isNewCommercialFlow ? !hasAdminCaseEdits : !hasUnsavedChanges)}>
          {submitting ? "Guardando..." : "Guardar cambios del caso"}
        </Button>
      </div>
    );
  };


  const renderAdminCasePanel = (c) => {
    const isEnterpriseCase = Boolean(c.enterprise_user_id);
    const currentService = getCaseServiceValue(c) || analysisService.code;
    const currentCommercialStatus = getEffectiveCommercialStatus(c);
    const proposalAlreadyAccepted = Boolean(c.proposal_accepted_at) || ["accepted", "payment_pending", "paid"].includes(currentCommercialStatus);
    const currentCommunicationMode = c.communication_mode === "rfa_managed"
      ? "RFA gestiona las comunicaciones"
      : c.communication_mode === "client_sends"
        ? "El cliente envía las comunicaciones preparadas por RFA"
        : "Sin definir";
    let acceptedSnapshot = null;
    try { acceptedSnapshot = c.accepted_proposal_snapshot ? JSON.parse(c.accepted_proposal_snapshot) : null; } catch { acceptedSnapshot = null; }
    const isNewCommercialFlow = !isEnterpriseCase && Number(c.commercial_flow_version) >= 2;
    const receiptHistory = Array.isArray(c.payment_receipts) ? c.payment_receipts : [];
    const attachments = parseArray(c.adjuntos);
    const history = updates[c.id] || [];
    const missingDocuments = c.documentacion_faltante || c.documentacion_faltantes || c.faltantes;
    const hasCommercialData = !isEnterpriseCase;
    const tabs = [
      { value: "summary", label: "Resumen" },
      { value: "documentation", label: "Documentacion" },
      { value: "management", label: "Gestion" },
      ...(hasCommercialData ? [{ value: "commercial", label: "Comercial" }] : []),
      { value: "activity", label: "Actividad" },
      ...(!isEnterpriseCase ? [{ value: "conversations", label: "Conversaciones" }] : [])
    ];
    const infoItem = (label, value, className = "") => (
      <div className={className}>
        <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 break-words text-sm text-slate-100">{value || "-"}</p>
      </div>
    );

    return (
      <div className="rounded-2xl border border-white/10 p-4 shadow-inner shadow-slate-950/20 md:p-5" style={{ backgroundColor: "#17365e" }}>
        <div className="flex flex-col gap-4 border-b border-white/10 pb-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <button type="button" className="mb-3 text-xs font-semibold text-sky-300 hover:text-sky-200" onClick={() => handleToggleUpdates(c.id)}>
              Volver a casos
            </button>
            <p className="text-xs uppercase tracking-[0.18em] text-amber-200">Expediente</p>
            <h3 className="mt-1 text-2xl font-semibold text-white">{c.case_code || c.id}</h3>
            <p className="mt-1 text-sm text-slate-400">{c.nombre_completo || "Sin nombre"} · {isEnterpriseCase ? "Caso empresa" : "Persona"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isNewCommercialFlow && <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadge(c.estado)}`}>{getOperationalStatusLabel(c.estado)}</span>}
            {isNewCommercialFlow && <span className="inline-flex rounded-full bg-sky-400/15 px-2.5 py-1 text-xs font-semibold text-sky-100">{getDashboardCaseStageLabel(c)}</span>}
            {isEnterpriseCase && <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getPriorityBadge(c.prioridad)}`}>{c.prioridad || "Pendiente"}</span>}
            {(!isNewCommercialFlow || isEnterpriseCase) && <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${normalizeRiskValue(c.riesgo) ? getRiskBadge(normalizeRiskValue(c.riesgo)) : "bg-amber-500/25 text-amber-200"}`}>{normalizeRiskValue(c.riesgo) || "Sin clasificar"}</span>}
          </div>
        </div>

        <nav className="mt-4 flex flex-wrap gap-1 border-b border-white/10" aria-label="Secciones del expediente">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={`rfa-admin-detail-tab border-b-2 px-3 py-2 text-sm font-semibold transition ${adminDetailTab === tab.value ? "rfa-admin-detail-tab-active border-amber-300 text-white" : "border-transparent text-slate-400 hover:text-slate-200"}`}
              onClick={() => setAdminDetailTab(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="mt-5">
          {adminDetailTab === "summary" && (
            <section className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {infoItem("Cliente", c.nombre_completo)}
                {infoItem("Contacto", getCaseContactEmail(c) || c.telefono)}
                {infoItem("DNI/CUIT", c.dni_cuit)}
                {infoItem("Origen", isEnterpriseCase ? c.enterprise_email || c.empresa || "Empresa" : "RFA directo")}
                {infoItem("Empresa reclamada", c.entidad)}
                {infoItem("Categoria", c.categoria)}
                {infoItem("Fecha de ingreso", formatDateTimeAr(c.created_at))}
                {infoItem("Ultima actividad", formatDateTimeAr(c.updated_at || c.created_at))}
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Descripcion completa</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-100">{c.relato || c.detalle || "-"}</p>
              </div>
              {!isEnterpriseCase && <div className="rounded-xl border border-sky-300/20 bg-sky-300/5 p-4">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">{isNewCommercialFlow ? "Etapa" : "Próximo paso"}</p>
                {isNewCommercialFlow && <p className="mt-1 text-sm font-semibold text-white">{getDashboardCaseStageLabel(c)}</p>}
                {isNewCommercialFlow && <p className="mt-3 text-[11px] uppercase tracking-wide text-slate-400">Próximo paso</p>}
                <p className="mt-1 text-sm font-semibold text-white">{getAdminNextStep(c)}</p>
                {c.customer_communication_mode === "client_sends" && <p className="mt-2 text-xs text-sky-100">El cliente eligió enviar las comunicaciones preparadas por RFA. Podés habilitar Conversaciones para compartir los mensajes.</p>}
              </div>}
            </section>
          )}

          {adminDetailTab === "documentation" && (
            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Estado documental</p>
                <p className="mt-1 text-sm text-slate-100">{c.documentacion_estado || "No informado"}</p>
                {missingDocuments && <p className="mt-4 text-sm text-slate-300"><span className="text-slate-500">Faltantes:</span> {missingDocuments}</p>}
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Archivos adjuntos</p>
                {attachments.length === 0 && <p className="mt-2 text-sm text-slate-400">Sin archivos adjuntos.</p>}
                <div className="mt-2 space-y-2">
                  {attachments.map((file) => (
                    <div key={file.filename || file.originalName} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 px-3 py-2">
                      <span className="truncate text-xs text-slate-200">{file.originalName || file.filename}</span>
                      <Button type="button" className="h-auto bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20" onClick={() => handleDownloadAttachment(c.id, file)}>Descargar</Button>
                    </div>
                  ))}
                </div>
                {c.payment_receipt_uploaded_at && <p className="mt-4 text-xs text-slate-400">Comprobante recibido: {formatDateTimeAr(c.payment_receipt_uploaded_at)}</p>}
                {c.payment_receipt_filename && <Button type="button" className="mt-2 bg-white/10 text-white hover:bg-white/20" onClick={() => handleDownloadPaymentReceipt(c)} disabled={downloadingReceiptCaseId === c.id}>{downloadingReceiptCaseId === c.id ? "Descargando..." : "Descargar comprobante"}</Button>}
              </div>
            </section>
          )}

          {adminDetailTab === "management" && (
            <section className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="grid gap-4 md:grid-cols-3">
                {isNewCommercialFlow ? (
                  <div className="md:col-span-3">
                    <p className="text-xs text-slate-300">Etapa actual</p>
                    <p className="mt-1 text-sm font-semibold text-white">{getDashboardCaseStageLabel(c)}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {personaV2OperationalActions.map((action) => (
                        <Button
                          key={action.status}
                          type="button"
                          className="bg-white/10 text-white hover:bg-white/20"
                          disabled={submitting}
                          onClick={() => {
                            if (action.requiresClientMessage) {
                              setError("");
                              setPersonaV2InfoRequestCaseId((current) => current === c.id ? "" : c.id);
                              setPersonaV2InfoRequestText("");
                            } else {
                              handlePersonaV2OperationalAction(c, action.status);
                            }
                          }}
                        >
                          {action.label}
                        </Button>
                      ))}
                    </div>
                    {personaV2InfoRequestCaseId === c.id && (
                      <div className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/5 p-3">
                        <label className="block text-sm font-medium text-white" htmlFor={`persona-v2-info-request-${c.id}`}>¿Qué información necesitás del cliente?</label>
                        <p className="mt-1 text-xs text-slate-300">Este texto se publicará en Consulta de caso. No se enviará nada hasta que lo confirmes.</p>
                        <textarea
                          id={`persona-v2-info-request-${c.id}`}
                          aria-label="Información solicitada al cliente"
                          className="mt-3 min-h-[110px] w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-white placeholder:text-slate-500"
                          value={personaV2InfoRequestText}
                          onChange={(event) => setPersonaV2InfoRequestText(event.target.value)}
                          placeholder="Detallá la información o documentación que necesitás..."
                        />
                        <div className="mt-3 flex flex-wrap justify-end gap-2">
                          <Button type="button" className="bg-white/10 text-white hover:bg-white/20" onClick={() => { setPersonaV2InfoRequestCaseId(""); setPersonaV2InfoRequestText(""); }}>Cancelar</Button>
                          <Button
                            type="button"
                            className="bg-sky-600 text-white hover:bg-sky-500"
                            disabled={submitting || !personaV2InfoRequestText.trim()}
                            onClick={() => handlePersonaV2OperationalAction(c, "needs_information", personaV2InfoRequestText)}
                          >
                            {submitting ? "Enviando..." : "Enviar solicitud al cliente"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <label className="text-xs text-slate-300">Estado operativo
                    <select className="mt-1 w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-white" value={adminStatus} onChange={(event) => { const value = event.target.value; setAdminStatus(value); if (!isEnterpriseCase && statusTemplates[value]) setAdminPublicMessage(statusTemplates[value]); }}>
                      <option value="">Mantener: {getOperationalStatusLabel(c.estado)}</option>
                      {(isEnterpriseCase ? enterpriseStatusOptions.map((label) => ({ code: label, label })) : statusOptions).map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
                    </select>
                  </label>
                )}
                {isEnterpriseCase && <label className="text-xs text-slate-300">Prioridad
                  <select className="mt-1 w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-white" value={adminPriority} onChange={(event) => setAdminPriority(event.target.value)}>
                    <option value="">Mantener: {c.prioridad || "Pendiente"}</option>
                    {priorityOptions.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                  </select>
                </label>}
                {!isNewCommercialFlow && <label className="text-xs text-slate-300">Riesgo
                  <select className="mt-1 w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-white" value={adminRisk} onChange={(event) => setAdminRisk(event.target.value)}>
                    <option value="">Mantener: {normalizeRiskValue(c.riesgo) || "Sin clasificar"}</option>
                    {riskOptions.map((risk) => <option key={risk} value={risk}>{risk}</option>)}
                  </select>
                </label>}
                <label className="text-xs text-slate-300 md:col-span-3">Observacion interna RFA
                  <span className="ml-2 text-[11px] text-amber-200">Solo visible para administracion RFA</span>
                  <textarea className="mt-1 min-h-[130px] w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-white placeholder:text-slate-500" value={adminNote} onChange={(event) => setAdminNote(event.target.value)} placeholder={c.observaciones_rfa || "Escribi una observacion interna"} />
                </label>
              </div>
            </section>
          )}

          {adminDetailTab === "commercial" && hasCommercialData && (
            <section className="rounded-xl border border-amber-300/25 bg-amber-300/5 p-4">
              {isNewCommercialFlow ? (
                <div className="space-y-5">
                  <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
                    {infoItem("Etapa", getDashboardCaseStageLabel(c))}
                    {infoItem("Próximo paso", getAdminNextStep(c))}
                    {infoItem("Fecha de aceptación", c.proposal_accepted_at ? formatDateTimeAr(c.proposal_accepted_at) : "-")}
                    {infoItem("Pago confirmado", c.payment_confirmed_at ? formatDateTimeAr(c.payment_confirmed_at) : "-")}
                  </div>
                  {acceptedSnapshot && (
                    <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/5 p-4">
                      <h4 className="font-semibold text-white">Opción elegida y aceptada</h4>
                      <div className="mt-3 grid gap-3 text-sm text-slate-200 md:grid-cols-2">
                        {infoItem("Servicio", getServiceDisplayName(acceptedSnapshot.service_code))}
                        {infoItem("Precio", formatQuotedAmount(acceptedSnapshot.amount, acceptedSnapshot.currency))}
                        {acceptedSnapshot.communication_mode && infoItem("Modalidad elegida por el cliente", acceptedSnapshot.communication_mode === "rfa_managed" ? "RFA gestiona las comunicaciones" : "El cliente envía las comunicaciones preparadas por RFA", "md:col-span-2")}
                        {infoItem("Alcance aceptado", acceptedSnapshot.scope, "md:col-span-2")}
                        {infoItem("Aceptación registrada", acceptedSnapshot.accepted_at || c.proposal_accepted_at || "-", "md:col-span-2")}
                      </div>
                      {acceptedSnapshot.communication_mode === "client_sends" && <p className="mt-3 text-xs text-sky-100">El cliente eligió enviar las comunicaciones. Podés habilitar Conversaciones para compartir los mensajes.</p>}
                    </div>
                  )}
                  {currentCommercialStatus === "analysis" && (
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold text-white">Opciones para este caso</h4>
                        <p className="mt-1 text-xs text-slate-400">Habilitá una o ambas alternativas. El cliente elegirá cuál acepta.</p>
                      </div>
                      {[
                        ["professional-folder", "Carpeta Profesional"],
                        ["rfa-management", "Gestión RFA"]
                      ].map(([code, label]) => {
                        const draft = adminOfferDrafts[code] || emptyServiceOfferDrafts()[code];
                        return <fieldset key={code} className="rounded-xl border border-white/10 bg-slate-950/20 p-4">
                          <label className="flex items-center gap-2 font-semibold text-white">
                            <input type="checkbox" checked={draft.enabled} onChange={(event) => setServiceOfferDraftValue(code, "enabled", event.target.checked)} />
                            {label}
                          </label>
                          {draft.enabled && <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <label className="text-xs text-slate-300">Precio
                              <input type="number" min="1" step="1" value={draft.quoted_amount} onChange={(event) => setServiceOfferDraftValue(code, "quoted_amount", event.target.value)} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-white" />
                            </label>
                            <label className="text-xs text-slate-300">Moneda
                              <select value={draft.quoted_currency} onChange={(event) => setServiceOfferDraftValue(code, "quoted_currency", event.target.value)} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-white"><option value="ARS">ARS</option><option value="USD">USD</option></select>
                            </label>
                            <label className="text-xs text-slate-300 md:col-span-2">Alcance
                              <textarea value={draft.quoted_scope} onChange={(event) => setServiceOfferDraftValue(code, "quoted_scope", event.target.value)} className="mt-1 min-h-[90px] w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-white" />
                            </label>
                            {code === "rfa-management" && <fieldset className="md:col-span-2">
                              <legend className="text-xs text-slate-300">Modalidades disponibles para que el cliente elija</legend>
                              {[["rfa_managed", "RFA gestiona las comunicaciones"], ["client_sends", "El cliente envía las comunicaciones preparadas por RFA"]].map(([mode, modeLabel]) => <label key={mode} className="mt-2 flex items-center gap-2 text-sm text-slate-200">
                                <input type="checkbox" checked={draft.available_communication_modes.includes(mode)} onChange={(event) => setServiceOfferDraftValue(code, "available_communication_modes", event.target.checked ? [...draft.available_communication_modes, mode] : draft.available_communication_modes.filter((item) => item !== mode))} />
                                {modeLabel}
                              </label>)}
                            </fieldset>}
                          </div>}
                        </fieldset>;
                      })}
                      {(c.service_offers || []).some((offer) => offer.status === "published") && <div className="rounded-lg border border-white/10 p-3">
                        <p className="text-xs font-semibold text-slate-300">Opciones actualmente publicadas</p>
                        <div className="mt-2 space-y-2">{c.service_offers.filter((offer) => offer.status === "published").map((offer) => <p key={offer.id} className="text-sm text-slate-200">{getServiceDisplayName(offer.service_code)} · {formatQuotedAmount(offer.quoted_amount, offer.quoted_currency)} · {offer.quoted_scope}</p>)}</div>
                      </div>}
                      <Button type="button" className="bg-sky-600 text-white hover:bg-sky-500" onClick={() => publishServiceOffers(c.id)} disabled={submitting}>{submitting ? "Publicando..." : "Publicar opciones"}</Button>
                    </div>
                  )}
                  {currentCommercialStatus === "proposal_sent" && <div className="space-y-3 rounded-xl border border-sky-300/20 bg-slate-950/20 p-4">
                    <div>
                      <h4 className="font-semibold text-white">Opciones publicadas</h4>
                      <p className="mt-1 text-sm text-slate-300">Esperando elección del cliente.</p>
                    </div>
                    {(c.service_offers || []).filter((offer) => offer.status === "published").map((offer) => (
                      <article key={offer.id} className="rounded-lg border border-white/10 p-3">
                        <h5 className="font-semibold text-white">{getServiceDisplayName(offer.service_code)}</h5>
                        <p className="mt-1 text-sm text-slate-200">{formatQuotedAmount(offer.quoted_amount, offer.quoted_currency)}</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{offer.quoted_scope}</p>
                        {offer.service_code === "rfa-management" && <p className="mt-2 text-xs text-slate-300">Modalidades disponibles: {(offer.available_communication_modes || []).map((mode) => mode === "rfa_managed" ? "RFA gestiona las comunicaciones" : "El cliente envía las comunicaciones preparadas por RFA").join(" · ") || "-"}</p>}
                      </article>
                    ))}
                    {!(c.service_offers || []).some((offer) => offer.status === "published") && <p className="text-sm text-amber-100">Las opciones publicadas no están disponibles en esta respuesta del caso.</p>}
                  </div>}
                  {["payment_pending", "paid"].includes(currentCommercialStatus) && <div className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-4">
                    <h4 className="font-semibold text-white">Comprobantes de pago</h4>
                    {receiptHistory.length === 0 && <p className="mt-2 text-sm text-slate-400">Aún no se recibió un comprobante.</p>}
                    <div className="mt-3 space-y-2">{receiptHistory.map((receipt) => <div key={receipt.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 p-3">
                      <div><p className="text-sm text-white">{receipt.original_filename}</p><p className="text-xs text-slate-400">{formatDateTimeAr(receipt.uploaded_at)} · {receipt.status === "pending" ? "Comprobante recibido — requiere verificación" : receipt.status === "verified" ? "Verificado" : receipt.status === "superseded" ? "Reemplazado; conservado en historial" : "Rechazado"}</p></div>
                      <div className="flex flex-wrap gap-2"><Button type="button" className="bg-white/10 text-white hover:bg-white/20" onClick={() => handleDownloadReceiptHistory(c.id, receipt)} disabled={downloadingReceiptCaseId === c.id}>Ver comprobante</Button>{currentCommercialStatus === "payment_pending" && receipt.status === "pending" && <Button type="button" className="bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => confirmCasePayment(c.id, receipt.id)} disabled={submitting}>Confirmar pago</Button>}</div>
                    </div>)}</div>
                  </div>}
                  {currentCommercialStatus === "paid" && <p className="rounded-lg border border-emerald-300/20 bg-emerald-300/5 p-3 text-sm text-emerald-100">Pago confirmado por RFA. El servicio está activo.</p>}
                </div>
              ) : (
                <>
              <div className="grid gap-4 text-sm text-slate-300 md:grid-cols-2 lg:grid-cols-4">
                {infoItem("Servicio RFA", getServiceDisplayName(currentService))}
                {infoItem("Situacion comercial", getCommercialStatusLabel(currentCommercialStatus))}
                {infoItem("Precio", formatQuotedAmount(c.quoted_amount, c.quoted_currency))}
                {infoItem("Moneda", c.quoted_currency)}
                {infoItem("Modalidad de comunicaciones", currentCommunicationMode, "lg:col-span-2")}
                {infoItem("Propuesta enviada", c.quoted_at ? formatDateTimeAr(c.quoted_at) : "-", "lg:col-span-2")}
                {infoItem("Aceptacion", c.proposal_accepted_at ? formatDateTimeAr(c.proposal_accepted_at) : "-", "lg:col-span-2")}
                {infoItem("Pago confirmado", c.payment_confirmed_at ? formatDateTimeAr(c.payment_confirmed_at) : "-", "lg:col-span-2")}
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-xs text-slate-300">Servicio
                  <select className="mt-1 w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60" value={adminServiceCode} disabled={proposalAlreadyAccepted} onChange={(event) => setAdminServiceCode(event.target.value)}>
                    <option value="">Mantener: {getServiceDisplayName(currentService)}</option>
                    <option value={analysisService.code}>{analysisService.name}</option>
                    {plans.map((service) => <option key={service.code} value={service.code}>{service.name}</option>)}
                  </select>
                </label>
                <label className="text-xs text-slate-300">Precio del servicio (ARS)
                  <input type="number" min="1" step="1" className="mt-1 w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60" value={adminQuotedAmount} disabled={proposalAlreadyAccepted} onChange={(event) => setAdminQuotedAmount(event.target.value)} placeholder={c.quoted_amount ? String(c.quoted_amount) : "Ej.: 65000"} />
                </label>
                <label className="text-xs text-slate-300 md:col-span-2">Alcance acordado
                  <textarea className="mt-1 min-h-[120px] w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-white placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-60" value={adminQuotedScope} disabled={proposalAlreadyAccepted} onChange={(event) => setAdminQuotedScope(event.target.value)} placeholder={c.quoted_scope || "Detalle del alcance del servicio"} />
                </label>
                <label className="text-xs text-slate-300 md:col-span-2">Situacion comercial
                  <select className="mt-1 w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-white" value={adminCommercialStatus} onChange={(event) => setAdminCommercialStatus(event.target.value)}>
                    <option value="">Mantener: {getCommercialStatusLabel(currentCommercialStatus)}</option>
                    {commercialStatusOptions.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
                  </select>
                </label>
                <label className="text-xs text-slate-300 md:col-span-2">Modalidad de comunicaciones
                  <select className="mt-1 w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60" value={adminCommunicationMode} disabled={proposalAlreadyAccepted} onChange={(event) => setAdminCommunicationMode(event.target.value)}>
                    <option value="">Mantener: {currentCommunicationMode}</option>
                    <option value="__unset">Sin definir</option>
                    <option value="rfa_managed">RFA gestiona las comunicaciones</option>
                    <option value="client_sends">El cliente envía las comunicaciones preparadas por RFA</option>
                  </select>
                  {proposalAlreadyAccepted && <span className="mt-1 block text-[11px] text-slate-400">La modalidad queda fija después de aceptar la propuesta.</span>}
                </label>
              </div>
              {!isEnterpriseCase && ["proposal_sent", "payment_pending"].includes(currentCommercialStatus) && (
                <div className="mt-4 border-t border-white/10 pt-4">
                  <p className="text-sm font-medium text-slate-200">Enlace de un solo uso, válido por 72 horas. Compartilo únicamente con el email del caso.</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {currentCommercialStatus === "proposal_sent" && <Button type="button" className="bg-white/10 text-white hover:bg-white/20" disabled={creatingPublicActionLink} onClick={() => generatePublicActionLink(c.id, "proposal_accept")}>{creatingPublicActionLink ? "Generando..." : "Generar enlace para aceptar"}</Button>}
                    {currentCommercialStatus === "payment_pending" && <Button type="button" className="bg-white/10 text-white hover:bg-white/20" disabled={creatingPublicActionLink} onClick={() => generatePublicActionLink(c.id, "payment_receipt")}>{creatingPublicActionLink ? "Generando..." : "Generar enlace para comprobante"}</Button>}
                  </div>
                  {publicActionLink?.caseId === c.id && (
                    <div className="mt-3 space-y-1">
                      <label className="block text-xs text-slate-400" htmlFor={`public-action-link-${c.id}`}>Enlace generado; copiado al portapapeles si el navegador lo permite. Vence: {formatDateTimeAr(publicActionLink.expiresAt)}</label>
                      <input id={`public-action-link-${c.id}`} readOnly value={publicActionLink.url} onFocus={(event) => event.target.select()} className="w-full rounded-lg border border-white/15 bg-slate-950/70 px-3 py-2 text-xs text-slate-200" />
                    </div>
                  )}
                </div>
              )}
                </>
              )}
            </section>
          )}

          {adminDetailTab === "activity" && (
            <section className="space-y-4">
              {!isEnterpriseCase && (
                <label className="block text-xs text-slate-300">Mensaje publico para el cliente
                  <textarea className="mt-1 min-h-[100px] w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-white placeholder:text-slate-500" value={adminPublicMessage} onChange={(event) => setAdminPublicMessage(event.target.value)} placeholder="Solo este texto sera visible en Consultar caso" />
                  {isNewCommercialFlow && <span className="mt-1 block text-[11px] text-slate-400">Solo se publicará si escribís un mensaje y confirmás con Guardar cambios del caso.</span>}
                </label>
              )}
              <div className="relative space-y-3 pl-5 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-white/15">
                {history.length === 0 && <p className="text-sm text-slate-400">Sin actualizaciones registradas.</p>}
                {history.map((update) => (
                  <article key={update.id} className="rfa-admin-activity-item relative rounded-xl border border-white/10 bg-white/5 p-4 before:absolute before:-left-[25px] before:top-5 before:h-2.5 before:w-2.5 before:rounded-full before:border-2 before:border-sky-300 before:bg-slate-950">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-sky-300">{formatDateTimeAr(update.created_at)}</p>
                        <h4 className="mt-1 text-sm font-semibold text-white">{update.estado ? `Estado: ${getOperationalStatusLabel(update.estado)}` : "Registro de actividad"}</h4>
                      </div>
                      <span className="text-[10px] uppercase tracking-wide text-slate-400">{isNewCommercialFlow
                        ? update.visibility === "rfa_internal" ? "Interna RFA · Solo RFA" : update.visibility === "public" ? "Visible al cliente" : "Interna"
                        : update.visibility === "rfa_internal" ? "Interna RFA" : update.visibility === "enterprise_internal" ? "Interna empresa" : "Publica"}</span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{update.mensaje || "Sin contenido"}</p>
                  </article>
                ))}
              </div>
            </section>
          )}

          {adminDetailTab === "conversations" && !isEnterpriseCase && (
            <CaseConversations
              mode="admin"
              caseId={c.id}
              onPendingChange={(pending) => setCases((current) => {
                let changed = false;
                const nextValue = pending ? 1 : 0;
                const next = current.map((item) => {
                  if (item.id !== c.id || Number(item.conversation_pending_admin_attention || 0) === nextValue) return item;
                  changed = true;
                  return { ...item, conversation_pending_admin_attention: nextValue };
                });
                return changed ? next : current;
              })}
            />
          )}
        </div>

        <div className="mt-5 flex justify-end border-t border-white/10 pt-4">
          <div className="flex flex-wrap items-center justify-end gap-3">
            {adminSaveNotice && <p className="text-xs text-emerald-300" role="status" aria-live="polite">{adminSaveNotice}</p>}
            <Button type="button" className="bg-sky-600 text-white hover:bg-sky-500" onClick={() => handleAdminUpdate(c.id)} disabled={submitting || (isNewCommercialFlow ? !hasAdminCaseEdits : !hasUnsavedChanges)}>
              {submitting ? "Guardando..." : "Guardar cambios del caso"}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className={isAdmin ? "rfa-admin-shell min-h-screen bg-[#071a3a] text-slate-100 px-4 md:px-6 py-16 pt-24" : isPublicCreateMode ? "rfa-public-create-page min-h-screen px-4 md:px-6 py-16 pt-24" : isEnterprise ? "rfa-enterprise-panel-shell min-h-screen text-slate-100 px-4 md:px-6 py-16 pt-24" : "min-h-screen text-slate-100 px-4 md:px-6 py-16 pt-24"}
      style={isPublicCreateMode ? { "--rfa-create-hero": "url('/images/rfa-home-01.png')" } : undefined}
    >
      <div className="max-w-[110rem] mx-auto">
        {isAdmin && (
          <header className="mb-8 flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">RFA / Administracion</p>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Panel de gestion</h1>
              <p className="mt-2 text-slate-300">Administracion y seguimiento de casos RFA.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <nav className="flex flex-wrap rounded-lg border border-white/10 bg-slate-950/30 p-1" aria-label="Vistas de casos">
                {[
                  { value: "attention", label: "Atención", source: "todos" },
                  { value: "all", label: "Todos", source: "todos" },
                  { value: "all-rfa", label: "Personas", source: "rfa" },
                  { value: "all-enterprise", label: "Empresas", source: "empresa" },
                  { value: "closed", label: "Cerrados", source: "todos" }
                ].map((option) => {
                  const active = option.value === "all-rfa"
                    ? adminListFilter === "all" && adminCaseSourceFilter === "rfa"
                    : option.value === "all-enterprise"
                      ? adminListFilter === "all" && adminCaseSourceFilter === "empresa"
                      : adminListFilter === option.value && adminCaseSourceFilter === option.source;
                  return (
                  <button
                    key={`${option.value}-${option.source}`}
                    type="button"
                    aria-pressed={active}
                    className={`rounded-md px-3 py-2 text-xs font-semibold transition ${active ? "bg-white text-slate-900" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}
                    onClick={() => handleAdminListFilter(option.value.startsWith("all") ? "all" : option.value, option.source)}
                  >
                    {option.label}
                  </button>
                  );
                })}
              </nav>
              <Button type="button" onClick={() => setAdminImportOpen((prev) => !prev)} className="bg-sky-600 text-white hover:bg-sky-500">
                {adminImportOpen ? "Cerrar importacion" : "Importar casos"}
              </Button>
              <Button onClick={handleLogout} className="bg-white/10 text-white hover:bg-white/20">
                Cerrar sesion
              </Button>
            </div>
          </header>
        )}
        {!isAdmin && <div className={`flex flex-wrap items-center justify-between gap-4 mb-10 ${isPublicCreateMode ? "rfa-public-create-heading" : ""}`}>
          <div>
            <h1 className="text-3xl font-bold">{isCreateCasePage ? "Nuevo caso" : "Panel de casos"}</h1>
            <p className="text-slate-300">
              {isPublicCreateMode
                ? "Contanos qué pasó. Vamos a revisar la información antes de proponerte cualquier servicio."
                : isEnterprise
                    ? "Panel empresa: organiza y clasifica casos con estado y prioridad."
                    : "Carga nuevos reclamos y sigue el estado."}
            </p>
          </div>
          {!isPublicCreateMode && (
            <Button onClick={handleLogout} className="bg-white/10 hover:bg-white/20 text-white">
              Cerrar sesión
            </Button>
          )}
        </div>}
        {isAdmin && (
          <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
            {adminSummary.map((metric) => (
              <button
                key={metric.label}
                type="button"
                onClick={() => handleAdminListFilter(metric.filter, metric.source || "todos")}
                className={`rounded-xl border px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-white/30 ${metric.tone === "amber" ? "border-amber-300/30 bg-amber-400/10" : metric.tone === "gold" ? "border-yellow-300/30 bg-yellow-400/10" : metric.tone === "blue" ? "border-sky-300/25 bg-sky-400/10" : "border-white/10 bg-white/5"}`}
              >
                <p className="text-xs font-medium text-slate-300">{metric.label}</p>
                <p className="mt-1 text-2xl font-bold text-white">{metric.value}</p>
              </button>
            ))}
          </div>
        )}
        {hasUnsavedChanges && !isNewCommercialTab && (
          <div className="mb-6 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 flex flex-wrap items-center justify-between gap-3">
            <span>Tenés cambios sin guardar. Guardalos antes de salir de esta pantalla.</span>
            <Button
              type="button"
              className="bg-amber-500 hover:bg-amber-600 text-slate-950"
              onClick={handleSaveAllPendingChanges}
              disabled={submitting}
            >
              {submitting ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        )}

        <div className={`grid gap-8 ${isAdmin ? "md:grid-cols-1" : "md:grid-cols-1"}`}>
          {showNewClaimSection && (
          <div className={`bg-white/10 border border-white/10 rounded-2xl p-6 backdrop-blur ${isPublicCreateMode ? "rfa-public-create-card" : ""}`}>
            <div className="flex flex-wrap items-center justify-end gap-3 mb-4">
              <Button
                type="button"
                className="bg-white/10 hover:bg-white/20 text-white"
                onClick={() => setShowNewCaseForm((prev) => !prev)}
              >
                {showNewCaseForm ? "Ocultar" : "Mostrar"}
              </Button>
            </div>
            {showNewCaseForm && (
            <form onSubmit={handleCreateCase} className="space-y-6">
              <div className="space-y-3">
                <div>
                  <h3 className="text-base font-semibold text-white">1. Tus datos</h3>
                  <p className="mt-1 text-sm text-slate-400">Necesitamos estos datos para analizar el caso y poder contactarte.</p>
                </div>
                <input
                  type="text"
                  placeholder="Nombre completo"
                  aria-label="Nombre completo"
                  className="w-full rounded-lg bg-white/10 border border-white/10 px-4 py-3 text-white placeholder:text-slate-400"
                  value={nombreCompleto}
                  onChange={(e) => setNombreCompleto(e.target.value)}
                  disabled={!canSubmitCase}
                  required
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    type="email"
                    placeholder="Correo electrónico"
                    aria-label="Correo electrónico"
                    className="w-full rounded-lg bg-white/10 border border-white/10 px-4 py-3 text-white placeholder:text-slate-400"
                    value={emailContacto}
                    onChange={(e) => setEmailContacto(e.target.value)}
                    disabled={!canSubmitCase}
                    required
                  />
                  <input
                    type="tel"
                    placeholder="Teléfono / WhatsApp (opcional)"
                    aria-label="Teléfono o WhatsApp"
                    className="w-full rounded-lg bg-white/10 border border-white/10 px-4 py-3 text-white placeholder:text-slate-400"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    disabled={!canSubmitCase}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="text-base font-semibold text-white">2. Tu reclamo</h3>
                  <p className="mt-1 text-sm text-slate-400">Contanos qué ocurrió y contra quién necesitás reclamar.</p>
                </div>
                <input
                  type="text"
                  placeholder="Empresa o proveedor reclamado"
                  aria-label="Empresa o proveedor reclamado"
                  className="w-full rounded-lg bg-white/10 border border-white/10 px-4 py-3 text-white placeholder:text-slate-400"
                  value={entidad}
                  onChange={(e) => setEntidad(e.target.value)}
                  disabled={!canSubmitCase}
                  required
                />
                <select
                  className="w-full rounded-lg bg-slate-900/70 border border-white/20 px-4 py-3 text-white"
                  aria-label="Categoría del problema"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  disabled={!canSubmitCase}
                  required
                >
                  <option value="">Categoría del problema</option>
                  {publicCaseCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
                <textarea
                  placeholder="Describí qué pasó, cuándo ocurrió y qué respuesta recibiste (si la hubo)."
                  aria-label="Descripción del reclamo"
                  className="min-h-[220px] w-full rounded-lg bg-white/10 border border-white/10 px-4 py-3 text-white placeholder:text-slate-400"
                  value={relato}
                  onChange={(e) => setRelato(e.target.value)}
                  disabled={!canSubmitCase}
                  required
                />
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="text-base font-semibold text-white">3. Información adicional</h3>
                  <p className="mt-1 text-sm text-slate-400">Estos datos son opcionales y ayudan a entender mejor el caso.</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    type="text"
                    placeholder="Monto aproximado (opcional)"
                    aria-label="Monto aproximado"
                    className="w-full rounded-lg bg-white/10 border border-white/10 px-4 py-3 text-white placeholder:text-slate-400"
                    value={montoValor}
                    onChange={(e) => setMontoValor(e.target.value)}
                    disabled={!canSubmitCase}
                  />
                  <select
                    className="w-full rounded-lg bg-slate-900/70 border border-white/20 px-4 py-3 text-white"
                    aria-label="Moneda"
                    value={montoMoneda}
                    onChange={(e) => setMontoMoneda(e.target.value)}
                    disabled={!canSubmitCase}
                  >
                    <option value="ARS">Peso (ARS)</option>
                    <option value="USD">Dólar (USD)</option>
                  </select>
                </div>
                <label className="block rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                  <span className="font-medium text-slate-200">Documentación (opcional)</span>
                  <input
                    type="file"
                    aria-label="Adjuntar documentación"
                    multiple
                    className="mt-2 block w-full text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-600"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt,application/pdf,image/png,image/jpeg,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    onChange={(e) => {
                      const selectedFiles = Array.from(e.target.files || []);
                      const validationError = validatePublicCaseAttachments(selectedFiles);
                      if (validationError) {
                        setAdjuntos([]);
                        e.target.value = "";
                        setError(validationError);
                        return;
                      }
                      setAdjuntos(selectedFiles);
                      setError("");
                    }}
                    disabled={!canSubmitCase}
                  />
                  <span className="mt-2 block text-xs text-slate-400">Podés adjuntar hasta 5 archivos (PDF, JPG, PNG, DOC, DOCX o TXT). Máximo 25 MB por archivo y 50 MB en total.</span>
                  {adjuntos?.length > 0 && <span className="mt-2 block text-xs text-slate-400">{adjuntos.length} archivo(s) seleccionado(s).</span>}
                </label>
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="text-base font-semibold text-white">4. Confirmación</h3>
                  <div className="mt-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                    <p className="font-semibold">Análisis inicial sin costo.</p>
                    <p className="mt-1">Revisamos tu caso para determinar si RFA puede ayudarte.</p>
                    <p className="mt-1">Si corresponde, te informaremos el servicio disponible, su alcance y precio antes de comenzar cualquier trabajo pago.</p>
                  </div>
                </div>
                <label className="flex items-start gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={aceptaTerminos}
                    onChange={(e) => setAceptaTerminos(e.target.checked)}
                    disabled={!canSubmitCase}
                    required
                  />
                  <span>
                    Acepto los{" "}
                    <Link to="/terminos" className="text-emerald-300 font-semibold hover:underline">
                      Términos y Condiciones
                    </Link>.
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={aceptaPrivacidad}
                    onChange={(e) => setAceptaPrivacidad(e.target.checked)}
                    disabled={!canSubmitCase}
                    required
                  />
                  <span>
                    Acepto el tratamiento de mis datos conforme a la{" "}
                    <Link to="/privacidad" className="text-emerald-300 font-semibold hover:underline">
                      Política de Privacidad
                    </Link>.
                  </span>
                </label>
                {publicCaseCode && (
                  <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-100" role="status" aria-live="polite">
                    <p className="font-semibold">Caso recibido correctamente</p>
                    <p className="mt-2 text-xs uppercase tracking-wide text-emerald-200/80">Tu número de caso</p>
                    <p className="mt-1 text-xl font-bold text-white">{publicCaseCode}</p>
                    <p className="mt-1">Guardá este número. Lo vas a necesitar para consultar el estado de tu caso.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="button" className="bg-emerald-700 text-white hover:bg-emerald-600" onClick={copyPublicCaseCode}>
                        {copiedPublicCaseCode ? "Número copiado" : "Copiar número de caso"}
                      </Button>
                      <Link to="/consultar-caso" className="inline-flex items-center rounded-md bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20">
                        Consultar mi caso
                      </Link>
                    </div>
                  </div>
                )}
                {error && <p className="text-rose-300 text-sm">{error}</p>}
                <Button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
                  disabled={submitting || !canSubmitCase}
                >
                  {submitting ? "Enviando..." : "Enviar para análisis \u2192"}
                </Button>
              </div>
            </form>
            )}
          </div>
          )}

          <div className="space-y-4">
            {!isAdmin && !isCreateCasePage && <h2 className="text-xl font-semibold">{isEnterprise ? "Panel empresa: organiza y clasifica casos con estado y prioridad." : "Carga nuevos reclamos y sigue el estado."}</h2>}

            {isAdmin && (
              <div className="rounded-2xl border border-white/10 bg-slate-900/45 p-4 shadow-lg shadow-slate-950/10">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1.7fr)_minmax(150px,.75fr)_minmax(190px,1fr)_auto]">
                  <input
                    type="text"
                    placeholder="Buscar expediente, cliente o empresa"
                    className="rounded-lg border border-white/15 bg-slate-950/45 px-3 py-2 text-white placeholder:text-slate-500"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <select className="rounded-lg border border-white/15 bg-slate-950/45 px-3 py-2 text-white" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                    <option value="">Estado</option>
                    {statusOptions.map((status) => <option key={status.code} value={status.code}>{status.label}</option>)}
                  </select>
                  <select className="rounded-lg border border-white/15 bg-slate-950/45 px-3 py-2 text-white" value={adminEnterpriseFilter} onChange={(e) => setAdminEnterpriseFilter(e.target.value)} disabled={adminCaseSourceFilter === "rfa"}>
                    <option value="">Empresa: todas</option>
                    {enterpriseUsers.map((enterpriseUser) => <option key={enterpriseUser.id} value={enterpriseUser.id}>{enterpriseUser.email}</option>)}
                  </select>
                  <Button type="button" className="bg-white/10 text-white hover:bg-white/20" onClick={() => setShowAdminAdvancedFilters((prev) => !prev)}>
                    {showAdminAdvancedFilters ? "Ocultar filtros" : "Más filtros"}
                  </Button>
                </div>
                {showAdminAdvancedFilters && (
                  <div className="mt-3 grid gap-3 border-t border-white/10 pt-3 md:grid-cols-2 lg:grid-cols-4">
                    {adminCaseSourceFilter !== "rfa" && <select className="rounded-lg border border-white/15 bg-slate-950/45 px-3 py-2 text-white" value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
                      <option value="">Prioridad</option>
                      {priorityOptions.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                    </select>}
                    <select className="rounded-lg border border-white/15 bg-slate-950/45 px-3 py-2 text-white" value={adminCaseSourceFilter} onChange={(e) => { setAdminCaseSourceFilter(e.target.value); if (e.target.value === "rfa") setFilterPriority(""); }}>
                      <option value="todos">Origen: todos</option>
                      <option value="rfa">Personas</option>
                      <option value="empresa">Empresas</option>
                    </select>
                    <select className="rounded-lg border border-white/15 bg-slate-950/45 px-3 py-2 text-white" value={filterPlan} onChange={(e) => setFilterPlan(e.target.value)}>
                      <option value="">Servicio</option>
                      {serviceFilterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <select className="rounded-lg border border-white/15 bg-slate-950/45 px-3 py-2 text-white" value={filterMoneda} onChange={(e) => setFilterMoneda(e.target.value)}>
                      <option value="">Moneda</option>
                      <option value="ARS">ARS</option>
                      <option value="USD">USD</option>
                    </select>
                    <input type="text" placeholder="Entidad reclamada" className="rounded-lg border border-white/15 bg-slate-950/45 px-3 py-2 text-white placeholder:text-slate-500" value={filterEntidad} onChange={(e) => setFilterEntidad(e.target.value)} />
                    <label className="flex items-center gap-2 rounded-lg border border-white/15 bg-slate-950/45 px-3 py-2 text-sm text-slate-200">
                      <input type="checkbox" checked={adminOnlyUnclassified} onChange={(e) => setAdminOnlyUnclassified(e.target.checked)} />
                      Solo sin clasificar
                    </label>
                    <select className="rounded-lg border border-white/15 bg-slate-950/45 px-3 py-2 text-white" value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
                      <option value="created_at">Orden: fecha</option>
                      <option value="nombre_completo">Orden: cliente</option>
                      <option value="estado">Orden: estado</option>
                      <option value="service_code">Orden: servicio</option>
                    </select>
                    <select className="rounded-lg border border-white/15 bg-slate-950/45 px-3 py-2 text-white" value={sortDir} onChange={(e) => setSortDir(e.target.value)}>
                      <option value="desc">Descendente</option>
                      <option value="asc">Ascendente</option>
                    </select>
                    <select className="rounded-lg border border-white/15 bg-slate-950/45 px-3 py-2 text-white" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                      <option value={10}>10 por pagina</option>
                      <option value={20}>20 por pagina</option>
                      <option value={50}>50 por pagina</option>
                    </select>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
                  <Button type="button" className="bg-white/10 text-white hover:bg-white/20" onClick={saveFilters}>Guardar filtros</Button>
                  <Button type="button" className="bg-white/10 text-white hover:bg-white/20" onClick={clearFilters}>Limpiar</Button>
                  <Button type="button" className="bg-sky-600 text-white hover:bg-sky-500" onClick={exportCsv}>Exportar CSV</Button>
                  <span className="ml-auto text-xs text-slate-400">{sortedCases.length} resultados</span>
                </div>
              </div>
            )}

            {isAdmin && adminImportOpen && (
              <div className="rounded-2xl border border-amber-300/25 bg-slate-900/50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">Importar casos</h3>
                    <p className="mt-1 text-xs text-slate-400">Carga CSV o Excel y asigna los casos a un usuario empresa.</p>
                  </div>
                  <span className="rounded-full border border-amber-300/30 bg-amber-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-200">Carga masiva</span>
                </div>
                <form onSubmit={handleImportCases} className="grid md:grid-cols-4 gap-3 items-end">
                  {isAdmin ? (
                    <div className="md:col-span-2">
                      <label className="text-xs text-slate-300">Usuario empresa destino</label>
                      <select
                        className="mt-1 w-full rounded-lg bg-slate-900/70 border border-white/20 px-3 py-2 text-white"
                        value={selectedEnterpriseUserId}
                        onChange={(e) => setSelectedEnterpriseUserId(e.target.value)}
                      >
                        <option value="">Seleccionar usuario empresa</option>
                        {enterpriseUsers.map((enterpriseUser) => (
                          <option key={enterpriseUser.id} value={enterpriseUser.id}>
                            {enterpriseUser.email}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="md:col-span-2">
                      <label className="text-xs text-slate-300">Usuario empresa destino</label>
                      <input
                        type="text"
                        readOnly
                        value={user?.email || "Mi usuario empresa"}
                        className="mt-1 w-full rounded-lg bg-slate-900/50 border border-white/20 px-3 py-2 text-slate-300"
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-xs text-slate-300">Archivos (CSV / XLSX)</label>
                    <input
                      type="file"
                      accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      multiple
                      className="mt-1 w-full rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-white"
                      onChange={handleImportFileChange}
                    />
                    {importFiles.length > 0 && (
                      <p className="mt-1 text-xs text-slate-300">{importFiles.length} archivo(s) seleccionado(s).</p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    className="bg-sky-600 hover:bg-sky-500 text-white"
                    disabled={importing}
                  >
                    {importing ? "Importando..." : "Importar casos"}
                  </Button>
                </form>
                {importSummary && (
                  <div className="mt-3 text-sm text-slate-200 space-y-1">
                    <p>Total: {importSummary.total} | Importados: {importSummary.imported} | Rechazados: {importSummary.rejected}</p>
                    {Array.isArray(importSummary.rejectedRows) && importSummary.rejectedRows.length > 0 && (
                      <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-100">
                        {importSummary.rejectedRows.slice(0, 10).map((r) => (
                          <p key={`${r.line}-${r.reason}`}>Línea {r.line}: {r.reason}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {!isPublicCreateMode && error && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3" role="alert">
                <p className="text-sm text-rose-200">{error}</p>
                <Button type="button" className="bg-white/10 text-white hover:bg-white/20" onClick={loadCases} disabled={loading}>
                  Reintentar
                </Button>
              </div>
            )}
            {loading && <p className="text-slate-300">Cargando casos...</p>}
            {!loading && !isCreateCasePage && (isAdmin ? sortedCases.length === 0 : visibleCases.length === 0) && (
              <p className="text-slate-300">{isAdmin ? "No hay casos que coincidan con los filtros actuales." : isEnterprise ? "Panel empresa: organiza y clasifica casos con estado y prioridad." : "Carga nuevos reclamos y sigue el estado."}</p>
            )}

            {!loading && isAdmin && sortedCases.length > 0 && (
              <div className={`rfa-admin-case-list overflow-hidden rounded-2xl border border-white/10 bg-slate-900/35 shadow-xl shadow-slate-950/20 ${expandedCaseId ? "rfa-admin-list-focused" : ""}`}>
                <div className="overflow-auto">
                  <table className="w-full min-w-[760px] border-collapse">
                    <thead className="bg-slate-950/45">
                      <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wide text-slate-400">
                        <th className="sticky left-0 z-10 bg-slate-950/90 px-3 py-3">Caso</th>
                        <th className="px-3 py-3"><button type="button" className="uppercase tracking-wide" onClick={() => handleSort("nombre_completo")}>Cliente / reclamo</button></th>
                        <th className="px-3 py-3"><button type="button" className="uppercase tracking-wide" onClick={() => handleSort("estado")}>Estado</button></th>
                        <th className="px-3 py-3">Atención</th>
                        <th className="px-3 py-3"><button type="button" className="uppercase tracking-wide" onClick={() => handleSort("updated_at")}>Última actividad</button></th>
                        <th className="px-3 py-3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedCases.map((c) => (
                        <Fragment key={c.id}>
                          <tr className={`rfa-admin-case-row border-b border-white/10 align-top ${expandedCaseId === c.id ? "rfa-admin-case-row-active" : ""} ${hasPendingConversationReply(c) ? "!opacity-100 bg-sky-400/15 shadow-[inset_3px_0_0_#38bdf8]" : isNewCase(c) ? "bg-emerald-500/10" : ""}`}>
                            <td className="px-3 py-3">
                              <p className="text-sm font-medium text-slate-100">{c.case_code || c.id}</p>
                              {hasPendingConversationReply(c) && <span className="mt-1 inline-flex max-w-full rounded-full border border-sky-300/40 bg-sky-400/15 px-2 py-0.5 text-[10px] font-semibold text-sky-100">Nueva respuesta</span>}
                              <p className="mt-1 text-xs text-slate-400">{formatDateTimeAr(c.created_at)}</p>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm text-slate-100">{c.nombre_completo || "Sin nombre"}</p>
                                {isNewCase(c) && <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">Nuevo</span>}
                              </div>
                              <p className="mt-1 max-w-[220px] truncate text-xs text-slate-400">{getCaseContactEmail(c) || c.dni_cuit || "Sin contacto"}</p>
                              <p className="mt-2 text-xs text-slate-300">{c.entidad || "Entidad no informada"} <span className="text-slate-500">·</span> {c.categoria || "Sin categoría"}</p>
                              <p className="mt-1 text-[11px] text-slate-500">{c.enterprise_user_id ? "Empresa" : "RFA directo"}</p>
                              {adminCaseSourceFilter === "rfa" && <p className="mt-1 text-[11px] text-slate-500">Servicio: {getServiceDisplayName(getCaseServiceValue(c) || analysisService.code)}</p>}
                            </td>
                            <td className="px-3 py-3"><span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getStatusBadge(c.estado)}`}>{getDashboardCaseStageLabel(c)}</span></td>
                            <td className="px-3 py-3">
                              <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${isAdminAttentionCase(c) ? "bg-amber-500/25 text-amber-100" : "bg-white/10 text-slate-300"}`}>
                                {isAdminAttentionCase(c) ? "Requiere atención" : "Normal"}
                              </span>
                              {(c.enterprise_user_id || Number(c.commercial_flow_version) < 2) && <p className="mt-1 text-[11px] text-slate-500">{c.enterprise_user_id && <>P: {c.prioridad || "Pendiente"} · </>}R: {normalizeRiskValue(c.riesgo) || "Pendiente"}</p>}
                            </td>
                            <td className="px-3 py-3 text-xs text-slate-300">{formatDateTimeAr(c.updated_at || c.created_at)}</td>
                            <td className="px-3 py-3 text-right">
                              <Button type="button" className="bg-transparent px-2 py-1 text-xs text-sky-300 hover:bg-white/10 hover:text-white" onClick={() => handleToggleUpdates(c.id)}>{expandedCaseId === c.id ? "Cerrar" : "Abrir →"}</Button>
                            </td>
                          </tr>
                          {expandedCaseId === c.id && (
                            <tr className="rfa-admin-case-detail-row border-b border-white/10 bg-slate-950/40">
                              <td colSpan={6} className="px-4 py-5">{renderAdminCasePanel(c)}</td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>

                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-white/10 text-sm text-slate-300">
                  <span>
                    Pagina {page} de {totalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      className="bg-white/10 hover:bg-white/20 text-white"
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                      disabled={page <= 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      className="bg-white/10 hover:bg-white/20 text-white"
                      onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={page >= totalPages}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {!loading && isRfaUser && visibleCases.map((c) => (
              <div key={c.id} className="bg-white/10 border border-white/10 rounded-2xl p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className={`inline-flex mt-1 px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadge(c.estado)}`}>
                      {getDashboardCaseStageLabel(c)}
                    </span>
                    {getCaseServiceValue(c) && <p className="text-xs text-slate-400 mt-1">Servicio: {getServiceDisplayName(getCaseServiceValue(c))}</p>}
                    <p className="text-xs text-slate-400 mt-1">{formatDateAr(c.created_at)}</p>
                  </div>
                  <Button
                    className="bg-white/10 hover:bg-white/20 text-white"
                    onClick={() => handleToggleUpdates(c.id)}
                  >
                    {expandedCaseId === c.id ? "Ocultar seguimiento" : "Ver seguimiento"}
                  </Button>
                </div>
                {expandedCaseId === c.id && (
                  <div className="mt-4 space-y-3">
                    {(updates[c.id] || []).length === 0 && (
                      <p className="text-slate-300 text-sm">Aún no hay actualizaciones.</p>
                    )}
                    {(updates[c.id] || []).map((u) => (
                      <div key={u.id} className="border border-white/10 rounded-xl p-3">
                        <p className="text-sm text-slate-200">{u.mensaje}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          {u.estado && (
                            <span className={`inline-flex px-2 py-0.5 rounded-full ${getStatusBadge(u.estado)}`}>
                              {u.estado}
                            </span>
                          )}
                          <span>
                            {u.author_email ? `Actualizado por ${u.author_email}` : "Actualización registrada"}
                          </span>
                          <span>{formatDateAr(u.created_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {!loading && isEnterprise && (
              <div className="space-y-4">
                <div className="bg-white/10 border border-white/10 rounded-2xl p-4">
                  <h3 className="text-base font-semibold">Política de retención de datos</h3>
                  <p className="text-xs text-slate-300 mt-1">
                    Para mayor seguridad, podes definir la eliminacion automatica de casos cerrados.
                  </p>
                  <div className="mt-3 grid md:grid-cols-[1fr_auto] gap-3 items-end">
                    <div>
                      <label className="text-xs text-slate-300 block mb-1">
                        Eliminar casos cerrados automaticamente
                      </label>
                      <select
                        className="w-full rounded-lg bg-slate-900/50 border border-white/15 px-3 py-2 text-sm text-white"
                        value={enterpriseRetentionChoice}
                        onChange={(e) => setEnterpriseRetentionChoice(e.target.value)}
                      >
                        {enterpriseRetentionOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <Button
                      className="bg-emerald-500 hover:bg-emerald-600 text-white"
                      onClick={handleSaveEnterpriseRetention}
                      disabled={savingRetention}
                    >
                      {savingRetention ? "Guardando..." : "Guardar política"}
                    </Button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    La purga aplica solo sobre casos cerrados del panel activo. Los backups siguen su propia rotación técnica.
                  </p>
                  {enterpriseRetentionSaved && (
                    <p className="text-[11px] text-emerald-200 mt-2">
                      Configuracion vigente: {enterpriseRetentionSaved.retention_mode === "auto"
                        ? `${enterpriseRetentionSaved.retention_days} días`
                        : "manual"}.
                    </p>
                  )}
                </div>
                <div className="bg-white/10 border border-white/10 rounded-2xl overflow-hidden">
                <div className="px-4 py-4 border-b border-white/10 bg-white/5">
                  <div className="grid md:grid-cols-4 gap-3">
                    <input
                      className="rounded-lg bg-slate-900/50 border border-white/15 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                      placeholder="Buscar por código, cliente o tipo"
                      value={enterpriseSearchQuery}
                      onChange={(e) => setEnterpriseSearchQuery(e.target.value)}
                    />
                    <select
                      className="rounded-lg bg-slate-900/50 border border-white/15 px-3 py-2 text-sm text-white"
                      value={enterpriseFilterStatus}
                      onChange={(e) => setEnterpriseFilterStatus(e.target.value)}
                    >
                      <option value="">Todos los estados</option>
                      {enterpriseStatusOptions.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                    <select
                      className="rounded-lg bg-slate-900/50 border border-white/15 px-3 py-2 text-sm text-white"
                      value={enterpriseFilterPriority}
                      onChange={(e) => setEnterpriseFilterPriority(e.target.value)}
                    >
                      <option value="">Todas las prioridades</option>
                      {priorityOptions.map((priority) => (
                        <option key={priority} value={priority}>{priority}</option>
                      ))}
                    </select>
                    <div className="text-xs text-slate-300 flex items-center">
                      Mostrando {enterpriseVisibleCases.length} casos
                    </div>
                  </div>
                </div>
                <div className="overflow-auto">
                  <table className="w-full min-w-[1700px] border-collapse">
                    <colgroup>
                      <col style={{ width: enterpriseColumnWidths.codigo }} />
                      <col style={{ width: enterpriseColumnWidths.consulta }} />
                      <col style={{ width: enterpriseColumnWidths.tipo }} />
                      <col style={{ width: enterpriseColumnWidths.descripcion }} />
                      <col style={{ width: enterpriseColumnWidths.estado }} />
                      <col style={{ width: enterpriseColumnWidths.prioridad }} />
                      <col style={{ width: enterpriseColumnWidths.riesgo }} />
                      <col style={{ width: enterpriseColumnWidths.documentacion }} />
                      <col style={{ width: enterpriseColumnWidths.dias }} />
                      <col style={{ width: enterpriseColumnWidths.ultima }} />
                      <col style={{ width: enterpriseColumnWidths.obsEmpresa }} />
                      <col style={{ width: enterpriseColumnWidths.accion }} />
                    </colgroup>
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-300 border-b border-white/10">
                        <th className="px-4 py-3 relative">Código RFA<div className="absolute top-0 right-0 h-full w-2 cursor-col-resize" onMouseDown={(e) => startEnterpriseColumnResize("codigo", e)} /></th>
                        <th className="px-4 py-3 relative">Consulta<div className="absolute top-0 right-0 h-full w-2 cursor-col-resize" onMouseDown={(e) => startEnterpriseColumnResize("consulta", e)} /></th>
                        <th className="px-4 py-3 relative">Tipo de Reclamo<div className="absolute top-0 right-0 h-full w-2 cursor-col-resize" onMouseDown={(e) => startEnterpriseColumnResize("tipo", e)} /></th>
                        <th className="px-4 py-3 relative">Descripción breve<div className="absolute top-0 right-0 h-full w-2 cursor-col-resize" onMouseDown={(e) => startEnterpriseColumnResize("descripcion", e)} /></th>
                        <th className="px-4 py-3 relative">Estado<div className="absolute top-0 right-0 h-full w-2 cursor-col-resize" onMouseDown={(e) => startEnterpriseColumnResize("estado", e)} /></th>
                        <th className="px-4 py-3 relative">Prioridad<div className="absolute top-0 right-0 h-full w-2 cursor-col-resize" onMouseDown={(e) => startEnterpriseColumnResize("prioridad", e)} /></th>
                        <th className="px-4 py-3 relative">Riesgo<div className="absolute top-0 right-0 h-full w-2 cursor-col-resize" onMouseDown={(e) => startEnterpriseColumnResize("riesgo", e)} /></th>
                        <th className="px-4 py-3 relative">Documentación<div className="absolute top-0 right-0 h-full w-2 cursor-col-resize" onMouseDown={(e) => startEnterpriseColumnResize("documentacion", e)} /></th>
                        <th className="px-4 py-3 relative">Días abiertos<div className="absolute top-0 right-0 h-full w-2 cursor-col-resize" onMouseDown={(e) => startEnterpriseColumnResize("dias", e)} /></th>
                        <th className="px-4 py-3 relative">Última actualización<div className="absolute top-0 right-0 h-full w-2 cursor-col-resize" onMouseDown={(e) => startEnterpriseColumnResize("ultima", e)} /></th>
                        <th className="px-4 py-3 relative">Observaciones internas (empresa)<div className="absolute top-0 right-0 h-full w-2 cursor-col-resize" onMouseDown={(e) => startEnterpriseColumnResize("obsEmpresa", e)} /></th>
                        <th className="px-4 py-3 relative">Acción<div className="absolute top-0 right-0 h-full w-2 cursor-col-resize" onMouseDown={(e) => startEnterpriseColumnResize("accion", e)} /></th>
                      </tr>
                    </thead>
                    <tbody>
                      {enterpriseVisibleCases.map((c) => {
                        const openedDays = Math.max(
                          0,
                          Math.floor((Date.now() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24))
                        );
                        return (
                        <Fragment key={c.id}>
                          <tr className="border-b border-white/10 align-top">
                            <td className="px-4 py-3 text-sm text-slate-200">{c.case_code || "-"}</td>
                            <td className="px-4 py-3 text-sm text-slate-100">{c.nombre_completo || c.id || "-"}</td>
                            <td className="px-4 py-3 text-sm text-slate-200">{c.categoria || "-"}</td>
                            <td className="px-4 py-3 text-xs text-slate-300">
                              <p className="line-clamp-2">{c.detalle || c.relato || "-"}</p>
                            </td>
                            <td className="px-4 py-3">
                              <div
                                className={`rounded-lg border ${getStatusBoxClass(
                                  toEnterpriseStatus(enterpriseStatusDrafts[c.id] ?? c.estado ?? "Pendiente")
                                )}`}
                              >
                                <select
                                  className="w-full rounded-lg bg-transparent px-3 py-2 text-xs font-bold text-slate-100 border-0 focus:outline-none"
                                  value={toEnterpriseStatus(enterpriseStatusDrafts[c.id] ?? c.estado ?? "Pendiente")}
                                  onChange={(e) => setEnterpriseStatusDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                                >
                                  {enterpriseStatusOptions.map((status) => (
                                    <option key={status} value={status}>{status}</option>
                                  ))}
                                </select>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div
                                className={`rounded-lg border ${getPriorityBoxClass(
                                  toEnterprisePriority(enterprisePriorityDrafts[c.id] ?? c.prioridad ?? "Pendiente"),
                                  toEnterpriseStatus(enterpriseStatusDrafts[c.id] ?? c.estado ?? "Pendiente")
                                )}`}
                              >
                                <select
                                  className="w-full rounded-lg bg-transparent px-3 py-2 text-xs font-bold text-slate-100 border-0 focus:outline-none"
                                  value={toEnterprisePriority(enterprisePriorityDrafts[c.id] ?? c.prioridad ?? "Pendiente")}
                                  onChange={(e) => setEnterprisePriorityDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                                >
                                  {priorityOptions.map((priority) => (
                                    <option key={priority} value={priority}>{priority}</option>
                                  ))}
                                </select>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex mt-2 px-2 py-0.5 rounded-full text-xs ${getRiskBadge(c.riesgo || "Pendiente")}`}>
                                {c.riesgo || "Pendiente"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs text-slate-200">{getDocumentationLabel(c.documentacion_estado)}</span>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-300">{openedDays}</td>
                            <td className="px-4 py-3 text-xs text-slate-400">{formatDateTimeAr(c.updated_at || c.created_at)}</td>
                            <td className="px-4 py-3">
                              <textarea
                                className="w-full min-w-[240px] rounded-lg bg-slate-900/60 border border-white/20 px-3 py-2 text-xs text-white placeholder:text-slate-400"
                                rows={3}
                                value={enterpriseInternalNotesDrafts[c.id] ?? c.observaciones_empresa ?? ""}
                                onChange={(e) =>
                                  setEnterpriseInternalNotesDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))
                                }
                                placeholder="Notas internas de la empresa"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  className="bg-emerald-500 hover:bg-emerald-600 text-white"
                                  disabled={submitting}
                                  onClick={() => handleEnterpriseUpdateCase(c)}
                                >
                                  Guardar
                                </Button>
                                <Button
                                  className="bg-white/10 hover:bg-white/20 text-white"
                                  onClick={() => handleToggleEnterpriseCaseDetails(c.id)}
                                >
                                  {expandedEnterpriseCaseDetailId === c.id ? "Ocultar" : "Ver caso"}
                                </Button>
                              </div>
                            </td>
                          </tr>
                          {expandedEnterpriseCaseDetailId === c.id && (
                            <tr className="border-b border-white/10 bg-white/5">
                              <td colSpan={12} className="px-4 py-4">
                                <div className="grid md:grid-cols-2 gap-4 text-sm text-slate-300">
                                  <div><span className="text-slate-400">Codigo:</span> {c.case_code || "-"}</div>
                                  <div><span className="text-slate-400">Caso ID:</span> {c.id}</div>
                                  <div><span className="text-slate-400">Cliente:</span> {c.nombre_completo || "-"}</div>
                                  <div><span className="text-slate-400">DNI/CUIT:</span> {c.dni_cuit || "-"}</div>
                                  <div><span className="text-slate-400">Email:</span> {c.email_contacto || "-"}</div>
                                  <div><span className="text-slate-400">Telefono:</span> {c.telefono || "-"}</div>
                                  <div><span className="text-slate-400">Canal origen:</span> {c.canal_origen || "-"}</div>
                                  <div><span className="text-slate-400">Fecha del caso:</span> {c.fecha_caso || "-"}</div>
                                  <div><span className="text-slate-400">Estado:</span> {c.estado || "Pendiente"}</div>
                                  <div><span className="text-slate-400">Prioridad:</span> {c.prioridad || "Pendiente"}</div>
                                  <div><span className="text-slate-400">Riesgo:</span> {c.riesgo || "Pendiente"}</div>
                                  <div><span className="text-slate-400">Documentación:</span> {c.documentacion_estado || "En revisión"}</div>
                                  <div><span className="text-slate-400">Monto:</span> {c.monto_valor ? `${c.monto_valor} ${c.monto_moneda || ""}` : "-"}</div>
                                  <div><span className="text-slate-400">Escala:</span> {c.monto_escala || "-"}</div>
                                  <div className="md:col-span-2">
                                    <span className="text-slate-400">Observaciones internas (empresa):</span>
                                    <p className="mt-1 whitespace-pre-wrap leading-relaxed">{c.observaciones_empresa || "-"}</p>
                                  </div>
                                  <div className="md:col-span-2">
                                    <span className="text-slate-400">Reclamo:</span>
                                    <p className="mt-1 whitespace-pre-wrap leading-relaxed">{c.relato || "-"}</p>
                                  </div>
                                  <div className="md:col-span-2">
                                    <span className="text-slate-400">Historial de cambios:</span>
                                    <div className="mt-2 space-y-2">
                                      {(updates[c.id] || []).length === 0 && (
                                        <p className="text-xs text-slate-400">Sin cambios registrados todavia.</p>
                                      )}
                                      {(updates[c.id] || []).map((u) => (
                                        <div key={u.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                                          <p className="text-xs text-slate-300">{u.mensaje || "Actualización registrada"}</p>
                                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                                            {u.estado && (
                                              <span className={`inline-flex px-2 py-0.5 rounded-full ${getStatusBadge(u.estado)}`}>
                                                {u.estado}
                                              </span>
                                            )}
                                            {u.prioridad && (
                                              <span className={`inline-flex px-2 py-0.5 rounded-full ${getPriorityBadge(u.prioridad)}`}>
                                                {u.prioridad}
                                              </span>
                                            )}
                                            <span>{u.author_email ? `Actualizado por ${u.author_email}` : "Actualización registrada"}</span>
                                            <span>{formatDateTimeAr(u.created_at)}</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              </div>
            )}

            {isRfaUser && (
              <>
                {/* Educación financiera (oculta por ahora) */}
                {/* <div className="bg-white/10 border border-white/10 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold">Educación financiera</h3>
                    <p className="text-xs text-slate-400">Guías útiles para prevenir y actuar mejor</p>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    {educationPosts.map((post) => (
                      <article
                        id={`educacion-${post.id}`}
                        key={post.id}
                        className="border border-white/10 rounded-xl p-4 bg-white/5"
                      >
                        <p className="text-xs uppercase tracking-wide text-emerald-300">{post.category}</p>
                        <h4 className="text-base font-semibold mt-2">{post.title}</h4>
                        <p className="text-sm text-slate-300 mt-2">{post.excerpt}</p>
                        <ul className="mt-3 space-y-1 text-xs text-slate-300">
                          {post.checklist.map((item) => (
                            <li key={item}>⬢ {item}</li>
                          ))}
                        </ul>
                        <Button
                          className="mt-4 bg-white/10 hover:bg-white/20 text-white w-full"
                          onClick={() => handleSharePost(post)}
                        >
                          Compartir
                        </Button>
                      </article>
                    ))}
                  </div>
                </div> */}

                <div className="bg-white/10 border border-white/10 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold">Modalidades de servicio</h3>
                    <p className="text-xs text-slate-400">Análisis inicial sin costo</p>
                  </div>
                  <p className="text-sm text-slate-300">
                    Primero revisamos el caso. Si podemos intervenir, informamos el alcance y el precio antes de comenzar cualquier servicio pago.
                  </p>
                  <div className="grid md:grid-cols-2 gap-4">
                    {plans.map((plan) => (
                      <div key={plan.code} className="border border-white/10 rounded-xl p-4 bg-white/5">
                        <p className="text-sm text-emerald-300 font-semibold">{plan.name}</p>
                        {plan.summary && (
                          <p className="text-xs text-slate-300 mt-2 leading-relaxed">{plan.summary}</p>
                        )}
                        <p className="text-2xl font-bold mt-1">{plan.priceLabel}</p>
                        <p className="text-xs text-slate-400">{plan.currency}</p>
                        <p className="text-xs text-slate-400 mb-3">{plan.period}</p>
                        <ul className="space-y-1 text-xs text-slate-300 mb-4">
                          {plan.features.map((item) => (
                            <li key={item}>⬢ {item}</li>
                          ))}
                        </ul>
                        <div className="flex gap-2">
                          <Button
                            className="bg-slate-900 hover:bg-slate-800 text-white w-full"
                            onClick={() => setInfoPlanId((prev) => (prev === plan.id ? null : plan.id))}
                          >
                            Mas informacion
                          </Button>
                        </div>
                        {infoPlanId === plan.id && (
                          <div className="mt-3 rounded-lg border border-white/15 bg-white/5 p-3 text-xs text-slate-200">
                            <p className="mb-2 font-semibold text-emerald-300">Detalle del servicio</p>
                            {plan.summary && <p className="mb-2 text-slate-300 leading-relaxed">{plan.summary}</p>}
                            <ul className="space-y-1">
                              {(plan.details || []).map((item) => (
                                <li key={item}>• {item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {!loading && isAdmin && adminCaseSourceFilter === "empresa" && (
              <div className="bg-white/10 border border-white/10 rounded-2xl p-5 space-y-4">
                <h2 className="text-xl font-semibold">Generar usuario empresa</h2>
                <form onSubmit={handleCreateEnterpriseUser} className="grid md:grid-cols-[1fr_1fr_auto] gap-3">
                  <input
                    type="email"
                    value={newEnterpriseEmail}
                    onChange={(e) => setNewEnterpriseEmail(e.target.value)}
                    placeholder="empresa@dominio.com"
                    className="rounded-lg bg-white/10 border border-white/10 px-4 py-2 text-white placeholder:text-slate-400"
                    required
                  />
                  <input
                    type="text"
                    value={newEnterprisePassword}
                    onChange={(e) => setNewEnterprisePassword(e.target.value)}
                    placeholder="Contraseña (opcional)"
                    className="rounded-lg bg-white/10 border border-white/10 px-4 py-2 text-white placeholder:text-slate-400"
                  />
                  <Button
                    type="submit"
                    className="bg-emerald-500 hover:bg-emerald-600 text-white"
                    disabled={creatingEnterpriseUser}
                  >
                    {creatingEnterpriseUser ? "Generando..." : "Generar usuario empresa"}
                  </Button>
                </form>
                <p className="text-xs text-slate-400">
                  Si no cargas contraseña, el sistema genera una segura automáticamente.
                </p>
                {generatedEnterpriseCredentials && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-slate-200">
                    <p><span className="text-slate-400">Email:</span> {generatedEnterpriseCredentials.email}</p>
                    <p><span className="text-slate-400">Contraseña:</span> {generatedEnterpriseCredentials.password}</p>
                    <div className="mt-3">
                      <Button
                        type="button"
                        className="bg-white/10 hover:bg-white/20 text-white"
                        onClick={handleCopyEnterpriseCredentials}
                      >
                        {copiedCredentials ? "Copiado" : "Copiar credenciales"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!loading && isAdmin && (
              <div className="bg-white/10 border border-white/10 rounded-2xl p-5 space-y-4">
                <h2 className="text-xl font-semibold">Comprobantes y pagos</h2>
                {adminPaymentCases.length === 0 ? (
                  <p className="text-slate-300 text-sm">Todavía no hay comprobantes cargados.</p>
                ) : (
                  <div className="overflow-auto">
                    <table className="w-full min-w-[900px] border-collapse">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-slate-300 border-b border-white/10">
                          <th className="px-4 py-3">Código</th>
                          <th className="px-4 py-3">Cliente</th>
                          <th className="px-4 py-3">Email</th>
                          <th className="px-4 py-3">Servicio</th>
                          <th className="px-4 py-3">Cargado</th>
                          <th className="px-4 py-3">Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminPaymentCases.map((c) => (
                          <tr key={`payment-${c.id}`} className="border-b border-white/10">
                            <td className="px-4 py-3 text-sm text-slate-200">{c.case_code || c.id}</td>
                            <td className="px-4 py-3 text-sm text-slate-100">{c.nombre_completo || "Sin nombre"}</td>
                            <td className="px-4 py-3 text-sm text-slate-200">{getCaseContactEmail(c) || "-"}</td>
                            <td className="px-4 py-3 text-sm text-slate-200">{getServiceDisplayName(getCaseServiceValue(c)) || "-"}</td>
                            <td className="px-4 py-3 text-xs text-slate-400">
                              {c.payment_receipt_uploaded_at
                                ? formatDateTimeAr(c.payment_receipt_uploaded_at)
                                : "-"}
                            </td>
                            <td className="px-4 py-3">
                              <Button
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => handleDownloadPaymentReceipt(c)}
                                disabled={downloadingReceiptCaseId === c.id}
                              >
                                {downloadingReceiptCaseId === c.id ? "Descargando..." : "Descargar comprobante"}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {!loading && isAdmin && (
              <div className="bg-white/10 border border-white/10 rounded-2xl p-5 space-y-4">
                <h2 className="text-xl font-semibold">Consultas de empresas</h2>
                {enterpriseInquiries.length === 0 ? (
                  <p className="text-slate-300 text-sm">Todavía no hay consultas registradas.</p>
                ) : (
                  <div className="overflow-auto">
                    <table className="w-full min-w-[980px] border-collapse">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-slate-300 border-b border-white/10">
                          <th className="px-4 py-3">Empresa</th>
                          <th className="px-4 py-3">Rubro</th>
                          <th className="px-4 py-3">Contacto</th>
                          <th className="px-4 py-3">Email</th>
                          <th className="px-4 py-3">Volumen</th>
                          <th className="px-4 py-3">Servicios</th>
                          <th className="px-4 py-3">Fecha</th>
                          <th className="px-4 py-3">Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {enterpriseInquiries.map((item) => (
                          <>
                            <tr key={item.id} className="border-b border-white/10 align-top">
                              <td className="px-4 py-3 text-sm text-slate-100">{item.empresa}</td>
                              <td className="px-4 py-3 text-sm text-slate-200">{item.rubro}</td>
                              <td className="px-4 py-3 text-sm text-slate-200">
                                {item.contacto}
                                {item.telefono && (
                                  <p className="text-xs text-slate-400 mt-1">{item.telefono}</p>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-200">{item.email}</td>
                              <td className="px-4 py-3 text-sm text-slate-200">{item.volumen}</td>
                              <td className="px-4 py-3 text-xs text-slate-300">
                                {parseServices(item.servicios).join(", ")}
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-400">
                                {formatDateAr(item.created_at)}
                              </td>
                              <td className="px-4 py-3">
                                <Button
                                  className="bg-white/10 hover:bg-white/20 text-white"
                                  onClick={() =>
                                    setExpandedInquiryId((prev) => (prev === item.id ? null : item.id))
                                  }
                                >
                                  {expandedInquiryId === item.id ? "Ocultar" : "Ver detalle"}
                                </Button>
                              </td>
                            </tr>
                            {expandedInquiryId === item.id && (
                              <tr className="border-b border-white/10 bg-white/5">
                                <td colSpan={8} className="px-4 py-4">
                                  <div className="grid md:grid-cols-2 gap-4 text-sm text-slate-300">
                                    <div>
                                      <p className="text-slate-400 text-xs uppercase mb-1">Descripción</p>
                                      <p>{item.descripcion || "-"}</p>
                                    </div>
                                    <div>
                                      <p className="text-slate-400 text-xs uppercase mb-1">Comentarios adicionales</p>
                                      <p>{item.comentarios || "Sin comentarios"}</p>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}





