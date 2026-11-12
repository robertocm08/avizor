"use strict";
/* Interfaz de Avizor: conecta la página con el motor (motor.js). */

// =====================================================================
// 7. INTERFAZ: conectar los botones y pintar el resultado
// =====================================================================

const EJEMPLOS = {
  correos: "Correos: Su paquete está retenido en nuestro centro por tasas de aduana pendientes (1,99 €). Pague antes de 24 horas o será devuelto al remitente: https://correos-es-envios.top/pago",
  dgt: "DGT: Tiene una multa de tráfico pendiente de pago. Evite el recargo y la pérdida de puntos abonando hoy mismo en dgt-multas.info/pagar",
  hacienda: "Agencia Tributaria: Tiene una devolución de impuestos de 342,50€ pendiente. Verifique sus datos bancarios para recibirla: http://bit.ly/aeat-reembolso",
  banco: "BBVA: Hemos detectado un acceso no autorizado a su cuenta. Su tarjeta ha sido bloqueada. Confirme su identidad urgentemente en https://bbva-seguridad-clientes.com/verificar",
  mama: "Hola mamá, se me ha roto el móvil y este es mi número nuevo, guárdalo. ¿Me puedes hacer un Bizum de 380€? Es urgente, luego te lo devuelvo.",
  normal: "Hola Ana, ¿quedamos mañana a las 18:00 en la cafetería de siempre? Llevo los apuntes de clase.",
};

const $ = id => document.getElementById(id);

// =====================================================================
// ESTADÍSTICAS ANÓNIMAS (GoatCounter, sin cookies)
// =====================================================================
// Solo enviamos rutas cortas y fijas, por ejemplo "resultado/estafa" u
// "origen/foto". NUNCA el texto del mensaje, la imagen ni la dirección
// completa (que puede llevar el mensaje compartido en "?texto=...").
// En localhost GoatCounter no cuenta nada, así que tus pruebas no ensucian.
const GOATCOUNTER = "https://avizor.goatcounter.com/count";
const pendientes = [];

function contar(ruta, titulo = ruta) {
  const gc = window.goatcounter;
  if (gc && typeof gc.count === "function") {
    try { gc.count({ path: ruta, title: titulo, event: true }); } catch { /* sin estadísticas no pasa nada */ }
  } else if (pendientes.length < 20) {
    pendientes.push([ruta, titulo]);
  }
}

(function cargarContador() {
  if (location.protocol === "file:") return;
  // no_onload: no dejamos que cuente la visita solo, porque usaría la dirección completa
  window.goatcounter = { no_onload: true };
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://gc.zgo.at/count.v4.js";
  s.dataset.goatcounter = GOATCOUNTER;
  s.onload = () => {
    try { window.goatcounter.count({ path: location.pathname, title: "Visita" }); } catch { /* nada */ }
    pendientes.splice(0).forEach(([r, t]) => contar(r, t));
  };
  document.head.append(s);   // si falla (sin internet, bloqueador...), la app sigue igual
})();

function crearElemento(etiqueta, clase, texto) {
  const el = document.createElement(etiqueta);
  if (clase) el.className = clase;
  if (texto) el.textContent = texto;   // textContent: nunca interpreta HTML (seguro)
  return el;
}

/**
 * Pinta el mensaje original con las zonas sospechosas dentro de <mark>.
 * Si dos marcas se solapan, gana la más grave. Todo con textContent (seguro).
 */
function pintarMensajeMarcado(texto, marcas) {
  const prioridad = { positivo: 1, aviso: 2, grave: 3 };
  const clases = ["", "m-positivo", "m-aviso", "m-grave"];
  const nivel = new Array(texto.length).fill(0);
  for (const m of marcas) {
    for (let i = m.inicio; i < m.fin && i < texto.length; i++) {
      nivel[i] = Math.max(nivel[i], prioridad[m.tipo]);
    }
  }
  const caja = $("mensaje-marcado");
  caja.replaceChildren();
  let i = 0;
  while (i < texto.length) {
    let j = i;
    while (j < texto.length && nivel[j] === nivel[i]) j++;   // tramo del mismo nivel
    const trozo = texto.slice(i, j);
    caja.append(nivel[i] ? crearElemento("mark", clases[nivel[i]], trozo) : document.createTextNode(trozo));
    i = j;
  }
}

const ETIQUETAS = { grave: "Grave", positivo: "A favor", "": "Aviso" };
const MOTIVOS_VISIBLES = 3;   // el resto se pliega en "Ver todas las señales"
const NIVEL_TEXTO = { seguro: "bajo", dudoso: "medio", estafa: "alto" };

