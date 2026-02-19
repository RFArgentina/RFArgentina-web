import { useState } from "react";
import { Button } from "@/components/ui/button";

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

    fetch("/api/enterprise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        empresa,
        rubro,
        contacto,
        email,
        telefono,
        servicios,
        descripcion,
        volumen,
        comentarios
      })
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "No se pudo enviar la consulta");
        }
        return res.json();
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
        setSent(true);
      })
      .catch((err) => setError(err.message))
      .finally(() => setSending(false));
  };

  return (
    <div className="min-h-screen text-slate-100 px-6 py-20 pt-28">
      <div className="max-w-6xl mx-auto space-y-16">
        <section className="grid lg:grid-cols-[1.2fr_0.8fr] gap-10 items-start">
          <div>
            <p className="text-emerald-300 uppercase tracking-[0.3em] text-xs font-semibold mb-4">
              Soluciones para Empresas
            </p>
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight mb-6">
              Transformamos reclamos en eficiencia operativa
            </h1>
            <p className="text-lg text-slate-300 leading-relaxed">
              En RFA ayudamos a empresas que reciben altos volumenes de reclamos a convertirlos en casos ordenados,
              claros y listos para su gestión interna.
            </p>
            <p className="text-sm text-slate-400 mt-4">
              Nos enfocamos exclusivamente en la organizacion profesional, no en la resolucion directa.
            </p>
            <p className="text-sm text-slate-300 mt-3 leading-relaxed">
              Cada empresa cuenta con un usuario exclusivo dentro del panel interno de RFA, pensado para
              visualizar, ordenar y dar seguimiento a sus casos con una trazabilidad clara y continua.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {[
                "Estructuracion de reclamos",
                "Clasificacion y priorizacion",
                "Automatizacion",
                "Reportes ejecutivos"
              ].map((item) => (
                <span key={item} className="px-4 py-2 rounded-full text-xs font-semibold rfa-chip">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="rfa-sheen rounded-2xl p-8">
            <h2 className="text-lg font-semibold mb-4">Como impactamos en tu operacion</h2>
            <ul className="space-y-3 text-sm text-slate-200">
              {[
                    "Casos claros y trazables para gestión interna",
                "Menos tiempo en tareas repetitivas",
                "Equipos mas ordenados y con mejor productividad",
                "Menor riesgo legal y reputacional"
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="bg-white/10 border border-white/10 rounded-2xl p-8 space-y-8">
          <div>
            <h2 className="text-2xl font-semibold mb-4">Que hacemos</h2>
            <div className="grid md:grid-cols-2 gap-6 text-sm text-slate-300">
              {[
                {
                  title: "1. Estructuracion de Reclamos",
                  text:
                    "Tomamos cada reclamo y lo transformamos en un caso claro, con hechos ordenados, pruebas asociadas y objetivo definido para el equipo interno."
                },
                {
                  title: "2. Clasificacion y Priorizacion",
                  text:
                    "Identificamos urgencias, riesgos y patrones repetitivos para que cada area reciba lo que corresponde y pueda actuar mas rapido."
                },
                {
                  title: "3. Automatizacion y Respuestas Base",
                  text:
                    "Disenamos plantillas y flujos operativos simples para reducir tareas manuales, mejorar tiempos y sostener volumen sin perder calidad."
                },
                {
                  title: "4. Reportes Ejecutivos",
                  text:
                    "Entregamos reportes concretos con volumen, tipologia y focos de riesgo para que puedas decidir con datos y mejorar el proceso."
                }
              ].map((block) => (
                <div key={block.title} className="bg-white/5 border border-white/10 rounded-xl p-5">
                  <p className="text-emerald-300 font-semibold mb-3">{block.title}</p>
                  <p className="leading-relaxed">{block.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white/10 border border-white/10 rounded-2xl p-8 space-y-8">
          <div>
            <h2 className="text-2xl font-semibold mb-4">Que problemas resolvemos</h2>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-slate-300">
              {[
                "Colapso de atencion al cliente",
                "Dificultades para cumplir tiempos regulatorios",
                "Exposicion a sanciones legales por falta de respuesta",
                "Imagen deteriorada en portales o redes",
                "Tiempo excesivo en tareas operativas"
              ].map((item) => (
                <div key={item} className="bg-white/5 border border-white/10 rounded-xl p-4">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-4">Como trabajamos</h2>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-slate-300 mb-6">
              {[
                {
                  title: "1. Recepcion de casos",
                  text:
                    "Recibimos los casos que la empresa envia en lote y validamos formato, datos clave y prioridad operativa para evitar reprocesos."
                },
                {
                  title: "2. Carga y orden en plataforma",
                  text:
                    "Cargamos cada caso en el panel interno de RFA con estado y prioridad definidos, para que el equipo lo vea claro desde el primer dia."
                },
                {
                  title: "3. Alta de usuario empresa",
                  text:
                    "Habilitamos un usuario exclusivo para la empresa, con acceso a su tablero de casos y trazabilidad completa de cada gestión interna."
                },
                {
                  title: "4. Seguimiento y claridad operativa",
                  text:
                    "La empresa puede consultar y actualizar estado/prioridad para su organizacion diaria, mientras RFA mantiene el orden y clasificacion."
                }
              ].map((item) => (
                <div key={item.title} className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <p className="text-emerald-300 font-semibold mb-2">{item.title}</p>
                  <p className="leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>

            <h2 className="text-2xl font-semibold mb-4">Planes</h2>
            <div className="overflow-auto">
              <table className="w-full min-w-[520px] text-sm text-slate-300 border border-white/10">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-400 bg-white/5">
                  <tr>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Ideal para...</th>
                    <th className="px-4 py-3">Precio</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { plan: "Base", ideal: "Hasta 100 casos/mes", price: "Tarifa fija" },
                    { plan: "Intermedio", ideal: "100 a 500 casos/mes", price: "Fijo + variable" },
                    { plan: "Corporativo", ideal: "+500 casos o soporte total", price: "Cotizacion a medida" }
                  ].map((row) => (
                    <tr key={row.plan} className="border-t border-white/10">
                      <td className="px-4 py-3 font-semibold">{row.plan}</td>
                      <td className="px-4 py-3">{row.ideal}</td>
                      <td className="px-4 py-3">{row.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid md:grid-cols-3 gap-3 text-xs text-slate-300">
              {["Casos estructurados", "Reportes mensuales", "Mejora de procesos"].map((item) => (
                <div key={item} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="text-center">
          <h2 className="text-2xl font-semibold mb-3">Contacto</h2>
          <p className="text-sm text-slate-300 mb-2">soporte@rfargentina.com</p>
          <p className="text-sm text-slate-300">o completa el siguiente formulario:</p>
        </section>

        <section className="bg-white/10 border border-white/10 rounded-2xl p-8">
          <h2 className="text-2xl font-semibold mb-2">Formulario de contacto para empresas</h2>
          <p className="text-sm text-slate-400 mb-4">
            El acceso al panel de empresa se habilita únicamente por RFA. No hay registro público para cuentas empresa.
          </p>
          <p className="text-sm text-slate-300 mb-6">Completa los datos y te contactamos a la brevedad.</p>

          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-300" htmlFor="empresa-nombre">Nombre de la empresa</label>
                <input
                  type="text"
                  className="mt-2 w-full rounded-lg bg-white/10 border border-white/10 px-4 py-3 text-white placeholder:text-slate-400"
                  id="empresa-nombre"
                  value={empresa}
                  onChange={(e) => setEmpresa(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-sm text-slate-300" htmlFor="empresa-rubro">Rubro / Sector</label>
                <select
                  className="mt-2 w-full rounded-lg bg-slate-900/70 border border-white/20 px-4 py-3 text-white"
                  id="empresa-rubro"
                  value={rubro}
                  onChange={(e) => setRubro(e.target.value)}
                  required
                >
                  <option value="">Seleccionar</option>
                  <option value="Bancos">Bancos</option>
                  <option value="Comercio minorista / e-commerce">Comercio minorista / e-commerce</option>
                  <option value="Fintech / billeteras digitales">Fintech / billeteras digitales</option>
                  <option value="Tarjetas / medios de pago">Tarjetas / medios de pago</option>
                  <option value="Seguros">Seguros</option>
                  <option value="Salud">Salud</option>
                  <option value="Telecomunicaciones">Telecomunicaciones</option>
                  <option value="Servicios públicos">Servicios públicos</option>
                  <option value="Educacion">Educacion</option>
                  <option value="Turismo y transporte">Turismo y transporte</option>
                  <option value="Logistica">Logistica</option>
                  <option value="Tecnologia / SaaS">Tecnologia / SaaS</option>
                  <option value="Agroindustria">Agroindustria</option>
                  <option value="Inmobiliario">Inmobiliario</option>
                  <option value="Otros">Otros</option>
                </select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-300" htmlFor="empresa-contacto">Nombre y cargo</label>
                <input
                  type="text"
                  className="mt-2 w-full rounded-lg bg-white/10 border border-white/10 px-4 py-3 text-white placeholder:text-slate-400"
                  id="empresa-contacto"
                  value={contacto}
                  onChange={(e) => setContacto(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-sm text-slate-300" htmlFor="empresa-email">Correo de contacto</label>
                <input
                  type="email"
                  className="mt-2 w-full rounded-lg bg-white/10 border border-white/10 px-4 py-3 text-white placeholder:text-slate-400"
                  id="empresa-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-sm text-slate-300" htmlFor="empresa-telefono">Telefono (opcional)</label>
              <input
                type="text"
                className="mt-2 w-full rounded-lg bg-white/10 border border-white/10 px-4 py-3 text-white placeholder:text-slate-400"
                id="empresa-telefono"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm text-slate-300">Que tipo de servicio les interesa?</label>
              <div className="mt-2 grid md:grid-cols-2 gap-2 text-sm text-slate-300">
                {[
                  "Organizacion de reclamos de clientes",
                  "Armado de casos legales/documentales",
                  "Automatizacion de procesos",
                  "Soporte externo (opcional y a demanda)",
                  "Otro (especificar)"
                ].map((item) => (
                  <label key={item} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={servicios.includes(item)}
                      onChange={() => toggleSelection(item, servicios, setServicios)}
                    />
                    {item}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm text-slate-300" htmlFor="empresa-descripcion">Breve descripcion del problema o necesidad</label>
              <textarea
                className="mt-2 w-full rounded-lg bg-white/10 border border-white/10 px-4 py-3 text-white placeholder:text-slate-400 min-h-[140px]"
                id="empresa-descripcion"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-sm text-slate-300" htmlFor="empresa-volumen">Volumen estimado de reclamos mensuales</label>
              <select
                className="mt-2 w-full rounded-lg bg-slate-900/70 border border-white/20 px-4 py-3 text-white"
                id="empresa-volumen"
                value={volumen}
                onChange={(e) => setVolumen(e.target.value)}
                required
              >
                <option value="">Seleccionar</option>
                <option value="0-200">0 a 200</option>
                <option value="200-500">200 a 500</option>
                <option value="500+">+500</option>
              </select>
            </div>

            <div>
              <label className="text-sm text-slate-300" htmlFor="empresa-comentarios">Comentarios adicionales (opcional)</label>
              <textarea
                className="mt-2 w-full rounded-lg bg-white/10 border border-white/10 px-4 py-3 text-white placeholder:text-slate-400 min-h-[120px]"
                id="empresa-comentarios"
                value={comentarios}
                onChange={(e) => setComentarios(e.target.value)}
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-6 rounded-lg" disabled={sending}>
                {sending ? "Enviando..." : "Enviar consulta"}
              </Button>
            </div>

            {sent && <p className="text-sm text-emerald-300">Consulta enviada. Te contactamos a la brevedad.</p>}
            {error && <p className="text-sm text-rose-300">{error}</p>}
          </form>
        </section>
      </div>
    </div>
  );
}

