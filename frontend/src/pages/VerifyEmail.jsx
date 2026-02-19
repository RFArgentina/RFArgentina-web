import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { apiRequest } from "@/lib/api";
import { setToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [status, setStatus] = useState("Verificando email...");
  const [error, setError] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setError("Token invalido");
      setStatus("");
      return;
    }

    let active = true;
    apiRequest(`/auth/verify?token=${encodeURIComponent(token)}`)
      .then((data) => {
        if (!active) return;
        if (data && data.token) {
          setToken(data.token);
          navigate("/panel");
          return;
        }
        setStatus(data.message || "Email verificado. Ya podés iniciar sesión.");
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || "No se pudo verificar el email");
        setStatus("");
      });

    return () => {
      active = false;
    };
  }, [params, navigate]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 px-6 py-16 pt-24 flex items-center justify-center">
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl p-8 shadow-xl text-center">
        <h1 className="text-2xl font-bold mb-3">Verificación de email</h1>
        {status && <p className="text-slate-600 mb-6">{status}</p>}
        {error && <p className="text-rose-600 mb-6">{error}</p>}
        <div className="flex justify-center gap-3">
          <Link to="/login">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Ir a login
            </Button>
          </Link>
          <Link to="/">
            <Button className="bg-white/10 hover:bg-white/20 text-slate-700 border border-slate-200">
              Volver al inicio
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
