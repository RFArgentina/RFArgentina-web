import React, { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import { getToken } from "@/lib/auth";
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { FaInstagram, FaFacebook, FaLinkedin } from "react-icons/fa";
import { CheckCircle, FileText, Shield, Gavel } from 'lucide-react';

const RFALanding = () => {
  const navigate = useNavigate();
  const isAuthenticated = Boolean(getToken());
  // ---- CTA: abre el formulario (gratis) en pestaña nueva ----
  const handleCTAClick = () => {
    navigate(isAuthenticated ? "/panel" : "/login");
  };
 
  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState(false);

  useEffect(() => {
    fetch("/api/news")
      .then(res => res.json())
      .then(data => setNews(Array.isArray(data) ? data : []))
      .catch(err => {
        console.error("Error cargando noticias:", err);
        setNewsError(true);
      })
      .finally(() => setNewsLoading(false));
  }, []);

  // ---- Pasos de trabajo ----
  const steps = [
    {
      icon: <FileText className="w-10 h-10 text-emerald-300" />,
      title: 'Cargás tu reclamo',
      description: 'Completás nuestro formulario con los detalles de tu situación financiera.',
    },
    {
      icon: <Shield className="w-10 h-10 text-emerald-300" />,
      title: 'Organizamos pruebas',
      description: 'Recopilamos y ordenamos toda la documentación necesaria.',
    },
    {
      icon: <Gavel className="w-10 h-10 text-emerald-300" />,
      title: 'Carpeta lista',
      description: 'Entregamos una carpeta profesional para estudios jurídicos aliados.',
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
    'Elaboración de carpeta profesional lista para presentar ante estudios aliados' ,
    'Optimización del expediente para una gestión más ágil',
    ],
  },
 {
  title: 'Planes de acompañamiento',
  description:
    'Tomamos tu caso y nos encargamos de iniciar o continuar el reclamo ante la entidad correspondiente, manteniéndote informado en cada etapa del proceso.',
  features: [

    'Gestión administrativa completa del reclamo',

    'Presentación formal ante la entidad',

    'Seguimiento constante del estado del caso',

    'Comunicación directa durante todo el proceso',
  ],
},

];


  // ---- Planes ----

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
                Consultoría en reclamos financieros
              </p>
              <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-6 text-slate-100">
                Reclamos Financieros Argentina
              </h1>

              <p className="text-lg md:text-2xl text-slate-200 mb-8 leading-relaxed">
                Convertimos tu reclamo en un caso sólido, claro y listo para avanzar.
                Atendemos de forma 100% online con un proceso transparente.
              </p>
              <div className="flex flex-wrap gap-3 mb-8">
                {["100% online", "Proceso guiado", "Confidencialidad", "Equipo experto"].map((item) => (
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
                  onClick={() => navigate(isAuthenticated ? "/panel" : "/registro")}
                >
                  Ver planes
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
                <p className="text-lg font-semibold text-slate-100">Tu reclamo, listo para accionar</p>
              </div>
              <p className="text-slate-200 mb-6">
                Organizamos evidencia, redactamos la presentación y dejamos todo listo para que un estudio aliado avance
                sin demoras.
              </p>
              <ul className="space-y-3 text-sm text-slate-200">
                {["Documentación ordenada", "Presentación profesional", "Seguimiento claro del estado"].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle className="w-4 h-4 text-emerald-300 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
 
      {/* ================= QUIÉNES SOMOS ================= */}
<section className="py-20 px-6 bg-white/5 backdrop-blur-sm">
  <div className="container mx-auto grid md:grid-cols-2 gap-12 items-center">
    
    {/* Columna Izquierda: Imagen con bloque flotante */}
    <div className="relative">
      <img
        src="https://images.unsplash.com/photo-1603796846097-bee99e4a601f"
        alt="Firma de documentos - RFA"
        className="rounded-2xl shadow-xl w-full h-48 md:h-80 object-cover"
      />


      {/* BLOQUE FLOTANTE DE NOTICIAS */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-slate-900/70 backdrop-blur-lg text-white p-6 rounded-2xl shadow-2xl w-full h-full border border-emerald-500/30">
          <h3 className="text-emerald-300 text-lg font-semibold mb-4 border-b border-emerald-500/30 pb-2 text-center sticky top-0 bg-slate-900/80">
            Últimas Noticias Financieras
          </h3>
          <ul
            className="space-y-3 pr-3"
            style={{
              maxHeight: "230px", // 🔹 Scroll largo visible
              overflowY: "scroll", // ✅ Solo este scrollea
              scrollbarWidth: "thin",
              scrollbarColor: "#10b981 transparent",
            }}
          >
            {newsLoading && (
              <li className="text-slate-300 text-sm">Cargando noticias...</li>
            )}
            {newsError && !newsLoading && (
              <li className="text-rose-300 text-sm">No se pudieron cargar las noticias.</li>
            )}
            {!newsLoading && !newsError && news.length === 0 && (
              <li className="text-slate-300 text-sm">Sin noticias por el momento.</li>
            )}
            {!newsLoading && !newsError && news.map((n) => (
              <li
                key={n.link || n.title}
                className="bg-slate-900/40 border border-emerald-500/20 p-3 rounded-md hover:bg-slate-900/60 transition-colors"
              >
                <a
                  href={n.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-200 hover:text-emerald-300 text-sm font-medium"
                >
                  {n.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>


    {/* Columna Derecha: Quiénes somos */}
    <div className="md:col-start-2 md:row-start-1">
      <h2 className="text-3xl md:text-4xl font-bold text-emerald-300 mb-6">
        Quiénes somos
      </h2>
      <p className="text-lg text-slate-300 leading-relaxed mb-6">
        <strong className="text-emerald-300">RFA</strong> es una consultoría
        especializada en reclamos financieros. Ayudamos a usuarios y empresas
        a transformar sus quejas en casos sólidos, claros y listos para ser
        presentados ante estudios jurídicos aliados.
      </p>
      <ul className="space-y-3">
        {[
          "Bancos tradicionales y digitales",
          "Billeteras digitales",
          "Plataformas de inversión",
          "Casas de apuestas legales",
        ].map((item, i) => (
          <li key={i} className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-300" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  </div>
</section>

        {/* ================= CÓMO TRABAJAMOS ================= */}
        <section className="py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-emerald-300 uppercase tracking-[0.3em] text-xs font-semibold mb-3">Proceso</p>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-100">Cómo trabajamos</h2>
              <p className="text-slate-300 mt-4 max-w-2xl mx-auto">
                Un camino claro y ordenado para que tu reclamo avance sin fricciones.
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

        {/* ================= PLANES ================= */}
        <section id="planes" className="py-20 px-6 bg-white/5 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-emerald-300 mb-6">
              Planes disponibles solo para usuarios registrados
            </h2>
            <p className="text-lg text-slate-300 mb-8">
              Registrate o iniciá sesión para ver todos los planes y beneficios.
            </p>
            <Button
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition"
              onClick={() => navigate(isAuthenticated ? "/panel" : "/registro")}
            >
              Registrarme para ver planes
            </Button>
          </div>
        </section>

{/* ================= PREGUNTAS FRECUENTES ================= */}
<section className="py-20 px-6 bg-white/5 backdrop-blur-sm">
  <div className="text-center mb-16">
    <h2 className="text-3xl md:text-4xl font-bold text-emerald-300 mb-6">
      Preguntas Frecuentes
    </h2>
    <p className="text-lg text-slate-300 max-w-2xl mx-auto">
      Respondemos lo más importante sobre nuestra institución y metodología.
    </p>
  </div>

  <div className="max-w-4xl mx-auto space-y-10">
    <div>
      <h3 className="text-2xl font-semibold text-emerald-300 mb-2">
        ¿Quiénes somos en RFA
      </h3>
      <p className="text-slate-300">
        Somos una consultora especializada en reclamos financieros.
        Te ayudamos a ordenar tu reclamo y dejarlo listo para que los abogados aliados puedan avanzar rápidamente.
      </p>
    </div>

    <div>
      <h3 className="text-2xl font-semibold text-emerald-300 mb-2">
        ¿Qué tipo de problemas atendemos
      </h3>
      <p className="text-slate-300">
        Trabajamos con reclamos contra bancos, billeteras virtuales, plataformas de inversión y casas de apuestas legales.
        También atendemos conflictos de consumo y financieros en general.
      </p>
    </div>

    <div>
      <h3 className="text-2xl font-semibold text-emerald-300 mb-2">
        ¿Necesito un abogado para empezar el reclamo
      </h3>
      <p className="text-slate-300">
        No. Iniciás el proceso con RFA: organizamos tu reclamo y armamos la carpeta profesional.
        Si hace falta, luego lo derivamos a un estudio jurídico aliado.
      </p>
    </div>

    <div>
      <h3 className="text-2xl font-semibold text-emerald-300 mb-2">
        ¿Cómo es el proceso de trabajo
      </h3>
      <p className="text-slate-300 leading-relaxed">
        1. Cargás tu reclamo en el formulario.<br />
        2. Organizamos la documentación y pruebas.<br />
        3. Entregamos una carpeta profesional lista para presentar.
      </p>
    </div>

    <div>
      <h3 className="text-2xl font-semibold text-emerald-300 mb-2">
        ¿Dónde trabajan y cómo me comunico
      </h3>
      
      <p className="text-slate-300">
        Atendemos en todo el país de manera 100% online.
        Podés contactarnos por WhatsApp, correo electrónico o redes sociales en cualquier momento.
      </p>
      <div className="mt-10">
  <h3 className="text-2xl font-semibold text-emerald-300 mb-2">
    ¿Puedo abonar mi plan en cuotas
  </h3>
  <p className="text-slate-300 leading-relaxed">
    Sí. A partir del <strong>Plan Seguimiento</strong>, los pagos pueden realizarse en 
    <strong> dos cuotas sin interés</strong>, abonadas dentro del período de soporte 
    establecido para cada plan.
  </p>
</div>
<div className="mt-10">
  <h3 className="text-2xl font-semibold text-emerald-300 mb-2">
    ¿El primer contacto y análisis del caso tiene costo
  </h3>
  <p className="text-slate-300 leading-relaxed">
    No. El <strong>primer contacto y el análisis inicial de tu caso son totalmente gratuitos</strong>. 
    En <strong>Reclamos Financieros Argentina (RFA)</strong> evaluamos cada situación sin compromiso 
    y solo si el reclamo es viable, te ofrecemos las opciones de seguimiento o documentación profesional 
    según corresponda.
  </p>
</div>


    </div>
    <div className="text-center mt-16">
      
  <Button
    onClick={() => navigate(isAuthenticated ? "/panel" : "/login")}
    className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition"
  >
    Cargar mi caso sin cargo
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
