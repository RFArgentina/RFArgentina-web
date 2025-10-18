import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { FaInstagram, FaFacebook, FaLinkedin } from "react-icons/fa";
import { CheckCircle, FileText, Shield, Gavel } from 'lucide-react';
import logoFondo from '../assets/logo-fondo.png';

const RFALanding = () => {
  // ---- CTA: abre el formulario (gratis) en pestaña nueva ----
  const handleCTAClick = () => {
    window.open('https://forms.gle/SKRiXkn5A2vAXgoL6', '_blank');
  };

  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const handlePlanClick = (plan) => {
    setSelectedPlan(plan);
    setShowModal(true);
  };

  // ---- Pasos de trabajo ----
  const steps = [
    {
      icon: <FileText className="w-10 h-10 text-blue-900" />,
      title: 'Cargás tu reclamo',
      description: 'Completás nuestro formulario con los detalles de tu situación financiera.',
    },
    {
      icon: <Shield className="w-10 h-10 text-blue-900" />,
      title: 'Organizamos pruebas',
      description: 'Recopilamos y ordenamos toda la documentación necesaria.',
    },
    {
      icon: <Gavel className="w-10 h-10 text-blue-900" />,
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
  const plans = [
    {
      name: "Plan Básico Profesional",
  priceUsd: "USD 180",
  price: "$250.000",
  period: "Entrega única",
  features: [
    "Armado completo de la carpeta profesional",
    "Organización y revisión de la documentación",
    "Informe de presentación para el abogado elegido",
    "Sin seguimiento del caso ni representación ante la entidad"
  ],
      paypalUrl: "https://www.paypal.com/invoice/p/#Z9U84SSDGGAM8U94",
      mpUrl: "https://link.mercadopago.com/plan-basico"
    },
    {
      name: "Plan Medio",
      priceUsd: "USD 310",
      price: "$435.000",
      period: "60 días",
      features: [
        "60 días corridos de soporte",
        "Seguimiento intensivo",
        "Documentación avanzada",
        "Asesoramiento especializado",
        "Contacto prioritario"
      ],
      paypalUrl: "https://www.paypal.com/invoice/p/#SR2ZGA5FNK7S4AZW",
      mpUrl: "https://link.mercadopago.com/plan-medio"
    },
    {
      name: "Plan Premium",
      priceUsd: "USD 620",
      price: "$900.000",
      period: "6 meses",
      features: [
       "Seguimiento y asistencia prioritaria durante todo el proceso administrativo",
    "Análisis y revisión avanzada de documentación",
    "Asesoramiento continuo con nuestro equipo especializado",
    "Comunicación directa y prioridad en consultas",
    "Incluye acompañamiento en 1 reclamo adicional"

      ],
      paypalUrl: "https://www.paypal.com/invoice/p/#3PU5KCVCFX52KLNX",
      mpUrl: "https://link.mercadopago.com/plan-premium"
    }
  ];

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------
  return (
    <div
      className="min-h-screen text-white relative"
     style={{
  backgroundImage: `url(${logoFondo})`,
  backgroundColor: 'rgba(0, 0, 41, 1)',

  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  backgroundAttachment: 'fixed',
}}


    >
      {/* Overlay global */}
       {/*<div className="absolute inset-0 bg-black/60 z-0"></div>*/}
      <div className="relative z-10">

        {/* ================= HERO ================= */}
        <section id="inicio" className="py-20 px-6 text-center">
          <div className="max-w-4xl mx-auto">
              <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-6 drop-shadow-[0_2px_6px_rgba(255,255,255,0.2)]" style={{ color: 'rgba(1, 1, 27, 1)' }}>
  Reclamos Financieros Argentina
</h1>

            <p className="text-lg md:text-2xl text-gray-200 mb-8 leading-relaxed">
              Tu aliado para reclamar lo que te pertenece.
            </p>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition"
              onClick={handleCTAClick}
            >
              Comenzar mi reclamo
            </Button>
          </div>
        </section>

        {/* ================= QUIÉNES SOMOS ================= */}
        <section className="py-20 px-6 bg-black/40">
          <div className="container mx-auto grid md:grid-cols-2 gap-12 items-center">
            <img
              src="https://images.unsplash.com/photo-1603796846097-bee99e4a601f"
              alt="Firma de documentos - RFA"
              className="rounded-lg shadow-xl w-full h-64 md:h-80 object-cover"
            />
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-green-600 mb-6">
                Quiénes somos
              </h2>
              <p className="text-lg text-gray-200 leading-relaxed mb-6">
                <strong className="text-green-600">RFA</strong> es una consultoría
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
                    <CheckCircle className="w-5 h-5 text-blue-900" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ================= CÓMO TRABAJAMOS ================= */}
        <section className="py-20 px-6 bg-black/30">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-green-600 mb-6">
              Cómo trabajamos
            </h2>
            <p className="text-lg text-gray-200">Nuestro proceso simple y efectivo en 3 pasos</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {steps.map((step, index) => (
              <Card key={index} className="text-center border-2 hover:border-blue-800 transition-all duration-300 hover:shadow-lg bg-white">
                <CardHeader className="pb-4">
                  <div className="mx-auto mb-4 w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center">
                    {step.icon}
                  </div>
                  <div className="text-sm font-semibold text-blue-800 mb-2">PASO {index + 1}</div>
                  <CardTitle className="text-xl text-blue-950">{step.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 leading-relaxed">{step.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* ================= SERVICIOS ================= */}
        <section id="servicios" className="py-20 px-6 bg-black/40">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-green-600 mb-6">Nuestros Servicios</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {services.map((service, index) => (
              <Card key={index} className="bg-white border-2 hover:border-blue-200">
                <CardHeader>
                  <CardTitle className="text-2xl text-blue-900 mb-3">{service.title}</CardTitle>
                  <CardDescription className="text-lg text-gray-600">{service.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {service.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <CheckCircle className="w-4 h-4 text-blue-700" />
                        <span className="text-gray-700">{f}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* ================= PLANES ================= */}
        <section className="py-20 px-6 bg-black/30">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-green-600 mb-6">Nuestros Planes</h2>
            <p className="text-lg text-gray-200">Elegí el plan que mejor se adapte a tu situación</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan, index) => (
              <Card key={index} className="relative bg-white border-2 hover:shadow-lg transition-all">
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl font-bold text-blue-900 mb-2">{plan.name}</CardTitle>
                  <p className="text-xl font-extrabold text-blue-950 mb-1">{plan.priceUsd}</p>
                  <p className="text-4xl font-extrabold text-blue-950 mb-2">{plan.price}</p>
                  <p className="text-sm text-gray-500">{plan.period}</p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 mb-4">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle className="w-5 h-5 text-blue-700" />
                        <span className="text-gray-700">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button onClick={() => handlePlanClick(plan)} className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg">
                    Iniciar con {plan.name}
                  </Button>
                </CardContent>
              </Card>
            ))}
                                  <p className="text-sm text-green-600 mt-0 font-medium text-center whitespace-nowrap tracking-wide">
                      *Sujeto a porcentaje de hasta el 10% sobre los montos recuperados, aplicable solo en casos de éxito y según evaluación del reclamo.*
</p>



          </div>

        </section>

{/* ================= PREGUNTAS FRECUENTES ================= */}
<section className="py-20 px-6 bg-black/40">
  <div className="text-center mb-16">
    <h2 className="text-3xl md:text-4xl font-bold text-green-600 mb-6">
      Preguntas Frecuentes
    </h2>
    <p className="text-lg text-gray-200 max-w-2xl mx-auto">
      Respondemos lo más importante sobre nuestra institución y metodología.
    </p>
  </div>

  <div className="max-w-4xl mx-auto space-y-10">
    <div>
      <h3 className="text-2xl font-semibold text-green-600 mb-2">
        ¿Quiénes somos en RFA?
      </h3>
      <p className="text-gray-200">
        Somos una consultora especializada en reclamos financieros. 
        Te ayudamos a ordenar tu reclamo y dejarlo listo para que los abogados aliados puedan avanzar rápidamente.
      </p>
    </div>

    <div>
      <h3 className="text-2xl font-semibold text-green-600 mb-2">
        ¿Qué tipo de problemas atendemos?
      </h3>
      <p className="text-gray-200">
        Trabajamos con reclamos contra bancos, billeteras virtuales, plataformas de inversión y casas de apuestas legales. 
        También atendemos conflictos de consumo y financieros en general.
      </p>
    </div>

    <div>
      <h3 className="text-2xl font-semibold text-green-600 mb-2">
        ¿Necesito un abogado para empezar el reclamo?
      </h3>
      <p className="text-gray-200">
        No. Iniciás el proceso con RFA: organizamos tu reclamo y armamos la carpeta profesional. 
        Si hace falta, luego lo derivamos a un estudio jurídico aliado.
      </p>
    </div>

    <div>
      <h3 className="text-2xl font-semibold text-green-600 mb-2">
        ¿Cómo es el proceso de trabajo?
      </h3>
      <p className="text-gray-200 leading-relaxed">
        1. Cargás tu reclamo en el formulario.<br />
        2. Organizamos la documentación y pruebas.<br />
        3. Entregamos una carpeta profesional lista para presentar.
      </p>
    </div>

    <div>
      <h3 className="text-2xl font-semibold text-green-600 mb-2">
        ¿Dónde trabajan y cómo me comunico?
      </h3>
      
      <p className="text-gray-200">
        Atendemos en todo el país de manera 100% online. 
        Podés contactarnos por WhatsApp, correo electrónico o redes sociales en cualquier momento.
      </p>
      <div className="mt-10">
  <h3 className="text-2xl font-semibold text-green-600 mb-2">
    ¿Puedo abonar mi plan en cuotas?
  </h3>
  <p className="text-gray-200 leading-relaxed">
    Sí. A partir del <strong>Plan Medio</strong>, los pagos pueden realizarse en 
    <strong> dos cuotas sin interés</strong>, abonadas dentro del período de soporte 
    establecido para cada plan.
  </p>
</div>

    </div>
    <div className="text-center mt-16">
      
  <Button
    onClick={() => window.open('https://forms.gle/SKRiXkn5A2vAXgoL6', '_blank')}
    className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition"
  >
    Cargar mi reclamo ahora
  </Button>
</div>

  </div>
</section>

        {/* ================= MODAL DE PAGO ================= */}
        {showModal && selectedPlan && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full text-center">
              <h2 className="text-2xl font-bold mb-4">Elegí un método de pago para {selectedPlan.name}</h2>
              <div className="space-y-3">
                <Button className="w-full bg-blue-600 text-white hover:bg-blue-700" onClick={() => window.open(selectedPlan.mpUrl, "_blank")}>
                  Pagar con MercadoPago
                </Button>
                <Button className="w-full bg-gray-800 text-white hover:bg-gray-900" onClick={() => window.open(selectedPlan.paypalUrl, "_blank")}>
                  Pagar con PayPal
                </Button>
                <button className="mt-4 text-red-600 hover:underline" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= FOOTER ================= */}
        <footer id="contacto" className="bg-black/90 py-12 px-6 text-gray-300 text-center md:text-left">
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div>
              <h3 className="text-lg font-semibold mb-4">RFA</h3>
              <p className="text-sm">
                Reclamos Financieros Argentina — Defendemos tus derechos financieros con profesionalismo y experiencia.
              </p>
              <p className="text-green-500 mt-2 text-sm">Atendemos en todo el país — modalidad 100% online.</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Contacto</h3>
              <p className="text-sm">soporte@rfargentina.com</p>
              
              <p className="text-sm">WhatsApp: En trámite</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Seguinos</h3>
              <div className="flex justify-center md:justify-start gap-4 text-2xl">
                <a href="https://www.instagram.com/reclamosfinancierosarg" target="_blank" rel="noreferrer">
                  <FaInstagram className="hover:text-pink-500 transition" />
                </a>
                <a href="https://www.facebook.com" target="_blank" rel="noreferrer">
                  <FaFacebook className="hover:text-blue-500 transition" />
                </a>
                <a href="https://www.linkedin.com" target="_blank" rel="noreferrer">
                  <FaLinkedin className="hover:text-blue-400 transition" />
                </a>
              </div>
            </div>
          </div>
          <div className="text-center text-gray-500 text-sm mt-10">
            © 2024 Reclamos Financieros Argentina. Todos los derechos reservados.
          </div>
        </footer>
      </div>
    </div>
  );
};

export default RFALanding;
