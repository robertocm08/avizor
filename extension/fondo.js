"use strict";
/*
 * Avizor (extensión) — proceso en segundo plano.
 *
 * 1) Antes de abrir cada web, la analiza (solo su dirección, aquí mismo).
 *    Si imita a una marca o entidad conocida, en lugar de abrirla muestra
 *    la página de aviso (aviso.html).
 * 2) Añade al menú del clic derecho «Comprobar este enlace con Avizor».
 *
 * Privacidad: no se envía nada a ningún servidor. Solo se guarda, en este
 * navegador, la lista de webs que has decidido abrir igualmente y cuántos
 * avisos se han mostrado.
 */
importScripts("motor.js", "decision.js");

const PAGINA_AVISO = chrome.runtime.getURL("aviso.html");

async function leer(clave, porDefecto) {
  const datos = await chrome.storage.local.get(clave);
  return datos[clave] ?? porDefecto;
}

// --- 1) Aviso al entrar en webs falsas ---
chrome.webNavigation.onBeforeNavigate.addListener(async detalle => {
  if (detalle.frameId !== 0 || detalle.tabId < 0) return;   // solo la página principal de una pestaña
  const r = evaluarWeb(detalle.url);
  if (!r.avisar) return;
  const permitidas = await leer("permitidas", []);
  if (permitidas.includes(r.host)) return;
  try {
    await chrome.tabs.update(detalle.tabId, { url: `${PAGINA_AVISO}?url=${encodeURIComponent(detalle.url)}` });
    await chrome.storage.local.set({ avisos: (await leer("avisos", 0)) + 1 });
  } catch { /* la pestaña se cerró o era una precarga: no hay nada que hacer */ }
}, { url: [{ schemes: ["http", "https"] }] });

// La página de aviso nos pide recordar una web que el usuario quiere abrir igualmente
chrome.runtime.onMessage.addListener((mensaje, _remitente, responder) => {
  if (mensaje?.tipo === "permitir" && typeof mensaje.host === "string") {
    leer("permitidas", []).then(lista => {
      if (!lista.includes(mensaje.host)) lista.push(mensaje.host);
      return chrome.storage.local.set({ permitidas: lista });
    }).then(() => responder({ ok: true }));
    return true;   // respuesta asíncrona
  }
});

// --- 2) Clic derecho en un enlace ---
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "comprobar-enlace", title: "Comprobar este enlace con Avizor", contexts: ["link"] });
  });
});

chrome.contextMenus.onClicked.addListener(info => {
  if (info.menuItemId !== "comprobar-enlace" || !info.linkUrl) return;
  chrome.windows.create({
    url: `enlace.html?url=${encodeURIComponent(info.linkUrl)}`,
    type: "popup", width: 440, height: 640, focused: true,
  });
});
