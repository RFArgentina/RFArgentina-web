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
              Soluciones para empresas
            </p>
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight mb-6">
              Transformamos reclamos en eficiencia operativa
            </h1>
            <p className="text-lg text-slate-300 leading-relaxed">
              En RFA ayudamos a empresas que reciben cientos de reclamos diarios a procesarlos, organizarlos y
              dejarlos listos para su gestión interna. Convertimos cada reclamo en un caso estructurado y
              gestionable para simplificar el trabajo del equipo de la empresa.
            </p>
            <p className="text-sm text-slate-400 mt-4">
              Importante: no nos hacemos cargo de la gestión del reclamo. Nuestro servicio es 100% de
              organización, evidencia y armado de carpeta profesional.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {["Estructuración de reclamos", "Clasificación inteligente", "Automatización", "Reportes ejecutivos"].map((item) => (
                <span key={item} className="px-4 py-2 rounded-full text-xs font-semibold rfa-chip">
                  {item}
                </span>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition"
                onClick={() => window.open("mailto:soporte@rfargentina.com", "_blank")}
              >
                Contactar equipo comercial
              </Button>
              <Button
                className="bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-6 rounded-lg border border-white/20"
                onClick={() => window.open("https://wa.me/542212024379", "_blank")}
              >
                WhatsApp ejecutivo
              </Button>
            </div>
          </div>
          <div className="rfa-sheen rounded-2xl p-8">
            <h2 className="text-lg font-semibold mb-4">Cómo impactamos en tu operación</h2>
            <ul className="space-y-3 text-sm text-slate-200">
              {[
                "Procesos claros para equipos colapsados",
                "Menos tiempo en tareas repetitivas",
                "Casos listos para presentar o derivar",
                "Menos riesgo legal y reputacional"
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-6">
          {[
            {
              title: "Estructuración de reclamos",
              text: "Convertimos mensajes desordenados en casos claros con hechos ordenados, documentación y requerimientos."
            },
            {
              title: "Clasificación y priorización",
              text: "Filtramos urgentes, legales y repetitivos. Identificamos áreas responsables y tipos de falla."
            },
            {
              title: "Automatización y reportes",
              text: "Creamos plantillas, flujos y reportes mensuales con motivos frecuentes y riesgos críticos."
            }
          ].map((item) => (
            <div key={item.title} className="bg-white/10 border border-white/10 rounded-2xl p-6">
              <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
              <p className="text-sm text-slate-300 leading-relaxed">{item.text}</p>
            </div>
          ))}
        </section>

        <section className="bg-white/10 border border-white/10 rounded-2xl p-8 space-y-8">
          <div>
            <h2 className="text-2xl font-semibold mb-4">Qué hacemos</h2>
            <div className="grid md:grid-cols-2 gap-6 text-sm text-slate-300">
              {[
                {
                  title: "1. Estructuración de reclamos",
                  items: [
                    "Descripción precisa del reclamo",
                    "Hechos ordenados",
                    "Documentación asociada",
                    "Requerimiento puntual del cliente"
                  ]
                },
                {
                  title: "2. Clasificación y priorización",
                  items: [
                    "Urgentes / legales / repetitivos",
                    "Áreas responsables",
                    "Tipos de falla"
                  ]
                },
                {
                  title: "3. Automatización de procesos",
                  items: [
                    "Respuestas base y plantillas",
                    "Flujos automáticos",
                    "Escalabilidad real"
                  ]
                },
                {
                  title: "4. Reportes y análisis",
                  items: [
                    "Volumen de reclamos",
                    "Motivos más frecuentes",
                    "Áreas críticas",
                    "Riesgos legales o reputacionales"
                  ]
                }
              ].map((block) => (
                <div key={block.title} className="bg-white/5 border border-white/10 rounded-xl p-5">
                  <p className="text-emerald-300 font-semibold mb-3">{block.title}</p>
                  <ul className="space-y-2">
                    {block.items.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

        </section>

        <section className="bg-white/10 border border-white/10 rounded-2xl p-8 space-y-8">
          <div>
            <h2 className="text-2xl font-semibold mb-4">Qué problemas resolvemos</h2>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-slate-300">
              {[
                "Colapso de atención al cliente",
                "Mala gestión de reclamos regulatorios",
                "Riesgo legal por falta de respuesta",
                "Imagen deteriorada en redes y portales",
                "Tiempo excesivo dedicado a tareas repetitivas"
              ].map((item) => (
                <div key={item} className="bg-white/5 border border-white/10 rounded-xl p-4">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-4">Cómo se paga</h2>
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
                    { plan: "Base", ideal: "Hasta 100 casos al mes", price: "Tarifa fija" },
                    { plan: "Intermedio", ideal: "100 a 500 casos mensuales", price: "Fijo + variable" },
                    { plan: "Corporativo", ideal: "+500 casos o soporte total", price: "A medida" }
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
              {[
                "Casos estructurados",
                "Reportes mensuales",
                "Asistencia en mejoras operativas"
              ].map((item) => (
                <div key={item} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                  ✔ {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="text-center">
          <h2 className="text-2xl font-semibold mb-3">¿Querés que procesemos tus reclamos</h2>
          <p className="text-sm text-slate-300 mb-2">
            Escribinos a: soporte@rfargentina.com
          </p>
          <p className="text-sm text-slate-300">
            o llená el formulario para que nos comuniquemos con tu empresa.
          </p>
        </section>

        <section className="bg-white/10 border border-white/10 rounded-2xl p-8">
          <h2 className="text-2xl font-semibold mb-2">Formulario de contacto para empresas</h2>
          <p className="text-sm text-slate-300 mb-6">
            Completá los datos y te contactamos a la brevedad.
          </p>

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
                  <option value="Retail">Retail</option>
                  <option value="Seguros">Seguros</option>
                  <option value="Salud">Salud</option>
                  <option value="Logistica">Logística</option>
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
              <label className="text-sm text-slate-300">Teléfono (opcional)</label>
              <input
                type="text"
                className="mt-2 w-full rounded-lg bg-white/10 border border-white/10 px-4 py-3 text-white placeholder:text-slate-400"
                id="empresa-telefono"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm text-slate-300">¿Qué tipo de servicio les interesa</label>
              <div id="empresa-servicios"
                className="mt-2 grid md:grid-cols-2 gap-2 text-sm text-slate-300">
                {[
                  "Organización de reclamos de clientes",
                  "Armado de casos legales/documentales",
                  "Colaboración en automatización de procesos",
                  "Soporte externo para atención al cliente",
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
              <label className="text-sm text-slate-300">Breve descripción del problema o necesidad actual</label>
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
            {sent && (
              <p className="text-sm text-emerald-300">Consulta enviada. Te contactamos a la brevedad.</p>
            )}
            {error && (
              <p className="text-sm text-rose-300">{error}</p>
            )}
          </form>
        </section>
      </div>
    </div>
  );
}
