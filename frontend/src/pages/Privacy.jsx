import { Link } from "react-router-dom";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 px-6 py-16 pt-24">
      <div className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-2xl p-8 shadow-sm space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Politica de Privacidad</h1>
          <p className="text-sm text-slate-500 mt-2">Ultima actualizacion: 14 de febrero de 2026</p>
        </div>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">1. Responsable del tratamiento</h2>
          <p className="text-slate-700">
            El responsable del tratamiento de datos personales es Reclamos Financieros Argentina (RFA), con canal de
            contacto en <a className="text-emerald-700 font-medium" href="mailto:soporte@rfargentina.com">soporte@rfargentina.com</a>.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">2. Datos que tratamos</h2>
          <p className="text-slate-700">
            Podemos tratar datos de identificacion y contacto, datos del caso/reclamo, archivos adjuntos y trazas de seguridad
            necesarias para operar el servicio.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">3. Finalidad y base de legitimacion</h2>
          <p className="text-slate-700">
            Los datos se utilizan para alta de cuentas, prestacion del servicio contratado, soporte, cumplimiento legal y
            seguridad de la plataforma. El tratamiento se fundamenta en el consentimiento del titular, la ejecucion de una
            relacion contractual y/o el cumplimiento de obligaciones legales aplicables.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">4. Conservacion y supresion</h2>
          <p className="text-slate-700">
            No mantenemos expedientes de forma permanente. En usuarios particulares, se eliminan de forma automatica en hasta
            90 dias desde cierre/resolucion/derivacion. En empresas, la retencion depende de la configuracion del cliente empresa.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">5. Destinatarios y transferencias</h2>
          <p className="text-slate-700">
            Solo compartimos datos con proveedores tecnicos necesarios para operar (hosting, correo, infraestructura), bajo
            criterios de confidencialidad y minimizacion.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">6. Seguridad y acceso interno</h2>
          <p className="text-slate-700">
            Aplicamos control de acceso por roles, registro de eventos, validacion de entradas, limites de carga de archivos
            y medidas de seguridad razonables para reducir riesgo de acceso no autorizado o perdida de informacion.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">7. Derechos del titular</h2>
          <p className="text-slate-700">
            Podes solicitar acceso, rectificacion o eliminacion de tus datos escribiendo a{" "}
            <a className="text-emerald-700 font-medium" href="mailto:soporte@rfargentina.com">soporte@rfargentina.com</a>.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">8. Backups y supresion</h2>
          <p className="text-slate-700">
            La eliminacion impacta la base operativa y archivos activos. Las copias de seguridad se depuran segun su ciclo
            tecnico de rotacion, con retencion limitada.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">9. Modificaciones de la politica</h2>
          <p className="text-slate-700">
            Podemos actualizar esta politica para reflejar mejoras de seguridad, cambios regulatorios o ajustes operativos.
            La version vigente sera la publicada en este sitio con su fecha de actualizacion.
          </p>
        </section>

        <p className="text-sm text-slate-500">
          Esta politica se complementa con los <Link className="text-emerald-700 font-medium" to="/terminos">Terminos y Condiciones</Link> y
          la <Link className="text-emerald-700 font-medium ml-1" to="/cookies">Politica de Cookies</Link>.
        </p>
      </div>
    </div>
  );
}
