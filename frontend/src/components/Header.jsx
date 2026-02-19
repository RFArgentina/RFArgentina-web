import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { clearToken, getToken } from "@/lib/auth";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = Boolean(getToken());
  const isHome = location.pathname === "/";

  const handleLogout = () => {
    clearToken();
    setMenuOpen(false);
    navigate("/");
  };

  const handleNav = (sectionId) => {
    setMenuOpen(false);
    if (isHome) {
      const section = document.getElementById(sectionId);
      section.scrollIntoView({ behavior: "smooth" });
      return;
    }
    navigate("/");
    setTimeout(() => {
      const section = document.getElementById(sectionId);
      section.scrollIntoView({ behavior: "smooth" });
    }, 150);
  };

  return (
    <header className="bg-slate-950/80 backdrop-blur text-white fixed top-0 left-0 w-full z-30 border-b border-white/10">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-3">
        <Link to="/" className="flex items-center gap-3">
          <span
            className="text-emerald-300 font-bold tracking-[0.35em] text-2xl md:text-3xl"
            style={{ fontFamily: '"Playfair Display", "Times New Roman", serif' }}
          >
            RFA
          </span>
        </Link>

        <nav className="hidden md:flex space-x-6">
          <button type="button" onClick={() => handleNav("inicio")} className="hover:text-emerald-300 transition">
            Inicio
          </button>
          <button type="button" onClick={() => handleNav("servicios")} className="hover:text-emerald-300 transition">
            Servicios
          </button>
          <button type="button" onClick={() => handleNav("contacto")} className="hover:text-emerald-300 transition">
            Contacto
          </button>
        </nav>

        <div className="flex items-center gap-4">
          {!isAuthenticated ? (
            <>
              <Link
                to="/consultar-caso"
                className="hidden md:inline-flex items-center px-4 py-2 rounded-lg border border-white/20 hover:border-emerald-300 text-white transition"
              >
                Consultar caso
              </Link>
              <Link
                to="/login"
                className="hidden md:inline-flex items-center px-4 py-2 rounded-lg border border-white/20 hover:border-emerald-300 text-white transition"
              >
                Acceso empresas
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/panel"
                className="hidden md:inline-flex items-center px-4 py-2 rounded-lg border border-white/20 hover:border-emerald-300 text-white transition"
              >
                Mi panel
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="hidden md:inline-flex items-center px-4 py-2 rounded-lg border border-white/20 hover:border-rose-300 text-white transition"
              >
                Salir
              </button>
            </>
          )}

          <button
            className="md:hidden flex flex-col justify-center items-center w-8 h-8 focus:outline-none"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Abrir menu"
          >
            <span className={`h-1 w-6 bg-white rounded transition-all ${menuOpen ? "rotate-45 translate-y-2" : ""}`}></span>
            <span className={`h-1 w-6 bg-white rounded my-1 transition-all ${menuOpen ? "opacity-0" : ""}`}></span>
            <span className={`h-1 w-6 bg-white rounded transition-all ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`}></span>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden bg-slate-950/90 px-6 py-4 space-y-4">
          <button type="button" className="block hover:text-emerald-300 transition" onClick={() => handleNav("inicio")}>
            Inicio
          </button>
          <button type="button" className="block hover:text-emerald-300 transition" onClick={() => handleNav("servicios")}>
            Servicios
          </button>
          <button type="button" className="block hover:text-emerald-300 transition" onClick={() => handleNav("contacto")}>
            Contacto
          </button>
          {!isAuthenticated ? (
            <>
              <Link to="/consultar-caso" className="block hover:text-emerald-300 transition" onClick={() => setMenuOpen(false)}>
                Consultar caso
              </Link>
              <Link to="/login" className="block hover:text-emerald-300 transition" onClick={() => setMenuOpen(false)}>
                Acceso empresas
              </Link>
            </>
          ) : (
            <>
              <Link to="/panel" className="block hover:text-emerald-300 transition" onClick={() => setMenuOpen(false)}>
                Mi panel
              </Link>
              <button type="button" className="block hover:text-rose-300 transition" onClick={handleLogout}>
                Salir
              </button>
            </>
          )}
        </div>
      )}
    </header>
  );
}
