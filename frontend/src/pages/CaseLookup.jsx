import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { formatDateTimeAr } from "@/lib/datetime";
import { getServiceDisplayName } from "@/data/plans";
import {
  formatQuotedAmount,
  getCommercialStatusLabel,
  getOperationalStatusLabel
} from "@/data/caseModel";

export default function CaseLookup() {
  const [identifier, setIdentifier] = useState("");
  const [caseId, setCaseId] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState(null);
  const [actionGrant, setActionGrant] = useState(null);

  useEffect(() => {
    if (!window.location.hash) return;
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const token = fragment.get("rfa_token");
    const action = fragment.get("rfa_action");
    const linkedCase = fragment.get("rfa_case");
    if (token && linkedCase && ["proposal_accept", "payment_receipt"].includes(action)) {
      setActionGrant({ token, action });
      setCaseId(linkedCase);
      setNotice("Enlace de acción recibido. Ingresá el email asociado al caso para continuar.");
    }
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }, []);

  const BANK_TRANSFER = {
    titular: "Matias Hernan Masdeu",
    banco: "Banco Supervielle",
    cbu: "0270053320052964280015",
    alias: "MATIASHERNAN.M",
    referencia: "Indicá tu email y el ID del caso en el comprobante"
  };
  const WHATSAPP_SUPPORT_NUMBER = String(process.env.REACT_APP_WHATSAPP_SUPPORT || "5492212024379").replace(/\D/g, "");
  const HAS_WHATSAPP_SUPPORT = WHATSAPP_SUPPORT_NUMBER.length >= 10;

  const lookupPayload = () => ({
    identifier: String(identifier || "").trim(),
    case_id: String(caseId || "").trim()
  });

  const loadCase = async () => {
    const data = await apiRequest("/public/case-lookup", {
      method: "POST",
      body: JSON.stringify(lookupPayload())
    });
    setResult(data || null);
    return data;
  };

  const handleOpenWhatsApp = () => {
    if (!HAS_WHATSAPP_SUPPORT || !result?.case) return;
    const currentCase = result.case;
    const serviceCode = currentCase.proposal?.service_code || currentCase.service_code;
    const lines = [
      "Hola, quiero enviar comprobante de pago.",
      `ID de caso: ${currentCase.case_code || currentCase.id}`,
      `Servicio: ${getServiceDisplayName(serviceCode) || "No informado"}`,
      currentCase.email_contacto ? `Email: ${currentCase.email_contacto}` : null
    ].filter(Boolean);
    const url = `https://wa.me/${WHATSAPP_SUPPORT_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    setResult(null);
    try {
      await loadCase();
    } catch (err) {
      setError(err.message || "No se pudo consultar el caso.");
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptProposal = async () => {
    setActionLoading(true);
    setError("");
    setNotice("");
    try {
      await apiRequest("/public/case-proposal-accept", {
        method: "POST",
        body: JSON.stringify({ ...lookupPayload(), action_token: actionGrant?.action === "proposal_accept" ? actionGrant.token : "" })
      });
      setActionGrant(null);
      await loadCase();
      setNotice("La propuesta quedó aceptada. RFA te indicará el próximo paso.");
    } catch (err) {
      setError(err.message || "No se pudo aceptar la propuesta.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUploadReceipt = async () => {
    if (!receipt) {
      setError("Seleccioná un comprobante antes de enviarlo.");
      return;
    }
    setActionLoading(true);
    setError("");
    setNotice("");
    try {
      const body = new FormData();
      body.append("case_id", String(caseId || "").trim());
      body.append("identifier", String(identifier || "").trim());
      body.append("action_token", actionGrant?.action === "payment_receipt" ? actionGrant.token : "");
      body.append("comprobante", receipt);
      await apiRequest("/public/case-payment-receipt", { method: "POST", body });
      setActionGrant(null);
      await loadCase();
      setReceipt(null);
      setNotice("Comprobante recibido. El pago quedará confirmado únicamente después de la verificación de RFA.");
    } catch (err) {
      setError(err.message || "No se pudo cargar el comprobante.");
    } finally {
      setActionLoading(false);
    }
  };

  const proposal = result?.case?.proposal || null;
  const commercialStatus = result?.case?.commercial_status || "analysis";
  const showPayment = commercialStatus === "payment_pending" && proposal;
  const publicUpdates = result?.updates || [];
  const initialTechnicalMessageIndex = publicUpdates
    .map((update) => update.mensaje)
    .lastIndexOf("Caso cargado por formulario publico.");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 px-4 sm:px-6 py-16 pt-24">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-8 shadow-sm">
          <h1 className="text-3xl font-bold mb-2">Consultar caso</h1>
          <p className="text-slate-600 mb-6">Ingresá tu email y el ID del caso para consultar su estado y avances.</p>
          <form onSubmit={handleSubmit} className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-slate-700" htmlFor="lookup-identifier">Email</label>
              <input id="lookup-identifier" type="email" autoComplete="email" className="mt-2 w-full rounded-lg bg-white border border-slate-200 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-200" value={identifier} onChange={(event) => setIdentifier(event.target.value)} required />
            </div>
            <div>
              <label className="block text-sm text-slate-700" htmlFor="lookup-case-id">ID de caso</label>
              <input id="lookup-case-id" type="text" className="mt-2 w-full rounded-lg bg-white border border-slate-200 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-200" value={caseId} onChange={(event) => setCaseId(event.target.value)} required />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" disabled={loading}>{loading ? "Consultando..." : "Ver seguimiento"}</Button>
            </div>
          </form>
          {error && <p className="text-rose-600 text-sm mt-4">{error}</p>}
          {notice && <p className="text-emerald-700 text-sm mt-4">{notice}</p>}
        </div>

        {result?.case && (
          <div className="bg-slate-900 text-white rounded-2xl border border-white/10 p-5 sm:p-6 space-y-6">
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div><span className="text-slate-400">ID:</span> {result.case.case_code || result.case.id}</div>
              <div><span className="text-slate-400">Estado actual:</span> {getOperationalStatusLabel(result.case.estado)}</div>
              <div><span className="text-slate-400">Categoría:</span> {result.case.categoria || "-"}</div>
              <div><span className="text-slate-400">Empresa reclamada:</span> {result.case.entidad || "-"}</div>
              <div><span className="text-slate-400">Etapa:</span> {commercialStatus === "analysis" ? "Análisis inicial sin costo" : getCommercialStatusLabel(commercialStatus)}</div>
              <div><span className="text-slate-400">Última actualización:</span> {formatDateTimeAr(result.case.updated_at || result.case.created_at)}</div>
            </div>

            {proposal && (
              <section className="rounded-xl border border-amber-300/30 bg-amber-400/10 p-5 space-y-3" aria-labelledby="proposal-title">
                <h2 id="proposal-title" className="text-lg font-semibold text-amber-100">Propuesta RFA</h2>
                <div className="grid sm:grid-cols-2 gap-3 text-sm text-slate-100">
                  <p><span className="text-slate-400">Servicio:</span> {getServiceDisplayName(proposal.service_code)}</p>
                  <p><span className="text-slate-400">Precio:</span> {formatQuotedAmount(proposal.amount, proposal.currency)}</p>
                  <p><span className="text-slate-400">Estado:</span> {getCommercialStatusLabel(proposal.status)}</p>
                  <div className="sm:col-span-2"><span className="text-slate-400">Alcance:</span><p className="mt-1 whitespace-pre-wrap leading-relaxed">{proposal.scope || "-"}</p></div>
                </div>
                {proposal.status === "proposal_sent" && (
                  <Button className="bg-amber-300 hover:bg-amber-200 text-slate-950" onClick={handleAcceptProposal} disabled={actionLoading || actionGrant?.action !== "proposal_accept"}>{actionLoading ? "Registrando..." : "Aceptar propuesta"}</Button>
                )}
              </section>
            )}

            {showPayment && (
              <section className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 space-y-4">
                <p className="text-sm text-emerald-100 font-semibold">Pago por transferencia</p>
                <div className="text-xs text-emerald-100 space-y-1">
                  <p><strong>Titular:</strong> {BANK_TRANSFER.titular}</p><p><strong>Banco:</strong> {BANK_TRANSFER.banco}</p><p><strong>CBU:</strong> {BANK_TRANSFER.cbu}</p><p><strong>Alias:</strong> {BANK_TRANSFER.alias}</p><p className="text-emerald-200/90">{BANK_TRANSFER.referencia}</p>
                </div>
                <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
                  <label className="text-xs text-emerald-100">Comprobante<input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" className="mt-2 block w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs" onChange={(event) => setReceipt(event.target.files?.[0] || null)} /></label>
                  <Button className="bg-emerald-500 hover:bg-emerald-600 text-white" onClick={handleUploadReceipt} disabled={actionLoading || !receipt || actionGrant?.action !== "payment_receipt"}>Enviar comprobante</Button>
                </div>
                <Button className="bg-white/10 hover:bg-white/20 text-white" onClick={handleOpenWhatsApp} disabled={!HAS_WHATSAPP_SUPPORT}>Enviar también por WhatsApp</Button>
                {result.case.payment_receipt_uploaded_at && <p className="text-xs text-emerald-200">Último comprobante cargado: {formatDateTimeAr(result.case.payment_receipt_uploaded_at)}. Pendiente de verificación.</p>}
              </section>
            )}

            {commercialStatus === "paid" && <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">Pago confirmado por RFA.</p>}

            <div>
              <h2 className="text-lg font-semibold mb-3">Mensajes y avances</h2>
              <div className="space-y-3">
                {publicUpdates.length === 0 && <p className="text-sm text-slate-300">Sin actualizaciones públicas por el momento.</p>}
                {publicUpdates.map((update, index) => (
                  <div key={update.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                    {index === initialTechnicalMessageIndex ? (
                      <>
                        <p className="text-sm font-semibold text-slate-100">Recibimos tu caso</p>
                        <p className="mt-1 text-sm text-slate-100">La información fue enviada correctamente y está pendiente de análisis por RFA.</p>
                      </>
                    ) : (
                      <p className="text-sm text-slate-100">{update.mensaje || "Actualización registrada."}</p>
                    )}
                    <div className="mt-2 text-xs text-slate-400 flex flex-wrap gap-3">{update.estado && <span>Estado: {getOperationalStatusLabel(update.estado)}</span>}<span>{formatDateTimeAr(update.created_at)}</span></div>
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
