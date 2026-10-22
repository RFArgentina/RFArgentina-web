import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";

const serviceOptions = [
  { value: "Organización de reclamos de clientes", label: "Organización y clasificación de reclamos" },
  { value: "Armado de casos documentales", label: "Estructuración documental" },
  { value: "Automatización de procesos", label: "Seguimiento administrativo" },
  { value: "Soporte externo (opcional y a demanda)", label: "Reportes y trazabilidad" },
  { value: "Otro (especificar)", label: "Necesitamos una solución personalizada" }
];

const operationalIssues = [
  "Información y documentación dispersa",
  "Casos o gestiones duplicadas",
  "Prioridades poco claras",
  "Seguimiento inconsistente entre áreas",
  "Dificultad para conocer el estado de cada caso",
  "Falta de trazabilidad para revisiones internas"
];

const workflow = [
  { title: "Recepción", text: "Recibimos los casos derivados por tu empresa." },
  { title: "Estructuración", text: "Ordenamos información, antecedentes y documentación." },
  { title: "Clasificación", text: "Organizamos el estado y la prioridad para facilitar su consulta." },
  { title: "Seguimiento", text: "Mantenemos organizada la evolución documental y administrativa." },
  { title: "Reporte", text: "Tu equipo puede consultar el estado y la información disponible de cada caso." }
];

const audience = [
  "Empresas con crecimiento sostenido de reclamos",
  "Equipos de atención con alto volumen operativo",
  "Plataformas o servicios con múltiples casos simultáneos",
  "Organizaciones que necesitan trazabilidad documental",
  "Equipos que preparan revisiones o reportes internos"
];

