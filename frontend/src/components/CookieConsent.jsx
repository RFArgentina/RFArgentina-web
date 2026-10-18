import { useEffect, useState } from "react";

const CONSENT_KEY = "rfa_cookie_analytics_consent_v1";
const MEASUREMENT_ID = "G-ZR6DRJD7K9";

function loadAnalytics() {
  if (document.querySelector('script[data-rfa-analytics="true"]')) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
  window.gtag("consent", "update", { analytics_storage: "granted" });
  window.gtag("js", new Date());
  window.gtag("config", MEASUREMENT_ID);
  const script = document.createElement("script");
  script.async = true;
  script.dataset.rfaAnalytics = "true";
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);
}

function stopAnalytics() {
  if (window.gtag) {
    window.gtag("consent", "update", { analytics_storage: "denied" });
  }
  document.querySelector('script[data-rfa-analytics="true"]')?.remove();
  document.cookie.split(";").forEach((part) => {
    const name = part.split("=")[0].trim();
    if (name.startsWith("_ga")) {
      document.cookie = `${name}=; Max-Age=0; path=/`;
      const host = window.location.hostname;
      document.cookie = `${name}=; Max-Age=0; path=/; domain=${host}`;
      if (host.endsWith("rfargentina.com")) {
        document.cookie = `${name}=; Max-Age=0; path=/; domain=.rfargentina.com`;
      }
    }
  });
}

export default function CookieConsent() {
  const [preference, setPreference] = useState(() => {
    try { return window.localStorage.getItem(CONSENT_KEY); } catch { return null; }
  });
  const [open, setOpen] = useState(() => {
    try { return !window.localStorage.getItem(CONSENT_KEY); } catch { return true; }
  });

  useEffect(() => {
    if (preference === "accepted") loadAnalytics();
    else if (preference === "rejected") stopAnalytics();
  }, [preference]);

  const save = (value) => {
    try { window.localStorage.setItem(CONSENT_KEY, value); } catch { /* decision applies for this page view */ }
    setPreference(value);
    setOpen(false);
  };

  return (
    <>
      <button type="button" className="rfa-cookie-settings" onClick={() => setOpen(true)}>
        Preferencias de cookies
      </button>
      {open && (
        <section className="rfa-cookie-banner" role="dialog" aria-labelledby="cookie-consent-title" aria-describedby="cookie-consent-description">
          <div>
            <h2 id="cookie-consent-title">Preferencias de cookies</h2>
            <p id="cookie-consent-description">Usamos cookies esenciales para que RFA funcione. La analítica es opcional y permanece desactivada hasta que la aceptes. Podés cambiar tu decisión desde este botón.</p>
          </div>
          <div className="rfa-cookie-actions">
            <button type="button" onClick={() => save("rejected")}>Rechazar analítica</button>
            <button type="button" className="rfa-cookie-accept" onClick={() => save("accepted")}>Aceptar analítica</button>
          </div>
        </section>
      )}
    </>
  );
}
