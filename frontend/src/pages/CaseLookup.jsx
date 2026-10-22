import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import CaseConversations from "@/components/CaseConversations";
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
  const [lookupTab, setLookupTab] = useState("updates");
  const [selectedOfferId, setSelectedOfferId] = useState("");
  const [selectedCommunicationMode, setSelectedCommunicationMode] = useState("");
  const [confirmedSingleMode, setConfirmedSingleMode] = useState(false);

  useEffect(() => {
    if (!window.location.hash) return;
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const token = fragment.get("rfa_token");
    const action = fragment.get("rfa_action");
    const linkedCase = fragment.get("rfa_case");
    if (token && linkedCase && ["proposal_accept", "payment_receipt"].includes(action)) {
      setActionGrant({ token, action, caseId: linkedCase, source: "legacy" });
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
  const lookupPayload = () => ({
    identifier: String(identifier || "").trim(),
    case_id: String(caseId || "").trim()
  });

  const loadCase = async () => {
    const data = await apiRequest("/public/case-lookup", {
      method: "POST",
      body: JSON.stringify(lookupPayload())
    });
    const isPersonaV2Case = Number(data?.case?.commercial_flow_version) >= 2;
    setResult(isPersonaV2Case
      ? { ...data, updates: (data?.updates || []).filter((update) => update.visibility === "public") }
      : data || null);
    if (Number(data?.case?.commercial_flow_version) >= 2) {
      setActionGrant(null);
    } else {
      setActionGrant((current) => {
        const caseMatches = [data?.case?.case_code, data?.case?.id].includes(current?.caseId);
        return current?.source === "legacy" && caseMatches ? current : null;
      });
    }
    return data;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    setResult(null);
    setLookupTab("updates");
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
      const actionToken = Number(result?.case?.commercial_flow_version) >= 2
        ? (await apiRequest("/public/case-action-token", {
            method: "POST",
            body: JSON.stringify({ ...lookupPayload(), action: "proposal_accept" })
          })).token
        : actionGrant?.action === "proposal_accept" ? actionGrant.token : "";
      await apiRequest("/public/case-proposal-accept", {
        method: "POST",
        body: JSON.stringify({
          ...lookupPayload(),
          action_token: actionToken,
          offer_id: selectedOfferId || undefined,
          communication_mode: selectedCommunicationMode || null
        })
      });
      setActionGrant(null);
      setSelectedOfferId("");
      setSelectedCommunicationMode("");
      setConfirmedSingleMode(false);
      await loadCase();
      setNotice("La propuesta quedó aceptada. RFA te indicará el próximo paso.");
    } catch (err) {
      const message = String(err?.message || "");
      const technicalResponse = !err?.status || /<!doctype\s+html|<html[\s>]|Cannot\s+(?:GET|POST)\s/i.test(message);
      setError(technicalResponse ? "No pudimos aceptar la propuesta. Intentá nuevamente." : message || "No pudimos aceptar la propuesta. Intentá nuevamente.");
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
      const actionToken = Number(result?.case?.commercial_flow_version) >= 2
        ? (await apiRequest("/public/case-action-token", {
            method: "POST",
            body: JSON.stringify({ ...lookupPayload(), action: "payment_receipt" })
          })).token
        : actionGrant?.action === "payment_receipt" ? actionGrant.token : "";
      const body = new FormData();
      body.append("case_id", String(caseId || "").trim());
      body.append("identifier", String(identifier || "").trim());
      body.append("action_token", actionToken);
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
  const serviceOffers = result?.service_offers || [];
  const isNewCommercialFlow = Number(result?.case?.commercial_flow_version) >= 2;
  const selectedOffer = serviceOffers.find((offer) => offer.id === selectedOfferId) || null;
  const selectedOfferModes = selectedOffer?.available_communication_modes || [];
  const needsOfferChoice = Number(result?.case?.commercial_flow_version) >= 2 && commercialStatus === "proposal_sent" && serviceOffers.length > 0;
  const canAcceptSelectedOffer = Boolean(selectedOffer) &&
    (selectedOffer.service_code !== "rfa-management" || (
      selectedOfferModes.includes(selectedCommunicationMode) &&
      (selectedOfferModes.length !== 1 || confirmedSingleMode)
    ));
  const publicUpdates = result?.updates || [];
  const initialTechnicalMessageIndex = publicUpdates
    .map((update) => update.mensaje)
    .lastIndexOf("Caso cargado por formulario publico.");
  const conversationsEnabled = Boolean(result?.conversation?.enabled && result?.conversation?.access_token);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 px-4 sm:px-6 py-16 pt-24">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-8 shadow-sm">
          <h1 className="text-3xl font-bold mb-2">Consultar caso</h1>
          <p className="text-slate-600 mb-6">Ingresá tu email y el número de caso para consultar su estado y avances.</p>
          <form onSubmit={handleSubmit} className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-slate-700" htmlFor="lookup-identifier">Email</label>
              <input id="lookup-identifier" type="email" autoComplete="email" className="mt-2 w-full rounded-lg bg-white border border-slate-200 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-200" value={identifier} onChange={(event) => setIdentifier(event.target.value)} required />
            </div>
            <div>
              <label className="block text-sm text-slate-700" htmlFor="lookup-case-id">Número de caso</label>
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
              <div><span className="text-slate-400">Número de caso:</span> {result.case.case_code || result.case.id}</div>
              <div><span className="text-slate-400">Estado actual:</span> {isNewCommercialFlow ? result.case.operational_stage : getOperationalStatusLabel(result.case.estado)}</div>
              <div><span className="text-slate-400">Categoría:</span> {result.case.categoria || "-"}</div>
              <div><span className="text-slate-400">Empresa reclamada:</span> {result.case.entidad || "-"}</div>
              <div><span className="text-slate-400">Etapa:</span> {commercialStatus === "analysis" ? "Análisis inicial sin costo" : getCommercialStatusLabel(commercialStatus)}</div>
              <div><span className="text-slate-400">Última actualización:</span> {formatDateTimeAr(result.case.updated_at || result.case.created_at)}</div>
            </div>

            {Number(result.case.commercial_flow_version) >= 2 && commercialStatus === "analysis" && (
              <section className="rounded-xl border border-sky-300/20 bg-sky-300/5 p-4">
                <h2 className="font-semibold text-white">RFA está analizando tu caso</h2>
                <p className="mt-1 text-sm text-slate-300">Cuando termine la revisión, vas a ver aquí las alternativas disponibles, con su precio y alcance.</p>
              </section>
            )}

            {needsOfferChoice && (
              <section className="space-y-4 rounded-xl border border-amber-300/25 bg-amber-300/5 p-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">RFA analizó tu caso</h2>
                  <p className="mt-1 text-sm text-slate-300">Estas son las alternativas disponibles. Elegí la que mejor se adapte a lo que necesitás.</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {serviceOffers.map((offer) => (
                    <article key={offer.id} className={`rounded-xl border p-4 ${selectedOfferId === offer.id ? "border-emerald-300/50 bg-emerald-300/10" : "border-white/10 bg-slate-950/20"}`}>
                      <h3 className="font-semibold text-white">{getServiceDisplayName(offer.service_code)}</h3>
                      <p className="mt-2 text-lg font-semibold text-emerald-100">{formatQuotedAmount(offer.quoted_amount, offer.quoted_currency)}</p>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{offer.quoted_scope}</p>
                      <Button type="button" className="mt-4 bg-white/10 text-white hover:bg-white/20" onClick={() => {
                        setSelectedOfferId(offer.id);
                        setSelectedCommunicationMode(offer.service_code === "rfa-management" && offer.available_communication_modes?.length === 1 ? offer.available_communication_modes[0] : "");
                        setConfirmedSingleMode(false);
                      }}>{selectedOfferId === offer.id ? "Opción seleccionada" : "Elegir esta opción"}</Button>
                    </article>
                  ))}
                </div>
                {selectedOffer && selectedOffer.service_code === "rfa-management" && (
                  <fieldset className="rounded-xl border border-white/10 p-4">
                    <legend className="px-1 text-sm font-semibold text-white">Modalidad de comunicaciones</legend>
                    {selectedOfferModes.length === 1 ? (
                      <>
                        <p className="mt-1 text-sm text-slate-200">Modalidad incluida: {selectedOfferModes[0] === "rfa_managed" ? "RFA gestiona las comunicaciones" : "Yo envío las comunicaciones preparadas por RFA"}.</p>
                        <label className="mt-3 flex items-start gap-2 text-sm text-slate-300"><input type="checkbox" checked={confirmedSingleMode} onChange={(event) => setConfirmedSingleMode(event.target.checked)} /><span>Confirmo esta modalidad para mi servicio.</span></label>
                      </>
                    ) : selectedOfferModes.map((mode) => <label key={mode} className="mt-2 flex items-center gap-2 text-sm text-slate-200">
                      <input type="radio" name="communication-mode" value={mode} checked={selectedCommunicationMode === mode} onChange={() => setSelectedCommunicationMode(mode)} />
                      {mode === "rfa_managed" ? "RFA gestiona las comunicaciones" : "Yo envío las comunicaciones preparadas por RFA"}
                    </label>)}
                  </fieldset>
                )}
                {selectedOffer && (
                  <div className="rounded-xl border border-emerald-300/25 bg-emerald-300/5 p-4">
                    <h3 className="font-semibold text-white">Resumen antes de aceptar</h3>
                    <p className="mt-2 text-sm text-slate-200">Servicio: {getServiceDisplayName(selectedOffer.service_code)}</p>
                    <p className="mt-1 text-sm text-slate-200">Precio: {formatQuotedAmount(selectedOffer.quoted_amount, selectedOffer.quoted_currency)}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">Alcance: {selectedOffer.quoted_scope}</p>
                    {selectedOffer.service_code === "rfa-management" && <p className="mt-1 text-sm text-slate-200">Modalidad: {selectedOfferModes.length === 1 ? (selectedOfferModes[0] === "rfa_managed" ? "RFA gestiona las comunicaciones" : "El cliente envía las comunicaciones preparadas por RFA") : selectedCommunicationMode === "rfa_managed" ? "RFA gestiona las comunicaciones" : selectedCommunicationMode === "client_sends" ? "El cliente envía las comunicaciones preparadas por RFA" : "Elegí una modalidad"}</p>}
                    <Button type="button" className="mt-4 bg-emerald-600 text-white hover:bg-emerald-500" onClick={handleAcceptProposal} disabled={actionLoading || !canAcceptSelectedOffer || (!isNewCommercialFlow && actionGrant?.action !== "proposal_accept")}>{actionLoading ? "Registrando..." : "Aceptar propuesta"}</Button>
                    {Number(result.case.commercial_flow_version) < 2 && actionGrant?.action !== "proposal_accept" && <p className="mt-2 text-xs text-slate-400">Para aceptar, abrí el enlace seguro que RFA te compartió.</p>}
                  </div>
                )}
              </section>
            )}

            {proposal && (
              <section className="rounded-xl border border-amber-300/30 bg-amber-400/10 p-5 space-y-3" aria-labelledby="proposal-title">
                <h2 id="proposal-title" className="text-lg font-semibold text-amber-100">Propuesta RFA</h2>
                <div className="grid sm:grid-cols-2 gap-3 text-sm text-slate-100">
                  <p><span className="text-slate-400">Servicio:</span> {getServiceDisplayName(proposal.service_code)}</p>
                  <p><span className="text-slate-400">Precio:</span> {formatQuotedAmount(proposal.amount, proposal.currency)}</p>
                  {proposal.communication_mode && <p className="sm:col-span-2"><span className="text-slate-400">Modalidad de comunicaciones:</span> {proposal.communication_mode === "rfa_managed" ? "RFA gestiona las comunicaciones" : "El cliente envía las comunicaciones preparadas por RFA"}</p>}
                  <p><span className="text-slate-400">Estado:</span> {getCommercialStatusLabel(proposal.status)}</p>
                  <div className="sm:col-span-2"><span className="text-slate-400">Alcance:</span><p className="mt-1 whitespace-pre-wrap leading-relaxed">{proposal.scope || "-"}</p></div>
                </div>
                {proposal.status === "proposal_sent" && (
                  <Button className="bg-amber-300 hover:bg-amber-200 text-slate-950" onClick={handleAcceptProposal} disabled={actionLoading || (!isNewCommercialFlow && actionGrant?.action !== "proposal_accept")}>{actionLoading ? "Registrando..." : "Aceptar propuesta"}</Button>
                )}
              </section>
            )}

            {showPayment && (
              <section className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 space-y-4">
                <p className="text-sm text-emerald-100 font-semibold">Pago pendiente · transferencia</p>
                <p className="text-xs text-emerald-100">{getServiceDisplayName(proposal.service_code)} · {formatQuotedAmount(proposal.amount, proposal.currency)}</p>
                <div className="text-xs text-emerald-100 space-y-1">
                  <p><strong>Titular:</strong> {BANK_TRANSFER.titular}</p><p><strong>Banco:</strong> {BANK_TRANSFER.banco}</p><p><strong>CBU:</strong> {BANK_TRANSFER.cbu}</p><p><strong>Alias:</strong> {BANK_TRANSFER.alias}</p><p className="text-emerald-200/90">{BANK_TRANSFER.referencia}</p>
                </div>
                <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
                  <label className="text-xs text-emerald-100">Comprobante<input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" className="mt-2 block w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs" onChange={(event) => setReceipt(event.target.files?.[0] || null)} /></label>
                  <Button className="bg-emerald-500 hover:bg-emerald-600 text-white" onClick={handleUploadReceipt} disabled={actionLoading || !receipt || (!isNewCommercialFlow && actionGrant?.action !== "payment_receipt")}>Subir comprobante</Button>
                </div>
                {Number(result.case.commercial_flow_version) < 2 && actionGrant?.action !== "payment_receipt" && <p className="text-xs text-emerald-100/80">Para habilitar la carga, abrí el enlace seguro para comprobantes que te compartió RFA.</p>}
                {result.case.payment_receipt_uploaded_at && <p className="text-xs text-emerald-200">Comprobante recibido ({formatDateTimeAr(result.case.payment_receipt_uploaded_at)}). RFA verificará la transferencia.</p>}
              </section>
            )}

            {commercialStatus === "paid" && <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">Pago confirmado por RFA.</p>}

            {conversationsEnabled && (
              <nav className="flex flex-wrap gap-2 border-b border-white/10" aria-label="Secciones del seguimiento">
                <button type="button" aria-pressed={lookupTab === "updates"} onClick={() => setLookupTab("updates")} className={`rounded-t-lg px-3 py-2 text-sm ${lookupTab === "updates" ? "border-b-2 border-emerald-300 text-white" : "text-slate-400 hover:text-white"}`}>Mensajes y avances</button>
                <button type="button" aria-pressed={lookupTab === "conversations"} onClick={() => setLookupTab("conversations")} className={`rounded-t-lg px-3 py-2 text-sm ${lookupTab === "conversations" ? "border-b-2 border-emerald-300 text-white" : "text-slate-400 hover:text-white"}`}>Conversaciones</button>
              </nav>
            )}

            {(!conversationsEnabled || lookupTab === "updates") && <div>
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
                    <div className="mt-2 text-xs text-slate-400 flex flex-wrap gap-3">{!isNewCommercialFlow && update.estado && <span>Estado: {getOperationalStatusLabel(update.estado)}</span>}<span>{formatDateTimeAr(update.created_at)}</span></div>
                  </div>
                ))}
              </div>
            </div>}
            {conversationsEnabled && lookupTab === "conversations" && (
              <CaseConversations mode="client" accessToken={result.conversation.access_token} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
