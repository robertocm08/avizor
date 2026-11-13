"use strict";
/* Ventana del clic derecho «Comprobar este enlace con Avizor». */

const $ = id => document.getElementById(id);
const enlace = new URLSearchParams(location.search).get("url") || "";
const r = evaluarEnlace(enlace);

const TEXTOS = {
  estafa: ["Enlace peligroso", "No lo abras: tiene las señales de las webs de estafa."],
  dudoso: ["Enlace dudoso", "Tiene señales sospechosas. Si no esperabas este enlace, mejor no lo abras."],
  seguro: ["Parece seguro", "No vemos señales de web falsa. Aun así, no des datos si no esperabas este enlace."],
  invalido: ["No es un enlace web", "Avizor solo puede comprobar direcciones que empiezan por http o https."],
};

function crear(etiqueta, clase, texto) {
  const el = document.createElement(etiqueta);
  if (clase) el.className = clase;
  if (texto) el.textContent = texto;   // textContent: nunca interpreta HTML
  return el;
}

document.body.classList.add(`nivel-${r.nivel}`);
const [titulo, resumen] = TEXTOS[r.nivel];
$("titulo").textContent = titulo;
$("resumen").textContent = resumen;
document.title = `${titulo} · Avizor`;
$("direccion").textContent = enlace;
$("nota-acortado").hidden = !r.acortado;

const motivos = (r.motivos || []).filter(m => m.peso !== 0 || m.tipo === "positivo");
if (!motivos.length) {
  $("motivos").append(crear("li", "", "No hemos encontrado ninguna señal de alerta conocida."));
}
for (const m of motivos.slice(0, 6)) {
  const li = crear("li", m.tipo || "");
  li.append(crear("span", "motivo-titulo", m.titulo), crear("span", "motivo-texto", m.explicacion));
  $("motivos").append(li);
}

// Si es peligroso, "Abrir" queda como opción discreta
if (r.nivel === "estafa") {
  $("abrir").className = "btn-texto";
  $("abrir").textContent = "Abrir igualmente";
}
if (r.nivel === "invalido") $("abrir").hidden = true;

$("cerrar").addEventListener("click", () => window.close());
$("abrir").addEventListener("click", async () => {
  await chrome.tabs.create({ url: enlace });
  window.close();
});
$("titulo").focus();
