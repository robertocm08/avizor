/*
 * Service worker de Avizor: guarda la app en el móvil para que funcione sin
 * conexión y se abra al instante.
 *
 * Estrategia: la página principal se pide primero a internet (las
 * actualizaciones se ven al momento) y, sin conexión, se usa la copia
 * guardada. Estilos, scripts e iconos salen de la copia guardada al instante.
 *
 * Al publicar cambios, sube el número de VERSION para forzar la actualización.
 */
const VERSION = "avizor-v10";

const ARCHIVOS = [
  "./",
  "./index.html",
  "./styles.css?v=10",
  "./modelo.js?v=10",
  "./motor.js?v=10",
  "./app.js?v=10",
  "./manifest.webmanifest",
  "./icono-192.png",
  "./icono-512.png",
  "./apple-touch-icon.png",
];

// Recursos de otros sitios que también guardamos (tipografías).
const EXTERNOS_PERMITIDOS = ["https://fonts.googleapis.com", "https://fonts.gstatic.com"];

self.addEventListener("install", evento => {
  evento.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", evento => {
  // Borra las copias de versiones anteriores
  evento.waitUntil(
    caches.keys()
      .then(claves => Promise.all(claves.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", evento => {
  const peticion = evento.request;
  if (peticion.method !== "GET") return;
  const url = new URL(peticion.url);
  const propio = url.origin === self.location.origin;
  if (!propio && !EXTERNOS_PERMITIDOS.includes(url.origin)) return;   // p. ej. el lector de imágenes

  // La página principal: PRIMERO internet (así las actualizaciones se ven al
  // momento) y, si no hay conexión, la copia guardada.
  if (peticion.mode === "navigate") {
    evento.respondWith(
      fetch(peticion)
        .then(respuesta => {
          if (respuesta.ok) caches.open(VERSION).then(c => c.put("./index.html", respuesta.clone()));
          return respuesta;
        })
        .catch(() => caches.match("./index.html", { ignoreSearch: true }))
    );
    return;
  }

  // El resto (estilos, scripts con ?v=, iconos, tipografías): primero la copia
  // guardada, y se actualiza en segundo plano.
  const clave = peticion;

  evento.respondWith(
    caches.open(VERSION).then(async cache => {
      const guardada = await cache.match(clave);
      const deRed = fetch(peticion)
        .then(respuesta => {
          if (respuesta.ok || respuesta.type === "opaque") cache.put(clave, respuesta.clone());
          return respuesta;
        })
        .catch(() => guardada);
      return guardada || deRed;
    })
  );
});
