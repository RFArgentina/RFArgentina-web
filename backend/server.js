require("dotenv").config();
const axios = require("axios");
const { parseStringPromise } = require("xml2js");

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

// ---- Noticias RSS (caché 30 min) ----
const FEEDS = [
  "https://news.google.com/rss/search?q=site:ambito.com+OR+site:iprofesional.com+reclamos+financieros&hl=es-419&gl=AR&ceid=AR:es-419",
  "https://news.google.com/rss/search?q=billeteras+digitales+reclamos&hl=es-419&gl=AR&ceid=AR:es-419",
  "https://news.google.com/rss/search?q=BCRA+regulaci%C3%B3n+transferencias&hl=es-419&gl=AR&ceid=AR:es-419"
];


let cache = { data: [], ts: 0 };
const TTL_MS = 1000 * 60 * 30;


async function fetchFeed(url) {
  const { data: xml } = await axios.get(url, { timeout: 12000 });
  const json = await parseStringPromise(xml, { trim: true, explicitArray: false });
  const items = json.rss?.channel?.item || [];
  const arr = Array.isArray(items) ? items : [items];
  return arr.map(it => ({ title: it.title, link: it.link, date: it.pubDate }));
}


app.get("/api/news", async (_req, res) => {
  try {
    if (Date.now() - cache.ts < TTL_MS && cache.data.length) {
      return res.json(cache.data.slice(0, 8));
    }
    const results = (await Promise.all(FEEDS.map(fetchFeed))).flat();
    const seen = new Set();
    const uniq = [];
    results
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .forEach(it => { if (it?.link && !seen.has(it.link)) { seen.add(it.link); uniq.push(it); }});
    cache = { data: uniq, ts: Date.now() };
    res.json(uniq.slice(0, 8));
  } catch (e) {
    console.error("NEWS ERR:", e.message);
    res.status(500).json([]);
  }
});


app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
