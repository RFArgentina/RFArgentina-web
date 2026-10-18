import React from 'react';
import { useNavigate } from "react-router-dom";
import { getToken } from "@/lib/auth";
import { analysisService, plans } from "@/data/plans";
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { FaInstagram, FaFacebook, FaLinkedin } from "react-icons/fa";
import {
  CheckCircle,
  FileText,
  Shield,
  Gavel,
  ShoppingBag,
  PackageCheck,
  ShieldCheck,
  RotateCcw,
  Receipt,
  Wifi,
  Repeat,
  Store,
  ArrowLeftRight,
  LockKeyhole
} from 'lucide-react';

const RFALanding = () => {
  const navigate = useNavigate();
  const [openFaqIndex, setOpenFaqIndex] = React.useState(null);
  const isAuthenticated = Boolean(getToken());
  // ---- CTA: abre el formulario (gratis) en pestaña nueva ----
  const handleCTAClick = () => {
    navigate(isAuthenticated ? "/panel" : "/crear-caso");
  };
 
  
  const handleServiceOptionsClick = () => {
    const el = document.getElementById("modalidades");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    navigate(isAuthenticated ? "/panel" : "/planes");
  };

  // ---- Pasos de trabajo ----
  const steps = [
    {
      icon: <FileText className="w-10 h-10 text-emerald-300" />,
      title: 'Contás qué pasó',
      description: 'Cargás tu caso y la documentación disponible, sin necesidad de registrarte.',
    },
    {
      icon: <Shield className="w-10 h-10 text-emerald-300" />,
      title: 'Revisamos el caso',
      description: 'Analizamos la información inicial e identificamos qué documentación puede faltar.',
    },
    {
      icon: <CheckCircle className="w-10 h-10 text-emerald-300" />,
      title: 'Definimos el alcance',
      description: 'Determinamos si RFA puede intervenir y qué modalidad se adapta mejor a la situación.',
    },
    {
      icon: <FileText className="w-10 h-10 text-emerald-300" />,
      title: 'Preparamos el reclamo',
      description: 'Ordenamos los hechos, clasificamos la documentación y preparamos las comunicaciones.',
    },
    {
      icon: <Shield className="w-10 h-10 text-emerald-300" />,
      title: 'Acompañamos el seguimiento',
      description: 'Si elegís una modalidad con gestión, acompañamos el seguimiento administrativo.',
    },
  ];


 // ---- Servicios ----
const services = [
  {
    title: 'Carpeta profesional',
    description:
      'Organizamos el caso y entregamos un expediente estructurado para que puedas continuar por tu cuenta o utilizarlo como base si posteriormente necesitás asistencia profesional.',
    features: [
    'Cronología de los hechos y descripción clara del problema',
    'Documentación, evidencia y comunicaciones clasificadas',
    'Pretensión del usuario y estado del reclamo',
    'Normativa de referencia, cuando corresponda',
    'Carpeta lista para presentar ante la empresa o proveedor',
    ],
  },
 {
  title: 'Gestión RFA',
  description:
    'Además de organizar el caso, preparamos las comunicaciones y acompañamos el seguimiento administrativo por los canales correspondientes dentro del alcance contratado.',
  features: [
    'Todo el trabajo de organización documental',
    'Preparación de comunicaciones y acompañamiento de la presentación',
    'Seguimiento de respuestas por los canales habilitados',
    'Organización de las respuestas y actualización del caso',
  ],
},

];


  // ---- Planes ----
  const faqs = [
    {
      q: "¿Qué puede hacer RFA por mi reclamo?",
      a: "Relevamiento documental, reconstrucción de los hechos, redacción del reclamo y acompañamiento administrativo por los canales habilitados, según la modalidad y el alcance acordados."
    },
    {
      q: "¿El análisis inicial tiene costo?",
      a: "No. El primer contacto y el análisis documental inicial son sin cargo. Si contamos con información suficiente para avanzar, te proponemos la modalidad adecuada."
    },
    {
      q: "¿Qué diferencia hay entre Carpeta Profesional y Gestión RFA?",
      a: "La Carpeta Profesional organiza y estructura el caso para que puedas continuar el reclamo por tu cuenta. Gestión RFA incorpora, además, la preparación de comunicaciones y el acompañamiento del seguimiento administrativo dentro del alcance acordado."
    },
    {
      q: "¿Quién envía los reclamos y las comunicaciones?",
      a: "Depende de la modalidad acordada. RFA puede preparar las comunicaciones para que las envíes directamente desde tus propios canales o, cuando el servicio contratado lo contemple, acompañar su presentación y seguimiento administrativo. Antes de comenzar te informamos qué incluye la modalidad propuesta para tu caso."
    },
    {
      q: "¿Qué documentación necesito para empezar?",
      a: "Comprobantes, capturas, resúmenes, contratos o términos vigentes, mails/chats con la entidad y cualquier número de operación. Si falta algo, te indicamos qué pedir y cómo."
    },
    {
      q: "¿Cómo me informan avances?",
      a: "Podés consultar estado y avances con tu email + ID de caso; además, cuando corresponde, dejamos registro de comunicaciones y actualizaciones."
    },
    {
      q: "¿Necesito un abogado para empezar?",
      a: "No para el análisis inicial. RFA brinda asistencia documental y administrativa; no realiza patrocinio judicial. Si el caso requiere una actuación reservada a profesionales, organizamos la documentación para facilitar su continuidad."
    },
    {
      q: "¿Qué pasa si mi caso requiere intervención profesional?",
      a: "RFA brinda asistencia documental y administrativa, pero no realiza patrocinio judicial. Si el caso requiere una actuación reservada a profesionales, organizamos la documentación para facilitar su continuidad con el profesional que elijas."
    },
    {
      q: "¿Puedo pagar en cuotas?",
      a: "Las condiciones de pago se informan junto con el alcance y el precio del servicio, antes de comenzar cualquier trabajo pago."
    },
    {
      q: "¿Cómo manejan la confidencialidad y mis datos?",
      a: "Aplicamos acceso por roles y minimización de datos. En particulares eliminamos casos cerrados en un plazo máximo de 90 días. En empresas, la retención puede configurarse (manual o purga automática 30/60/90 días)."
    }
  ];

  const issueLists = [
    [
      [ShoppingBag, "Compras que no llegaron."],
      [PackageCheck, "Productos defectuosos o distintos de lo ofrecido."],
      [ShieldCheck, "Garantías, devoluciones y reintegros pendientes."],
      [Receipt, "Cobros, débitos u operaciones que necesitás reclamar o aclarar."],
      [RotateCcw, "Bajas de servicios que continúan facturándose."]
    ],
    [
      [Wifi, "Problemas de internet y telecomunicaciones."],
      [Repeat, "Suscripciones y facturación de servicios."],
      [Store, "Reclamos frente a marketplaces y comercios."],
      [ArrowLeftRight, "Transferencias, fondos retenidos o movimientos no reconocidos."],
      [LockKeyhole, "Cuentas bloqueadas u otras situaciones que requieren aclaración."]
    ]
  ];

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------
  return (
    <div className="rfa-landing min-h-screen text-slate-100 relative overflow-hidden">
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute top-32 -left-32 h-80 w-80 rounded-full bg-amber-300/10 blur-3xl" />
        <div className="absolute bottom-0 right-10 h-72 w-72 rounded-full bg-sky-400/10 blur-3xl" />
      </div>
      <div className="relative z-10">

        {/* ================= HERO ================= */}
        <section
          id="inicio"
          className="rfa-landing-hero rfa-home-image-section rfa-home-image-section-01 py-20 px-6"
          style={{ "--rfa-home-image": "url('/images/rfa-home-01.png')" }}
        >
          <div className="max-w-6xl mx-auto grid md:grid-cols-[1.2fr_0.8fr] gap-10 items-center">
            <div>
              <div className="rfa-brand-lockup mb-7" aria-label="RFA, Reclamos Financieros Argentina">
                <p className="rfa-brand-name">RECLAMOS FINANCIEROS ARGENTINA</p>
                <p className="rfa-brand-activity">Gestión de reclamos financieros y de consumo</p>
              </div>
              <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-6 text-slate-100">
                Cuando una empresa no resuelve tu problema, te ayudamos a ordenar y gestionar el reclamo
              </h1>

              <p className="text-lg md:text-2xl text-slate-200 mb-8 leading-relaxed">
                Organizamos la documentación, reconstruimos los hechos, preparamos el reclamo y acompañamos su seguimiento.
              </p>
              <p className="text-slate-300 mb-8">
                RFA asiste en reclamos frente a entidades financieras, comercios, marketplaces y proveedores de productos o servicios.
              </p>
              <div className="rfa-hero-badges flex flex-wrap gap-3 mb-8">
                {[
                  [CheckCircle, "Modalidad 100% online"],
                  [Shield, "Reclamos financieros y de consumo"],
                  [FileText, "Registro de comunicaciones"],
                  [CheckCircle, "Seguimiento documentado"]
                ].map(([Icon, item]) => (
                  <span key={item} className="px-4 py-2 rounded-full text-xs font-semibold rfa-chip">
                    <Icon aria-hidden="true" className="rfa-badge-icon" />
                    {item}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-4">
                <Button
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition"
                  onClick={handleCTAClick}
                >
                  Iniciar reclamo sin costo
                </Button>
                <Button
                  className="bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-6 rounded-lg border border-white/20"
                  onClick={handleServiceOptionsClick}
                >
                  Ver opciones de servicio
                </Button>
                <Button
                  className="bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-6 rounded-lg border border-white/20"
                  onClick={() => navigate("/empresas")}
                >
                  Servicios para empresas
                </Button>
              </div>
            </div>
            <div className="rfa-hero-aside">
              <img
                className="rfa-hero-emblem"
                src="/android-chrome-512x512.png"
                alt="Escudo de Reclamos Financieros Argentina"
              />
              <div className="rfa-sheen rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Shield className="w-5 h-5 text-emerald-300" />
                  <p className="text-lg font-semibold text-slate-100">Dos modalidades, un mismo objetivo</p>
                </div>
                <p className="text-slate-200 mb-4">
                  Según tu necesidad, podés solicitar acompañamiento administrativo o una carpeta estructurada para presentar por tu cuenta.
                </p>
                <div className="grid gap-2">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-sm font-semibold text-slate-100">Gestión de reclamos ante entidades</p>
                    <p className="text-xs text-slate-300 mt-1">
                      Redacción, acompañamiento de la presentación y seguimiento ante la empresa o proveedor.
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-sm font-semibold text-slate-100">Carpeta profesional</p>
                    <p className="text-xs text-slate-300 mt-1">
                      Documentación ordenada y reclamo redactado para que lo presentes por tu cuenta.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================= PROBLEMAS ================= */}
        <section
          className="rfa-home-image-section rfa-home-image-section-02 py-10 px-6"
          style={{ "--rfa-home-image": "url('/images/rfa-home-02.png')" }}
        >
          <div className="rfa-problems-panel max-w-6xl mx-auto bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-100 mb-4">
              Qué problemas podemos gestionar
            </h2>
            <p className="text-slate-300 mb-6">
              Trabajamos con reclamos financieros y con problemas cotidianos de consumo, entre ellos:
            </p>
            <div className="rfa-issues-grid grid sm:grid-cols-2 gap-x-8 gap-y-2 text-slate-200 text-sm">
              {issueLists.map((group, groupIndex) => (
                <ul className="rfa-issue-list" key={groupIndex}>
                  {group.map(([Icon, text]) => (
                    <li className="rfa-issue-item" key={text}>
                      <Icon aria-hidden="true" className="rfa-line-icon" />
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
              ))}
            </div>
            <p className="text-slate-100 font-semibold mt-6">
              Cada caso se evalúa según sus características, documentación y complejidad.
            </p>
          </div>
        </section>

        {/* ================= COMO TRABAJAMOS ================= */}
        <section
          className="rfa-home-image-section rfa-home-image-section-03 py-20 px-6"
          style={{ "--rfa-home-image": "url('/images/rfa-home-03.png')" }}
        >
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-emerald-300 uppercase tracking-[0.3em] text-xs font-semibold mb-3">Proceso</p>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-100">Cómo funciona</h2>
              <p className="text-slate-300 mt-4 max-w-2xl mx-auto">
                El análisis inicial permite determinar si RFA puede intervenir y qué servicio corresponde.
              </p>
            </div>
            <div className="rfa-process-grid grid md:grid-cols-2 lg:grid-cols-5 gap-6">
              {steps.map((step, index) => (
                <div key={index} className="rfa-process-step bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                  <div className="rfa-process-icon mb-4">{step.icon}</div>
                  <h3 className="text-xl font-semibold text-slate-100 mb-2">{index + 1}. {step.title}</h3>
                  <p className="text-slate-300 text-sm leading-relaxed">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ================= ESTRUCTURA ================= */}
        <section
          className="rfa-home-image-section rfa-home-image-section-04 py-10 px-6"
          style={{ "--rfa-home-image": "url('/images/rfa-home-04.png')" }}
        >
          <div className="max-w-6xl mx-auto bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-100 mb-4">¿Podés reclamar por tu cuenta? Sí.</h2>
            <p className="text-slate-300 mb-4">
              Es frecuente encontrarse con respuestas estandarizadas o gestiones que no avanzan. RFA aporta organización documental,
              una cronología clara, precisión sobre lo solicitado y registro de las comunicaciones.
            </p>
            <ul className="space-y-2 text-slate-200 text-sm mb-4">
              <li>• Ordenamos los hechos y la evidencia disponible.</li>
              <li>• Identificamos información o documentación faltante.</li>
              <li>• Preparamos una descripción clara del problema y de lo que solicitás.</li>
              <li>• Incorporamos normativa de referencia, cuando corresponda.</li>
            </ul>
            <p className="text-slate-100 font-semibold">RFA no reemplaza tu voz. La organiza y la fortalece.</p>
          </div>
        </section>

 
      {/* ================= QUIENES SOMOS ================= */}
<section
  className="rfa-home-image-section rfa-home-image-section-05 py-20 px-6 bg-white/5 backdrop-blur-sm"
  style={{ "--rfa-home-image": "url('/images/rfa-home-05.png')" }}
>
  <div className="container mx-auto max-w-4xl">
    <div>
      <h2 className="text-3xl md:text-4xl font-bold text-emerald-300 mb-6">
        Quiénes somos
      </h2>
      <p className="text-lg text-slate-300 leading-relaxed mb-6">
        RFA brinda asistencia documental y administrativa en reclamos financieros y de consumo.
      </p>
      <p className="text-lg text-slate-300 leading-relaxed mb-4">Nuestro enfoque se basa en:</p>
      <ul className="space-y-3">
        {[
          "Precisión técnica",
          "Análisis estructural del caso",
          "Comunicación clara y documentada",
          "Seguimiento documental y administrativo",
        ].map((item, i) => (
          <li key={i} className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-300" />
            {item}
          </li>
        ))}
      </ul>
      <p className="text-slate-100 font-semibold mt-6">No improvisamos reclamos. Los estructuramos.</p>
    </div>
  </div>
</section>

        {/* ================= SERVICIOS ================= */}
        <section
          id="modalidades"
          className="rfa-home-image-section rfa-home-image-section-06 py-20 px-6 bg-white/5 backdrop-blur-sm"
          style={{ "--rfa-home-image": "url('/images/rfa-home-06.png')" }}
        >
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-emerald-300 mb-6">Dos modalidades de servicio</h2>
            <p className="text-slate-300 max-w-3xl mx-auto">
              Podés elegir una carpeta profesional para continuar por tu cuenta o una modalidad con acompañamiento administrativo.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {services.map((service, index) => (
              <Card key={index} className={`rfa-service-card border transition ${index === 1 ? "rfa-service-card-featured" : ""}`}>
                <CardHeader>
                  <CardTitle className="rfa-service-card-title text-2xl mb-3">{service.title}</CardTitle>
                  <CardDescription className="rfa-service-card-description text-lg">{service.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {service.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                        <span className="rfa-service-feature">{f}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="text-center mt-10">
            <Button
              onClick={handleCTAClick}
                  className="rfa-home-cta bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition"
            >
              Iniciar reclamo sin costo
            </Button>
          </div>
        </section>

        {/* ================= ALCANCE Y EMPRESAS ================= */}
        <section
          className="rfa-home-image-section rfa-home-image-section-07 py-20 px-6"
          style={{ "--rfa-home-image": "url('/images/rfa-home-07.png')" }}
        >
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 h-full">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-100 mb-4">
                Algunos casos requieren intervención profesional
              </h2>
              <p className="text-slate-300 mb-4">
                Cuando la naturaleza o complejidad del caso requiere asesoramiento o una actuación reservada a profesionales,
                RFA puede organizar la documentación para facilitar su continuidad.
              </p>
              <ul className="space-y-2 text-slate-200 text-sm">
                <li className="flex items-start gap-2"><Gavel className="w-5 h-5 text-emerald-400 mt-0.5" />No prestamos patrocinio judicial ni servicios reservados a abogados.</li>
                <li className="flex items-start gap-2"><Gavel className="w-5 h-5 text-emerald-400 mt-0.5" />No intervenimos en mediaciones oficiales.</li>
                <li className="flex items-start gap-2"><Gavel className="w-5 h-5 text-emerald-400 mt-0.5" />No garantizamos resultados, devoluciones, indemnizaciones ni plazos.</li>
              </ul>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 h-full">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-100 mb-4">¿Gestionás múltiples casos?</h2>
              <p className="text-slate-300 mb-6">
                RFA también brinda servicios de organización y seguimiento documental para empresas, con acceso privado a la
                información de los casos.
              </p>
              <Button
                className="bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-6 rounded-lg border border-white/20"
                onClick={() => navigate("/empresas")}
              >
                Conocer RFA Empresas
              </Button>
            </div>
          </div>
        </section>

        {/* ================= PLANES ================= */}
        <section
          id="planes"
          className="rfa-home-image-section rfa-home-image-section-08 py-20 px-6 bg-white/5 backdrop-blur-sm"
          style={{ "--rfa-home-image": "url('/images/rfa-home-08.png')" }}
        >
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-emerald-300 mb-6">
              Modalidades de servicio
            </h2>
            <p className="text-slate-200 mb-8">
              El análisis inicial es sin costo. Si podemos intervenir, te indicamos qué modalidad se adapta al caso.
            </p>
            </div>

            <div className="rfa-analysis-card max-w-3xl mx-auto mb-8 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-6 text-center">
              <p className="text-xs uppercase tracking-[0.25em] text-emerald-300 font-semibold mb-2">
                {analysisService.priceLabel}
              </p>
              <h3 className="text-2xl font-bold text-white mb-2">{analysisService.name}</h3>
              <p className="text-slate-200 leading-relaxed">{analysisService.summary}</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`rfa-plan-card border rounded-2xl p-6 ${plan.featured ? "rfa-plan-card-featured" : ""}`}
                >
                  <p className="text-xs uppercase tracking-wide text-emerald-600 font-semibold mb-2">
                    {plan.period}
                  </p>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{plan.name}</h3>
                  <p className="text-3xl font-extrabold text-slate-950 mb-1">{plan.priceLabel}</p>
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-4">{plan.currency}</p>
                  <p className="text-sm text-slate-600 mb-4">{plan.summary}</p>
                  <ul className="space-y-2 text-sm text-slate-700">
                    {plan.features.map((item) => (
                       <li key={item}>• {item.replace("normativa de referencia", "normativa de referencia, cuando corresponda")}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="max-w-4xl mx-auto text-center text-slate-300 space-y-3">
              <p>
                Algunos casos pueden requerir un presupuesto personalizado según el volumen documental, la cantidad de
                intervinientes, los antecedentes, la reconstrucción necesaria y la carga de trabajo. El precio no depende del monto reclamado.
              </p>
              <p className="font-semibold text-slate-100">
                Cada reclamo es diferente. Si podemos intervenir, te informamos previamente el alcance, el precio y qué incluye
                el servicio. No comenzamos ninguna gestión paga sin tu conformidad.
              </p>
            </div>

          </div>
        </section>

        {/* ================= PREGUNTAS FRECUENTES ================= */}
        <section
          className="rfa-home-image-section rfa-home-image-section-09 rfa-faq-section py-20 px-6 bg-white/5 backdrop-blur-sm"
          style={{ "--rfa-home-image": "url('/images/rfa-home-09.png')" }}
        >
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-emerald-300 mb-6">Preguntas Frecuentes</h2>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto">
              Respuestas claras sobre el análisis inicial, la documentación y el seguimiento de los casos.
            </p>
          </div>

          <div className="rfa-faq-list max-w-4xl mx-auto">
            {faqs.map((item, index) => {
              const isOpen = openFaqIndex === index;
              const triggerId = `rfa-faq-trigger-${index}`;
              const panelId = `rfa-faq-panel-${index}`;

              return (
                <article key={item.q} className={`rfa-faq-item${isOpen ? " is-open" : ""}`}>
                  <h3 className="rfa-faq-heading">
                    <button
                      id={triggerId}
                      type="button"
                      className="rfa-faq-trigger"
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    >
                      <span>{item.q}</span>
                      <span className="rfa-faq-indicator" aria-hidden="true">{isOpen ? "−" : "+"}</span>
                    </button>
                  </h3>
                  <div
                    id={panelId}
                    className={`rfa-faq-panel${isOpen ? " is-open" : ""}`}
                    role="region"
                    aria-labelledby={triggerId}
                    aria-hidden={!isOpen}
                  >
                    <div className="rfa-faq-panel-inner">
                      <p className="text-slate-300 leading-relaxed">{item.a}</p>
                    </div>
                  </div>
                </article>
              );
            })}

            <div className="text-center mt-10">
              <Button
                onClick={handleCTAClick}
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition"
              >
                Iniciar reclamo sin costo
              </Button>
            </div>
          </div>
        </section>

        {/* ================= FOOTER ================= */}
        <footer
          id="contacto"
          className="rfa-home-image-section rfa-home-image-section-09 bg-slate-950/80 py-12 px-6 text-slate-300 text-center md:text-left"
          style={{ "--rfa-home-image": "url('/images/rfa-home-09.png')" }}
        >
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div>
              <h3 className="text-lg font-semibold mb-4">RFA</h3>
              <p className="text-sm">
                Reclamos Financieros Argentina — Gestión de reclamos financieros y de consumo.
              </p>
              <p className="text-emerald-300 mt-2 text-sm">Atendemos en todo el país — modalidad 100% online.</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Contacto</h3>
              <p className="text-sm">
                <a
                  href="mailto:soporte@rfargentina.com"
                  className="hover:text-emerald-300 transition"
                >
                  soporte@rfargentina.com
                </a>
              </p>

              <p className="text-sm">
                <a
                  href="https://wa.me/542212024379"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-emerald-300 transition"
                >
                  WhatsApp: +54 221 202 4379
                </a>
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Seguinos</h3>
              <div className="flex justify-center md:justify-start gap-4 text-2xl">
                <a href="https://www.instagram.com/reclamosfinancierosarg" target="_blank" rel="noreferrer">
                  <FaInstagram className="hover:text-pink-400 transition" />
                </a>
                <a href="https://www.facebook.com" target="_blank" rel="noreferrer">
                  <FaFacebook className="hover:text-blue-400 transition" />
                </a>
                <a href="https://www.linkedin.com/in/matias-masdeu" target="_blank" rel="noreferrer">
                  <FaLinkedin className="hover:text-blue-400 transition" />
                </a>


              </div>
              <p className="mt-3 text-sm">
           
              </p>
              <div className="mt-4 space-y-1 text-sm">
                <button className="block hover:text-emerald-300 transition" onClick={() => navigate("/terminos")}>
                  Términos y Condiciones
                </button>
                <button className="block hover:text-emerald-300 transition" onClick={() => navigate("/privacidad")}>
                  Política de Privacidad
                </button>
                <button className="block hover:text-emerald-300 transition" onClick={() => navigate("/cookies")}>
                  Política de Cookies
                </button>
              </div>
            </div>
          </div>
          <div className="text-center text-slate-500 text-sm mt-10">
            © 2026 Reclamos Financieros Argentina. Todos los derechos reservados.
          </div>
        </footer>
      </div>
    </div>
  );
};

export default RFALanding;

