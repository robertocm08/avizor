"use strict";
/* Ventanita que se abre al pulsar el icono de Avizor. */

const $ = id => document.getElementById(id);

async function pintar() {
  const { avisos = 0, permitidas = [] } = await chrome.storage.local.get(["avisos", "permitidas"]);
  if (avisos > 0) {
    $("contador").textContent = `Te hemos avisado de ${avisos} ${avisos === 1 ? "web sospechosa" : "webs sospechosas"}.`;
  }
  $("permitidas").hidden = permitidas.length === 0;
  $("permitidas-texto").textContent = `Has decidido entrar igualmente en ${permitidas.length} ${permitidas.length === 1 ? "web" : "webs"}.`;
}

$("olvidar").addEventListener("click", async () => {
  await chrome.storage.local.set({ permitidas: [] });
  pintar();
});

pintar();
