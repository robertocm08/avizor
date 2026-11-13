"use strict";
/*
 * Avizor (extensión) — decide cuándo avisar. Necesita motor.js cargado antes.
 *
 * Al navegar, una falsa alarma es muy molesta (y hace que la gente desinstale
 * la extensión), así que aquí somos MÁS estrictos que en la web:
 *   - Solo avisamos si la dirección IMITA a una marca o entidad conocida y,
 *     además, suma al menos UMBRAL_AVISO_WEB puntos de sospecha.
 *   - Nunca avisamos en redes locales ni en webs conocidas de grandes empresas
 *     que no están en la lista de dominios oficiales (p. ej. google.fr).
 */

const UMBRAL_AVISO_WEB = 50;

// Dominios legítimos de grandes empresas que contienen el nombre de una marca
// pero no son su dominio principal (inicios de sesión, contenidos, nubes...).
const DOMINIOS_CONOCIDOS = [
  "microsoftonline.com", "office.com", "office365.com", "sharepoint.com", "onedrive.com", "msn.com", "bing.com",
  "azure.com", "windows.net", "microsoft365.com", "skype.com", "xbox.com",
  "googleapis.com", "gstatic.com", "googleusercontent.com", "googlevideo.com", "googletagmanager.com",
  "google-analytics.com", "googlesyndication.com", "doubleclick.net", "gmail.com", "android.com", "blogger.com",
  "amazonaws.com", "cloudfront.net", "media-amazon.com", "ssl-images-amazon.com", "amazon.dev", "primevideo.com",
  "awsstatic.com", "audible.es", "audible.com",
  "icloud-content.com", "apple-cloudkit.com", "mzstatic.com", "cdn-apple.com",
  "paypalobjects.com", "paypal-community.com", "fbcdn.net", "messenger.com", "cdninstagram.com",
  "whatsapp.net", "spotifycdn.com", "scdn.co", "netflix.net", "nflxvideo.net", "nflximg.net",
  "tiktokcdn.com", "disney.com", "disney.es", "disneyplus.es", "go.com",
  "applebees.com", "pineapple.com",
  "santanderseguros.es", "segurcaixaadeslas.es", "bbvaseguros.es", "mapfre.es",
];

// Marcas que, como nombre principal con una terminación de país o genérica
// normal (google.fr, amazon.de, paypal.me), son la web real de la empresa.
const TLD_NORMALES = new Set(["com", "net", "org", "es", "eu", "me", "io", "tv"]);

/** Dominio "registrable" aproximado: lo que va antes de la terminación (amazon.co.uk -> amazon). */
function nombrePrincipal(host) {
  const partes = host.split(".");
  const n = partes.length;
  if (n >= 3 && /^(co|com|org|net|gob|gov)$/.test(partes[n - 2]) && partes[n - 1].length === 2) {
    return { nombre: partes[n - 3], tld: partes.slice(-2).join(".") };
  }
  return { nombre: partes[n - 2] || "", tld: partes[n - 1] };
}

function esRedLocal(host) {
  return host === "localhost" || /\.(local|lan|home|internal|localhost)$/.test(host) ||
    /^(10|127)\.\d+\.\d+\.\d+$/.test(host) || /^192\.168\.\d+\.\d+$/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host) || /^\[?[0-9a-f:]+\]?$/i.test(host);
}

/** ¿Es una web conocida y legítima aunque no esté en la lista de dominios oficiales? */
function esWebConocida(host) {
  if (DOMINIOS_CONOCIDOS.some(d => host === d || host.endsWith("." + d))) return true;
  const { nombre, tld } = nombrePrincipal(host);
  const esMarca = MARCAS_EN_DOMINIO.some(m => m.claves.includes(nombre) || (m.exactas || []).includes(nombre));
  const tldNormal = TLD_NORMALES.has(tld) || /^[a-z]{2}$/.test(tld) || /^(co|com)\.[a-z]{2}$/.test(tld);
  // Terminaciones de país muy usadas para imitar ".com" (correos.co, bbva.ly)
  const tldImitador = /^(co|ly|to|st|su|gd)$/.test(tld);
  return esMarca && tldNormal && !tldImitador && !TLD_SOSPECHOSOS.includes(tld);
}

