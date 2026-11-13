#!/usr/bin/env node
/*
 * Pruebas automáticas de Avizor (sin dependencias).
 *
 *   node pruebas/ejecutar.js          -> resumen + fallos
 *   node pruebas/ejecutar.js --todo   -> también cada mensaje con su nota
 *
 * Carga modelo.js y motor.js tal y como los usa la web y pasa todos los
 * mensajes de pruebas/casos.json. Falla (código de salida 1) si alguna
 * estafa sale en VERDE: es el error que nunca nos podemos permitir.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const raiz = path.join(__dirname, "..");
const contexto = vm.createContext({ console, URL });
for (const archivo of ["modelo.js", "motor.js"]) {
  vm.runInContext(fs.readFileSync(path.join(raiz, archivo), "utf8"), contexto, { filename: archivo });
}
const analizar = vm.runInContext("analizarMensaje", contexto);

const casos = JSON.parse(fs.readFileSync(path.join(__dirname, "casos.json"), "utf8"));
const verTodo = process.argv.includes("--todo");
const color = { seguro: "VERDE", dudoso: "ÁMBAR", estafa: "ROJO " };
const recorte = t => (t.length > 90 ? t.slice(0, 90) + "…" : t);

const cuenta = { estafa: { seguro: 0, dudoso: 0, estafa: 0 }, legitimo: { seguro: 0, dudoso: 0, estafa: 0 } };
const fallosGraves = [];   // estafas en verde
const avisos = [];         // mensajes legítimos en rojo

for (const tipo of ["estafa", "legitimo"]) {
  for (const texto of casos[tipo]) {
    const r = analizar(texto);
    cuenta[tipo][r.nivel]++;
    if (tipo === "estafa" && r.nivel === "seguro") fallosGraves.push([r, texto]);
    if (tipo === "legitimo" && r.nivel === "estafa") avisos.push([r, texto]);
    if (verTodo) console.log(`${tipo === "estafa" ? "E" : "L"} ${color[r.nivel]} ${String(r.puntos).padStart(3)}  ${recorte(texto)}`);
  }
}

const pct = (n, total) => `${n}/${total} (${Math.round((n / total) * 100)} %)`;
const nE = casos.estafa.length, nL = casos.legitimo.length;
console.log("\n=== Resultado de las pruebas de Avizor ===");
console.log(`Estafas detectadas (ámbar o rojo): ${pct(nE - cuenta.estafa.seguro, nE)}  ·  en rojo: ${pct(cuenta.estafa.estafa, nE)}`);
console.log(`Mensajes normales en verde:        ${pct(cuenta.legitimo.seguro, nL)}  ·  en rojo por error: ${pct(cuenta.legitimo.estafa, nL)}`);

const detalle = ([r, texto]) => `  [${r.puntos} pts] ${recorte(texto)}\n     señales: ${r.motivos.map(m => `${m.titulo} (${m.peso})`).join("; ") || "ninguna"}`;
if (fallosGraves.length) console.log(`\n✗ ESTAFAS EN VERDE (${fallosGraves.length}):\n` + fallosGraves.map(detalle).join("\n"));
if (avisos.length) console.log(`\n! Mensajes normales marcados como estafa (${avisos.length}):\n` + avisos.map(detalle).join("\n"));
if (!fallosGraves.length) console.log("\n✓ Ninguna estafa sale en verde.");
process.exit(fallosGraves.length ? 1 : 0);
