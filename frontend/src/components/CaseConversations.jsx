import { useCallback, useEffect, useRef, useState } from "react";
import { apiDownload, apiRequest } from "@/lib/api";
import { formatDateTimeAr } from "@/lib/datetime";
import { Button } from "@/components/ui/button";

const ACCEPTED_FILES = ".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt";

export default function CaseConversations({ mode, caseId, accessToken, onPendingChange }) {
  const isAdmin = mode === "admin";
  const [thread, setThread] = useState(null);
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState("");
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const onPendingChangeRef = useRef(onPendingChange);
  const submitLockRef = useRef(false);

  useEffect(() => {
    onPendingChangeRef.current = onPendingChange;
  }, [onPendingChange]);

  const conversationPath = isAdmin
    ? `/cases/${encodeURIComponent(caseId)}/conversations`
    : "/public/case-conversations";
  const requestOptions = isAdmin
    ? {}
    : { headers: { "X-RFA-Conversation-Token": accessToken }, skipAuthRefresh: true };

  const applyThread = useCallback((value) => {
    setThread(value);
    onPendingChangeRef.current?.(Boolean(value?.pending_admin_attention));
  }, []);

  const loadThread = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest(conversationPath, requestOptions);
      applyThread(data);
    } catch (err) {
      setError(err.message || "No se pudo cargar la conversación.");
    } finally {
      setLoading(false);
    }
  }, [applyThread, conversationPath, accessToken, isAdmin]);

  useEffect(() => {
    loadThread();
  }, [loadThread]);

  const saveSettings = async (enabled) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const data = await apiRequest(conversationPath, {
        method: "PATCH",
        body: JSON.stringify({ enabled })
      });
      applyThread(data);
      setNotice(enabled ? "Conversaciones habilitada para este caso." : "Conversaciones deshabilitada. El historial se conserva.");
    } catch (err) {
      setError(err.message || "No se pudo actualizar la configuración.");
    } finally {
      setSaving(false);
    }
  };

  const markAttended = async () => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const data = await apiRequest(`${conversationPath}/mark-attended`, { method: "POST", body: JSON.stringify({}) });
      applyThread(data);
      setNotice("Respuesta marcada como atendida.");
    } catch (err) {
      setError(err.message || "No se pudo marcar como atendida.");
    } finally {
      setSaving(false);
    }
  };

  const setClientReplyEnabled = async (enabled) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const data = await apiRequest(conversationPath, {
        method: "PATCH",
        body: JSON.stringify({ client_reply_enabled: enabled })
      });
      applyThread(data);
      setNotice(enabled ? "Se habilitó una respuesta para el cliente." : "Se deshabilitó la respuesta del cliente.");
    } catch (err) {
      setError(err.message || "No se pudo actualizar el turno de respuesta.");
    } finally {
      setSaving(false);
    }
  };

  const submitMessage = async (event) => {
    event.preventDefault();
    if (saving || submitLockRef.current || (isAdmin && !body.trim()) || (!isAdmin && !thread?.client_reply_enabled) || (!body.trim() && files.length === 0)) return;
    submitLockRef.current = true;
    const form = event.currentTarget;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      let payload;
      if (files.length) {
        payload = new FormData();
        payload.append("body", body.trim());
        if (isAdmin && channel.trim()) payload.append("channel", channel.trim());
        files.forEach((file) => payload.append("adjuntos", file));
      } else {
        payload = JSON.stringify({ body: body.trim(), ...(isAdmin ? { channel: channel.trim() } : {}) });
      }
      const path = isAdmin
        ? `${conversationPath}/messages`
        : "/public/case-conversations/messages";
      const data = await apiRequest(path, {
        ...requestOptions,
        method: "POST",
        body: payload
      });
      applyThread(data);
      setBody("");
      setChannel("");
      setFiles([]);
      setNotice(isAdmin ? "Mensaje para enviar publicado." : "Respuesta enviada a RFA. Estamos revisando la información. Podrás enviar una nueva respuesta cuando RFA la habilite.");
      const fileInput = form.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = "";
    } catch (err) {
      setError(err.message || "No se pudo enviar el mensaje.");
    } finally {
      submitLockRef.current = false;
      setSaving(false);
    }
  };

  const downloadAttachment = async (attachment) => {
    setError("");
    try {
      const path = isAdmin
        ? `/cases/${encodeURIComponent(caseId)}/conversations/attachments/${encodeURIComponent(attachment.id)}`
        : `/public/case-conversations/attachments/${encodeURIComponent(attachment.id)}`;
      const blob = await apiDownload(path, requestOptions);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.original_name || "adjunto";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err.message || "No se pudo descargar el adjunto.");
    }
  };

  const copyMessage = async (message) => {
    try {
      await navigator.clipboard.writeText(message.body);
      setNotice("Mensaje copiado para que puedas enviarlo desde tu canal.");
      setError("");
    } catch {
      setError("No se pudo copiar el mensaje. Seleccioná y copialo manualmente.");
    }
  };

  if (loading) return <p className="py-4 text-sm text-slate-300" role="status">Cargando conversaciones...</p>;

  return (
    <section className="space-y-5" aria-label="Conversaciones del caso">
      {isAdmin && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/25 p-4">
          <div>
            <p className="text-sm font-semibold text-white">Conversaciones {thread?.enabled ? "habilitada" : "deshabilitada"}</p>
            <p className="mt-1 text-xs text-slate-400">El historial se conserva aunque se deshabilite el acceso del cliente.</p>
            <p className="mt-2 text-xs text-slate-300">Respuesta del cliente: {thread?.client_reply_enabled ? "habilitada" : "no habilitada"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {thread?.enabled && <Button type="button" onClick={() => setClientReplyEnabled(!thread?.client_reply_enabled)} disabled={saving} className="bg-slate-700 text-white hover:bg-slate-600">
              {thread?.client_reply_enabled ? "Deshabilitar respuesta" : "Habilitar respuesta del cliente"}
            </Button>}
            <Button type="button" onClick={() => saveSettings(!thread?.enabled)} disabled={saving} className="bg-slate-700 text-white hover:bg-slate-600">
              {thread?.enabled ? "Deshabilitar conversaciones" : "Habilitar conversaciones"}
            </Button>
          </div>
        </div>
      )}

      {!isAdmin && !thread?.enabled ? (
        <p className="text-sm text-slate-300">Conversaciones no está habilitada para este caso.</p>
      ) : (
        <>
          {isAdmin && thread?.pending_admin_attention && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/30 bg-amber-300/10 p-4" role="status">
              <p className="text-sm text-amber-100">Hay una respuesta nueva del cliente pendiente de atención.</p>
              <Button type="button" onClick={markAttended} disabled={saving} className="bg-amber-200 text-slate-950 hover:bg-amber-100">Marcar como atendida</Button>
            </div>
          )}

          <div className="space-y-3" aria-live="polite">
            {!thread?.messages?.length && <p className="rounded-xl border border-white/10 bg-slate-950/20 p-4 text-sm text-slate-400">Todavía no hay mensajes en esta conversación.</p>}
            {(thread?.messages || []).map((message) => {
              const fromRfa = message.sender_type === "rfa";
              return (
                <article key={message.id} className={`rounded-xl border p-4 ${fromRfa ? "border-sky-300/20 bg-sky-950/30" : "border-emerald-300/20 bg-emerald-950/20"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{fromRfa ? "RFA · Mensaje para enviar" : "Cliente · Respuesta recibida"}</p>
                    <time className="text-xs text-slate-400" dateTime={message.created_at}>{formatDateTimeAr(message.created_at)}</time>
                  </div>
                  {fromRfa && message.channel && <p className="mt-2 text-xs text-sky-200">Canal/destino: {message.channel}</p>}
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-100">{message.body}</p>
                  {message.attachments?.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-2" aria-label="Archivos adjuntos">
                      {message.attachments.map((attachment) => (
                        <li key={attachment.id}>
                          <button type="button" className="text-left text-xs text-sky-200 underline underline-offset-2 hover:text-sky-100" onClick={() => downloadAttachment(attachment)}>
                            Descargar {attachment.original_name} ({Math.ceil(attachment.size_bytes / 1024)} KB)
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!isAdmin && fromRfa && (
                    <Button type="button" onClick={() => copyMessage(message)} className="mt-3 bg-slate-700 text-white hover:bg-slate-600">Copiar mensaje</Button>
                  )}
                </article>
              );
            })}
          </div>

          {thread?.enabled && (isAdmin || thread?.client_reply_enabled) && (
            <form onSubmit={submitMessage} className="space-y-3 rounded-xl border border-white/10 bg-slate-950/25 p-4">
              <label className="block text-sm font-semibold text-white" htmlFor={`conversation-body-${mode}-${caseId || "public"}`}>
                {isAdmin ? "Mensaje para enviar" : "Respuesta de la entidad"}
              </label>
              {!isAdmin && <p className="text-xs leading-relaxed text-slate-300">Pegá o escribí acá la respuesta que recibiste de la empresa, banco o entidad reclamada. RFA la revisará para indicarte cómo continuar.</p>}
              <textarea
                id={`conversation-body-${mode}-${caseId || "public"}`}
                className="min-h-32 w-full rounded-lg border border-white/15 bg-slate-950/50 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder={isAdmin ? "" : "Escribí o pegá acá la respuesta que recibiste..."}
                maxLength={6000}
                required={isAdmin}
              />
              {isAdmin && (
                <label className="block text-xs text-slate-300">Canal o destino (opcional)
                  <input className="mt-1 w-full rounded-lg border border-white/15 bg-slate-950/50 px-3 py-2 text-sm text-white" value={channel} onChange={(event) => setChannel(event.target.value)} maxLength={160} placeholder="Email, home banking, portal..." />
                </label>
              )}
              <label className="block text-xs text-slate-300">Adjuntos (opcional)
                <input type="file" multiple accept={ACCEPTED_FILES} onChange={(event) => setFiles(Array.from(event.target.files || []))} className="mt-1 block w-full text-xs text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-white" />
                <span className="mt-1 block text-[11px] text-slate-500">Hasta 5 archivos, 25 MB cada uno y 50 MB en total. PDF, JPG, PNG, DOC, DOCX o TXT.</span>
                {!isAdmin && <span className="mt-1 block text-[11px] text-slate-400">También podés adjuntar capturas o documentos relacionados con la respuesta.</span>}
              </label>
              {files.length > 0 && <p className="text-xs text-slate-400">{files.length} archivo(s) seleccionado(s).</p>}
              <Button type="submit" disabled={saving || (isAdmin ? !body.trim() : !body.trim() && files.length === 0)} className="bg-emerald-600 text-white hover:bg-emerald-700">
                {saving ? "Enviando..." : isAdmin ? "Publicar mensaje" : "Enviar respuesta"}
              </Button>
            </form>
          )}
          {!isAdmin && thread?.enabled && !thread?.client_reply_enabled && !notice && (
            <p className="rounded-xl border border-white/10 bg-slate-950/25 p-4 text-sm text-slate-300" role="status">
              {thread?.messages?.some((message) => message.sender_type === "client")
                ? "Respuesta enviada a RFA. Estamos revisando la información."
                : "RFA todavía no habilitó una respuesta para este caso."}
            </p>
          )}
        </>
      )}

      {notice && <p className="text-sm text-emerald-200" role="status">{notice}</p>}
      {error && <div className="flex flex-wrap items-center gap-3" role="alert"><p className="text-sm text-rose-200">{error}</p><Button type="button" onClick={loadThread} className="bg-slate-700 text-white hover:bg-slate-600">Reintentar</Button></div>}
    </section>
  );
}
