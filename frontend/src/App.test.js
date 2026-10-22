import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders the public RFA home without loading analytics before consent", () => {
  window.localStorage.clear();
  render(<App />);
  expect(screen.getByText("RECLAMOS FINANCIEROS ARGENTINA")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /preferencias de cookies/i })).toBeInTheDocument();
  expect(document.querySelector('script[data-rfa-analytics="true"]')).toBeNull();

  const supportDigits = String(process.env.REACT_APP_WHATSAPP_SUPPORT || "").replace(/\D/g, "");
  const whatsappLink = screen.queryByRole("link", { name: /^WhatsApp$/i });
  if (supportDigits.length >= 10) {
    expect(whatsappLink).toHaveAttribute("href", `https://wa.me/${supportDigits}`);
    expect(whatsappLink.getAttribute("href")).not.toContain("?");
  } else {
    expect(whatsappLink).not.toBeInTheDocument();
  }
});
