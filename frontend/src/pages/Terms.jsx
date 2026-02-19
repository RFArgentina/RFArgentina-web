import { Link } from "react-router-dom";

export default function Terms() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 px-6 py-16 pt-24">
      <div className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-2xl p-8 shadow-sm space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Términos y Condiciones</h1>
          <p className="text-sm text-slate-500 mt-2">Última actualización: 14 de febrero de 2026</p>
        </div>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">1. Objeto del servicio</h2>
          <p className="text-slate-700">
            Reclamos Financieros Argentina (RFA) presta servicios de organización documental, redacción y gestión
            administrativa de reclamos frente a entidades publicas o privadas, conforme el plan contratado por cada usuario.
            RFA no ejerce patrocinio letrado ni representacion judicial.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">2. Aceptacion</h2>
          <p className="text-slate-700">
            El uso del sitio y/o la contratación de servicios implica la aceptación plena de estos Términos y de la
            Política de Privacidad vigente al momento de uso.
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
            Cualquier política de reintegro o cancelación se informa al momento de contratar. Una vez iniciada la
            ejecución del servicio (análisis, armado documental o presentación), pueden aplicarse cargos proporcionales
            al trabajo efectivamente realizado.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">6. Proteccion de datos y retencion</h2>
          <p className="text-slate-700">
            Para usuarios particulares, los casos cerrados/resueltos/derivados se eliminan de forma permanente en un plazo
            máximo de 90 días corridos. En cuentas empresa, la retención puede ser manual o automática (30/60/90 días)
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
            El alta de usuarios empresa se realiza exclusivamente por administración de RFA. La empresa cliente define
            internamente el uso de su panel, sus perfiles autorizados y su política de retención/eliminación de casos cerrados.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">9. Suspensiones y uso indebido</h2>
          <p className="text-slate-700">
            RFA puede limitar o suspender cuentas ante actividad abusiva, intentos de acceso no autorizado, carga maliciosa
            de archivos o incumplimiento grave de estos términos.
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
            Estos términos se interpretan conforme la normativa de la República Argentina. En relaciones de consumo,
            se respetan los derechos irrenunciables del consumidor y la jurisdiccion aplicable segun ley vigente.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">12. Modificaciones</h2>
          <p className="text-slate-700">
            RFA puede actualizar estos términos para reflejar cambios legales, operativos o de seguridad. La versión vigente
            será la publicada en este sitio con su fecha de actualización.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">13. Contacto</h2>
          <p className="text-slate-700">
            Consultas legales/operativas: <a className="text-emerald-700 font-medium" href="mailto:soporte@rfargentina.com">soporte@rfargentina.com</a>
          </p>
        </section>

        <p className="text-sm text-slate-500">
          También podés revisar la <Link className="text-emerald-700 font-medium" to="/privacidad">Política de Privacidad</Link> y la{" "}
          <Link className="text-emerald-700 font-medium" to="/cookies">Política de Cookies</Link>.
        </p>
        <p className="text-xs text-slate-400">
          Documento base de cumplimiento operativo. Recomendado: validacion final con asesoramiento legal antes de produccion definitiva.
        </p>
      </div>
    </div>
  );
}
