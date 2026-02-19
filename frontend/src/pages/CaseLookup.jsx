import { useState } from "react";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";

export default function CaseLookup() {
  const [identifier, setIdentifier] = useState("");
  const [caseId, setCaseId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const BANK_TRANSFER = {
    titular: "Matias Hernan Masdeu",
    banco: "Banco Supervielle",
    cbu: "0270053320052964280015",
    alias: "MATIASHERNAN.M",
    referencia: "Indica tu email y plan elegido en el comprobante"
  };
  const WHATSAPP_SUPPORT_NUMBER = String(process.env.REACT_APP_WHATSAPP_SUPPORT || "5492212024379").replace(/\D/g, "");
  const HAS_WHATSAPP_SUPPORT = WHATSAPP_SUPPORT_NUMBER.length >= 10;

  const handleOpenWhatsApp = () => {
    if (!HAS_WHATSAPP_SUPPORT || !result?.case) return;
    const c = result.case;
    const lines = [
      "Hola, quiero enviar comprobante de pago.",
      `ID de caso: ${c.case_code || c.id}`,
      `Plan: ${c.plan_elegido || "No informado"}`,
      c.email_contacto ? `Email: ${c.email_contacto}` : null
    ].filter(Boolean);
    const url = `https://wa.me/${WHATSAPP_SUPPORT_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await apiRequest("/public/case-lookup", {
        method: "POST",
        body: JSON.stringify({
          identifier: String(identifier || "").trim(),
          case_id: String(caseId || "").trim()
        })
      });
      setResult(data || null);
    } catch (err) {
      setError(err.message || "No se pudo consultar el caso.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 px-6 py-16 pt-24">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          <h1 className="text-3xl font-bold mb-2">Consultar caso</h1>
          <p className="text-slate-600 mb-6">
            Ingresa tu email o DNI/CUIT y el ID de caso para ver estado y avances.
          </p>
          <form onSubmit={handleSubmit} className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="block text-sm text-slate-700" htmlFor="lookup-identifier">Email o DNI/CUIT</label>
              <input
                id="lookup-identifier"
                type="text"
                className="mt-2 w-full rounded-lg bg-white border border-slate-200 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm text-slate-700" htmlFor="lookup-case-id">ID de caso</label>
              <input
                id="lookup-case-id"
                type="text"
                className="mt-2 w-full rounded-lg bg-white border border-slate-200 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                value={caseId}
                onChange={(e) => setCaseId(e.target.value)}
                required
              />
            </div>
            <div className="md:col-span-1 flex items-end">
              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={loading}
              >
                {loading ? "Consultando..." : "Ver seguimiento"}
              </Button>
            </div>
          </form>
          {error && <p className="text-rose-600 text-sm mt-4">{error}</p>}
        </div>

        {result?.case && (
          <div className="bg-slate-900 text-white rounded-2xl border border-white/10 p-6 space-y-6">
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div><span className="text-slate-400">ID:</span> {result.case.case_code || result.case.id}</div>
              <div><span className="text-slate-400">Estado actual:</span> {result.case.estado}</div>
              <div><span className="text-slate-400">Categoria:</span> {result.case.categoria || "-"}</div>
              <div><span className="text-slate-400">Entidad:</span> {result.case.entidad || "-"}</div>
              <div><span className="text-slate-400">Plan:</span> {result.case.plan_elegido || "-"}</div>
              <div><span className="text-slate-400">Ultima actualizacion:</span> {new Date(result.case.updated_at || result.case.created_at).toLocaleString("es-AR")}</div>
            </div>

            {result.case.estado === "Viable (pendiente de pago)" && result.case.plan_elegido && (
              <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 space-y-3">
                <p className="text-sm text-emerald-100 font-semibold">Pago del plan y envío de comprobante</p>
                <div className="text-xs text-emerald-100 space-y-1">
                  <p><strong>Titular:</strong> {BANK_TRANSFER.titular}</p>
                  <p><strong>Banco:</strong> {BANK_TRANSFER.banco}</p>
                  <p><strong>CBU:</strong> {BANK_TRANSFER.cbu}</p>
                  <p><strong>Alias:</strong> {BANK_TRANSFER.alias}</p>
                  <p className="text-emerald-200/90">{BANK_TRANSFER.referencia}</p>
                </div>
                <Button
                  className="bg-white/10 hover:bg-white/20 text-white"
                  onClick={handleOpenWhatsApp}
                  disabled={!HAS_WHATSAPP_SUPPORT}
                >
                  Enviar comprobante por WhatsApp
                </Button>
                {!HAS_WHATSAPP_SUPPORT && (
                  <p className="text-xs text-amber-200">Configura `REACT_APP_WHATSAPP_SUPPORT` para habilitar WhatsApp.</p>
                )}
                {result.case.payment_receipt_uploaded_at && (
                  <p className="text-xs text-emerald-200">
                    Ultimo comprobante cargado: {new Date(result.case.payment_receipt_uploaded_at).toLocaleString("es-AR")}
                  </p>
                )}
              </div>
            )}

            <div>
              <h2 className="text-lg font-semibold mb-3">Mensajes y avances</h2>
              <div className="space-y-3">
                {(result.updates || []).length === 0 && (
                  <p className="text-sm text-slate-300">Sin actualizaciones registradas por el momento.</p>
                )}
                {(result.updates || []).map((update) => (
                  <div key={update.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-sm text-slate-100">{update.mensaje || "Actualización registrada."}</p>
                    <div className="mt-2 text-xs text-slate-400 flex flex-wrap gap-3">
                      {update.estado && <span>Estado: {update.estado}</span>}
                      {update.prioridad && <span>Prioridad: {update.prioridad}</span>}
                      <span>{new Date(update.created_at).toLocaleString("es-AR")}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
