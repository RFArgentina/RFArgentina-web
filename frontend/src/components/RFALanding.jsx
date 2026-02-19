import React from 'react';
import { useNavigate } from "react-router-dom";
import { getToken } from "@/lib/auth";
import { plans } from "@/data/plans";
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { FaInstagram, FaFacebook, FaLinkedin } from "react-icons/fa";
import { CheckCircle, FileText, Shield, Gavel } from 'lucide-react';

const RFALanding = () => {
  const navigate = useNavigate();
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
      title: 'Completás el formulario',
      description: 'Cargás tu caso sin registro: datos de contacto, entidad y descripción del reclamo.',
    },
    {
      icon: <Shield className="w-10 h-10 text-emerald-300" />,
      title: 'Recibís tu ID de seguimiento',
      description: 'Al enviar, te damos un ID único (RFA-XXXXXX) para consultar el estado cuando quieras.',
    },
    {
      icon: <Gavel className="w-10 h-10 text-emerald-300" />,
      title: 'Analizamos y actualizamos',
      description: 'El equipo revisa el caso, gestiona los avances y vos los ves en “Consultar caso” con email o DNI + ID.',
    },
  ];


 // ---- Servicios ----
const services = [
  {
    title: 'Carpetas de reclamo profesional',
    description:
      'Organizamos y estructuramos tu documentación para que tu reclamo se presente de forma clara, completa y profesional ante la entidad correspondiente.',
    features: [
    'Revisión y clasificación de la información',
    'Estructuración del caso según el tipo de reclamo',
    'Elaboración de carpeta profesional lista para presentar ante la entidad o para tu asesor legal',
    'Optimización del expediente para una gestión más ágil',
    ],
  },
 {
  title: 'Gestión de reclamos ante entidades',
  description:
    'Si tu caso es viable, podemos tomar la gestión administrativa completa del reclamo ante la entidad correspondiente, con seguimiento y comunicación en cada etapa.',
  features: [
    'Presentación formal ante banco, fintech u otra entidad',
    'Pedido de revisión y reajuste en casos de deuda o cargos discutidos',
    'Seguimiento de respuestas y plazos para evitar demoras',
    'Comunicación clara para que siempre sepas en qué estado está tu caso',
  ],
},

];


  // ---- Planes ----
  const faqs = [
    {
      q: "¿Qué incluye la gestión de reclamos ante entidades?",
      a: "Relevamiento del caso, armado y redacción del reclamo, presentación por canales formales y seguimiento hasta agotar vías administrativas, según el plan."
    },
    {
      q: "¿Necesito un abogado para empezar?",
      a: "No. Podés iniciar con RFA. Si el caso requiere instancia judicial, no brindamos patrocinio; te dejamos la carpeta y comunicaciones disponibles para continuar con tu abogado."
    },
    {
      q: "¿Qué documentación necesito para avanzar más rápido?",
      a: "Comprobantes, capturas, resúmenes, contratos o términos vigentes, mails/chats con la entidad y cualquier número de operación. Si falta algo, te indicamos qué pedir y cómo."
    },
    {
      q: "¿Cómo me informan avances?",
      a: "Podés consultar estado y avances con tu email + ID de caso; además, cuando corresponde, dejamos registro de comunicaciones y actualizaciones."
    },
    {
      q: "¿El análisis inicial tiene costo?",
      a: "No. El primer contacto y el análisis inicial del caso son sin cargo. Si el reclamo es viable, te proponemos el plan adecuado."
    },
    {
      q: "¿Puedo pagar en cuotas?",
      a: "Sí. En planes con gestión, podemos coordinar pago en dos cuotas dentro del período de soporte del plan."
    },
    {
      q: "¿Qué es el servicio para empresas?",
      a: "Ordenamos reclamos de alto volumen y los transformamos en casos claros y operativos para tu gestión interna: estructuración, clasificación por estado/prioridad y orden documental."
    },
    {
      q: "¿Cómo trabajamos con empresas y qué acceso tienen?",
      a: "Recibimos los casos (por lote), los cargamos y habilitamos un usuario de empresa con panel interno para consultar y actualizar estado/prioridad. No gestionamos al cliente final salvo acuerdo específico."
    },
    {
      q: "¿Cómo manejan la confidencialidad y la eliminación de datos?",
      a: "Aplicamos acceso por roles y minimización de datos. En particulares eliminamos casos cerrados en un plazo máximo de 90 días. En empresas, la retención puede configurarse (manual o purga automática 30/60/90 días)."
    }
  ];

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------
  return (
    <div className="min-h-screen text-slate-100 relative overflow-hidden">
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute top-32 -left-32 h-80 w-80 rounded-full bg-amber-300/10 blur-3xl" />
        <div className="absolute bottom-0 right-10 h-72 w-72 rounded-full bg-sky-400/10 blur-3xl" />
      </div>
      <div className="relative z-10">

        {/* ================= HERO ================= */}
        <section id="inicio" className="py-20 px-6">
          <div className="max-w-6xl mx-auto grid md:grid-cols-[1.2fr_0.8fr] gap-10 items-center">
            <div>
              <p className="text-emerald-300 uppercase tracking-[0.3em] text-xs font-semibold mb-4">
                Defensa administrativa especializada frente a entidades financieras
              </p>
              <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-6 text-slate-100">
                Reclamos Financieros Argentina
              </h1>

              <p className="text-lg md:text-2xl text-slate-200 mb-8 leading-relaxed">
                Estructuramos y gestionamos reclamos contra bancos, billeteras digitales, tarjetas y plataformas de inversión con precisión técnica, fundamento normativo y seguimiento documentado.
              </p>
              <p className="text-slate-300 mb-8">
                Cuando el reclamo está bien armado, la respuesta cambia.
              </p>
              <div className="flex flex-wrap gap-3 mb-8">
                {["Modalidad 100% online", "Registro formal de comunicaciones", "Control de plazos", "Enfoque técnico y estratégico"].map((item) => (
                  <span key={item} className="px-4 py-2 rounded-full text-xs font-semibold rfa-chip">
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
            <div className="rfa-sheen rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-6 h-6 text-emerald-300" />
                <p className="text-lg font-semibold text-slate-100">Dos modalidades, un mismo objetivo</p>
              </div>
              <p className="text-slate-200 mb-6">
                Según tu necesidad, podés delegar la gestión administrativa completa del reclamo o pedir una carpeta profesional
                lista para presentar por tu cuenta.
              </p>
              <div className="grid gap-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-slate-100">Gestión de reclamos ante entidades</p>
                  <p className="text-xs text-slate-300 mt-1">
                    Redacción + presentación + seguimiento ante la entidad, con registro de comunicaciones.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-slate-100">Carpeta profesional</p>
                  <p className="text-xs text-slate-300 mt-1">
                    Documentacion ordenada y reclamo redactado para que lo presentes por tu cuenta o con tu abogado.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-10 px-6">
          <div className="max-w-6xl mx-auto bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-100 mb-4">
              Por qué un reclamo estructurado cambia la respuesta de la entidad
            </h2>
            <p className="text-slate-300 mb-4">
              Las entidades financieras operan con procesos automatizados y respuestas estandarizadas.
              Un reclamo mal planteado suele quedar atrapado en ese circuito.
            </p>
            <p className="text-slate-300 mb-4">En RFA trabajamos distinto:</p>
            <ul className="space-y-2 text-slate-200 text-sm mb-4">
              <li>• Hechos ordenados cronológicamente y con trazabilidad clara.</li>
              <li>• Identificación de inconsistencias operativas.</li>
              <li>• Fundamento en normativa aplicable cuando corresponde (Ley 24.240, Comunicaciones BCRA, normativa CNV, etc.).</li>
              <li>• Registro formal y control de plazos de respuesta.</li>
            </ul>
            <p className="text-slate-100 font-semibold">La diferencia no es el tono. Es la estructura.</p>
          </div>
        </section>

        {/* ================= MODALIDADES ================= */}
        <section id="modalidades" className="py-10 px-6">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-300 font-semibold mb-3">Servicio principal</p>
              <h2 className="text-2xl md:text-3xl font-bold text-slate-100">Gestión de reclamos ante entidades</h2>
              <p className="text-slate-300 mt-3 leading-relaxed">
                Nos ocupamos del reclamo administrativo: armamos el caso, presentamos formalmente y damos seguimiento hasta
                agotar vías administrativas, según el plan.
              </p>
              <div className="mt-5">
                <Button
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition"
                  onClick={handleCTAClick}
                >
                  Iniciar reclamo sin costo
                </Button>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-300 font-semibold mb-3">Alternativa</p>
              <h2 className="text-2xl md:text-3xl font-bold text-slate-100">Carpeta profesional (para gestionar por tu cuenta)</h2>
              <p className="text-slate-300 mt-3 leading-relaxed">
                Si preferís avanzar por tu cuenta, organizamos pruebas, redactamos el reclamo y te entregamos un informe claro para
                presentar ante la entidad o tu abogado.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button
                  className="bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-6 rounded-lg border border-white/20"
                  onClick={() => navigate("/planes")}
                >
                  Ver planes
                </Button>
              </div>
            </div>
          </div>
        </section>

 
      {/* ================= QUI?NES SOMOS ================= */}
<section className="py-20 px-6 bg-white/5 backdrop-blur-sm">
  <div className="container mx-auto max-w-4xl">
    <div>
      <h2 className="text-3xl md:text-4xl font-bold text-emerald-300 mb-6">
        Quiénes somos
      </h2>
      <p className="text-lg text-slate-300 leading-relaxed mb-6">
        RFA es una estructura especializada en reclamos financieros administrativos.
      </p>
      <p className="text-lg text-slate-300 leading-relaxed mb-6">
        Surge ante una realidad concreta: entidades que responden con automatización,
        fragmentación de tickets y demoras sistemáticas.
      </p>
      <p className="text-lg text-slate-300 leading-relaxed mb-4">Nuestro enfoque se basa en:</p>
      <ul className="space-y-3">
        {[
          "Precisión técnica",
          "Análisis estructural del caso",
          "Comunicación clara y documentada",
          "Seguimiento hasta agotar vías administrativas",
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

        {/* ================= C?MO TRABAJAMOS ================= */}
        <section className="py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-emerald-300 uppercase tracking-[0.3em] text-xs font-semibold mb-3">Proceso</p>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-100">Cómo trabajamos</h2>
              <p className="text-slate-300 mt-4 max-w-2xl mx-auto">
                Flujo simple: cargás el caso, obtenés tu ID y seguís cada avance sin depender de login de usuario.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {steps.map((step, index) => (
                <div key={index} className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                  <div className="mb-4">{step.icon}</div>
                  <h3 className="text-xl font-semibold text-slate-100 mb-2">{step.title}</h3>
                  <p className="text-slate-300 text-sm leading-relaxed">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ================= SERVICIOS ================= */}
        <section id="servicios" className="py-20 px-6 bg-white/5 backdrop-blur-sm">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-emerald-300 mb-6">Nuestros Servicios</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {services.map((service, index) => (
              <Card key={index} className="bg-white/95 border border-white/20 hover:border-emerald-300/60 transition">
                <CardHeader>
                  <CardTitle className="text-2xl mb-3" style={{ color: "#0f172a" }}>{service.title}</CardTitle>
                  <CardDescription className="text-lg text-slate-600">{service.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {service.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                        <span className="text-slate-700">{f}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* ================= GESTIÓN DE RECLAMOS ================= */}
        <section className="py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-emerald-300 uppercase tracking-[0.22em] text-sm md:text-base font-extrabold mb-4">
                Gestión de Reclamos ante Entidades
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-100 mb-4">
                Defendemos tus derechos como usuario financiero
              </h2>
              <p className="text-slate-300 max-w-4xl mx-auto">
                En RFA te acompañamos de forma profesional en la gestión completa de reclamos administrativos contra bancos,
                billeteras virtuales, tarjetas de crédito y otras entidades del sistema financiero que hayan actuado con abuso,
                desinformación o incumplimiento.
              </p>
              <p className="text-slate-300 max-w-4xl mx-auto mt-4">
                En cada caso analizamos no solo el hecho puntual, sino la consistencia operativa de la entidad involucrada.
                Cuando detectamos omisiones, contradicciones o falta de respaldo contractual, lo dejamos asentado formalmente.
                Eso eleva el peso técnico.
              </p>
              <p className="text-slate-300 max-w-4xl mx-auto mt-4">
                Nos ocupamos de redactar, presentar y hacer el seguimiento del reclamo formal ante la entidad correspondiente,
                exigiendo una respuesta fundada y justa en base al caso concreto, hasta agotar vías administrativas.
              </p>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 h-full">
                <h3 className="text-xl font-semibold text-emerald-300 mb-3">Cuándo aplica este servicio</h3>
                <p className="text-slate-300 mb-3">Casos en los que la entidad:</p>
                <ul className="space-y-2 text-slate-200 text-sm">
                  <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5" />Cobró comisiones, débitos o intereses abusivos.</li>
                  <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5" />Suspendió cuentas o retuvo fondos sin explicación.</li>
                  <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5" />Rechazó refinanciaciones razonables.</li>
                  <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5" />No entregó información clara ni contratos escritos.</li>
                  <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5" />Omitió respuesta a reclamos anteriores.</li>
                  <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5" />Desconoció pagos, transferencias o reintegros.</li>
                  <li className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5" />Vulneró tu derecho a trato digno o atención personalizada.</li>
                </ul>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 h-full">
                <h3 className="text-xl font-semibold text-emerald-300 mb-3">Qué hacemos por vos</h3>
                <ul className="space-y-2 text-slate-200 text-sm">
                  <li className="flex items-start gap-2"><Shield className="w-5 h-5 text-emerald-400 mt-0.5" />Relevamos tu situación: analizamos tu caso, documentación y antecedentes.</li>
                  <li className="flex items-start gap-2"><Shield className="w-5 h-5 text-emerald-400 mt-0.5" />Armamos tu reclamo profesional: con hechos, pruebas y fundamentos jurídicos claros.</li>
                  <li className="flex items-start gap-2"><Shield className="w-5 h-5 text-emerald-400 mt-0.5" />Presentamos a la entidad por canales formales.</li>
                  <li className="flex items-start gap-2"><Shield className="w-5 h-5 text-emerald-400 mt-0.5" />Hacemos seguimiento real: controlamos plazos y respuestas.</li>
                  <li className="flex items-start gap-2"><Shield className="w-5 h-5 text-emerald-400 mt-0.5" />Te mantenemos informado con claridad.</li>
                  <li className="flex items-start gap-2"><Shield className="w-5 h-5 text-emerald-400 mt-0.5" />A pedido, dejamos las comunicaciones RFA-entidad disponibles como respaldo.</li>
                  <li className="flex items-start gap-2"><Shield className="w-5 h-5 text-emerald-400 mt-0.5" />Seguimiento activo hasta agotar vías administrativas.</li>
                </ul>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 h-full">
                <h3 className="text-xl font-semibold text-emerald-300 mb-3">Qué no hacemos</h3>
                <ul className="space-y-2 text-slate-200 text-sm">
                  <li className="flex items-start gap-2"><Gavel className="w-5 h-5 text-emerald-400 mt-0.5" />No ejercemos patrocinio judicial.</li>
                  <li className="flex items-start gap-2"><Gavel className="w-5 h-5 text-emerald-400 mt-0.5" />No intervenimos en mediaciones oficiales.</li>
                  <li className="flex items-start gap-2"><Gavel className="w-5 h-5 text-emerald-400 mt-0.5" />No prometemos resultados judiciales ni indemnizaciones.</li>
                </ul>
                <p className="text-slate-300 text-sm mt-4">
                  Nuestro trabajo es administrativo y técnico. Si el caso requiere instancia judicial, entregamos la
                  carpeta estructurada para que tu abogado continúe con una base sólida.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ================= PLANES ================= */}
        <section id="planes" className="py-20 px-6 bg-white/5 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-emerald-300 mb-6">
              Planes de servicio
            </h2>
            <p className="text-slate-200 mb-4">
              Un reclamo bien estructurado no depende de la agresividad, sino de la claridad y la consistencia.
              Elegí el nivel de intervención que necesitás.
            </p>
            <p className="text-lg text-slate-300 mb-8">
              Elegí la modalidad que mejor se adapta a tu caso.
            </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`bg-white/95 border rounded-2xl p-6 ${
                    plan.featured ? "border-emerald-400 shadow-2xl" : "border-white/20"
                  }`}
                >
                  <p className="text-xs uppercase tracking-wide text-emerald-600 font-semibold mb-2">
                    {plan.period}
                  </p>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{plan.name}</h3>
                  {plan.priceUsd && <p className="text-slate-900 font-semibold">{plan.priceUsd}</p>}
                  <p className="text-3xl font-extrabold text-slate-950 mb-4">{plan.price}</p>
                  <ul className="space-y-2 text-sm text-slate-700">
                    {plan.features.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="text-center">
              <p className="text-sm text-slate-300 mb-4">
                Para servicio para empresas, consultanos desde la sección Empresas.
              </p>
              <Button
                className="bg-white/10 hover:bg-white/20 text-white border border-white/20"
                onClick={() => navigate("/empresas")}
              >
                Consultar servicio para empresas
              </Button>
            </div>
          </div>
        </section>

        {/* ================= PREGUNTAS FRECUENTES ================= */}
        <section className="py-20 px-6 bg-white/5 backdrop-blur-sm">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-emerald-300 mb-6">Preguntas Frecuentes</h2>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto">
              Respuestas claras sobre la gestión de reclamos y el servicio para empresas.
            </p>
          </div>

          <div className="max-w-4xl mx-auto space-y-4">
            {faqs.map((item) => (
              <div key={item.q} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <h3 className="text-xl font-semibold text-emerald-300 mb-2">{item.q}</h3>
                <p className="text-slate-300 leading-relaxed">{item.a}</p>
              </div>
            ))}

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
        <footer id="contacto" className="bg-slate-950/80 py-12 px-6 text-slate-300 text-center md:text-left">
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div>
              <h3 className="text-lg font-semibold mb-4">RFA</h3>
              <p className="text-sm">
                Reclamos Financieros Argentina — Defendemos tus derechos financieros con profesionalismo y experiencia.
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
            © 2024 Reclamos Financieros Argentina. Todos los derechos reservados.
          </div>
        </footer>
      </div>
    </div>
  );
};

export default RFALanding;

