export const analysisService = {
  id: "analysis",
  code: "analysis",
  name: "Análisis inicial",
  priceLabel: "Sin costo",
  isPaid: false,
  summary:
    "Contás qué pasó y aportás la documentación disponible. RFA realiza una revisión inicial para determinar si puede intervenir y qué modalidad de trabajo corresponde.",
  features: [
    "Revisión inicial del caso",
    "Identificación de documentación faltante",
    "Definición de la modalidad de trabajo adecuada"
  ],
  details: [
    "Revisión inicial de los hechos y la documentación disponible.",
    "Evaluación del alcance posible antes de ofrecer un servicio pago."
  ]
};

export const plans = [
  {
    id: "professional-folder",
    code: "professional-folder",
    name: "Carpeta Profesional",
    startingPrice: 65000,
    currency: "ARS",
    priceMode: "from",
    priceLabel: "Desde $65.000",
    isPaid: true,
    summary:
      "Organización y estructuración del caso, la documentación, la cronología, los antecedentes y los elementos relevantes para dejar el reclamo preparado y ordenado.",
    period: "Entrega única",
    features: [
      "Organización y clasificación de la documentación",
      "Reconstrucción cronológica de los hechos",
      "Orden de antecedentes y elementos relevantes",
      "Carpeta preparada para continuar el reclamo"
    ],
    details: [
      "Relevamiento y organización documental del caso.",
      "Cronología, antecedentes y comunicaciones estructuradas.",
      "No incluye seguimiento administrativo."
    ]
  },
  {
    id: "rfa-management",
    code: "rfa-management",
    name: "Gestión RFA",
    startingPrice: 120000,
    currency: "ARS",
    priceMode: "from",
    priceLabel: "Desde $120.000",
    isPaid: true,
    featured: true,
    summary:
      "Incluye la organización del caso, la preparación de comunicaciones y el seguimiento administrativo dentro del alcance previamente acordado.",
    period: "Alcance acordado según el caso",
    features: [
      "Organización y estructuración del expediente",
      "Preparación de comunicaciones",
      "Seguimiento administrativo acordado",
      "Registro de respuestas y actualizaciones"
    ],
    details: [
      "Organización documental y preparación de comunicaciones.",
      "Seguimiento administrativo por los canales habilitados.",
      "El alcance y el precio se informan antes de comenzar."
    ]
  }
];

// Se conservan fuera del catálogo público para poder interpretar casos históricos.
export const historicalPlans = [
  {
    id: "plan-inicial",
    name: "Plan Inicial - Carpeta Profesional",
    aliases: ["Plan Inicial", "Initial", "Initial / Carpeta Profesional"],
    isPaid: true,
    legacy: true,
    summary: "Servicio histórico de preparación y organización de la carpeta documental.",
    details: [
      "Relevamiento inicial y clasificación de pruebas.",
      "Preparación de la carpeta final según el alcance contratado originalmente."
    ]
  },
  {
    id: "plan-gestion-basica",
    name: "Plan Gestión Básica - Presentación del Reclamo",
    aliases: ["Plan Gestión Básica", "Gestion Basica"],
    isPaid: true,
    legacy: true,
    summary: "Servicio histórico de presentación y seguimiento administrativo del reclamo.",
    details: [
      "Organización documental y acompañamiento administrativo.",
      "Alcance correspondiente a la contratación histórica del caso."
    ]
  },
  {
    id: "plan-completo",
    name: "Plan Completo - Seguimiento + Asistencia Extendida",
    aliases: ["Plan Completo", "Completo"],
    isPaid: true,
    legacy: true,
    summary: "Servicio histórico de seguimiento y asistencia extendida.",
    details: [
      "Seguimiento intensivo y asistencia según el alcance contratado originalmente.",
      "La denominación se conserva exclusivamente para consultar casos históricos."
    ]
  }
];

const freeAnalysisAliases = [
  analysisService.code,
  analysisService.name,
  "Análisis inicial sin costo",
  "Primer contacto (sin cargo)"
];

const normalizeServiceValue = (value = "") =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

export const resolveServiceByStoredValue = (value = "") => {
  const normalized = normalizeServiceValue(value);
  if (!normalized) return null;

  if (freeAnalysisAliases.some((alias) => normalizeServiceValue(alias) === normalized)) {
    return analysisService;
  }

  const current = plans.find((service) =>
    [service.code, service.id, service.name].some(
      (candidate) => normalizeServiceValue(candidate) === normalized
    )
  );
  if (current) return current;

  return historicalPlans.find((service) =>
    [service.id, service.name, ...(service.aliases || [])].some(
      (candidate) => normalizeServiceValue(candidate) === normalized
    )
  ) || null;
};

export const getServiceDisplayName = (value = "") =>
  resolveServiceByStoredValue(value)?.name || String(value || "").trim();

export const isPaidServiceValue = (value = "") =>
  resolveServiceByStoredValue(value)?.isPaid === true;
