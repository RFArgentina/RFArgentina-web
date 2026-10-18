import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders the public RFA home without loading analytics before consent", () => {
  window.localStorage.clear();
  render(<App />);
  expect(screen.getByText("RECLAMOS FINANCIEROS ARGENTINA")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /preferencias de cookies/i })).toBeInTheDocument();
  expect(document.querySelector('script[data-rfa-analytics="true"]')).toBeNull();
});