function crearMotivo(m) {
  const li = crearElemento("li", m.tipo);
  li.append(crearElemento("span", "etiqueta", ETIQUETAS[m.tipo || ""]));
  li.append(crearElemento("span", "motivo-titulo", m.titulo));
  li.append(crearElemento("span", "motivo-texto", m.explicacion));
  if (m.evidencia) li.append(crearElemento("div", "evidencia", m.evidencia));
  return li;
}

function mostrarResultado(resultado, texto) {
  const caja = $("resultado");
  const v = VEREDICTOS[resultado.nivel];

  caja.className = `resultado nivel-${resultado.nivel}`;
  $("titulo-veredicto").textContent = v.titulo;
  $("resumen").textContent = v.resumen;

  // Escala: el marcador se coloca en la posición del riesgo (0–100)
  const riesgo = Math.min(100, resultado.puntos);
  $("marcador").style.left = Math.max(2, Math.min(98, riesgo)) + "%";
  $("medidor").setAttribute("aria-valuenow", riesgo);
  $("medidor").setAttribute("aria-valuetext", `Riesgo ${NIVEL_TEXTO[resultado.nivel]}: ${riesgo} de 100`);
  const n = resultado.motivos.length;
  const p = $("puntuacion");
  p.replaceChildren(crearElemento("strong", "", `Riesgo ${NIVEL_TEXTO[resultado.nivel]} (${riesgo}/100)`),
    document.createTextNode(` · ${n} ${n === 1 ? "señal encontrada" : "señales encontradas"}`));

  // Qué hacer ahora (primero) + botón del 017 si hay riesgo
  $("consejos").replaceChildren(...generarConsejos(resultado).map(t => crearElemento("li", "", t)));
  $("llamar-017").hidden = resultado.nivel === "seguro";

  pintarMensajeMarcado(texto, resultado.marcas);

  // Motivos: los más importantes a la vista, el resto plegado
  const lista = $("motivos");
  const resto = $("motivos-resto");
  lista.replaceChildren();
  resto.replaceChildren();
  if (!n) {
    lista.append(crearElemento("li", "vacio", "No hemos encontrado ninguna señal de alerta conocida."));
  }
  resultado.motivos.forEach((m, i) => (i < MOTIVOS_VISIBLES ? lista : resto).append(crearMotivo(m)));
  const ocultos = Math.max(0, n - MOTIVOS_VISIBLES);
  $("mas-senales").hidden = !ocultos;
  $("mas-senales").open = false;
  $("mas-senales-texto").textContent = `Ver todas las señales (${ocultos} más)`;

  caja.hidden = false;
  caja.scrollIntoView({ behavior: "smooth", block: "start" });
  // Llevamos el foco al veredicto: los lectores de pantalla lo anuncian
  // y quien usa teclado sigue leyendo desde ahí.
  $("titulo-veredicto").focus({ preventScroll: true });
}

function nuevoMensaje() {
  $("mensaje").value = "";
  $("resultado").hidden = true;
  $("estado-ocr").hidden = true;
  window.scrollTo({ top: 0, behavior: "smooth" });
  $("mensaje").focus({ preventScroll: true });
}

/**
 * origen: cómo llegó el mensaje ("escrito", "pegar", "foto", "archivo",
 * "compartido" o "ejemplo"). Solo se usa para las estadísticas anónimas.
 */
function analizar(origen = "escrito") {
  const texto = $("mensaje").value.trim();
  if (!texto) {
    $("mensaje").focus();
    return;
  }
  const resultado = analizarMensaje(texto);
  mostrarResultado(resultado, texto);
  // Los ejemplos se cuentan aparte para no mezclarlos con mensajes reales
  if (typeof origen === "string" && origen.startsWith("ejemplo")) {
    contar(origen, "Ejemplo probado");
  } else {
    contar(`resultado/${resultado.nivel}`, `Resultado: ${VEREDICTOS[resultado.nivel].titulo}`);
    contar(`origen/${origen}`, `Mensaje ${origen}`);
  }
}

$("analizar").addEventListener("click", () => analizar("escrito"));
$("limpiar").addEventListener("click", nuevoMensaje);
$("otro").addEventListener("click", nuevoMensaje);
// Ctrl + Enter también analiza
$("mensaje").addEventListener("keydown", e => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) analizar("escrito");
});
// Botones de ejemplo: leen su atributo data-ejemplo
document.querySelectorAll("[data-ejemplo]").forEach(boton => {
  boton.addEventListener("click", () => {
    $("mensaje").value = EJEMPLOS[boton.dataset.ejemplo];
    analizar(`ejemplo/${boton.dataset.ejemplo}`);
  });
});

// =====================================================================
// 8. IMÁGENES: leer el texto de una captura (OCR) con Tesseract.js
// =====================================================================
// Tesseract.js reconoce texto dentro del propio navegador: la imagen
// nunca sale del dispositivo. Solo se descarga el programa lector y el
// diccionario de español la primera vez (luego quedan en caché).