function prepararEnlace(urlTexto) {
  let url;
  try { url = new URL(urlTexto); } catch { return null; }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  return { url, host, original: urlTexto, conProtocolo: true };
}

/**
 * Para la navegación: ¿mostramos el aviso a pantalla completa?
 * Devuelve { avisar, host, puntos, motivos, entidad }.
 */
function evaluarWeb(urlTexto) {
  const enlace = prepararEnlace(urlTexto);
  if (!enlace) return { avisar: false };
  const { host } = enlace;
  if (esRedLocal(host) || entidadOficial(host) || esWebConocida(host)) {
    return { avisar: false, host, puntos: 0, motivos: [] };
  }
  const motivos = analizarEnlace(enlace);
  let imita = motivos.find(m => m.id === "imita");

  // Marca escrita con números en lugar de letras: "c0rreos", "b8va" -> no, "paypa1"
  if (!imita) {
    const sinNumeros = host.replace(/0/g, "o").replace(/1/g, "l").replace(/3/g, "e").replace(/4/g, "a").replace(/5/g, "s");
    const marca = sinNumeros !== host && MARCAS_EN_DOMINIO.find(m => m.claves.some(c => c.length >= 4 && sinNumeros.includes(c)));
    if (marca) {
      const ent = ENTIDADES[marca.entidad];
      imita = { peso: 40, tipo: "grave", id: "imita", entidad: ent.nombre,
        titulo: `Imita a ${ent.nombre} cambiando letras por números`,
        explicacion: "Escribe el nombre con números (como «c0rreos») para que parezca la web real a simple vista." };
      motivos.push(imita);
    }
  }
  // Marca exacta con una terminación que imita a ".com" (correos.co, bbva.ly)
  const { nombre, tld } = nombrePrincipal(host);
  if (imita && /^(co|ly|to|st|su|gd)$/.test(tld) && MARCAS_EN_DOMINIO.some(m => m.claves.includes(nombre))) {
    motivos.push({ peso: 20, tipo: "", titulo: `Terminación engañosa (.${tld})`,
      explicacion: `Usa «.${tld}» para parecerse a la dirección real de la empresa.` });
  }

  motivos.sort((a, b) => b.peso - a.peso);
  const puntos = motivos.reduce((s, m) => s + m.peso, 0);
  return { avisar: Boolean(imita) && puntos >= UMBRAL_AVISO_WEB, host, puntos, motivos, entidad: imita?.entidad };
}

/**
 * Para el clic derecho en un enlace: semáforo completo, como en la web.
 * Devuelve { nivel, host, puntos, motivos, acortado }.
 */
function evaluarEnlace(urlTexto) {
  const enlace = prepararEnlace(urlTexto);
  if (!enlace) return { nivel: "invalido" };
  const { host } = enlace;
  const acortado = ACORTADORES.includes(host);
  if (esRedLocal(host)) return { nivel: "seguro", host, puntos: 0, motivos: [], local: true };
  if (!entidadOficial(host) && esWebConocida(host)) {
    return { nivel: "seguro", host, puntos: 0, acortado, motivos: [{
      peso: 0, tipo: "positivo", titulo: "Web conocida",
      explicacion: "Pertenece a una gran empresa conocida. Aun así, no des datos si no esperabas este enlace.",
    }] };
  }
  const r = analizarMensaje(urlTexto, { usarModelo: false });
  return { nivel: r.nivel, host, puntos: r.puntos, motivos: r.motivos, acortado };
}

if (typeof module !== "undefined") module.exports = { evaluarWeb, evaluarEnlace, esWebConocida };
