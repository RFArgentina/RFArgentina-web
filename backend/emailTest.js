require("dotenv").config();
const sgMail = require("@sendgrid/mail");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const msg = {
  to: "soporte@rfargentina.com", // destinatario (puede ser tu correo)
  from: "reclamos@rfargentina.com", // remitente verificado en SendGrid
  subject: "✅ Prueba de envío desde RFA",
  text: "Hola Matías! Este es un correo de prueba enviado desde el servidor RFA.",
  html: "<strong>Hola Matías! 🚀 Este es un correo de prueba enviado desde el servidor RFA.</strong>",
};

sgMail
  .send(msg)
  .then(() => {
    console.log("📩 Correo enviado correctamente");
  })
  .catch((error) => {
    console.error("❌ Error al enviar el correo:", error);
  });
