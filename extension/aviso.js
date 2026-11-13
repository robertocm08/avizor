"use strict";
/* Página de aviso: explica por qué la web parece falsa y deja salir o entrar igualmente. */

const $ = id => document.getElementById(id);
const destino = new URLSearchParams(location.search).get("url") || "";
const r = evaluarWeb(destino);

function crear(etiqueta, clase, texto) {
  const el = document.createElement(etiqueta);
  if (clase) el.className = clase;
  if (texto) el.textContent = texto;   // textContent: nunca interpreta HTML
  return el;
}

// En la página de aviso hablamos de "esta web", no de "el enlace"
const enWeb = t => t.replace(/^El enlace/, "La web").replace(/^Enlace sin cifrar/, "Conexión sin cifrar");

$("direccion").textContent = r.host || destino;
if (r.entidad) {
  $("entradilla").textContent = `Parece hacerse pasar por ${r.entidad}, pero no es su web oficial. Así funcionan las estafas que llegan por SMS, WhatsApp o correo.`;
}
for (const m of (r.motivos || []).filter(m => m.peso > 0)) {
  const li = crear("li", m.tipo || "");
  li.append(crear("span", "motivo-titulo", enWeb(m.titulo)), crear("span", "motivo-texto", m.explicacion));
  $("motivos").append(li);
}
$("titulo").focus();

// Salir: volver a la página anterior o, si no la hay, a una pestaña nueva
$("salir").addEventListener("click", () => {
  if (history.length > 1) history.back();
  else chrome.tabs.update({ url: "chrome://newtab/" });
});

$("mostrar-continuar").addEventListener("click", e => {
  $("continuar").hidden = false;
  e.currentTarget.setAttribute("aria-expanded", "true");
  e.currentTarget.hidden = true;
  $("continuar-igualmente").focus();
});

$("continuar-igualmente").addEventListener("click", async () => {
  if (!r.host) return;
  await chrome.runtime.sendMessage({ tipo: "permitir", host: r.host });
  location.replace(destino);
});
