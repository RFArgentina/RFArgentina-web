import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiRequest } from "@/lib/api";
import { setToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      setToken(data.token);
      navigate("/panel");
    } catch (err) {
      if (err.code === "EMAIL_NOT_VERIFIED") {
        setError("No se pudo iniciar sesion con esas credenciales.");
      } else if (err.code === "USER_PORTAL_DISABLED") {
        setError("El acceso de particulares se realiza desde 'Consultar caso' con email + ID de caso.");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 px-6 py-16 pt-24 flex items-center justify-center">
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8">
        <div className="hidden md:flex flex-col justify-between rounded-2xl p-8 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white shadow-xl">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-300 mb-3">RFA</p>
            <h1 className="text-3xl font-bold mb-3">Accede a tu panel</h1>
            <p className="text-slate-200">
              Seguimiento de reclamos, mensajes y documentacion en un solo lugar.
            </p>
          </div>
          <div className="space-y-3 text-sm text-slate-200">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Datos protegidos y acceso seguro
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Estado del caso siempre actualizado
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-xl">
          <h1 className="text-3xl font-bold mb-2">Iniciar sesión</h1>
          <p className="text-slate-600 mb-6">Acceso exclusivo para empresas y administración.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-700" htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                placeholder="tu@email.com"
                autoComplete="email"
                className="mt-2 w-full rounded-lg bg-white border border-slate-200 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-700" htmlFor="login-password">Contraseña</label>
              <div className="relative mt-2">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Tu contraseña"
                  autoComplete="current-password"
                  className="w-full rounded-lg bg-white border border-slate-200 px-4 py-3 pr-20 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-700"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </div>
            {error && <p className="text-rose-600 text-sm">{error}</p>}
            <Button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={loading}
            >
              {loading ? "Ingresando..." : "Ingresar"}
            </Button>
          </form>
          <p className="text-xs text-slate-500 mt-6">
            Si sos particular, consulta avances desde{" "}
            <Link to="/consultar-caso" className="text-emerald-700 font-semibold">Consultar caso</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
