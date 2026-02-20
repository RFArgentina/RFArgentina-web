import { Fragment, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiRequest } from "@/lib/api";
import { clearToken, getToken } from "@/lib/auth";
import { formatDateAr, formatDateTimeAr } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { plans } from "@/data/plans";

const FIRST_CONTACT_PLAN = "Primer contacto (sin cargo)";
const PUBLIC_INTAKE_EMAIL = "intake.publico@rfargentina.com";

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = getToken();
  const isPublicCreateMode = !token && location.pathname === "/crear-caso";
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
  const [planElegido, setPlanElegido] = useState("");
  const [montoEscala, setMontoEscala] = useState("");
  const [montoMoneda, setMontoMoneda] = useState("");
  const [mediosPago, setMediosPago] = useState([]);
  const [relato, setRelato] = useState("");
  const [autorizacion, setAutorizacion] = useState(false);
  const [adjuntos, setAdjuntos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [updates, setUpdates] = useState({});
  const [expandedCaseId, setExpandedCaseId] = useState(null);
  const [expandedCaseDetailId, setExpandedCaseDetailId] = useState(null);
  const [expandedInquiryId, setExpandedInquiryId] = useState(null);
  const [transferPlanId, setTransferPlanId] = useState(null);
  const [infoPlanId, setInfoPlanId] = useState(null);
  const [enterpriseInquiries, setEnterpriseInquiries] = useState([]);
  const [enterpriseUsers, setEnterpriseUsers] = useState([]);
  const [newEnterpriseEmail, setNewEnterpriseEmail] = useState("");
  const [newEnterprisePassword, setNewEnterprisePassword] = useState("");
  const [creatingEnterpriseUser, setCreatingEnterpriseUser] = useState(false);
  const [generatedEnterpriseCredentials, setGeneratedEnterpriseCredentials] = useState(null);
  const [copiedCredentials, setCopiedCredentials] = useState(false);
  const [selectedEnterpriseUserId, setSelectedEnterpriseUserId] = useState("");
  const [importFile, setImportFile] = useState(null);
  const [importSummary, setImportSummary] = useState(null);
  const [importing, setImporting] = useState(false);
  const [enterpriseStatusDrafts, setEnterpriseStatusDrafts] = useState({});
  const [enterprisePriorityDrafts, setEnterprisePriorityDrafts] = useState({});
  const [enterpriseSearchQuery, setEnterpriseSearchQuery] = useState("");
  const [enterpriseFilterStatus, setEnterpriseFilterStatus] = useState("");
  const [enterpriseFilterPriority, setEnterpriseFilterPriority] = useState("");
  const [enterpriseRetentionChoice, setEnterpriseRetentionChoice] = useState("manual");
  const [enterpriseRetentionSaved, setEnterpriseRetentionSaved] = useState(null);
  const [savingRetention, setSavingRetention] = useState(false);
  const [expandedEnterpriseCaseDetailId, setExpandedEnterpriseCaseDetailId] = useState(null);
  const [showNewCaseForm, setShowNewCaseForm] = useState(true);
  const [publicCaseCode, setPublicCaseCode] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [adminStatus, setAdminStatus] = useState("");
  const [adminPriority, setAdminPriority] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPlan, setFilterPlan] = useState("");
  const [filterMoneda, setFilterMoneda] = useState("");
  const [filterEntidad, setFilterEntidad] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [downloadingReceiptCaseId, setDownloadingReceiptCaseId] = useState(null);

  const statusOptions = [
    "Recibido",
    "En análisis",
    "Documentación solicitada",
    "Viable (pendiente de pago)",
    "No viable",
    "Presentado ante entidad",
    "En espera de respuesta",
    "Respuesta recibida",
    "Cerrado"
  ];
  const enterpriseStatusOptions = ["Recibido", "En análisis", "Pendiente interno", "Cerrado"];
  const priorityOptions = ["Alta", "Media", "Baja"];
  const enterpriseRetentionOptions = [
    { value: "manual", label: "Manual (sin purga automatica)" },
    { value: "30", label: "Eliminar a los 30 días" },
    { value: "60", label: "Eliminar a los 60 días" },
    { value: "90", label: "Eliminar a los 90 días" }
  ];

  const statusTemplates = {
    "Recibido": "Caso recibido correctamente. En breve iniciamos el análisis.",
    "En análisis": "Estamos revisando la documentación y el relato para determinar la viabilidad.",
    "Documentación solicitada": "Te solicitamos documentación adicional para avanzar con el reclamo.",
    "Viable (pendiente de pago)":
      "Tu caso es viable. Te enviamos una carpeta demo. Para continuar, te recomendamos Plan Gestión Básica o Plan Completo.",
    "No viable": "Luego de analizar la información, el caso no resulta viable por el momento.",
    "Presentado ante entidad": "Reclamo presentado formalmente ante la entidad. Seguimos el proceso.",
    "En espera de respuesta": "El reclamo ya fue enviado. Estamos esperando respuesta de la entidad.",
    "Respuesta recibida": "Recibimos respuesta de la entidad. Te informaremos los próximos pasos.",
    "Cerrado": "El caso fue cerrado. Si necesitás continuar, contactanos."
  };

  const normalizePlanName = (value = "") =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  const findPlanByName = (planName = "") => {
    const normalized = normalizePlanName(planName);
    if (!normalized) return null;
    return plans.find((plan) => {
      const planNameNormalized = normalizePlanName(plan.name);
      return normalized === planNameNormalized || normalized.includes(plan.id);
    }) || null;
  };

  const BANK_TRANSFER = {
    titular: "Matias Hernan Masdeu",
    banco: "Banco Supervielle",
    cbu: "0270053320052964280015",
    alias: "MATIASHERNAN.M",
    referencia: "Indica tu email y plan elegido en el comprobante"
  };
  const isNewCase = (c) => {
    if (!c) return false;
    return c.estado === "Recibido";
  };

  const educationPosts = [

    {
      id: "bloqueo-cuenta",
      title: "¿Te bloquearon la cuenta o billetera",
      category: "Bancos y billeteras",
      excerpt: "Guardá capturas, comprobantes y fechas. El primer reclamo formal define buena parte del resultado.",
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
  const activeCases = useMemo(
    () => cases.filter((c) => c.estado !== "Cerrado"),
    [cases]
  );
  const hasActiveCase = activeCases.length > 0;
  const hasMultipleCasesPlan = cases.some((c) => {
    const plan = (c.plan_elegido || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    return plan.includes("plan completo");
  });
  const canCreateCase = !hasActiveCase || hasMultipleCasesPlan;
  const canSubmitCase = isPublicCreateMode ? true : canCreateCase;

  const adminFilteredCases = useMemo(() => {
    if (!isAdmin) return cases;
    const query = searchQuery.trim().toLowerCase();
    return cases.filter((c) => {
      const matchStatus = !filterStatus || c.estado === filterStatus;
      const matchPlan = !filterPlan || c.plan_elegido === filterPlan;
      const matchMoneda = !filterMoneda || c.monto_moneda === filterMoneda;
      const entidadText = (c.entidad || "").toLowerCase();
      const matchEntidad = !filterEntidad || entidadText.includes(filterEntidad.toLowerCase());
      if (!query) return matchStatus && matchPlan && matchMoneda && matchEntidad;
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
        c.plan_elegido
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchSearch = haystack.includes(query);
      return matchStatus && matchPlan && matchMoneda && matchEntidad && matchSearch;
    });
  }, [cases, filterStatus, filterPlan, filterMoneda, filterEntidad, searchQuery, isAdmin]);

  const sortedCases = useMemo(() => {
    if (!isAdmin) return adminFilteredCases;
    const sorted = [...adminFilteredCases];
    const dir = sortDir === "asc" ? 1 : -1;
    sorted.sort((a, b) => {
      const va = a[sortKey] ?? "";
      const vb = b[sortKey] ?? "";
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
    return cases.filter((c) => {
      const matchStatus = !enterpriseFilterStatus || (c.estado || "Recibido") === enterpriseFilterStatus;
      const matchPriority = !enterpriseFilterPriority || (c.prioridad || "Media") === enterpriseFilterPriority;
      if (!query) return matchStatus && matchPriority;
      const haystack = [
        c.case_code,
        c.nombre_completo,
        c.id,
        c.email_contacto,
        c.dni_cuit
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchStatus && matchPriority && haystack.includes(query);
    });
  }, [cases, enterpriseSearchQuery, enterpriseFilterStatus, enterpriseFilterPriority, isEnterprise]);

  const getMontoBadge = (moneda, escala) => {
    if (!moneda || !escala) return { label: "Monto sin clasificar", className: "bg-white/10 text-slate-300" };
    const key = `${moneda}-${escala}`.toLowerCase();
    const map = {
      "ars-cientos": "bg-slate-700/50 text-slate-200",
      "ars-miles": "bg-emerald-600/30 text-emerald-200",
      "ars-millones": "bg-emerald-500/60 text-emerald-100",
      "usd-cientos": "bg-sky-600/30 text-sky-200",
      "usd-miles": "bg-sky-500/50 text-sky-100",
      "usd-millones": "bg-sky-500/70 text-white"
    };
    return {
      label: `${moneda} · ${escala}`,
      className: map[key] || "bg-white/10 text-slate-300"
    };
  };

  const getStatusBadge = (status) => {
    const map = {
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
      Alta: "bg-rose-500/40 text-rose-200",
      Media: "bg-amber-500/40 text-amber-200",
      Baja: "bg-emerald-500/30 text-emerald-200"
    };
    return map[priority] || "bg-white/10 text-slate-300";
  };

  const getStatusBoxClass = (status) => {
    const map = {
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
      Alta: "border-rose-400/60 bg-rose-500/20",
      Media: "border-amber-400/60 bg-amber-500/20",
      Baja: "border-emerald-400/60 bg-emerald-500/20"
    };
    return map[priority] || "border-white/20 bg-white/5";
  };


  useEffect(() => {
    if (!token) {
      if (isPublicCreateMode) {
        setLoading(false);
        return;
      }
      navigate("/login");
      return;
    }
    loadCases();
  }, [token, isPublicCreateMode, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    const raw = localStorage.getItem("rfa_admin_filters");
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      setFilterStatus(saved.filterStatus || "");
      setFilterPlan(saved.filterPlan || "");
      setFilterMoneda(saved.filterMoneda || "");
      setFilterEntidad(saved.filterEntidad || "");
      setSearchQuery(saved.searchQuery || "");
      setSortKey(saved.sortKey || "created_at");
      setSortDir(saved.sortDir || "desc");
      setPageSize(saved.pageSize || 10);
    } catch {
      localStorage.removeItem("rfa_admin_filters");
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    if (page !== 1) setPage(1);
  }, [filterStatus, filterPlan, filterMoneda, filterEntidad, searchQuery, pageSize, sortKey, sortDir, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages, isAdmin]);

  const loadCases = async () => {
    setLoading(true);
    setError("");
    try {
      const me = await apiRequest("/me");
      setUser(me);
      const data = await apiRequest("/cases");
      setCases(data || []);
      if (me.role === "admin") {
        const inquiries = await apiRequest("/enterprise");
        setEnterpriseInquiries(inquiries || []);
        const enterpriseUsersData = await apiRequest("/enterprise-users");
        setEnterpriseUsers(enterpriseUsersData || []);
      } else if (me.role === "enterprise") {
        const retentionConfig = await apiRequest("/enterprise-retention");
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
      setError(err.message);
    } finally {
      setLoading(false);
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

  const handleToggleCaseDetails = (caseId) => {
    setExpandedCaseDetailId((prev) => (prev === caseId ? null : caseId));
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
      filterPlan,
      filterMoneda,
      filterEntidad,
      searchQuery,
      sortKey,
      sortDir,
      pageSize
    };
    localStorage.setItem("rfa_admin_filters", JSON.stringify(payload));
  };

  const clearFilters = () => {
    setFilterStatus("");
    setFilterPlan("");
    setFilterMoneda("");
    setFilterEntidad("");
    setSearchQuery("");
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
      "Plan",
      "Estado",
      "Prioridad",
      "Moneda",
      "Escala",
      "Monto",
      "Creado"
    ];
    const escapeCell = (value) => {
      const str = String(value ?? "");
      return `"${str.replace(/"/g, '""')}"`;
    };
    const rows = sortedCases.map((c) => [
      c.id,
      c.case_code || "",
      c.empresa || c.enterprise_email || "",
      c.nombre_completo || "",
      getCaseContactEmail(c) || "",
      c.entidad || "",
      c.plan_elegido || "",
      c.estado || "",
      c.prioridad || "",
      c.monto_moneda || "",
      c.monto_escala || "",
      c.monto_valor || "",
      c.created_at || ""
    ]);
    const csvBody = [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n");
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

  const handleCreateCase = async (event) => {
    event.preventDefault();
    if (!canSubmitCase) {
      setError("Solo podés cargar un nuevo reclamo si tenés Plan Completo.");
      return;
    }
    if (!String(emailContacto || "").trim() && !String(dniCuit || "").trim()) {
      setError("Debes completar email o DNI/CUIT para poder consultar el caso luego.");
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
      formData.append("plan_elegido", planElegido);
      formData.append("medios_pago", JSON.stringify(mediosPago));
      formData.append("relato", relato);
      formData.append("autorizacion", autorizacion ? "true" : "false");
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
      setMontoMoneda("");
      setPlanElegido("");
      setMediosPago([]);
      setRelato("");
      setAutorizacion(false);
      setAdjuntos([]);
      if (isPublicCreateMode) {
        setPublicCaseCode(created?.case_code || "");
      } else {
        await loadCases();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleImportCases = async (event) => {
    event.preventDefault();
    if (!selectedEnterpriseUserId) {
      setError("Selecciona un usuario empresa para importar.");
      return;
    }
    if (!importFile) {
      setError("Debes adjuntar un archivo CSV.");
      return;
    }
    setImporting(true);
    setError("");
    setImportSummary(null);
    try {
      const formData = new FormData();
      formData.append("enterprise_user_id", selectedEnterpriseUserId);
      formData.append("file", importFile);
      const result = await apiRequest("/cases/import", {
        method: "POST",
        body: formData
      });
      setImportSummary(result);
      setImportFile(null);
      await loadCases();
    } catch (err) {
      setError(err.message || "No se pudo importar casos.");
    } finally {
      setImporting(false);
    }
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

  const handleEnterpriseUpdateCase = async (caseId) => {
    const nextStatus = enterpriseStatusDrafts[caseId];
    const nextPriority = enterprisePriorityDrafts[caseId];
    if (!nextStatus && !nextPriority) {
      setError("Debes elegir estado o prioridad para actualizar.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await apiRequest(`/cases/${caseId}/updates`, {
        method: "POST",
        body: JSON.stringify({
          mensaje: "Actualización interna de empresa.",
          estado: nextStatus || null,
          prioridad: nextPriority || null
        })
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

  const handleToggleUpdates = async (caseId) => {
    if (expandedCaseId === caseId) {
      setExpandedCaseId(null);
      return;
    }
    setExpandedCaseId(caseId);
    if (!updates[caseId]) {
      try {
        const data = await apiRequest(`/cases/${caseId}/updates`);
        setUpdates((prev) => ({ ...prev, [caseId]: data || [] }));
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const handleLogout = () => {
    clearToken();
    navigate("/");
  };

  const handleAdminUpdate = async (caseId) => {
    setSubmitting(true);
    setError("");
    try {
      await apiRequest(`/cases/${caseId}/updates`, {
        method: "POST",
        body: JSON.stringify({ mensaje: adminNote, estado: adminStatus || null, prioridad: adminPriority || null })
      });
      setAdminNote("");
      setAdminStatus("");
      setAdminPriority("");
      const data = await apiRequest(`/cases/${caseId}/updates`);
      setUpdates((prev) => ({ ...prev, [caseId]: data || [] }));
      await loadCases();
    } catch (err) {
      setError(err.message);
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
      return;
    }
    const waUrl = `https://wa.me/text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`;
    window.open(waUrl, "_blank");
  };

  return (
    <div className="min-h-screen text-slate-100 px-4 md:px-6 py-16 pt-24">
      <div className="max-w-[92rem] mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-3xl font-bold">Panel de casos</h1>
            <p className="text-slate-300">
              {isPublicCreateMode
                ? "Completa el formulario para crear tu caso y obtener tu ID de seguimiento."
                : isAdmin
                  ? "Panel administrador: revisa y actualiza todos los reclamos."
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
        </div>

        <div className={`grid gap-8 ${isAdmin ? "md:grid-cols-1" : "md:grid-cols-1"}`}>
          {!isAdmin && !isEnterprise && (
          <div className="bg-white/10 border border-white/10 rounded-2xl p-6 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl font-semibold">Nuevo reclamo</h2>
                <p className="text-xs text-slate-400">Completá los datos básicos para iniciar el caso.</p>
              </div>
              <Button
                type="button"
                className="bg-white/10 hover:bg-white/20 text-white"
                onClick={() => setShowNewCaseForm((prev) => !prev)}
              >
                {showNewCaseForm ? "Ocultar" : "Mostrar"}
              </Button>
            </div>
            {!canSubmitCase && (
              <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                Ya tenés un reclamo activo. Para cargar uno nuevo necesitás Plan Completo.
              </div>
            )}
            {showNewCaseForm && (
            <form onSubmit={handleCreateCase} className="space-y-4">
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
              <div className="grid md:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="DNI / CUIT"
                  aria-label="DNI o CUIT"
                  className="w-full rounded-lg bg-white/10 border border-white/10 px-4 py-3 text-white placeholder:text-slate-400"
                  value={dniCuit}
                  onChange={(e) => setDniCuit(e.target.value)}
                  disabled={!canSubmitCase}
                />
                <input
                  type="email"
                  placeholder="Correo electrónico"
                  className="w-full rounded-lg bg-white/10 border border-white/10 px-4 py-3 text-white placeholder:text-slate-400"
                  value={emailContacto}
                  onChange={(e) => setEmailContacto(e.target.value)}
                  disabled={!canSubmitCase}
                />
              </div>
              <input
                type="tel"
                placeholder="Teléfono / WhatsApp"
                className="w-full rounded-lg bg-white/10 border border-white/10 px-4 py-3 text-white placeholder:text-slate-400"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                disabled={!canSubmitCase}
              />
              <input
                type="text"
                placeholder="Entidad o empresa"
                aria-label="Entidad o empresa"
                className="w-full rounded-lg bg-white/10 border border-white/10 px-4 py-3 text-white placeholder:text-slate-400"
                value={entidad}
                onChange={(e) => setEntidad(e.target.value)}
                disabled={!canSubmitCase}
              />
              <select
                className="w-full rounded-lg bg-slate-900/70 border border-white/20 px-4 py-3 text-white"
                aria-label="Tipo de entidad"
                value={tipoEntidad}
                onChange={(e) => setTipoEntidad(e.target.value)}
                disabled={!canSubmitCase}
              >
                <option value="">Tipo de entidad</option>
                <option value="Banco tradicional">Banco tradicional</option>
                <option value="Banco digital">Banco digital</option>
                <option value="Billetera digital">Billetera digital</option>
                <option value="Plataforma de inversión">Plataforma de inversión</option>
                <option value="Casa de apuestas">Casa de apuestas</option>
                <option value="Otro">Otro</option>
              </select>
              <div className="grid md:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Monto (aprox.)"
                  aria-label="Monto aproximado"
                  className="w-full rounded-lg bg-white/10 border border-white/10 px-4 py-3 text-white placeholder:text-slate-400"
                  value={montoValor}
                  onChange={(e) => setMontoValor(e.target.value)}
                  disabled={!canSubmitCase}
                />
                <select
                  className="w-full rounded-lg bg-slate-900/70 border border-white/20 px-4 py-3 text-white"
                  aria-label="Escala de monto"
                  value={montoEscala}
                  onChange={(e) => setMontoEscala(e.target.value)}
                  disabled={!canSubmitCase}
                >
                  <option value="">Escala</option>
                  <option value="Cientos">Cientos</option>
                  <option value="Miles">Miles</option>
                  <option value="Millones">Millones</option>
                </select>
                <select
                  className="w-full rounded-lg bg-slate-900/70 border border-white/20 px-4 py-3 text-white"
                  aria-label="Moneda"
                  value={montoMoneda}
                  onChange={(e) => setMontoMoneda(e.target.value)}
                  disabled={!canSubmitCase}
                >
                  <option value="">Moneda</option>
                  <option value="ARS">Peso (ARS)</option>
                  <option value="USD">Dólar (USD)</option>
                </select>
              </div>
              <select
                className="w-full rounded-lg bg-slate-900/70 border border-white/20 px-4 py-3 text-white"
                aria-label="Plan elegido"
                value={planElegido}
                onChange={(e) => setPlanElegido(e.target.value)}
                disabled={!canSubmitCase}
              >
                <option value="">Elegir plan</option>
                <option value={FIRST_CONTACT_PLAN}>{FIRST_CONTACT_PLAN}</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.name}>{plan.name}</option>
                ))}
              </select>
              <div className="space-y-2">
                <p className="text-sm text-slate-300">Medios de pago</p>
                {["Transferencia bancaria", "Tarjeta de crédito", "Tarjeta de débito", "PayPal", "Otros"].map((medio) => (
                  <label key={medio} className="flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={mediosPago.includes(medio)}
                      disabled={!canSubmitCase}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setMediosPago((prev) => [...prev, medio]);
                        } else {
                          setMediosPago((prev) => prev.filter((m) => m !== medio));
                        }
                      }}
                    />
                    {medio}
                  </label>
                ))}
              </div>
              <textarea
                placeholder="Descripción del caso (contá con tus palabras qué pasó)"
                className="w-full rounded-lg bg-white/10 border border-white/10 px-4 py-3 text-white placeholder:text-slate-400 min-h-[160px]"
                value={relato}
                onChange={(e) => setRelato(e.target.value)}
                disabled={!canSubmitCase}
                required
              />
              <input
                type="file"
                aria-label="Adjuntar archivos"
                multiple
                className="w-full rounded-lg bg-white/10 border border-white/10 px-4 py-3 text-white"
                onChange={(e) => setAdjuntos(e.target.files)}
                disabled={!canSubmitCase}
              />
              <label className="flex items-start gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={autorizacion}
                  onChange={(e) => setAutorizacion(e.target.checked)}
                  disabled={!canSubmitCase}
                  required
                />
                Autorizo a RFA a realizar gestiones administrativas y comunicaciones en mi nombre con el único fin de
                resolver el reclamo informado.
              </label>
              {publicCaseCode && (
                <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                  Caso cargado. Guarda tu ID de seguimiento: <strong>{publicCaseCode}</strong>
                </div>
              )}
              {error && <p className="text-rose-300 text-sm">{error}</p>}
              <Button
                type="submit"
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
                disabled={submitting || !canSubmitCase}
              >
                {submitting ? "Enviando..." : "Enviar reclamo"}
              </Button>
            </form>
            )}
          </div>
          )}

          <div className="space-y-4">
            <h2 className="text-xl font-semibold">{isAdmin ? "Panel administrador: revisa y actualiza todos los reclamos." : isEnterprise ? "Panel empresa: organiza y clasifica casos con estado y prioridad." : "Carga nuevos reclamos y sigue el estado."}</h2>

            {isAdmin && (
              <div className="bg-white/10 border border-white/10 rounded-2xl p-4">
                <div className="grid md:grid-cols-5 gap-3">
                  <input
                    type="text"
                    placeholder="Busqueda global"
                    className="rounded-lg bg-slate-900/70 border border-white/20 px-3 py-2 text-white placeholder:text-slate-400"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <select
                    className="rounded-lg bg-slate-900/70 border border-white/20 px-3 py-2 text-white"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="">Estado</option>
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                  <select
                    className="rounded-lg bg-slate-900/70 border border-white/20 px-3 py-2 text-white"
                    value={filterPlan}
                    onChange={(e) => setFilterPlan(e.target.value)}
                  >
                    <option value="">Plan</option>
                    <option value={FIRST_CONTACT_PLAN}>{FIRST_CONTACT_PLAN}</option>
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.name}>{plan.name}</option>
                    ))}
                  </select>
                  <select
                    className="rounded-lg bg-slate-900/70 border border-white/20 px-3 py-2 text-white"
                    value={filterMoneda}
                    onChange={(e) => setFilterMoneda(e.target.value)}
                  >
                    <option value="">Moneda</option>
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Entidad"
                    className="rounded-lg bg-slate-900/70 border border-white/20 px-3 py-2 text-white placeholder:text-slate-400"
                    value={filterEntidad}
                    onChange={(e) => setFilterEntidad(e.target.value)}
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <select
                    className="rounded-lg bg-slate-900/70 border border-white/20 px-3 py-2 text-white"
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value)}
                  >
                    <option value="created_at">Orden: fecha</option>
                    <option value="nombre_completo">Orden: cliente</option>
                    <option value="entidad">Orden: entidad</option>
                    <option value="estado">Orden: estado</option>
                    <option value="plan_elegido">Orden: plan</option>
                  </select>
                  <select
                    className="rounded-lg bg-slate-900/70 border border-white/20 px-3 py-2 text-white"
                    value={sortDir}
                    onChange={(e) => setSortDir(e.target.value)}
                  >
                    <option value="desc">Descendente</option>
                    <option value="asc">Ascendente</option>
                  </select>
                  <select
                    className="rounded-lg bg-slate-900/70 border border-white/20 px-3 py-2 text-white"
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                  >
                    <option value={10}>10 por pagina</option>
                    <option value={20}>20 por pagina</option>
                    <option value={50}>50 por pagina</option>
                  </select>
                  <Button className="bg-white/10 hover:bg-white/20 text-white" onClick={saveFilters}>
                    Guardar filtros
                  </Button>
                  <Button className="bg-white/10 hover:bg-white/20 text-white" onClick={clearFilters}>
                    Limpiar
                  </Button>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={exportCsv}>
                    Exportar CSV
                  </Button>
                  <span className="text-xs text-slate-300">
                    {sortedCases.length} resultados
                  </span>
                </div>
              </div>
            )}

            {isAdmin && (
              <div className="bg-white/10 border border-white/10 rounded-2xl p-4">
                <h3 className="text-lg font-semibold mb-3">Carga masiva de casos por empresa</h3>
                <form onSubmit={handleImportCases} className="grid md:grid-cols-4 gap-3 items-end">
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
                  <div>
                    <label className="text-xs text-slate-300">Archivo CSV</label>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="mt-1 w-full rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-white"
                      onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
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

            {loading && <p className="text-slate-300">Cargando casos...</p>}
            {!loading && (isAdmin ? sortedCases.length === 0 : visibleCases.length === 0) && (
              <p className="text-slate-300">{isAdmin ? "Panel administrador: revisa y actualiza todos los reclamos." : isEnterprise ? "Panel empresa: organiza y clasifica casos con estado y prioridad." : "Carga nuevos reclamos y sigue el estado."}</p>
            )}

            {!loading && isAdmin && sortedCases.length > 0 && (
              <div className="bg-white/10 border border-white/10 rounded-2xl overflow-hidden">
                <div className="overflow-auto">
                  <table className="w-full min-w-[1080px] border-collapse">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-300 border-b border-white/10">
                        <th className="px-4 py-3">
                          <button type="button" className="uppercase tracking-wide" onClick={() => handleSort("nombre_completo")}>
                            Cliente {sortKey === "nombre_completo" ? (sortDir === "asc" ? "?" : "?") : ""}
                          </button>
                        </th>
                        <th className="px-4 py-3">Codigo</th>
                        <th className="px-4 py-3">Empresa</th>
                        <th className="px-4 py-3">Contacto</th>
                        <th className="px-4 py-3">
                          <button type="button" className="uppercase tracking-wide" onClick={() => handleSort("entidad")}>
                            Entidad {sortKey === "entidad" ? (sortDir === "asc" ? "?" : "?") : ""}
                          </button>
                        </th>
                        <th className="px-4 py-3">Monto</th>
                        <th className="px-4 py-3">
                          <button type="button" className="uppercase tracking-wide" onClick={() => handleSort("plan_elegido")}>
                            Plan {sortKey === "plan_elegido" ? (sortDir === "asc" ? "?" : "?") : ""}
                          </button>
                        </th>
                        <th className="px-4 py-3">
                          <button type="button" className="uppercase tracking-wide" onClick={() => handleSort("estado")}>
                            Estado {sortKey === "estado" ? (sortDir === "asc" ? "?" : "?") : ""}
                          </button>
                        </th>
                        <th className="px-4 py-3">
                          <button type="button" className="uppercase tracking-wide" onClick={() => handleSort("prioridad")}>
                            Prioridad {sortKey === "prioridad" ? (sortDir === "asc" ? "?" : "?") : ""}
                          </button>
                        </th>
                        <th className="px-4 py-3">
                          <button type="button" className="uppercase tracking-wide" onClick={() => handleSort("created_at")}>
                            Fecha {sortKey === "created_at" ? (sortDir === "asc" ? "?" : "?") : ""}
                          </button>
                        </th>
                        <th className="px-4 py-3">Accion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedCases.map((c) => (
                        <Fragment key={c.id}>
                          <tr
                            className={`border-b border-white/10 align-top ${
                              isNewCase(c) ? "bg-emerald-500/10" : ""
                            }`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <p className="text-sm text-slate-100">{c.nombre_completo || "Sin nombre"}</p>
                                {isNewCase(c) && (
                                  <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-emerald-500/20 text-emerald-200">
                                    Nuevo
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400">{c.dni_cuit || "-"}</p>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-200">{c.case_code || "-"}</td>
                            <td className="px-4 py-3 text-sm text-slate-200">{c.empresa || c.enterprise_email || "-"}</td>
                            <td className="px-4 py-3">
                              <p className="text-sm text-slate-200">{getCaseContactEmail(c) || "Sin email"}</p>
                              <p className="text-xs text-slate-400">{c.telefono || "-"}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm text-slate-200">{c.entidad || "Sin entidad"}</p>
                              <p className="text-xs text-slate-400">{c.tipo_entidad || "-"}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${getMontoBadge(c.monto_moneda, c.monto_escala).className}`}>
                                {getMontoBadge(c.monto_moneda, c.monto_escala).label}
                              </span>
                              <p className="text-xs text-slate-400 mt-1">{c.monto_valor || "-"}</p>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-200">{c.plan_elegido || "Sin plan"}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadge(c.estado)}`}>
                                {c.estado}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${getPriorityBadge(c.prioridad)}`}>
                                {c.prioridad || "Media"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-400">
                              {formatDateAr(c.created_at)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-2">
                                <Button
                                  className="bg-white/10 hover:bg-white/20 text-white"
                                  onClick={() => handleToggleUpdates(c.id)}
                                >
                                  {expandedCaseId === c.id ? "Cerrar" : "Gestionar"}
                                </Button>
                                <Button
                                  className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100"
                                  onClick={() => handleToggleCaseDetails(c.id)}
                                >
                                  {expandedCaseDetailId === c.id ? "Ocultar caso" : "Ver caso"}
                                </Button>
                              </div>
                            </td>
                          </tr>
                          {expandedCaseDetailId === c.id && (
                            <tr className="border-b border-white/10 bg-white/5">
                              <td colSpan={11} className="px-4 py-4">
                                <div className="grid md:grid-cols-2 gap-4 text-sm text-slate-300">
                                  <div>
                                    <p className="text-slate-400 text-xs uppercase mb-1">Resumen</p>
                                    <p className="text-slate-200">{c.relato || c.detalle || "-"}</p>
                                  </div>
                                  <div className="space-y-2">
                                    <div>
                                      <p className="text-slate-400 text-xs uppercase mb-1">Contacto</p>
                                      <p>{getCaseContactEmail(c) || "-"}</p>
                                      <p className="text-xs text-slate-400">{c.telefono || "-"}</p>
                                    </div>
                                    <div>
                                      <p className="text-slate-400 text-xs uppercase mb-1">Plan elegido</p>
                                      <p>{c.plan_elegido || "Sin plan"}</p>
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-slate-400 text-xs uppercase mb-1">Monto</p>
                                    <p>
                                      {c.monto_moneda || "-"} {c.monto_escala || ""} {c.monto_valor || ""}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-slate-400 text-xs uppercase mb-1">Autorizacion</p>
                                    <p>{Number(c.autorizacion) === 1 ? "Si" : "No"}</p>
                                  </div>
                                  <div>
                                    <p className="text-slate-400 text-xs uppercase mb-1">Medios de pago</p>
                                    <p>{parseArray(c.medios_pago).join(", ") || "-"}</p>
                                  </div>
                                  <div>
                                    <p className="text-slate-400 text-xs uppercase mb-1">Adjuntos</p>
                                    <div className="space-y-2">
                                      {parseArray(c.adjuntos).length === 0 && (
                                        <p className="text-xs text-slate-300">Sin adjuntos</p>
                                      )}
                                      {parseArray(c.adjuntos).map((file) => (
                                        <div
                                          key={file.filename || file.originalName}
                                          className="flex items-center justify-between gap-2 rounded-md border border-white/10 px-2 py-1"
                                        >
                                          <span className="text-xs text-slate-300 truncate">
                                            {file.originalName || file.filename}
                                          </span>
                                          <Button
                                            className="bg-white/10 hover:bg-white/20 text-white text-xs px-2 py-1 h-auto"
                                            onClick={() => handleDownloadAttachment(c.id, file)}
                                          >
                                            Descargar
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </td>
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

            {!loading && !isAdmin && !isEnterprise && visibleCases.map((c) => (
              <div key={c.id} className="bg-white/10 border border-white/10 rounded-2xl p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className={`inline-flex mt-1 px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadge(c.estado)}`}>
                      {c.estado}
                    </span>
                    {c.plan_elegido && <p className="text-xs text-slate-400 mt-1">Plan: {c.plan_elegido}</p>}
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
                    {c.estado === "Viable (pendiente de pago)" && c.plan_elegido && findPlanByName(c.plan_elegido) && (
                      <div className="border border-white/10 rounded-xl p-4 bg-white/5">
                        <p className="text-sm text-slate-300 mb-3">
                          Tu caso es viable. Continua el proceso con el pago del plan.
                        </p>
                        <div className="flex flex-wrap gap-3">
                          <Button
                            className="bg-emerald-500 hover:bg-emerald-600 text-white"
                            onClick={() => setTransferPlanId((prev) => (prev === c.id ? null : c.id))}>
                            Contratar plan
                          </Button>
                          <Button
                            className="bg-white/10 hover:bg-white/20 text-white"
                            onClick={() => setInfoPlanId((prev) => (prev === c.id ? null : c.id))}>
                            Mas informacion
                          </Button>
                        </div>
                        {transferPlanId === c.id && (
                          <div className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3 text-xs text-emerald-100 space-y-1">
                            <p><strong>Titular:</strong> {BANK_TRANSFER.titular}</p>
                            <p><strong>Banco:</strong> {BANK_TRANSFER.banco}</p>
                            <p><strong>CBU:</strong> {BANK_TRANSFER.cbu}</p>
                            <p><strong>Alias:</strong> {BANK_TRANSFER.alias}</p>
                            <p className="text-emerald-200/90">{BANK_TRANSFER.referencia}</p>

                          </div>
                        )}
                        {infoPlanId === c.id && (
                          <div className="mt-3 rounded-lg border border-white/15 bg-white/5 p-3 text-xs text-slate-200">
                            <p className="mb-2 font-semibold text-emerald-300">Trabajo detallado del plan</p>
                            {findPlanByName(c.plan_elegido)?.summary && (
                              <p className="mb-2 text-slate-300 leading-relaxed">{findPlanByName(c.plan_elegido)?.summary}</p>
                            )}
                            <ul className="space-y-1">
                              {(findPlanByName(c.plan_elegido)?.details || []).map((item) => (
                                <li key={item}>• {item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
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
                      placeholder="Buscar por codigo o cliente"
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
                  <table className="w-full min-w-[980px] border-collapse">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-300 border-b border-white/10">
                        <th className="px-4 py-3">Codigo</th>
                        <th className="px-4 py-3">Cliente</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3">Prioridad</th>
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Accion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enterpriseVisibleCases.map((c) => (
                        <Fragment key={c.id}>
                          <tr className="border-b border-white/10 align-top">
                            <td className="px-4 py-3 text-sm text-slate-200">{c.case_code || "-"}</td>
                            <td className="px-4 py-3 text-sm text-slate-100">{c.nombre_completo || "-"}</td>
                            <td className="px-4 py-3">
                              <div
                                className={`rounded-lg border ${getStatusBoxClass(
                                  enterpriseStatusDrafts[c.id] ?? c.estado ?? "Recibido"
                                )}`}
                              >
                                <select
                                  className="w-full rounded-lg bg-transparent px-3 py-2 text-xs font-bold text-slate-100 border-0 focus:outline-none"
                                  value={enterpriseStatusDrafts[c.id] ?? c.estado ?? "Recibido"}
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
                                  enterprisePriorityDrafts[c.id] ?? c.prioridad ?? "Media",
                                  enterpriseStatusDrafts[c.id] ?? c.estado ?? "Recibido"
                                )}`}
                              >
                                <select
                                  className="w-full rounded-lg bg-transparent px-3 py-2 text-xs font-bold text-slate-100 border-0 focus:outline-none"
                                  value={enterprisePriorityDrafts[c.id] ?? c.prioridad ?? "Media"}
                                  onChange={(e) => setEnterprisePriorityDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                                >
                                  {priorityOptions.map((priority) => (
                                    <option key={priority} value={priority}>{priority}</option>
                                  ))}
                                </select>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-400">
                              {formatDateAr(c.created_at)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  className="bg-emerald-500 hover:bg-emerald-600 text-white"
                                  disabled={submitting}
                                  onClick={() => handleEnterpriseUpdateCase(c.id)}
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
                              <td colSpan={6} className="px-4 py-4">
                                <div className="grid md:grid-cols-2 gap-4 text-sm text-slate-300">
                                  <div><span className="text-slate-400">Codigo:</span> {c.case_code || "-"}</div>
                                  <div><span className="text-slate-400">Caso ID:</span> {c.id}</div>
                                  <div><span className="text-slate-400">Cliente:</span> {c.nombre_completo || "-"}</div>
                                  <div><span className="text-slate-400">DNI/CUIT:</span> {c.dni_cuit || "-"}</div>
                                  <div><span className="text-slate-400">Email:</span> {c.email_contacto || "-"}</div>
                                  <div><span className="text-slate-400">Telefono:</span> {c.telefono || "-"}</div>
                                  <div><span className="text-slate-400">Canal origen:</span> {c.canal_origen || "-"}</div>
                                  <div><span className="text-slate-400">Fecha del caso:</span> {c.fecha_caso || "-"}</div>
                                  <div><span className="text-slate-400">Estado:</span> {c.estado || "Recibido"}</div>
                                  <div><span className="text-slate-400">Prioridad:</span> {c.prioridad || "Media"}</div>
                                  <div><span className="text-slate-400">Monto:</span> {c.monto_valor ? `${c.monto_valor} ${c.monto_moneda || ""}` : "-"}</div>
                                  <div><span className="text-slate-400">Escala:</span> {c.monto_escala || "-"}</div>
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
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              </div>
            )}

            {!isAdmin && !isEnterprise && (
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
                    <h3 className="text-lg font-semibold">Planes y pagos</h3>
                    <p className="text-xs text-slate-400">Primer contacto y análisis: sin cargo</p>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    {plans.map((plan) => (
                      <div key={plan.name} className="border border-white/10 rounded-xl p-4 bg-white/5">
                        <p className="text-sm text-emerald-300 font-semibold">{plan.name}</p>
                        {plan.summary && (
                          <p className="text-xs text-slate-300 mt-2 leading-relaxed">{plan.summary}</p>
                        )}
                        <p className="text-2xl font-bold mt-1">{plan.price}</p>
                        {plan.priceUsd && <p className="text-xs text-slate-400">{plan.priceUsd}</p>}
                        <p className="text-xs text-slate-400 mb-3">{plan.period}</p>
                        <ul className="space-y-1 text-xs text-slate-300 mb-4">
                          {plan.features.map((item) => (
                            <li key={item}>⬢ {item}</li>
                          ))}
                        </ul>
                        <div className="flex gap-2">
                          <Button
                            className="bg-emerald-500 hover:bg-emerald-600 text-white w-full"
                            onClick={() => setTransferPlanId((prev) => (prev === plan.id ? null : plan.id))}
                          >
                            Contratar plan
                          </Button>
                          <Button
                            className="bg-slate-900 hover:bg-slate-800 text-white w-full"
                            onClick={() => setInfoPlanId((prev) => (prev === plan.id ? null : plan.id))}
                          >
                            Mas informacion
                          </Button>
                        </div>
                        {transferPlanId === plan.id && (
                          <div className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3 text-xs text-emerald-100 space-y-1">
                            <p><strong>Titular:</strong> {BANK_TRANSFER.titular}</p>
                            <p><strong>Banco:</strong> {BANK_TRANSFER.banco}</p>
                            <p><strong>CBU:</strong> {BANK_TRANSFER.cbu}</p>
                            <p><strong>Alias:</strong> {BANK_TRANSFER.alias}</p>
                            <p className="text-emerald-200/90">{BANK_TRANSFER.referencia}</p>
                          </div>
                        )}
                        {infoPlanId === plan.id && (
                          <div className="mt-3 rounded-lg border border-white/15 bg-white/5 p-3 text-xs text-slate-200">
                            <p className="mb-2 font-semibold text-emerald-300">Trabajo detallado del plan</p>
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

            {!loading && isAdmin && expandedCaseId && (() => {
              const c = visibleCases.find((item) => item.id === expandedCaseId) || cases.find((item) => item.id === expandedCaseId);
              if (!c) return null;
              return (
                <div className="bg-white/10 border border-white/10 rounded-2xl p-5 space-y-3">
                  <h3 className="text-lg font-semibold">Gestión del caso</h3>
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
                  {c.estado === "Viable (pendiente de pago)" && c.plan_elegido && findPlanByName(c.plan_elegido) && (
                    <div className="border border-white/10 rounded-xl p-4 bg-white/5">
                      <p className="text-sm text-slate-300 mb-3">Caso viable. Enviar pago al cliente:</p>
                      <div className="flex flex-wrap gap-3">
                        <Button
                          className="bg-emerald-500 hover:bg-emerald-600 text-white"
                          onClick={() => setTransferPlanId((prev) => (prev === c.id ? null : c.id))}
                        >
                          Contratar plan
                        </Button>
                        <Button
                          className="bg-slate-900 hover:bg-slate-800 text-white"
                          onClick={() => setInfoPlanId((prev) => (prev === c.id ? null : c.id))}
                        >
                          Mas informacion
                        </Button>
                      </div>
                      {transferPlanId === c.id && (
                        <div className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3 text-xs text-emerald-100 space-y-1">
                          <p><strong>Titular:</strong> {BANK_TRANSFER.titular}</p>
                          <p><strong>Banco:</strong> {BANK_TRANSFER.banco}</p>
                          <p><strong>CBU:</strong> {BANK_TRANSFER.cbu}</p>
                          <p><strong>Alias:</strong> {BANK_TRANSFER.alias}</p>
                          <p className="text-emerald-200/90">{BANK_TRANSFER.referencia}</p>

                        </div>
                      )}
                      {infoPlanId === c.id && (
                        <div className="mt-3 rounded-lg border border-white/15 bg-white/5 p-3 text-xs text-slate-200">
                          <p className="mb-2 font-semibold text-emerald-300">Trabajo detallado del plan</p>
                            {findPlanByName(c.plan_elegido)?.summary && (
                              <p className="mb-2 text-slate-300 leading-relaxed">{findPlanByName(c.plan_elegido)?.summary}</p>
                            )}
                            <ul className="space-y-1">
                            {(findPlanByName(c.plan_elegido)?.details || []).map((item) => (
                              <li key={item}>• {item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="border border-emerald-500/30 rounded-xl p-4 bg-emerald-500/5">
                    <h4 className="text-sm font-semibold text-emerald-200 mb-3">Nueva actualización</h4>
                    <div className="space-y-3">
                      <select
                        className="w-full rounded-lg bg-slate-900/70 border border-white/20 px-4 py-2 text-white"
                        value={adminStatus}
                        onChange={(e) => {
                          const value = e.target.value;
                          setAdminStatus(value);
                          if (statusTemplates[value]) setAdminNote(statusTemplates[value]);
                        }}
                      >
                        <option value="">Estado del caso</option>
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                      <select
                        className="w-full rounded-lg bg-slate-900/70 border border-white/20 px-4 py-2 text-white"
                        value={adminPriority}
                        onChange={(e) => setAdminPriority(e.target.value)}
                      >
                        <option value="">Prioridad (opcional)</option>
                        {priorityOptions.map((priority) => (
                          <option key={priority} value={priority}>{priority}</option>
                        ))}
                      </select>
                      <textarea
                        placeholder="Mensaje para el cliente"
                        className="w-full rounded-lg bg-white/10 border border-white/10 px-4 py-2 text-white placeholder:text-slate-400 min-h-[120px]"
                        value={adminNote}
                        onChange={(e) => setAdminNote(e.target.value)}
                      />
                      <Button
                        className="bg-emerald-500 hover:bg-emerald-600 text-white"
                        onClick={() => handleAdminUpdate(c.id)}
                        disabled={submitting}
                      >
                        {submitting ? "Guardando..." : "Guardar actualización"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {!loading && isAdmin && (
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
                          <th className="px-4 py-3">Plan</th>
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
                            <td className="px-4 py-3 text-sm text-slate-200">{c.plan_elegido || "-"}</td>
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