const TESSERACT_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";

let promesaLibreria = null;   // para no descargar la librería dos veces
let promesaLector = null;     // el "lector" (worker) se crea una vez y se reutiliza
let alProgresar = null;       // función que actualiza la barra mientras lee
let ocrOcupado = false;

/** Añade la librería a la página solo cuando hace falta (carga diferida). */
function cargarLibreria() {
  if (window.Tesseract) return Promise.resolve();
  if (!promesaLibreria) {
    promesaLibreria = new Promise((resolver, rechazar) => {
      const script = document.createElement("script");
      script.src = TESSERACT_URL;
      script.onload = resolver;
      script.onerror = () => {
        promesaLibreria = null;   // permite reintentar más tarde
        rechazar(new Error("No se pudo descargar el lector de imágenes. Comprueba tu conexión a internet."));
      };
      document.head.append(script);
    });
  }
  return promesaLibreria;
}

/** Crea (una sola vez) un lector configurado para español. */
async function obtenerLector() {
  await cargarLibreria();
  if (!promesaLector) {
    promesaLector = Tesseract.createWorker("spa", 1, {
      logger: m => alProgresar && alProgresar(m),
    }).catch(err => { promesaLector = null; throw err; });
  }
  return promesaLector;
}

/** Arregla errores típicos del OCR al leer enlaces. */
function limpiarTextoOCR(texto) {
  return texto
    .replace(/(https?)\s*:\s*\/\s*\//gi, "$1://")   // "https : / /" -> "https://"
    .replace(/([-/])\n(?=\S)/g, "$1")                // enlace cortado al final de línea
    .split("\n").map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean)
    .join("\n");
}

/** Muestra el estado de la lectura (texto + barra de progreso). */
function estadoOCR(texto, progreso = null, esError = false) {
  const caja = $("estado-ocr");
  caja.hidden = false;
  caja.classList.toggle("error", esError);
  $("mensaje-ocr").textContent = texto;
  if (progreso !== null) $("barra-ocr").style.width = Math.round(progreso * 100) + "%";
}

const LADO_MAXIMO = 1800;   // px: suficiente para leer texto, ligero para el móvil

/**
 * Reduce fotos grandes (las del iPhone tienen 12 MP o más) antes de leerlas:
 * el lector va mucho más rápido y no se queda sin memoria en el móvil.
 * Devuelve un PNG reducido, o el archivo original si ya es pequeño.
 */
async function prepararImagen(archivo) {
  let imagen;
  try {
    imagen = await createImageBitmap(archivo);
  } catch {
    // Formato que el navegador no sabe abrir (p. ej. algunas fotos HEIC)
    throw new Error("No hemos podido abrir esa foto. Haz una captura de pantalla del mensaje y súbela, o elige la foto desde «Fototeca».");
  }
  const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height));
  if (escala === 1 && archivo.size < 2_000_000) { imagen.close?.(); return archivo; }
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(imagen.width * escala);
  lienzo.height = Math.round(imagen.height * escala);
  lienzo.getContext("2d").drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  imagen.close?.();
  return new Promise(ok => lienzo.toBlob(b => ok(b || archivo), "image/png"));
}

/** Archivos de texto (.txt): se leen directamente, sin lector de imágenes. */
async function procesarTexto(archivo) {
  const texto = (await archivo.text()).trim();
  if (!texto) {
    estadoOCR("Ese archivo está vacío. Elige otro o pega el mensaje en el cuadro.", null, true);
    return;
  }
  $("mensaje").value = texto.slice(0, 5000);
  $("estado-ocr").hidden = true;
  analizar("archivo");
}

/** Punto de entrada común para el botón, arrastrar y pegar. */
async function procesarImagen(archivo) {
  if (!archivo) return;
  const esTexto = archivo.type.startsWith("text/") || /\.txt$/i.test(archivo.name || "");
  if (esTexto) return procesarTexto(archivo);
  if (!archivo.type.startsWith("image/") && !/\.(heic|heif|jpe?g|png|webp)$/i.test(archivo.name || "")) {
    estadoOCR("Ese tipo de archivo no se puede leer. Sube una foto, una captura de pantalla o un archivo de texto (.txt).", null, true);
    return;
  }
  if (ocrOcupado) return;
  ocrOcupado = true;

  // Miniatura de la imagen (URL temporal que vive solo en tu dispositivo)
  const img = $("vista-previa");
  if (img.src) URL.revokeObjectURL(img.src);
  img.src = URL.createObjectURL(archivo);

  estadoOCR("Preparando el lector de imágenes…", 0);
  alProgresar = m => {
    if (m.status === "recognizing text") {
      estadoOCR(`Leyendo el texto de la imagen… ${Math.round(m.progress * 100)} %`, m.progress);
    } else if (m.status.includes("loading")) {
      estadoOCR("Descargando el lector de español (solo la primera vez)…", m.progress || 0);
    }
  };

  try {
    const imagen = await prepararImagen(archivo);
    const lector = await obtenerLector();
    const { data } = await lector.recognize(imagen);
    const texto = limpiarTextoOCR(data.text || "");

    if (texto.length < 5) {
      estadoOCR("No hemos podido leer texto en la imagen. Prueba con una captura de pantalla (es más nítida que una foto) o copia el mensaje a mano.", null, true);
      return;
    }
    $("mensaje").value = texto;
    estadoOCR("Listo: hemos copiado el texto de la imagen en el cuadro. Revísalo por si hay algún error.", 1);
    analizar("foto");
  } catch (err) {
    estadoOCR(err.message || "No se pudo leer la imagen.", null, true);
  } finally {
    ocrOcupado = false;
    alProgresar = null;
  }
}

