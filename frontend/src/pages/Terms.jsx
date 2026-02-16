import { Link } from "react-router-dom";

export default function Terms() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 px-6 py-16 pt-24">
      <div className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-2xl p-8 shadow-sm space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Terminos y Condiciones</h1>
          <p className="text-sm text-slate-500 mt-2">Ultima actualizacion: 14 de febrero de 2026</p>
        </div>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">1. Objeto del servicio</h2>
          <p className="text-slate-700">
            Reclamos Financieros Argentina (RFA) presta servicios de organizacion documental, redaccion y gestion
            administrativa de reclamos frente a entidades publicas o privadas, conforme el plan contratado por cada usuario.
            RFA no ejerce patrocinio letrado ni representacion judicial.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">2. Aceptacion</h2>
          <p className="text-slate-700">
            El uso del sitio y/o la contratacion de servicios implica la aceptacion plena de estos Terminos y de la
            Politica de Privacidad vigente al momento de uso.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">3. Alcance y limites</h2>
          <p className="text-slate-700">
            RFA puede preparar, presentar y dar seguimiento administrativo de reclamos hasta agotar vias administrativas,
            segun el plan contratado. El resultado final depende de terceros (entidades, organismos, abogados).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">4. Obligaciones del usuario</h2>
          <p className="text-slate-700">
            El usuario debe aportar informacion veraz, completa y actualizada, y mantener disponibles los respaldos que
            sustenten el caso. RFA puede rechazar o pausar gestiones cuando existan datos insuficientes o inconsistentes.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">5. Planes, pagos y cancelaciones</h2>
          <p className="text-slate-700">
            Los precios, alcances y tiempos se informan en la web y pueden actualizarse para nuevas contrataciones.
            Cualquier politica de reintegro o cancelacion se informa al momento de contratar. Una vez iniciada la
            ejecucion del servicio (analisis, armado documental o presentacion), pueden aplicarse cargos proporcionales
            al trabajo efectivamente realizado.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">6. Proteccion de datos y retencion</h2>
          <p className="text-slate-700">
            Para usuarios particulares, los casos cerrados/resueltos/derivados se eliminan de forma permanente en un plazo
            maximo de 90 dias corridos. En cuentas empresa, la retencion puede ser manual o automatica (30/60/90 dias)
            segun configuracion del cliente empresa.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">7. Limitacion de responsabilidad</h2>
          <p className="text-slate-700">
            RFA responde por la correcta prestacion del servicio contratado dentro de su control razonable. No responde por
            decisiones de entidades, caidas de servicios de terceros, ni por informacion falsa o incompleta provista por usuarios.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">8. Cuentas empresa (B2B)</h2>
          <p className="text-slate-700">
            El alta de usuarios empresa se realiza exclusivamente por administracion de RFA. La empresa cliente define
            internamente el uso de su panel, sus perfiles autorizados y su politica de retencion/eliminacion de casos cerrados.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">9. Suspensiones y uso indebido</h2>
          <p className="text-slate-700">
            RFA puede limitar o suspender cuentas ante actividad abusiva, intentos de acceso no autorizado, carga maliciosa
            de archivos o incumplimiento grave de estos terminos.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">10. Propiedad intelectual</h2>
          <p className="text-slate-700">
            Los contenidos, marcas, textos y desarrollos de la plataforma son titularidad de RFA o de sus licenciantes.
            Se prohibe su reproduccion o explotacion no autorizada.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">11. Ley aplicable y jurisdiccion</h2>
          <p className="text-slate-700">
            Estos terminos se interpretan conforme la normativa de la Republica Argentina. En relaciones de consumo,
            se respetan los derechos irrenunciables del consumidor y la jurisdiccion aplicable segun ley vigente.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">12. Modificaciones</h2>
          <p className="text-slate-700">
            RFA puede actualizar estos terminos para reflejar cambios legales, operativos o de seguridad. La version vigente
            sera la publicada en este sitio con su fecha de actualizacion.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">13. Contacto</h2>
          <p className="text-slate-700">
            Consultas legales/operativas: <a className="text-emerald-700 font-medium" href="mailto:soporte@rfargentina.com">soporte@rfargentina.com</a>
          </p>
        </section>

        <p className="text-sm text-slate-500">
          Tambien podes revisar la <Link className="text-emerald-700 font-medium" to="/privacidad">Politica de Privacidad</Link> y la{" "}
          <Link className="text-emerald-700 font-medium" to="/cookies">Politica de Cookies</Link>.
        </p>
        <p className="text-xs text-slate-400">
          Documento base de cumplimiento operativo. Recomendado: validacion final con asesoramiento legal antes de produccion definitiva.
        </p>
      </div>
    </div>
  );
}
