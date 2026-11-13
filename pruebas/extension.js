#!/usr/bin/env node
/*
 * Pruebas de la extensión de Avizor.
 *
 *   node pruebas/extension.js
 *
 * 1) Comprueba que extension/motor.js es igual que motor.js
 *    (si no: node extension/sincronizar.js).
 * 2) Webs FALSAS: todas deben mostrar el aviso.
 * 3) Webs LEGÍTIMAS de uso diario: ninguna debe mostrarlo (una falsa alarma
 *    al navegar es lo que hace que la gente desinstale la extensión).
 * 4) Clic derecho en enlaces: semáforo esperado.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const raiz = path.join(__dirname, "..");
let fallos = 0;
const mal = texto => { fallos++; console.log("  ✗ " + texto); };

// 1) Copia del motor al día
const motor = fs.readFileSync(path.join(raiz, "motor.js"), "utf8");
const copia = fs.readFileSync(path.join(raiz, "extension", "motor.js"), "utf8");
if (motor !== copia) mal("extension/motor.js está desactualizado: ejecuta  node extension/sincronizar.js");

// Cargamos los archivos igual que la extensión (sin el modelo)
const ctx = vm.createContext({ console, URL });
for (const f of ["extension/motor.js", "extension/decision.js"]) {
  vm.runInContext(fs.readFileSync(path.join(raiz, f), "utf8"), ctx, { filename: f });
}
const evaluarWeb = vm.runInContext("evaluarWeb", ctx);
const evaluarEnlace = vm.runInContext("evaluarEnlace", ctx);

// 2) Webs falsas (como las de las campañas reales)
const FALSAS = [
  "https://correos-entregas.vip/es", "https://correos-es-envios.top/pago", "http://seur-reparto.online/track",
  "https://dhl-aduanas.top", "https://amazon-pedidos-es.com/login", "https://dgt-sanciones.info",
  "https://multasdgt.click", "https://agenciatributaria-reembolso.com", "https://aeat-gob-es.site/regularizar",
  "https://bbva-acceso.net", "https://caixa-desbloqueo.xyz", "https://unicaja-seguro.com",
  "https://netflix-cuenta.help", "https://iberdrola-pagos.com", "https://movistar-premios.shop",
  "https://mercadona-aniversario.club", "https://whatsapp-verificacion.site", "https://ig-copyright-apelacion.com",
  "https://wallapop-cobro.net", "https://policia-expediente.com", "https://sepe-prestaciones.online",
  "https://apple-id-desbloqueo.com", "https://paypal.com.verificacion-cuenta.xyz", "https://repsol-puntos.top",
  "https://bizum-pagos.app", "https://correos.es-entrega.com", "https://lidl-regalo.xyz", "https://disney-renovar.site",
  "https://kutxabank-clientes.com", "https://orange-factura.online", "https://santander-seguridad-clientes.com",
  "https://accounts.google.com.inicio-sesion.top", "https://c0rreos-envio.com", "https://bbva.ly/verificar",
  "https://correos.co/pago",
];
console.log(`\nWebs falsas (deben avisar): ${FALSAS.length}`);
let avisadas = 0;
for (const u of FALSAS) {
  const r = evaluarWeb(u);
  if (r.avisar) avisadas++; else mal(`NO avisa: ${u}  (${r.puntos} pts)`);
}
console.log(`  ${avisadas}/${FALSAS.length} avisan`);

// 3) Webs legítimas de uso diario en España
const LEGITIMAS = [
  "https://www.google.com/search?q=correos", "https://www.google.es", "https://mail.google.com", "https://accounts.google.com",
  "https://www.youtube.com", "https://login.microsoftonline.com/common/oauth2", "https://outlook.live.com/mail",
  "https://www.office.com", "https://onedrive.live.com", "https://www.amazon.es/dp/B08", "https://www.amazon.com",
  "https://www.amazon.de", "https://www.amazon.co.uk", "https://s3.eu-west-1.amazonaws.com/bucket/file",
  "https://m.media-amazon.com/images/I/1.jpg", "https://images-eu.ssl-images-amazon.com/x.jpg",
  "https://www.apple.com/es/", "https://appleid.apple.com", "https://www.icloud.com", "https://www.paypal.com/es/signin",
  "https://www.paypal.me/ana", "https://www.facebook.com", "https://www.instagram.com", "https://web.whatsapp.com",
  "https://www.netflix.com/es/login", "https://open.spotify.com", "https://www.disneyplus.com", "https://www.disneyplus.es",
  "https://www.bbva.es/personas.html", "https://www.bancosantander.es", "https://www.caixabank.es", "https://www.ing.es",
  "https://www.bancsabadell.com", "https://www.unicajabanco.es", "https://www.openbank.es", "https://bizum.es",
  "https://www.correos.es/es/es/herramientas/localizador", "https://www.seur.com", "https://www.dhl.com/es-es/home.html",
  "https://sede.dgt.gob.es", "https://www.dgt.es", "https://sede.agenciatributaria.gob.es", "https://sede.seg-social.gob.es",
  "https://www.sepe.es", "https://www.policia.es", "https://www.boe.es", "https://www.gobiernodecanarias.org",
  "https://www.juntadeandalucia.es", "https://www.comunidad.madrid", "https://www.iberdrola.es", "https://www.endesa.com",
  "https://www.movistar.es", "https://www.vodafone.es", "https://www.orange.es", "https://www.mercadona.es",
  "https://www.lidl.es", "https://www.elcorteingles.es", "https://es.wallapop.com", "https://www.vinted.es",
  "https://www.booking.com", "https://www.airbnb.es", "https://www.tiktok.com", "https://es.shein.com",
  "https://www.carrefour.es", "https://www.iberia.com", "https://www.repsol.es", "https://www.repsol.com",
  "https://elpais.com", "https://www.elmundo.es", "https://www.marca.com", "https://www.rtve.es", "https://www.wikipedia.org",
  "https://es.wikipedia.org/wiki/Correos", "https://github.com", "https://robertocm08.github.io/avizor/",
  "https://www.idealista.com", "https://www.milanuncios.com", "https://www.renfe.com", "https://www.aemet.es",
  "https://www.incibe.es", "https://www.osi.es", "https://www.linkedin.com", "https://www.twitch.tv",
  "https://www.reddit.com", "https://x.com", "https://chatgpt.com", "https://claude.ai", "https://www.zara.com/es/",
  "https://www.decathlon.es", "https://www.pccomponentes.com", "https://www.mediamarkt.es", "https://www.ikea.com/es/es/",
  "https://www.orangecounty.gov", "https://www.applebees.com", "https://www.lavanguardia.com", "https://www.ingenieria.es",
  "https://www.universidad-de-granada.es", "https://www.ucm.es", "https://campusvirtual.ual.es",
  "http://192.168.1.1", "http://localhost:8765", "http://router.home",
  "https://www.santanderseguros.es", "https://www.segurcaixaadeslas.es", "https://www.mapfre.es",
  "https://www.seguridadsocial.gob.es", "https://www.citapreviadnie.es", "https://www.mi-seguro-hogar.es",
];
console.log(`\nWebs legítimas (no deben avisar): ${LEGITIMAS.length}`);
let tranquilas = 0;
for (const u of LEGITIMAS) {
  const r = evaluarWeb(u);
  if (!r.avisar) tranquilas++;
  else mal(`AVISA por error: ${u}  (${r.puntos} pts: ${r.motivos.map(m => m.titulo).join("; ")})`);
}
console.log(`  ${tranquilas}/${LEGITIMAS.length} sin aviso`);

// 4) Clic derecho en un enlace
const ENLACES = [
  ["https://correos-envios.top/pago", "estafa"],
  ["https://bbva-acceso.net/login", "estafa"],
  ["http://185.62.48.10/devolucion", "estafa"],
  ["https://bit.ly/aeat-reembolso", "estafa"],
  ["https://bit.ly/3xYz9", "dudoso"],
  ["https://www.correos.es/es/es/herramientas/localizador", "seguro"],
  ["https://www.amazon.es/gp/your-account/order-history", "seguro"],
  ["https://login.microsoftonline.com/", "seguro"],
  ["https://elpais.com/espana/", "seguro"],
];
console.log(`\nClic derecho en enlaces: ${ENLACES.length}`);
let bien = 0;
for (const [u, esperado] of ENLACES) {
  const r = evaluarEnlace(u);
  if (r.nivel === esperado) bien++; else mal(`${u}: sale «${r.nivel}» (${r.puntos} pts), se esperaba «${esperado}»`);
}
console.log(`  ${bien}/${ENLACES.length} correctos`);

console.log(fallos ? `\n✗ ${fallos} fallo(s)` : "\n✓ Todas las pruebas de la extensión pasan");
process.exit(fallos ? 1 : 0);
