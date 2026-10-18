import { Link } from "react-router-dom";

export default function Terms() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 px-6 py-16 pt-24">
      <div className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-2xl p-8 shadow-sm space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Términos y Condiciones</h1>
          <p className="text-sm text-slate-500 mt-2">Última actualización: 18 de octubre de 2026</p>
        </div>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">1. Objeto del servicio</h2>
          <p className="text-slate-700">
            Reclamos Financieros Argentina (RFA) presta servicios de asistencia documental y administrativa para reclamos financieros y de consumo frente a empresas y proveedores, conforme a la modalidad y el alcance acordados con cada usuario.
          </p>
          <p className="text-slate-700">
            Según el servicio contratado, RFA puede realizar tareas de análisis de antecedentes, organización y clasificación de documentación, reconstrucción cronológica, estructuración del caso, preparación de comunicaciones y seguimiento administrativo.
          </p>
          <p className="text-slate-700">
            RFA no es un estudio jurídico, no brinda asesoramiento jurídico profesional, no ejerce patrocinio ni representación judicial y no presta servicios reservados a profesionales habilitados.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">2. Ingreso y análisis inicial</h2>
          <p className="text-slate-700">
            El envío de un caso a través de la plataforma no implica la contratación automática de un servicio pago ni la aceptación del caso por parte de RFA.
          </p>
          <p className="text-slate-700">
            El análisis inicial es sin costo y tiene por finalidad conocer el problema, revisar preliminarmente la información disponible, identificar documentación faltante y determinar si RFA puede intervenir y bajo qué modalidad.
          </p>
          <p className="text-slate-700">
            RFA podrá solicitar información o documentación adicional antes de realizar una propuesta de servicio.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">3. Aceptación</h2>
          <p className="text-slate-700">
            El uso de la plataforma y el envío de un caso requieren la aceptación expresa de estos Términos y Condiciones y de la Política de Privacidad vigente.
          </p>
          <p className="text-slate-700">
            Cuando el servicio contemple que RFA realice o acompañe comunicaciones administrativas, la autorización correspondiente se solicitará de forma separada cuando resulte necesaria.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">4. Alcance y límites</h2>
          <p className="text-slate-700">
            RFA puede preparar comunicaciones para que sean enviadas directamente por el usuario.
          </p>
          <p className="text-slate-700">
            Cuando la modalidad contratada lo contemple y exista la autorización necesaria, RFA también podrá realizar o acompañar comunicaciones administrativas por los canales habilitados ante la empresa o proveedor involucrado.
          </p>
          <p className="text-slate-700">
            Determinados canales, trámites o procedimientos pueden exigir la intervención personal del usuario.
          </p>
          <p className="text-slate-700">
            La utilización de normativa, información oficial o antecedentes tiene como finalidad contribuir a la organización y estructuración administrativa del reclamo y no constituye asesoramiento jurídico profesional.
          </p>
          <p className="text-slate-700">
            Cuando un caso requiera interpretación jurídica profesional, patrocinio, representación, mediación, actuación judicial u otra intervención reservada a profesionales habilitados, RFA podrá finalizar su intervención administrativa y entregar la información organizada para facilitar la continuidad del caso.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">5. Obligaciones del usuario</h2>
          <p className="text-slate-700">
            El usuario se compromete a proporcionar información veraz, completa y actualizada y a conservar los documentos originales o respaldos relacionados con su reclamo.
          </p>
          <p className="text-slate-700">
            El usuario es responsable de la información y documentación que suministra a RFA.
          </p>
          <p className="text-slate-700">RFA podrá solicitar aclaraciones o documentación adicional y podrá rechazar, limitar o pausar una gestión cuando:</p>
          <ul className="list-disc pl-6 space-y-1 text-slate-700">
            <li>la información sea insuficiente o inconsistente;</li>
            <li>no pueda verificarse razonablemente el objeto del reclamo;</li>
            <li>la gestión solicitada exceda el alcance del servicio;</li>
            <li>existan indicios de utilización fraudulenta o abusiva de la plataforma.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">6. Servicios, propuesta y precio</h2>
          <p className="text-slate-700">El análisis inicial del caso es sin costo.</p>
          <p className="text-slate-700">Si luego del análisis RFA considera que puede intervenir, informará al usuario antes de comenzar cualquier trabajo pago:</p>
          <ul className="list-disc pl-6 space-y-1 text-slate-700">
            <li>modalidad propuesta;</li>
            <li>alcance;</li>
            <li>precio;</li>
            <li>tareas incluidas;</li>
            <li>eventuales exclusiones o limitaciones relevantes.</li>
          </ul>
          <p className="text-slate-700">
            Entre las modalidades disponibles pueden encontrarse la preparación de una Carpeta Profesional y la Gestión RFA, además de propuestas específicas para casos que requieran un alcance diferente.
          </p>
          <p className="text-slate-700">
            Los precios publicados como “desde” son valores de referencia mínimos y el precio definitivo se informa antes de la contratación.
          </p>
          <p className="text-slate-700">
            El valor del servicio puede variar según el volumen documental, cantidad de intervinientes, antecedentes, reconstrucción necesaria, complejidad y carga de trabajo.
          </p>
          <p className="text-slate-700">El precio del servicio no se determina como porcentaje del monto reclamado.</p>
          <p className="text-slate-700">No se inicia un servicio pago sin la conformidad previa del usuario.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">7. Pagos, cancelación y tareas iniciadas</h2>
          <p className="text-slate-700">
            Las condiciones de pago aplicables serán informadas al usuario junto con la propuesta correspondiente.
          </p>
          <p className="text-slate-700">
            Cuando se ofrezca pago en cuotas, se informarán previamente las condiciones aplicables.
          </p>
          <p className="text-slate-700">
            Las solicitudes de cancelación serán evaluadas de acuerdo con el estado de ejecución del servicio y los derechos que correspondan al usuario conforme a la normativa vigente.
          </p>
          <p className="text-slate-700">
            Cuando el usuario solicite expresamente el inicio de tareas y estas ya hayan sido ejecutadas total o parcialmente, se tendrá en consideración el trabajo efectivamente realizado, sin perjuicio de los derechos irrenunciables que correspondan al consumidor.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">8. Documentación y comunicaciones</h2>
          <p className="text-slate-700">
            El usuario autoriza a RFA a utilizar la información y documentación aportada exclusivamente en la medida necesaria para prestar el servicio contratado y realizar las tareas autorizadas.
          </p>
          <p className="text-slate-700">
            Cuando RFA prepare una comunicación para que sea enviada por el usuario, será responsabilidad del usuario revisar y efectuar el envío por el canal correspondiente.
          </p>
          <p className="text-slate-700">
            Cuando RFA tenga a su cargo una comunicación administrativa, actuará dentro del alcance y autorización acordados.
          </p>
          <p className="text-slate-700">
            RFA conservará registro de las gestiones realizadas cuando ello resulte necesario para la prestación y trazabilidad del servicio.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">9. Protección de datos</h2>
          <p className="text-slate-700">
            El tratamiento de datos personales se realiza conforme a la Política de Privacidad vigente.
          </p>
          <p className="text-slate-700">
            RFA procura conservar la información únicamente durante el tiempo necesario para prestar el servicio, mantener la trazabilidad correspondiente y cumplir las obligaciones aplicables.
          </p>
          <p className="text-slate-700">
            Los criterios específicos de conservación, eliminación y tratamiento de información se detallan en la Política de Privacidad.
          </p>
          <p className="text-slate-700">
            En cuentas empresa podrán existir políticas de conservación particulares según la configuración y condiciones del servicio contratado.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">10. Resultados y responsabilidad</h2>
          <p className="text-slate-700">
            RFA se compromete a prestar el servicio contratado de acuerdo con el alcance informado y dentro de aquello que se encuentre razonablemente bajo su control.
          </p>
          <p className="text-slate-700">La contratación de RFA no garantiza:</p>
          <ul className="list-disc pl-6 space-y-1 text-slate-700">
            <li>respuesta favorable;</li>
            <li>devolución;</li>
            <li>reintegro;</li>
            <li>desbloqueo;</li>
            <li>acuerdo;</li>
            <li>indemnización;</li>
            <li>resolución del conflicto;</li>
            <li>respuesta de una empresa u organismo;</li>
            <li>plazo determinado de resolución.</li>
          </ul>
          <p className="text-slate-700">
            Las decisiones y tiempos de respuesta de empresas, proveedores, plataformas, entidades u organismos externos no dependen de RFA.
          </p>
          <p className="text-slate-700">
            RFA tampoco será responsable por consecuencias originadas en información falsa, incompleta, desactualizada u omitida por el usuario, sin perjuicio de las responsabilidades que legalmente correspondan.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">11. Cuentas empresa (RFA Empresas)</h2>
          <p className="text-slate-700">
            El alta de usuarios empresa se realiza exclusivamente mediante administración de RFA.
          </p>
          <p className="text-slate-700">
            Las condiciones comerciales, alcance, usuarios habilitados y características operativas del servicio podrán establecerse mediante una propuesta o acuerdo específico con cada empresa.
          </p>
          <p className="text-slate-700">
            Los usuarios habilitados por una empresa deberán utilizar sus accesos exclusivamente para las finalidades autorizadas.
          </p>
          <p className="text-slate-700">
            Las condiciones específicas acordadas con una empresa podrán complementar estos Términos y Condiciones.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">12. Seguridad y uso indebido</h2>
          <p className="text-slate-700">
            El usuario debe utilizar la plataforma de manera legítima y adoptar medidas razonables para proteger sus credenciales de acceso.
          </p>
          <p className="text-slate-700">RFA podrá limitar o suspender accesos cuando detecte:</p>
          <ul className="list-disc pl-6 space-y-1 text-slate-700">
            <li>intentos de acceso no autorizado;</li>
            <li>utilización abusiva de la plataforma;</li>
            <li>carga de archivos maliciosos;</li>
            <li>manipulación de mecanismos de seguridad;</li>
            <li>utilización fraudulenta;</li>
            <li>incumplimientos graves de estos Términos.</li>
          </ul>
          <p className="text-slate-700">
            Estas medidas podrán adoptarse cuando resulten razonablemente necesarias para proteger la plataforma, los usuarios o la información almacenada.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">13. Propiedad intelectual</h2>
          <p className="text-slate-700">
            Los contenidos, marca, identidad visual, textos, diseños y desarrollos propios de la plataforma pertenecen a RFA o se utilizan bajo las autorizaciones correspondientes.
          </p>
          <p className="text-slate-700">No está permitida su reproducción, distribución o explotación no autorizada.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">14. Disponibilidad de la plataforma</h2>
          <p className="text-slate-700">
            RFA procura mantener disponible la plataforma y sus funcionalidades, pero no garantiza disponibilidad ininterrumpida.
          </p>
          <p className="text-slate-700">
            Podrán producirse interrupciones por mantenimiento, actualizaciones, fallas técnicas, servicios de terceros, situaciones de seguridad u otras circunstancias razonables.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">15. Ley aplicable y relaciones de consumo</h2>
          <p className="text-slate-700">
            Estos Términos se interpretan conforme a la normativa vigente de la República Argentina.
          </p>
          <p className="text-slate-700">
            Cuando exista una relación de consumo, ninguna disposición de estos Términos deberá interpretarse como una renuncia o limitación de los derechos irrenunciables reconocidos al consumidor.
          </p>
          <p className="text-slate-700">
            La competencia y jurisdicción aplicables serán las que correspondan conforme a la normativa vigente.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">16. Modificaciones</h2>
          <p className="text-slate-700">
            RFA podrá actualizar estos Términos para reflejar cambios normativos, operativos, comerciales, funcionales o de seguridad.
          </p>
          <p className="text-slate-700">
            La versión vigente será la publicada en el sitio, identificada mediante su fecha de última actualización.
          </p>
          <p className="text-slate-700">
            Cuando una modificación requiera una nueva aceptación del usuario, RFA podrá solicitarla antes de continuar utilizando las funcionalidades correspondientes.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">17. Contacto</h2>
          <p className="text-slate-700">
            Para consultas operativas o relacionadas con el servicio:
          </p>
          <p className="text-slate-700">
            <a className="text-emerald-700 font-medium" href="mailto:soporte@rfargentina.com">soporte@rfargentina.com</a>
          </p>
          <p className="text-slate-700">También se encuentran disponibles en el sitio:</p>
          <ul className="list-disc pl-6 space-y-1 text-slate-700">
            <li><Link className="text-emerald-700 font-medium" to="/privacidad">Política de Privacidad</Link></li>
            <li><Link className="text-emerald-700 font-medium" to="/cookies">Política de Cookies</Link></li>
          </ul>
        </section>
      </div>
    </div>
  );
}
