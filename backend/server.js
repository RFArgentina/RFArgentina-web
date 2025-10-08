require("dotenv").config();
const express = require("express");
const cors = require("cors");
const sgMail = require("@sendgrid/mail");

const app = express();
const PORT = process.env.PORT || 3001;

// Configuración básica
app.use(cors());
app.use(express.json());

// Configuración SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Ruta simple de prueba
app.get("/", (req, res) => {
  res.send("Servidor funcionando correctamente 🚀");
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
