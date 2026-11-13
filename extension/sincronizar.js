#!/usr/bin/env node
/*
 * Copia el motor de detección de la web (../motor.js) dentro de la extensión.
 * Chrome solo puede cargar archivos que estén dentro de la carpeta extension/,
 * así que cada vez que cambies motor.js ejecuta:
 *
 *   node extension/sincronizar.js
 *
 * (Las pruebas avisan si te olvidas.)
 */
"use strict";
const fs = require("fs");
const path = require("path");
fs.copyFileSync(path.join(__dirname, "..", "motor.js"), path.join(__dirname, "motor.js"));
console.log("✓ extension/motor.js actualizado");