export default function Enterprise() {
  const [empresa, setEmpresa] = useState("");
  const [rubro, setRubro] = useState("");
  const [contacto, setContacto] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [servicios, setServicios] = useState([]);
  const [descripcion, setDescripcion] = useState("");
  const [volumen, setVolumen] = useState("");
  const [comentarios, setComentarios] = useState("");
  const [aceptaPrivacidad, setAceptaPrivacidad] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const toggleSelection = (value, list, setter) => {
    if (list.includes(value)) {
      setter(list.filter((item) => item !== value));
    } else {
      setter([...list, value]);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setSending(true);
    setError("");
    setSent(false);

    apiRequest("/enterprise", {
      method: "POST",
      body: JSON.stringify({
        empresa,
        rubro,
        contacto,
        email,
        telefono,
        servicios,
        descripcion,
        volumen,
        comentarios,
        acepta_privacidad: aceptaPrivacidad
      })
    })
      .then(() => {
        setEmpresa("");
        setRubro("");
        setContacto("");
        setEmail("");
        setTelefono("");
        setServicios([]);
        setDescripcion("");
        setVolumen("");
        setComentarios("");
        setAceptaPrivacidad(false);
        setSent(true);
      })
      .catch((err) => setError(err.message))
      .finally(() => setSending(false));
  };

  return (
    <main className="rfa-enterprise">
      <section
        className="rfa-enterprise__hero rfa-home-image-section rfa-home-image-section-01 py-20 px-6"
        style={{ "--rfa-home-image": "url('/images/rfa-home-01.png')" }}
      >
        <div className="rfa-enterprise__container rfa-enterprise__hero-inner grid md:grid-cols-[1.2fr_0.8fr] gap-10 items-center">
          <div className="rfa-enterprise__hero-copy">
            <p className="rfa-enterprise__eyebrow">Reclamos Financieros Argentina</p>
            <p className="rfa-enterprise__label">Soluciones para empresas</p>
            <h1>Orden y trazabilidad para operaciones con alto volumen de reclamos</h1>
            <p className="rfa-enterprise__lead">
              RFA recibe, organiza, clasifica y da seguimiento documental a los casos derivados por tu empresa desde un entorno centralizado.
            </p>
            <p className="rfa-enterprise__supporting">
              Trabajamos sobre la estructura y el seguimiento de los casos para fortalecer la capacidad interna de respuesta; no resolvemos directamente el conflicto con el cliente final.
            </p>
            <a className="rfa-enterprise__button" href="#enterprise-form">Solicitar una propuesta</a>
          </div>

          <aside className="rfa-enterprise__hero-aside" aria-label="Sello institucional y capacidades">
            <img className="rfa-enterprise__emblem" src="/rfa-logo.png" alt="Escudo de Reclamos Financieros Argentina" />
            <div className="rfa-enterprise__signal-panel">
              <span>Trazabilidad</span>
              <span>Priorización</span>
              <span>Seguimiento</span>
            </div>
          </aside>
        </div>
      </section>

      <section
        className="rfa-enterprise__section rfa-enterprise__problem rfa-home-image-section rfa-home-image-section-02 py-10 px-6"
        style={{ "--rfa-home-image": "url('/images/rfa-home-02.png')" }}
        aria-labelledby="enterprise-problem-title"
      >
        <div className="rfa-enterprise__container">
          <div className="rfa-enterprise__section-heading">
            <p className="rfa-enterprise__kicker">El desafío operativo</p>
            <h2 id="enterprise-problem-title">Cuando el volumen crece, el problema deja de ser un caso aislado</h2>
            <p>Con muchos reclamos abiertos, el desafío pasa a ser mantener orden, criterios consistentes y visibilidad sobre lo que requiere atención.</p>
          </div>
          <ul className="rfa-enterprise__issue-list">
            {operationalIssues.map((issue) => <li key={issue}>{issue}</li>)}
          </ul>
        </div>
      </section>

      <section
        className="rfa-enterprise__section rfa-home-image-section rfa-home-image-section-03 py-20 px-6"
        style={{ "--rfa-home-image": "url('/images/rfa-home-03.png')" }}
        aria-labelledby="enterprise-work-title"
      >
        <div className="rfa-enterprise__container">
          <div className="rfa-enterprise__section-heading">
            <p className="rfa-enterprise__kicker">Un proceso claro</p>
            <h2 id="enterprise-work-title">Cómo trabaja RFA con tu empresa</h2>
          </div>
          <ol className="rfa-enterprise__workflow">
            {workflow.map((step, index) => (
              <li className="rfa-enterprise__step" key={step.title}>
                <span className="rfa-enterprise__step-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        className="rfa-enterprise__section rfa-enterprise__visibility rfa-home-image-section rfa-home-image-section-04 py-10 px-6"
        style={{ "--rfa-home-image": "url('/images/rfa-home-04.png')" }}
        aria-labelledby="enterprise-visibility-title"
      >
        <div className="rfa-enterprise__container rfa-enterprise__visibility-inner">
          <div className="rfa-enterprise__section-heading">
            <p className="rfa-enterprise__kicker">Panel privado para empresas</p>
            <h2 id="enterprise-visibility-title">Visibilidad sobre cada caso desde un único lugar</h2>
            <p>Cada empresa cuenta con acceso privado para consultar sus casos, identificar prioridades y revisar la información disponible para el seguimiento.</p>
            <ul className="rfa-enterprise__benefits">
              <li>Estado y prioridad de los casos</li>
              <li>Información organizada y centralizada</li>
              <li>Seguimiento y trazabilidad</li>
            </ul>
          </div>
          <div className="rfa-enterprise__panel-preview" aria-label="Mockup ilustrativo preparado para reemplazar por una captura real del panel">
            <div className="rfa-enterprise__preview-topbar">
              <span className="rfa-enterprise__preview-dots" aria-hidden="true"><i /><i /><i /></span>
              <span>Panel de empresas</span>
              <span className="rfa-enterprise__preview-private">Acceso privado</span>
            </div>
            <div className="rfa-enterprise__preview-content">
              <div className="rfa-enterprise__preview-heading"><span>Caso</span><span>Estado</span><span>Prioridad</span></div>
              {[0, 1, 2].map((row) => (
                <div className="rfa-enterprise__preview-row" key={row} aria-hidden="true">
                  <span className="rfa-enterprise__preview-case" />
                  <span className="rfa-enterprise__preview-status" />
                  <span className="rfa-enterprise__preview-priority" />
                </div>
              ))}
            </div>
            <p className="rfa-enterprise__preview-caption">Vista ilustrativa · espacio para captura real</p>
          </div>
          <p className="rfa-enterprise__visibility-note">Panel privado para consulta, clasificación y seguimiento de los casos derivados.</p>
        </div>
      </section>

      <section
        className="rfa-enterprise__section rfa-enterprise__audience-section rfa-home-image-section rfa-home-image-section-05 py-20 px-6 bg-white/5 backdrop-blur-sm"
        style={{ "--rfa-home-image": "url('/images/rfa-home-05.png')" }}
        aria-labelledby="enterprise-audience-title"
      >
        <div className="rfa-enterprise__container">
          <div className="rfa-enterprise__section-heading">
            <p className="rfa-enterprise__kicker">Para equipos en crecimiento</p>
            <h2 id="enterprise-audience-title">Pensado para operaciones que necesitan más control</h2>
          </div>
          <ul className="rfa-enterprise__audience-list">
            {audience.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </section>

      <section
        className="rfa-enterprise__proposal rfa-home-image-section rfa-home-image-section-06 py-20 px-6 bg-white/5 backdrop-blur-sm"
        style={{ "--rfa-home-image": "url('/images/rfa-home-06.png')" }}
        aria-labelledby="enterprise-proposal-title"
      >
        <div className="rfa-enterprise__container rfa-enterprise__proposal-inner">
          <div>
            <p className="rfa-enterprise__kicker">Alcance a medida</p>
            <h2 id="enterprise-proposal-title">Una propuesta adaptada a la operación</h2>
            <p>No trabajamos con un paquete único para empresas. La propuesta se define según el volumen de casos, el tipo de trabajo requerido y la modalidad de seguimiento.</p>
            <p className="rfa-enterprise__proposal-close">Una operación con más reclamos no debería significar más desorden. Centralizá la información, identificá prioridades y mantené trazabilidad sobre cada caso.</p>
            <div className="rfa-enterprise__contact" aria-label="Contacto y acceso para empresas">
              <a href="mailto:soporte@rfargentina.com">soporte@rfargentina.com</a>
              <p>El acceso al panel empresa se habilita únicamente por RFA. No existe registro público para cuentas corporativas.</p>
            </div>
          </div>
          <a className="rfa-enterprise__button rfa-enterprise__button--secondary" href="#enterprise-form">Solicitar una propuesta</a>
        </div>
      </section>

      <section
        className="rfa-enterprise__form-section rfa-home-image-section rfa-home-image-section-07 py-20 px-6"
        style={{ "--rfa-home-image": "url('/images/rfa-home-07.png')" }}
        id="enterprise-form"
        aria-labelledby="enterprise-form-title"
      >
        <div className="rfa-enterprise__container rfa-enterprise__form-inner">
          <div className="rfa-enterprise__form-intro">
            <p className="rfa-enterprise__kicker">Conversemos sobre tu operación</p>
            <h2 id="enterprise-form-title">Contanos cómo gestionan hoy sus reclamos</h2>
            <p>Analizamos el volumen, el circuito actual y las necesidades de seguimiento para preparar una propuesta de trabajo.</p>
          </div>

          <form onSubmit={handleSubmit} className="rfa-enterprise__form">
            <div className="rfa-enterprise__field-grid">
              <div className="rfa-enterprise__field">
                <label htmlFor="empresa-nombre">Nombre de la empresa</label>
                <input type="text" id="empresa-nombre" value={empresa} onChange={(e) => setEmpresa(e.target.value)} required />
              </div>
              <div className="rfa-enterprise__field">
                <label htmlFor="empresa-rubro">Rubro / Sector</label>
                <select id="empresa-rubro" value={rubro} onChange={(e) => setRubro(e.target.value)} required>
                  <option value="">Seleccionar</option>
                  <option value="Bancos">Bancos</option>
                  <option value="Comercio minorista / e-commerce">Comercio minorista / e-commerce</option>
                  <option value="Fintech / billeteras digitales">Fintech / billeteras digitales</option>
                  <option value="Tarjetas / medios de pago">Tarjetas / medios de pago</option>
                  <option value="Seguros">Seguros</option>
                  <option value="Salud">Salud</option>
                  <option value="Telecomunicaciones">Telecomunicaciones</option>
                  <option value="Servicios públicos">Servicios públicos</option>
                  <option value="Educación">Educación</option>
                  <option value="Turismo y transporte">Turismo y transporte</option>
                  <option value="Logística">Logística</option>
                  <option value="Tecnología / SaaS">Tecnología / SaaS</option>
                  <option value="Agroindustria">Agroindustria</option>
                  <option value="Inmobiliario">Inmobiliario</option>
                  <option value="Otros">Otros</option>
                </select>
              </div>
              <div className="rfa-enterprise__field">
                <label htmlFor="empresa-contacto">Nombre y cargo</label>
                <input type="text" id="empresa-contacto" value={contacto} onChange={(e) => setContacto(e.target.value)} required />
              </div>
              <div className="rfa-enterprise__field">
                <label htmlFor="empresa-email">Correo de contacto</label>
                <input type="email" id="empresa-email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="rfa-enterprise__field">
                <label htmlFor="empresa-telefono">Teléfono (opcional)</label>
                <input type="text" id="empresa-telefono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
              </div>
              <fieldset className="rfa-enterprise__field rfa-enterprise__services">
                <legend>¿Qué necesitan mejorar?</legend>
                <div className="rfa-enterprise__service-options">
                  {serviceOptions.map(({ value, label }) => (
                    <label className="rfa-enterprise__checkbox-option" key={value}>
                      <input type="checkbox" checked={servicios.includes(value)} onChange={() => toggleSelection(value, servicios, setServicios)} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="rfa-enterprise__field rfa-enterprise__field--wide">
                <label htmlFor="empresa-descripcion">Breve descripción del problema o necesidad</label>
                <textarea id="empresa-descripcion" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} required />
              </div>
              <div className="rfa-enterprise__field">
                <label htmlFor="empresa-volumen">Volumen estimado de reclamos mensuales</label>
                <select id="empresa-volumen" value={volumen} onChange={(e) => setVolumen(e.target.value)} required>
                  <option value="">Seleccionar</option>
                  <option value="0-200">0 a 200</option>
                  <option value="200-500">200 a 500</option>
                  <option value="500+">+500</option>
                </select>
              </div>
              <div className="rfa-enterprise__field rfa-enterprise__field--wide">
                <label htmlFor="empresa-comentarios">Comentarios adicionales (opcional)</label>
                <textarea className="rfa-enterprise__comments" id="empresa-comentarios" value={comentarios} onChange={(e) => setComentarios(e.target.value)} />
              </div>
            </div>

            <label className="rfa-enterprise__privacy">
              <input type="checkbox" checked={aceptaPrivacidad} onChange={(event) => setAceptaPrivacidad(event.target.checked)} required />
              <span>Acepto el tratamiento de los datos de contacto conforme a la <Link to="/privacidad">Política de Privacidad</Link>.</span>
            </label>
            <div className="rfa-enterprise__submit-row">
              <Button type="submit" className="rfa-enterprise__submit" disabled={sending}>
                {sending ? "Enviando..." : "Solicitar propuesta"}
              </Button>
            </div>
            {sent && <p className="rfa-enterprise__success" role="status">Consulta enviada. Te contactamos a la brevedad.</p>}
            {error && <p className="rfa-enterprise__error" role="alert">{error}</p>}
          </form>
        </div>
      </section>
    </main>
  );
}
