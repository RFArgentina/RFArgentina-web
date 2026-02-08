import { Link } from "react-router-dom";
import { plans } from "@/data/plans";
import { Button } from "@/components/ui/button";

export default function Plans() {
  return (
    <div className="min-h-screen px-6 py-16 pt-24 text-slate-100">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-emerald-300 uppercase tracking-[0.3em] text-xs font-semibold mb-3">
            Planes disponibles
          </p>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Elegí el plan ideal</h1>
          <p className="text-slate-300">
            Ya estás registrado. Podés elegir un plan y luego cargar tu caso.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-10">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`bg-white/95 border rounded-2xl p-6 ${
                plan.featured ? "border-emerald-400 shadow-2xl" : "border-white/20"
              }`}
            >
              <p className="text-xs uppercase tracking-wide text-emerald-600 font-semibold mb-2">
                {plan.period}
              </p>
              <h3 className="text-xl font-bold text-slate-900 mb-2">{plan.name}</h3>
              <p className="text-slate-900 font-semibold">{plan.priceUsd}</p>
              <p className="text-3xl font-extrabold text-slate-950 mb-4">{plan.price}</p>
              <ul className="space-y-2 text-sm text-slate-700">
                {plan.features.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          <Link to="/panel">
            <Button className="bg-emerald-500 hover:bg-emerald-600 text-white">
              Ir a mi panel
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
