import { Link } from "react-router-dom";
import { analysisService, plans } from "@/data/plans";
import { Button } from "@/components/ui/button";

export default function Plans() {
  return (
    <div className="min-h-screen px-6 py-16 pt-24 text-slate-100">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-emerald-300 uppercase tracking-[0.3em] text-xs font-semibold mb-3">
            Modalidades de servicio
          </p>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Primero analizamos tu caso</h1>
          <p className="text-slate-300">
            Iniciá el reclamo sin costo. Si podemos intervenir, te informamos el alcance, el precio y qué incluye el servicio antes de comenzar.
          </p>
        </div>

        <div className="max-w-3xl mx-auto mb-8 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-6 text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-emerald-300 font-semibold mb-2">
            {analysisService.priceLabel}
          </p>
          <h2 className="text-2xl font-bold text-white mb-2">{analysisService.name}</h2>
          <p className="text-slate-200 leading-relaxed">{analysisService.summary}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-10">
          {plans.map((plan) => (
            <div
              key={plan.code}
              className={`bg-white/95 border rounded-2xl p-6 ${
                plan.featured ? "border-emerald-400 shadow-2xl" : "border-white/20"
              }`}
            >
              <p className="text-xs uppercase tracking-wide text-emerald-600 font-semibold mb-2">
                {plan.period}
              </p>
              <h3 className="text-xl font-bold text-slate-900 mb-2">{plan.name}</h3>
              <p className="text-3xl font-extrabold text-slate-950 mb-1">{plan.priceLabel}</p>
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-4">{plan.currency}</p>
              <p className="text-sm text-slate-600 mb-4">{plan.summary}</p>
              <ul className="space-y-2 text-sm text-slate-700">
                {plan.features.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="max-w-3xl mx-auto mb-10 text-center text-slate-300 space-y-2">
          <p className="font-semibold text-slate-100">Casos que requieren mayor trabajo</p>
          <p>
            Algunos casos reciben un presupuesto personalizado según el volumen documental, la cantidad de intervinientes,
            los antecedentes, la reconstrucción necesaria y la carga de trabajo. El precio no depende del monto reclamado.
          </p>
          <p>
            No comenzamos ninguna gestión paga sin informarte previamente el alcance, el precio y qué incluye el servicio.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          <Link to="/crear-caso">
            <Button className="bg-emerald-500 hover:bg-emerald-600 text-white">
              Iniciar reclamo sin costo
            </Button>
          </Link>
          <Link to="/consultar-caso">
            <Button className="bg-white/10 hover:bg-white/20 text-white border border-white/20">
              Consultar seguimiento
            </Button>
          </Link>
          <Link to="/">
            <Button className="bg-white/10 hover:bg-white/20 text-white border border-white/20">
              Volver al inicio
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
