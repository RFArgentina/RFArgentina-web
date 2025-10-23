// src/components/Header.jsx
import { useState } from "react";
import { Link } from "react-router-dom";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="bg-rfa-primary text-white fixed top-0 left-0 w-full z-30">
      <div className="max-w-71xl mx-auto flex items-center justify-between px-6 py-35">
        {/* Logo */}
      <Link to="/" className="text-2xl font-bold flex items-center gap-2">
 <img
  src="./favicon.png"
  alt="RFA logo"
  className="w-90 h-11 object-contain"
  style={{ borderRadius: "50%", transform: "scale(1.9)" }}
/>
<span className="text-white text-2xl font-bold">RFA</span>

</Link>


{/* Menú desktop */}
<nav className="hidden md:flex space-x-6">
  <a href="#inicio" className="hover:text-rfa-action transition">Inicio</a>
  <a href="#servicios" className="hover:text-rfa-action transition">Servicios</a>
  <a href="#contacto" className="hover:text-rfa-action transition">Contacto</a>
</nav>

        {/* Botón + hamburguesa (a la derecha) */}
        <div className="flex items-center gap-4">
          <a
            href="https://forms.gle/SKRiXkn5A2vAXgoL6"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-rfa-action hover:bg-rfa-action-dark text-white px-4 py-2 rounded-lg transition"
          >
            Cargar tu caso GRATIS
          </a>

          {/* Mostrar solo en mobile */}
          <button
            className="md:hidden flex flex-col justify-center items-center w-8 h-8 focus:outline-none"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Abrir menú"
          >
            <span className={`h-1 w-6 bg-white rounded transition-all ${menuOpen ? "rotate-45 translate-y-2" : ""}`}></span>
            <span className={`h-1 w-6 bg-white rounded my-1 transition-all ${menuOpen ? "opacity-0" : ""}`}></span>
            <span className={`h-1 w-6 bg-white rounded transition-all ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`}></span>
          </button>
        </div>
      </div>

      {/* Menú desplegable mobile */}
      {menuOpen && (
        <div className="md:hidden bg-rfa-primary px-6 py-4 space-y-4">
          <Link to="/" className="block hover:text-rfa-action transition" onClick={() => setMenuOpen(false)}>Inicio</Link>
          <Link to="/services" className="block hover:text-rfa-action transition" onClick={() => setMenuOpen(false)}>Servicios</Link>
          <Link to="/contact" className="block hover:text-rfa-action transition" onClick={() => setMenuOpen(false)}>Contacto</Link>
        </div>
      )}
    </header>
  );
}
