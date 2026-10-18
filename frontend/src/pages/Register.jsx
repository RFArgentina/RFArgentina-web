import { useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptPolicies, setAcceptPolicies] = useState(false);


  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (!acceptPolicies) {
      setError("Debes aceptar los Términos y la Política de Privacidad.");
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      setSuccess(data.message || "Registro creado correctamente. Ya puedes iniciar sesión.");
    } catch (err) {
      setError(err.message);
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
            <h1 className="text-3xl font-bold mb-3">Crea tu cuenta</h1>
            <p className="text-slate-200">
              Accede al seguimiento y la documentacion desde un panel centralizado.
            </p>
          </div>
          <div className="space-y-3 text-sm text-slate-200">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Alta en menos de un minuto
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Acceso inmediato a tus casos
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-xl">
          <h1 className="text-3xl font-bold mb-2">Crear cuenta</h1>
          <p className="text-slate-600 mb-6">Registrate para acceder al seguimiento de tus casos.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-700" htmlFor="register-email">Email</label>
              <input
                id="register-email"
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
              <label className="block text-sm text-slate-700" htmlFor="register-password">Contraseña</label>
              <div className="relative mt-2">
                <input
                  id="register-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Crea una contraseña"
                  autoComplete="new-password"
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
            <div>
              <label className="block text-sm text-slate-700" htmlFor="register-password-confirm">Confirmar contraseña</label>
              <div className="relative mt-2">
                <input
                  id="register-password-confirm"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Repetí tu contraseña"
                  autoComplete="new-password"
                  className="w-full rounded-lg bg-white border border-slate-200 px-4 py-3 pr-20 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-700"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                >
                  {showConfirmPassword ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </div>
            <label className="flex items-start gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                className="mt-1"
                checked={acceptPolicies}
                onChange={(e) => setAcceptPolicies(e.target.checked)}
              />
              <span>
                Acepto los <Link to="/terminos" className="text-emerald-700 font-semibold">Términos y Condiciones</Link> y la{" "}
                <Link to="/privacidad" className="text-emerald-700 font-semibold">Política de Privacidad</Link>.
              </span>
            </label>
            {error && <p className="text-rose-600 text-sm">{error}</p>}
            {success && <p className="text-emerald-600 text-sm">{success}</p>}
            <Button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={loading}
            >
              {loading ? "Creando..." : "Registrarme"}
            </Button>
          </form>
          <p className="text-sm text-slate-600 mt-6">
            Ya tenes cuenta?{" "}
            <Link to="/login" className="text-emerald-600 hover:text-emerald-700 font-semibold">
              Iniciar sesión
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
}
