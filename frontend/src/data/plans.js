export const plans = [
  {
    id: "inicial",
    name: "Plan Inicial",
    priceUsd: "USD 60",
    price: "$75.000",
    period: "Entrega unica",
    features: [
      "Armado completo del caso en carpeta profesional",
      "Revision basica de documentacion",
      "Informe claro para presentar a un abogado",
      "Entrega unica sin seguimiento posterior"
    ],
    payment: {
      mp: "https://mpago.la/2ked6DL",
      paypal: "https://www.paypal.com/invoice/p/#Z9U84SSDGGAM8U94"
    }
  },
  {
    id: "seguimiento",
    name: "Plan Seguimiento",
    featured: true,
    priceUsd: "USD 110",
    price: "$150.000",
    period: "30 dias",
    features: [
      "Seguimiento del caso durante 30 dias",
      "Soporte por mail y WhatsApp",
      "Mejora de documentacion si hiciera falta",
      "Informe actualizado en caso de respuesta de la entidad",
      "Contacto directo, sin intermediarios"
    ],
    payment: {
      mp: "https://mpago.la/2cvjdmK",
      paypal: "https://www.paypal.com/invoice/p/#SR2ZGA5FNK7S4AZW"
    }
  },
  {
    id: "total",
    name: "Plan Total",
    priceUsd: "USD 220",
    price: "$300.000",
    period: "90 dias",
    features: [
      "Acompanamiento durante 90 dias",
      "Analisis y revision profunda de toda la documentacion",
      "Preparacion de nuevas presentaciones si la entidad responde",
      "Informe final con cierre del caso",
      "Asistencia directa + prioridad en consultas",
      "Incluye armado de un reclamo adicional sin costo"
    ],
    payment: {
      mp: "https://mpago.la/2fqDaVD",
      paypal: "https://www.paypal.com/invoice/p/#3PU5KCVCFX52KLNX"
    }
  }
];
