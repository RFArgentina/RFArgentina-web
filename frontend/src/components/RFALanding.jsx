import React from 'react';
import { useNavigate } from "react-router-dom";
import { getToken } from "@/lib/auth";
import { analysisService, plans } from "@/data/plans";
import { Button } from './ui/button';
import { FaInstagram, FaFacebook, FaLinkedin } from "react-icons/fa";
import {
  CheckCircle,
  FileText,
  Shield,
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
  const whatsappSupportNumber = String(process.env.REACT_APP_WHATSAPP_SUPPORT || "").replace(/\D/g, "");
  // ---- CTA: abre el formulario (gratis) en pestaña nueva ----
  const handleCTAClick = () => {
    navigate(isAuthenticated ? "/panel" : "/crear-caso");
  };
 
  
  // ---- Pasos de trabajo ----
  const steps = [
    {
      icon: <FileText className="w-10 h-10 text-emerald-300" />,
      title: 'Contás qué pasó',
      description: 'Completás el formulario y adjuntás lo que tengas.',
    },
    {
      icon: <Shield className="w-10 h-10 text-emerald-300" />,
      title: 'Revisamos el caso',
      description: 'Analizamos el problema y la documentación.',
    },
    {
      icon: <CheckCircle className="w-10 h-10 text-emerald-300" />,
      title: 'Definimos el alcance',
      description: 'Te indicamos si podemos ayudarte y cómo.',
    },
    {
      icon: <FileText className="w-10 h-10 text-emerald-300" />,
      title: 'Preparamos el reclamo',
      description: 'Ordenamos el caso y las comunicaciones.',
    },
    {
      icon: <Shield className="w-10 h-10 text-emerald-300" />,
      title: 'Acompañamos el seguimiento',
      description: 'Según la modalidad que hayas elegido.',
    },
  ];


  // ---- Preguntas frecuentes ----
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
                Ordenamos tu caso, preparamos el reclamo y acompañamos su seguimiento.
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
                <div className="grid gap-3">
                  <div>
                    <p className="font-semibold text-slate-100">Carpeta Profesional</p>
                    <p className="text-slate-300">Tu caso ordenado y listo para presentar.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-100">Gestión RFA</p>
                    <p className="text-slate-300">Preparamos las comunicaciones y acompañamos el seguimiento.</p>
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
            <p className="text-slate-300 mb-6">Reclamos financieros y problemas cotidianos de consumo.</p>
            <div className="rfa-issues-grid grid sm:grid-cols-2 gap-x-8 gap-y-2 text-slate-200 text-base">
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
            </div>
            <div className="rfa-process-grid grid md:grid-cols-2 lg:grid-cols-5 gap-6">
              {steps.map((step, index) => (
                <div key={index} className="rfa-process-step bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                  <div className="rfa-process-icon mb-4">{step.icon}</div>
                  <h3 className="text-xl font-semibold text-slate-100 mb-2">{index + 1}. {step.title}</h3>
                  <p className="text-slate-300 text-base leading-relaxed">{step.description}</p>
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
              Y muchas veces alcanza. El problema aparece cuando las respuestas se estancan, la documentación se dispersa o no sabés cómo continuar.
            </p>
            <p className="text-slate-300 mb-4">
              RFA ordena el caso, prepara el reclamo y registra cada avance.
            </p>
            <p className="text-slate-100 font-semibold">Tu reclamo sigue siendo tuyo. Nosotros le damos estructura.</p>
          </div>
        </section>

 
      {/* ================= QUIENES SOMOS ================= */}
        <section
          className="rfa-home-image-section rfa-home-image-section-05 py-12 px-6 bg-white/5 backdrop-blur-sm"
          style={{ "--rfa-home-image": "url('/images/rfa-home-05.png')" }}
        >
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-emerald-300 mb-4">Qué es RFA</h2>
            <p className="text-lg text-slate-300 leading-relaxed">
              RFA es un servicio especializado en organización y gestión administrativa de reclamos financieros y de consumo. Analizamos cada caso individualmente y trabajamos con documentación, trazabilidad y un alcance definido desde el inicio.
            </p>
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
                ¿El caso requiere intervención profesional?
              </h2>
              <p className="text-slate-300">
                Si por su naturaleza o complejidad el reclamo excede la gestión administrativa, podemos dejar la documentación organizada para facilitar su continuidad con el profesional correspondiente.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 h-full">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-100 mb-4">¿Gestionás múltiples casos?</h2>
              <p className="text-slate-300 mb-6">
                RFA también organiza y da seguimiento a múltiples casos desde un entorno privado y trazable.
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
          aria-labelledby="modalidades"
          className="rfa-home-image-section rfa-home-image-section-08 py-20 px-6 bg-white/5 backdrop-blur-sm"
          style={{ "--rfa-home-image": "url('/images/rfa-home-08.png')" }}
        >
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
            <h2 id="modalidades" className="text-3xl md:text-4xl font-bold text-emerald-300 mb-6">
              Cómo podemos ayudarte
            </h2>
            <p className="text-slate-200 mb-8">
              El análisis inicial es sin costo. Revisamos tu caso y te indicamos qué alternativas están disponibles.
            </p>
            </div>

            <div className="rfa-analysis-card max-w-3xl mx-auto mb-8 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-6 text-center">
              <p className="text-xs uppercase tracking-[0.25em] text-emerald-300 font-semibold mb-2">
                {analysisService.priceLabel}
              </p>
              <h3 className="text-2xl font-bold text-white mb-2">{analysisService.name}</h3>
              <p className="text-slate-200 leading-relaxed">
                Contás qué pasó y aportás la documentación disponible. Revisamos el caso y te indicamos si podemos intervenir y qué modalidad corresponde.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {plans.map((plan) => {
                const publicPlanCopy = {
                  "professional-folder": {
                    summary: "Tu caso ordenado y preparado para que puedas continuar el reclamo por tu cuenta.",
                    features: [
                      "Cronología clara de los hechos",
                      "Documentación y evidencia organizadas",
                      "Antecedentes relevantes del reclamo",
                      "Carpeta preparada para continuar"
                    ]
                  },
                  "rfa-management": {
                    summary: "Además de organizar el caso, preparamos las comunicaciones y acompañamos el seguimiento dentro del alcance acordado.",
                    features: [
                      "Organización completa del caso",
                      "Preparación de comunicaciones",
                      "Seguimiento administrativo acordado",
                      "Registro de respuestas y avances"
                    ]
                  }
                }[plan.id];

                return (
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
                  <p className="text-base text-slate-600 leading-relaxed mb-4">{publicPlanCopy.summary}</p>
                  <ul className="space-y-2 text-base text-slate-700 leading-relaxed">
                    {publicPlanCopy.features.map((item) => (
                       <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
                );
              })}
            </div>

            <div className="max-w-4xl mx-auto text-center text-slate-300 space-y-3">
              <p>
                Algunos casos pueden requerir un presupuesto personalizado según su complejidad y carga de trabajo. El precio no depende del monto reclamado.
              </p>
              <p className="font-semibold text-slate-100">
                Antes de comenzar, te informamos el alcance, el precio y qué incluye el servicio. No iniciamos ningún trabajo pago sin tu conformidad.
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

              {whatsappSupportNumber.length >= 10 && (
                <p className="text-sm">
                  <a
                    href={`https://wa.me/${whatsappSupportNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-emerald-300 transition"
                  >
                    WhatsApp
                  </a>
                </p>
              )}
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