// --- Forma 1: botón "Subir captura" ---
const zona = $("zona-imagen");   // el compositor entero acepta imágenes arrastradas
$("adjuntar").addEventListener("click", () => $("archivo").click());
$("archivo").addEventListener("change", e => {
  procesarImagen(e.target.files[0]);
  e.target.value = "";   // permite volver a subir la misma imagen
});

// --- Forma 2: arrastrar y soltar ---
zona.addEventListener("dragover", e => { e.preventDefault(); zona.classList.add("arrastrando"); });
// dragleave también salta al pasar sobre un elemento hijo: solo quitamos
// la capa si el puntero ha salido de verdad del compositor.
zona.addEventListener("dragleave", e => {
  if (!zona.contains(e.relatedTarget)) zona.classList.remove("arrastrando");
});
zona.addEventListener("drop", e => {
  e.preventDefault();
  zona.classList.remove("arrastrando");
  procesarImagen(e.dataTransfer.files[0]);
});
// Evita que el navegador abra la imagen si se suelta fuera de la zona
window.addEventListener("dragover", e => e.preventDefault());
window.addEventListener("drop", e => e.preventDefault());

// --- Forma 3: pegar una captura con Ctrl+V en cualquier parte de la página ---
document.addEventListener("paste", e => {
  const item = [...(e.clipboardData?.items || [])].find(i => i.kind === "file" && i.type.startsWith("image/"));
  if (item) {
    e.preventDefault();               // si es texto normal, se pega como siempre
    procesarImagen(item.getAsFile());
  }
});

// =====================================================================
// 9. APP EN EL MÓVIL (PWA)
// =====================================================================

// 9.1 Recibir un mensaje desde el menú "Compartir" del móvil (Android).
//     El sistema abre la app con ?titulo=...&texto=...&enlace=... (ver
//     "share_target" en manifest.webmanifest). Juntamos lo que llegue y lo analizamos.
(function recibirCompartido() {
  const p = new URLSearchParams(location.search);
  const partes = [p.get("titulo"), p.get("texto"), p.get("enlace")]
    .map(t => (t || "").trim())
    .filter((t, i, todas) => t && todas.indexOf(t) === i);   // sin vacíos ni repetidos
  if (!partes.length) return;
  $("mensaje").value = partes.join("\n");
  // Limpiamos la dirección para que al recargar no se vuelva a analizar
  history.replaceState(null, "", location.pathname);
  analizar("compartido");
})();

// 9.2 Botón "Pegar y comprobar": lee lo que se ha copiado (p. ej. un SMS en
//     el iPhone) y lo analiza con un solo toque. El navegador puede mostrar
//     un aviso "Pegar" que hay que tocar: es una protección de privacidad.
if (navigator.clipboard && navigator.clipboard.readText) {
  const boton = $("pegar");
  boton.hidden = false;
  boton.addEventListener("click", async () => {
    try {
      const texto = (await navigator.clipboard.readText()).trim();
      if (!texto) {
        estadoOCR("No hay ningún texto copiado. Mantén pulsado el mensaje sospechoso, toca «Copiar» y vuelve aquí.", null, true);
        return;
      }
      $("estado-ocr").hidden = true;
      $("mensaje").value = texto;
      analizar("pegar");
    } catch {
      // Si el navegador no deja leer el portapapeles, guiamos para pegar a mano
      estadoOCR("Mantén pulsado el cuadro de texto y toca «Pegar». Después pulsa «Comprobar mensaje».", null, true);
      $("mensaje").focus();
    }
  });
}

// 9.3 Guardar la app en el dispositivo para que funcione sin conexión.
//     (Solo funciona en https o en localhost, no abriendo el archivo con doble clic.)
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => { /* sin modo sin conexión, la app sigue funcionando */ });
  });
}
