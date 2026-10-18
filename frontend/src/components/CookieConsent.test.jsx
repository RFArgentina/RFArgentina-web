/** @jest-environment jsdom */
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import CookieConsent from "./CookieConsent";

const CONSENT_KEY = "rfa_cookie_analytics_consent_v1";
const SCRIPT_SELECTOR = 'script[data-rfa-analytics="true"]';

describe("CookieConsent", () => {
  let root;
  let host;
  let essentialAction;

  const renderConsent = () => {
    root = createRoot(host);
    act(() => root.render(
      <>
        <button type="button" onClick={() => { essentialAction += 1; }}>Acción esencial</button>
        <CookieConsent />
      </>
    ));
  };

  const click = (selector) => act(() => host.querySelector(selector)?.click());
  const clickButtonContaining = (text) => {
    const button = [...host.querySelectorAll("button")].find((item) => item.textContent.includes(text));
    act(() => button?.click());
  };

  beforeEach(() => {
    window.localStorage.clear();
    document.head.querySelector(SCRIPT_SELECTOR)?.remove();
    window.dataLayer = [];
    delete window.gtag;
    essentialAction = 0;
    host = document.createElement("div");
    document.body.appendChild(host);
    global.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    if (root) act(() => root.unmount());
    host.remove();
    delete global.IS_REACT_ACT_ENVIRONMENT;
  });

  it("keeps analytics unloaded until consent is accepted", () => {
    renderConsent();
    expect(document.querySelector(SCRIPT_SELECTOR)).toBeNull();
    expect(window.localStorage.getItem(CONSENT_KEY)).toBeNull();
  });

  it("rejects analytics without blocking an essential action", () => {
    renderConsent();
    clickButtonContaining("Acción esencial");
    clickButtonContaining("Rechazar");
    expect(essentialAction).toBe(1);
    expect(window.localStorage.getItem(CONSENT_KEY)).toBe("rejected");
    expect(document.querySelector(SCRIPT_SELECTOR)).toBeNull();
  });

  it("loads one script after acceptance, restores consent, and stops future loads after revocation", () => {
    renderConsent();
    clickButtonContaining("Aceptar");
    expect(window.localStorage.getItem(CONSENT_KEY)).toBe("accepted");
    expect(document.querySelectorAll(SCRIPT_SELECTOR)).toHaveLength(1);
    expect(document.querySelector(SCRIPT_SELECTOR).src).toContain("googletagmanager.com/gtag/js");

    act(() => root.unmount());
    renderConsent();
    expect(document.querySelectorAll(SCRIPT_SELECTOR)).toHaveLength(1);

    click(".rfa-cookie-settings");
    clickButtonContaining("Rechazar");
    expect(window.localStorage.getItem(CONSENT_KEY)).toBe("rejected");
    expect(document.querySelector(SCRIPT_SELECTOR)).toBeNull();

    act(() => root.unmount());
    renderConsent();
    expect(document.querySelector(SCRIPT_SELECTOR)).toBeNull();
  });
});
