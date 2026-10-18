import { Link } from "react-router-dom";

export default function Cookies() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 px-6 py-16 pt-24">
      <div className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-2xl p-8 shadow-sm space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Política de Cookies</h1>
          <p className="text-sm text-slate-500 mt-2">Última actualización: 18 de octubre de 2026</p>
        </div>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">1. Qué son las cookies</h2>
          <p className="text-slate-700">
            Las cookies son pequeños archivos o mecanismos de almacenamiento que pueden utilizarse para recordar información, mantener determinadas funcionalidades y obtener información sobre el uso de un sitio web.
          </p>
          <p className="text-slate-700">
            Además de cookies, determinadas tecnologías pueden utilizar otros mecanismos de almacenamiento o identificadores en el navegador.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">2. Tecnologías utilizadas por RFA</h2>
          <p className="text-slate-700">
            RFA utiliza los mecanismos técnicos necesarios para el funcionamiento y seguridad de su plataforma. El token de acceso se almacena en el almacenamiento local del navegador. Para renovar la sesión, el servidor utiliza una cookie HttpOnly de actualización y una cookie CSRF accesible al navegador, cuyo valor se envía en un encabezado para su validación en las operaciones correspondientes.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">3. Google Analytics</h2>
          <p className="text-slate-700">
            RFA ofrece Google Analytics para obtener información general sobre el uso y rendimiento del sitio. La implementación utiliza el identificador G-ZR6DRJD7K9 y permanece bloqueada hasta que aceptes las cookies de analítica. La preferencia se guarda en el almacenamiento local del navegador.</p>
          <p className="text-slate-700">
            Si aceptas la analítica, Google Analytics puede utilizar cookies, identificadores u otras tecnologías para recopilar información relacionada con el uso del sitio. Si la rechazas, no se carga y las funciones esenciales de RFA siguen disponibles. Podés modificar o revocar tu preferencia en cualquier momento desde el control "Preferencias de cookies" disponible en el sitio. La información generada puede ser procesada por Google conforme a sus propias condiciones y políticas.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">4. Gestión desde el navegador</h2>
          <p className="text-slate-700">
            El usuario puede configurar su navegador para bloquear, limitar o eliminar cookies y otros datos almacenados por los sitios web. La modificación de estas configuraciones puede afectar determinadas funcionalidades cuando estas dependan del almacenamiento del navegador.
          </p>
          <p className="text-slate-700">
            El bloqueo de herramientas de analítica no debería impedir el acceso a las funciones principales de RFA.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">5. Servicios de terceros</h2>
          <p className="text-slate-700">
            Determinados servicios tecnológicos de terceros utilizados por RFA pueden utilizar sus propios mecanismos de almacenamiento o identificación.
          </p>
          <p className="text-slate-700">
            Cuando corresponda, el tratamiento realizado por dichos proveedores estará sujeto también a sus respectivas políticas y condiciones.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">6. Cambios en esta política</h2>
          <p className="text-slate-700">
            RFA podrá actualizar esta Política de Cookies cuando existan cambios técnicos, operativos, regulatorios o en las tecnologías utilizadas por el sitio.
          </p>
          <p className="text-slate-700">
            La versión vigente será la publicada en esta página con su fecha de última actualización.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">7. Contacto</h2>
          <p className="text-slate-700">
            Para consultas relacionadas con cookies, privacidad o tecnologías utilizadas por el sitio:
          </p>
          <p className="text-slate-700">
            <a className="text-emerald-700 font-medium" href="mailto:soporte@rfargentina.com">soporte@rfargentina.com</a>
          </p>
          <p className="text-slate-700">También se encuentran disponibles:</p>
          <ul className="list-disc pl-6 space-y-1 text-slate-700">
            <li><Link className="text-emerald-700 font-medium" to="/terminos">Términos y Condiciones</Link></li>
            <li><Link className="text-emerald-700 font-medium" to="/privacidad">Política de Privacidad</Link></li>
          </ul>
        </section>
      </div>
    </div>
  );
}
