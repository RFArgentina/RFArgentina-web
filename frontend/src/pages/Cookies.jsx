import { Link } from "react-router-dom";

export default function Cookies() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 px-6 py-16 pt-24">
      <div className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-2xl p-8 shadow-sm space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Politica de Cookies</h1>
          <p className="text-sm text-slate-500 mt-2">Ultima actualizacion: 14 de febrero de 2026</p>
        </div>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">1. Definicion</h2>
          <p className="text-slate-700">
            Las cookies son archivos de texto que el navegador almacena para reconocer sesiones, recordar preferencias y
            mejorar la operacion tecnica del sitio.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">2. Cookies utilizadas por RFA</h2>
          <p className="text-slate-700">
            RFA utiliza principalmente cookies tecnicas y de seguridad, incluyendo cookies de sesion y mecanismos de
            proteccion contra solicitudes maliciosas (CSRF). Estas cookies son necesarias para autenticacion y uso del panel.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">3. Gestion de cookies por el usuario</h2>
          <p className="text-slate-700">
            El usuario puede configurar su navegador para bloquear o eliminar cookies. Dicha configuracion puede afectar el
            funcionamiento de login, renovacion de sesion y otras funciones esenciales.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">4. Modificaciones</h2>
          <p className="text-slate-700">
            Esta politica puede modificarse por cambios tecnicos, operativos o regulatorios. La version vigente sera la
            publicada en esta pagina con su fecha de actualizacion.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">5. Contacto</h2>
          <p className="text-slate-700">
            Consultas sobre cookies y privacidad:{" "}
            <a className="text-emerald-700 font-medium" href="mailto:soporte@rfargentina.com">
              soporte@rfargentina.com
            </a>
          </p>
        </section>

        <p className="text-sm text-slate-500">
          Revisa tambien los <Link className="text-emerald-700 font-medium" to="/terminos">Terminos y Condiciones</Link> y la{" "}
          <Link className="text-emerald-700 font-medium" to="/privacidad">Politica de Privacidad</Link>.
        </p>
      </div>
    </div>
  );
}
