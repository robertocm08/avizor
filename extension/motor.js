"use strict";
/*
 * Avizor — motor de análisis (sin interfaz). Lo usan index.html y evaluar.html.
 *
 * Funcionamiento general:
 *   1) Normalizamos el texto (minúsculas, sin tildes, sin saltos de línea).
 *   2) Pasamos una lista de REGLAS de texto; cada una que coincide suma puntos.
 *   3) Extraemos los ENLACES y analizamos cada dominio.
 *   4) Aplicamos COMBINACIONES (señales que juntas son más graves).
 *   5) Un MODELO estadístico entrenado puede añadir puntos (nunca quitarlos).
 *   6) Con el total decidimos el color del semáforo.
 *
 * Los pesos se han ajustado con datos/entrenamiento.json usando evaluar.html,
 * con un objetivo prioritario: que ninguna estafa salga en verde.
 */

// =====================================================================
// 1. CONFIGURACIÓN
// =====================================================================

const UMBRAL_DUDOSO = 20;   // desde aquí: ámbar
const UMBRAL_ESTAFA = 50;   // desde aquí: rojo

// Entidades que se suelen suplantar y sus dominios oficiales.
// Un enlace es "oficial" si su dominio es uno de estos o un subdominio
// (p. ej. sede.dgt.gob.es termina en ".dgt.gob.es").
const ENTIDADES = {
  paqueteria: { nombre: "Correos o una empresa de paquetería", dominios: [
    "correos.es", "correos.com", "correosexpress.com", "seur.com", "dhl.com", "dhl.es", "gls-spain.es",
    "gls-group.com", "mrw.es", "nacex.es", "cttexpress.com", "ups.com", "inpost.es", "fedex.com"] },
  dgt:        { nombre: "la DGT", dominios: ["dgt.es", "dgt.gob.es"] },
  hacienda:   { nombre: "Hacienda (Agencia Tributaria)", dominios: ["agenciatributaria.gob.es", "agenciatributaria.es"] },
  organismo:  { nombre: "un organismo público", dominios: ["gob.es", "seg-social.es", "sepe.es", "policia.es", "guardiacivil.es"] },
  banco:      { nombre: "tu banco", dominios: [
    "bbva.es", "bbva.com", "bancosantander.es", "santander.es", "caixabank.es", "caixabank.com",
    "bancsabadell.com", "bankinter.com", "unicajabanco.es", "kutxabank.es", "abanca.com",
    "openbank.es", "ibercaja.es", "cajamar.es", "ing.es", "evobanco.com", "bizum.es"] },
  servicio:   { nombre: "una empresa conocida", dominios: [
    "netflix.com", "amazon.es", "amazon.com", "paypal.com", "apple.com", "icloud.com", "google.com",
    "youtube.com", "microsoft.com", "outlook.com", "live.com", "whatsapp.com", "instagram.com",
    "facebook.com", "spotify.com", "disneyplus.com", "iberdrola.es", "endesa.com", "naturgy.es",
    "movistar.es", "vodafone.es", "orange.es", "repsol.es", "mercadona.es", "lidl.es",
    "elcorteingles.es", "wallapop.com", "vinted.es", "booking.com", "airbnb.es", "airbnb.com", "tiktok.com",
    "hbomax.com", "max.com", "shein.com", "carrefour.es", "iberia.com", "forms.gle", "meet.google.com"] },
};

// Marcas que, si aparecen DENTRO de un dominio que no es el oficial,
// delatan una web falsa (p. ej. "correos-envios.top").
// "claves" se buscan como trozo de texto; "exactas" (muy cortas) solo como
// palabra completa del dominio, para no confundir "ing" con "ingles".
const MARCAS_EN_DOMINIO = [
  { entidad: "paqueteria", claves: ["correos", "seur", "dhl", "gls", "mrw", "nacex", "inpost", "fedex", "ctt"], exactas: ["ups"] },
  { entidad: "dgt",        claves: ["dgt"] },
  { entidad: "hacienda",   claves: ["tributaria", "hacienda", "aeat"] },
  { entidad: "organismo",  claves: ["segsocial", "seg-social", "seguridadsocial", "sepe", "policia", "guardiacivil", "gob"] },
  { entidad: "banco",      claves: ["bbva", "santander", "caixa", "sabadell", "bankinter", "unicaja", "kutxa",
                                    "abanca", "openbank", "ibercaja", "cajamar", "evobanco", "bizum"], exactas: ["ing"] },
  { entidad: "servicio",   claves: ["netflix", "amazon", "amzn", "paypal", "apple", "google", "g00gle", "microsoft",
                                    "outlook", "whatsapp", "instagram", "facebook", "spotify", "disney", "iberdrola",
                                    "endesa", "naturgy", "movistar", "vodafone", "vodaf0ne", "orange", "repsol",
                                    "mercadona", "lidl", "corteingles", "wallapop", "vinted", "booking", "airbnb", "tiktok",
                                    "hbomax", "shein", "carrefour", "iberia"], exactas: ["ig", "fb", "eci", "meta", "hbo"] },
];

// Palabras de "trámite" en el nombre de una web desconocida.
const PALABRAS_TRAMITE = [
  "seguridad", "verificacion", "verificar", "pago", "reembolso", "devolucion", "multa", "cobro", "desbloqueo",
  "acceso", "login", "cliente", "soporte", "alerta", "entrega", "envio", "tracking", "delivery", "upgrade",
  "ayudas", "sorteo", "premio", "regalo", "puntos", "factura", "cuenta", "apelacion", "copyright", "billing",
  "reparto", "aduana", "sancion", "notificacion", "dispositivo", "firma", "canje", "documento", "compartidos",
  "recurso", "reintento", "monedero", "coordenadas", "inmovilizacion", "tarifa", "renovar",
  "seguro", "expediente", "denuncia", "citacion", "validar", "verifica", "bloqueo", "reactivar",
];

// Acortadores: esconden la dirección real del enlace.
const ACORTADORES = [
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "cutt.ly", "is.gd", "ow.ly", "shorturl.at",
  "rb.gy", "t.ly", "s.id", "rebrand.ly", "buff.ly", "tiny.cc", "v.gd", "acortar.link", "short.gy"
];

// Servicios de alojamiento gratuito: cualquiera puede montar ahí una web falsa.
const HOSTING_GRATUITO = [
  "webcindario.com", "weebly.com", "wixsite.com", "000webhostapp.com", "blogspot.com", "firebaseapp.com",
  "web.app", "netlify.app", "glitch.me", "github.io", "pages.dev", "vercel.app", "ngrok.io", "ngrok-free.app",
  "repl.co", "godaddysites.com", "square.site",
];

// Terminaciones de dominio muy usadas en campañas de estafa por ser baratas.
const TLD_SOSPECHOSOS = [
  "xyz", "top", "click", "live", "online", "site", "icu", "buzz", "shop", "vip", "cc",
  "info", "link", "work", "rest", "cyou", "sbs", "cfd", "monster", "quest", "bond", "lol", "app",
  "help", "support", "delivery", "club", "fun", "win", "bid", "loan", "tk", "ml", "ga", "cf", "gq", "ws", "pw",
];

// Terminaciones que aceptamos como "dominio real" al buscar enlaces sin http://
const TLD_CONOCIDOS = new Set([
  "es", "com", "net", "org", "eu", "gob", "info", "io", "co", "me", "uk", "fr", "de", "it", "pt",
  "us", "ly", "gl", "gd", "at", "id", "cat", "biz", "online", "site", "store", "gy", "to", ...TLD_SOSPECHOSOS
]);

// =====================================================================
// 2. REGLAS DE TEXTO
// =====================================================================
// Cada regla: id, peso (puntos), patrones (regex sobre texto normalizado),
// titulo y explicacion. Opcionales:
//   entidad  -> la regla detecta una suplantación de esa entidad
//   refuerzo -> puntos extra si coinciden 2 o más patrones distintos
//   peso 0   -> la regla solo sirve como "pista" para las combinaciones
// Los patrones se escriben SIN tildes porque el texto se normaliza antes.

const REGLAS = [
  // --- Presión y miedo ---
  {
    id: "urgencia", peso: 20,
    titulo: "Te mete prisa",
    explicacion: "Los estafadores crean urgencia para que actúes sin pensar.",
    patrones: [
      /\burgente\w*/, /\burgentemente\b/, /\binmediata(mente)?\b/, /\b(en|antes de|durante|plazo de|proximas) (las )?(12|24|48|72) ?h(oras)?\b/,
      /\bultimo aviso\b/, /\bhoy mismo\b/, /\bsin falta\b/, /\bultim[oa] (dia|oportunidad|intento|recordatorio|notificacion)\b/,
      /\bcaduc\w*\b.{0,15}\b(hoy|manana|en [0-9]+|pronto|ya)\b/, /\bha caducado\b/, /\b(vence|expira)\w* hoy\b/,
      /\bde lo contrario\b/, /\blo antes posible\b/, /\bcuanto antes\b/, /\bantes de (medianoche|manana|las [0-9])/,
      /\ben ([1-7]|12|24|48|72) (dias|horas)\b/, /\bplazas limitadas\b/,
    ],
  },
  {
    id: "amenaza", peso: 20,
    titulo: "Amenaza con bloqueos, cortes o sanciones",
    explicacion: "Amenazar con bloquear tu cuenta, cortarte un servicio o cobrarte recargos es una táctica de miedo típica.",
    patrones: [
      /\b(cuenta|tarjeta|acceso|banca online|banca movil|servicio|suscripcion|linea|perfil|buzon|id|permiso de conducir|prestacion)\b.{0,50}\b(bloquead|suspendid|desactivad|restringid|limitad|cancelad|eliminad|comprometid|desvinculad|reportad|inoperativ|cortad|lleno)\w*/,
      /\b(limitado|bloqueado|suspendido|restringido|desactivado)\w* (tu|su) (cuenta|tarjeta|acceso)/,
      /\b(bloquear|suspender|desactivar|cancelar|eliminar)(emos|a|an)?\b.{0,20}\b(tu|su) (cuenta|tarjeta|acceso)/,
      /\b(sera|seran|quedara) (eliminad|bloquead|suspendid|cortad|desactivad|devuelt|destruid|dada de baja)\w*/,
      /\b(embargo|embargaremos|recargo|recargos|apremio|impago)\b/, /\bdevuelto al remitente\b/, /\bdada de baja\b/,
      /\b(cuenta|perfil|linea)\b.{0,30}\b(denunciad|reportad)\w*/,
      /\bevitar el (bloqueo|corte)\b/, /\bevite el (corte|recargo|embargo|bloqueo)\b/,
    ],
  },
  {
    id: "legal", peso: 25,
    titulo: "Amenaza con consecuencias legales",
    explicacion: "La Policía o un juzgado nunca te citan ni te reclaman pagos por SMS o WhatsApp.",
    // Cuenta si la denuncia o el expediente es CONTRA TI, no si la pones tú ("mañana pongo denuncia").
    patrones: [
      /\b(citacion judicial|orden de detencion|procedimiento judicial|se procedera a su detencion)\b/, /\bjuzgado\b/,
      /\b(tiene|tienes|existe|hay|se ha abierto|ha sido|usted ha sido|has sido)\b.{0,25}\b(denuncia|denunciad|expediente|citacion|demanda|delito)\w*/,
      /\bcontra (usted|ti)\b/,
    ],
  },
  {
    id: "pago_fallido", peso: 20,
    titulo: "Dice que un pago ha fallado o está pendiente",
    explicacion: "Inventar un pago fallido o una deuda es la excusa perfecta para pedirte la tarjeta.",
    patrones: [
      /\b(pago|cobro|factura|recibo)\b.{0,40}\b(rechazad|no (se ha podido|pudo|ha podido) (procesar|cobrar|completar|realizar)|fallid|no se (completo|ha completado))\w*/,
      /\bproblema con (el|su|tu) (pago|metodo de pago|tarjeta)\b/, /\bno (hemos podido|pudimos) procesar\b/,
      /\b(no pagada|sin pagar|pendiente de pago|pago pendiente|deuda pendiente)\b/, /\bdeuda de [0-9]/,
    ],
  },
  // --- Lo que te pide ---
  {
    id: "datos", peso: 30,
    titulo: "Pide datos confidenciales",
    explicacion: "Ningún banco, empresa ni organismo te pedirá claves, PIN, tarjeta o tu DNI por un mensaje.",
    patrones: [
      // "tu clave" cuenta si te la PIDEN, no si te la DAN ("tu clave de un solo uso es 760128")
      /\b(pin|cvv|cvc|contrasena|password|credenciales)\b/, /(?<![0-9] es )\b(tu|su) clave\b(?! de un solo uso)(?!.{0,30}\bes [0-9])/,
      /\bclave de (acceso|firma|seguridad)\b(?!.{0,30}\bes [0-9])/, /\b(coordenadas|tarjeta de claves)\b/,
      /\bnumero de (la |tu |su )?tarjeta\b/, /\bdatos de (la |tu |su )?tarjeta\b/, /\bmetodo de pago\b/,
      /\b(verifi|confirm|actualiz|actualic|valid|introduc|complet|facilit)\w* (tus|sus|los) (datos|credenciales)\b/,
      /\b(confirm|introduc|verifi)\w* (tu|su) (tarjeta|identidad|usuario)\b/,
      /\bdatos (bancarios|personales|de pago)\b/, /\bfoto de (tu|su) dni\b/, /\bdni por (ambos|las dos) (lados|caras)\b/,
      /\busuario y contrasena\b/,
    ],
  },
  {
    id: "pide_codigo", peso: 50,
    // Códigos que no dan acceso a ninguna cuenta ("el código del wifi", "el código postal")
    excluir: /\bcodigo (del |de la )?(wifi|postal|de descuento|promocional|de la puerta|del portal|de la alarma|del garaje|de la taquilla)\b/,
    titulo: "Te pide que le pases un código",
    explicacion: "Si alguien te pide el código que te ha llegado por SMS, quiere robarte la cuenta (WhatsApp, banco…). Nunca lo compartas.",
    patrones: [
      /\bcodigo\b.{0,60}\b(reenvi|pasa|pasame|pasas|pasamelo|dime|digaselo|digamelo|diganos|facilit|mandamelo|enviamelo|envienos|decir|decirmelo|decirnoslo|leer|leermelo|leernoslo|dictar|dictarmelo)\w*/,      /\b(necesito|dame|dime|dices|decir|decirme|dinos|diganos|digame|pasame|pasas|pasamelo|facilit\w*|mandame|enviame|envienos|reenvi\w*|responda con|responde con|dicte|dictenos|lea|leanos)\b.{0,40}\bcodigo\b/,
      /\bte ha llegado (un|el) (sms con un )?codigo\b/, /\b(mensaje|sms) con [0-9]+ (numeros|digitos|cifras)\b/,
    ],
  },
  {
    id: "cuenta_segura", peso: 50,
    titulo: "Te pide mover tu dinero a una «cuenta segura»",
    explicacion: "Es un engaño clásico: ningún banco te pide nunca trasladar tus ahorros a otra cuenta para protegerlos.",
    patrones: [
      /\bcuenta (segura|de seguridad|puente|protegida|blindada)\b/,
      /\b(transfier|traspas|muev|mover|traslad)\w*\b.{0,30}\b(fondos|ahorros|(su|tu|el) dinero)\b/,
      /\b(sacar|saque|retire|retirar) (el )?(efectivo|dinero)\b.{0,60}\b(mensajero|agente|recoger|entreg)\w*/,
    ],
  },
  {
    id: "solicitud_falsa", peso: 40,
    titulo: "Te pide «aceptar» un pago para recibir dinero",
    explicacion: "Para RECIBIR dinero nunca hay que aceptar nada. Si aceptas esa «solicitud» (por ejemplo de Bizum), eres tú quien paga.",
    patrones: [
      /\bsolicitud de (dinero|pago|cobro|bizum)\b/,
      /\bacept\w*\b.{0,50}\bpara (recibir|cobrar)/, /\bsolicitud\b.{0,40}\bpara (recibir|cobrar)/,
      /\bsi aceptas\b.{0,40}\b(recibir|cobrar)\w*/,
      /\b(tarjeta|datos bancarios)\b.{0,40}\bpara (recibir|cobrar)/, /\bpara (recibir|cobrar)\w*\b.{0,40}\b(tarjeta|datos bancarios)\b/,
      /\b(pago|dinero) por un enlace\b/,
      /\bpendiente de (su|tu) (aprobacion|aceptacion)\b/,
    ],
  },
  {
    id: "dinero", peso: 15,
    titulo: "Te pide dinero o un pago",
    explicacion: "Te pide pagar, transferir o hacer un Bizum. Comprueba siempre por otra vía antes de pagar.",
    patrones: [
      /\bme prestas\b/, /\b(envia|envie|manda|mande)\w* (dinero|[0-9]+)/,
      /\ba por el dinero\b/, /\b(tenlo|tengalo|ten el dinero) preparado\b/,
      /\b(haz|hazme|hagas|haga|hacer|realice|realiza|necesito)\w* (me )?(una |un |la |el )?(transferencia|ingreso|bizum)\b/,
      /\bnecesito [0-9][0-9.,]* ?(€|euros)/, /\bingresa [0-9][0-9.,]* ?(€|euros)?/,
      /\btransfier(a|as|e|es)\b/,
      /\b(puedes|podrias|puede) (hacer|mandar|enviar|prestar|dejar)\w*\b.{0,20}\b(bizum|transferencia|ingreso|dinero|[0-9]+)/,
      /\b(pagar|pague|pagues|paga|abona|abone|abonar|abonando|pagando)\b/,
      /\b(prestame|presta|prestar|dejame) (dinero|[0-9]+)/, /\bnecesito (dinero|[0-9]+ ?(€|euros))/,
      /\benvie\w* (el|la|los|las) (dinero|fianza|importe|pago|senal)\b/,
      /\bgastos de (gestion|envio)\b/, /\btasas? (de )?(aduana|envio|gestion|almacenamiento)\b/, /\baranceles?\b/,
    ],
  },
  {
    id: "importe", peso: 0,
    titulo: "Menciona una cantidad de dinero", explicacion: "",
    patrones: [/[0-9]+(?:[.,][0-9]+)? ?(€|eur\b|euros\b)/],
  },
  {
    id: "premio", peso: 20,
    titulo: "Promete un premio, regalo o devolución",
    explicacion: "Los premios inesperados y las devoluciones «pendientes» son un cebo muy común.",
    patrones: [
      /\bhas (sido (seleccionad|elegid)\w*|ganado)\b/, /\bha sido (seleccionad|elegid)\w*/, /\bganaste\b/,
      /\b(premio|sorte\w*|ganador\w*|regalando|regala|cheques?|vales? de|un vale|tarjeta regalo)\b/, /\breembolso\b/, /\ble devolvemos\b/,
      /\bcobro duplicado\b/, /\b(devolucion|ayuda) de [0-9]/, /\bbeneficiario\b/, /\bpuntos\b.{0,40}\bcaduc/,
      /\bcanje\w*/, /\b(enhorabuena|felicidades)\b/, /\bderecho a una devolucion\b/,
    ],
  },
  {
    id: "dinero_facil", peso: 50,
    titulo: "Promete dinero fácil",
    explicacion: "Ganar cientos de euros al día sin esfuerzo o con «rentabilidad garantizada» es siempre un engaño.",
    patrones: [
      /\b(gana|ganar|ganaras|ganes|cobra|cobrar|cobraras)\b.{0,25}[0-9][0-9.,]* ?(€|euros)?.{0,15}\b(al|por|a la|cada|en una) (dia|hora|semana|mes)\b/,
      /[0-9]+ ?(€|euros)? ?(diarios|semanales|al dia|por hora)\b/, /\brentabilidad (garantizada|asegurada)\b/,
      /\bsin riesgo\b/, /\bdar likes?\b/, /\b[0-9]+ ?h(oras)? al dia\b.{0,40}[0-9][0-9.,]* ?(€|euros)/,
      /\bpor cada (video|resena|like)\b/, /\b(multiplic|duplic)\w* (tu|su) (dinero|capital|inversion)\b/,
    ],
  },
  {
    id: "cebo", peso: 20,
    titulo: "Oferta de trabajo o inversión sospechosa",
    explicacion: "Las falsas ofertas de empleo e inversión buscan tu dinero o tus datos.",
    patrones: [
      /\btrabaj\w* desde casa\b/, /\bsin experiencia\b/, /\btiempo parcial\b/, /\bagencia de (empleo|reclutamiento)\b/,
      /\b(bitcoin|criptomoneda\w*|criptos?|criptoactivos?|trading)\b/, /\binviert\w*\b/, /\btrabajo (flexible|remoto)\b/, /\boferta de (empleo|trabajo)\b/,
    ],
  },
  {
    id: "chantaje", peso: 50,
    titulo: "Chantaje o extorsión",
    explicacion: "Es una amenaza genérica enviada a miles de personas. No pagues ni respondas.",
    patrones: [/\b(video|videos|fotos?) (tuy|intim)\w*/, /\bhe hackeado\b/, /\b(publicare|enviare a todos|lo difundo|las difundo)\b/, /\bpaginas para adultos\b/, /\bacceso a tu camara\b/, /\bhe grabado\b/],
  },
  {
    id: "adelantado", peso: 40,
    titulo: "Pago por adelantado o envío raro",
    explicacion: "Pedir una fianza, un «seguro de envío» o usar transportistas y Western Union es típico de compraventas y alquileres falsos.",
    patrones: [
      /\b(transportista|western union|moneygram)\b/, /\bseguro de envio\b/, /\b(pago|pagar|te pago) por adelantado\b/,
      /\bestoy en el extranjero\b/, /\b(fianza|senal)\b.{0,40}\b(envi|transfer|ingres)\w*/,
      /\b(vivo fuera|vivo en el extranjero|estoy embarcado|estoy en un buque)\b/, /\bagencia de (envios|transporte)\b/,
      /\bpag\w* el seguro\b/,
      // Pagar fuera de la plataforma (Airbnb, Wallapop, Idealista...): pierdes toda protección
      /\bdirectamente al (anfitrion|vendedor|propietario|casero|comprador)\b/, /\bfuera de la (plataforma|app|aplicacion)\b/,
      /\b(transferencia|pago|bizum|reserva)\b.{0,60}\b(por whatsapp|al propietario|al anfitrion)\b/,
    ],
  },
  {
    id: "soporte", peso: 25,
    titulo: "Falso aviso de virus o soporte técnico",
    explicacion: "Nadie detecta virus en tu móvil a distancia. Instalar lo que te piden da el control a los estafadores.",
    patrones: [/\b(virus|infectado|malware|hackeado)\b/, /\binstal\w* (la |esta |una )?(nueva )?(aplicacion|app)\b/, /\.apk\b/, /\bsoporte tecnico\b/,
               /\bdescarg\w* (la |una )?(nueva )?(version|app|aplicacion)\b/, /\bdesde este enlace\b/,
               /\binstal\w* (ya )?(la |el )?(proteccion|antivirus|limpiador)\b/, /\b(espian|en peligro)\b/,
               /\b(control remoto|anydesk|teamviewer)\b/],
  },
  {
    id: "llamar", peso: 15,
    titulo: "Te pide que llames a un número",
    explicacion: "Es el «vishing»: te hacen llamar a un número falso. Llama solo al teléfono que aparece en tu tarjeta o en la web oficial.",
    patrones: [/\b(llame|llama|llamame|llameme|llamenos|llamanos|contacte|marque)\b[^0-9]{0,40}(\+?34 ?)?[6789][0-9]{2}[ .]?[0-9]{2,3}[ .]?[0-9]{2,3}/],
  },
  {
    id: "responder", peso: 15,
    excluir: /\bpara (anular|cancelar|confirmar|modificar)\b|\bcita\b/,   // "Para anular su cita responda NO" es legítimo
    titulo: "Te pide que respondas al mensaje",
    explicacion: "Responder confirma que tu número está activo, y a menudo da pie a una llamada de un falso empleado.",
    patrones: [/\b(responda|responde|conteste|contesta)\b.{0,25}\b(no|si)\b/, /\bconteste a este mensaje\b/],
  },
  {
    id: "chat_externo", peso: 15,
    titulo: "Te lleva a hablar por WhatsApp o Telegram",
    explicacion: "Sacarte a un chat privado es habitual en falsas ofertas e inversiones.",
    patrones: [/\b(wa\.me|t\.me)\//, /\b(escrib|contact|habla|agreg|anad|unete|unase)\w* (por|en|a mi|al) (whatsapp|telegram)\b/,
               /\b(por|en) telegram\b/],
  },
  {
    id: "desconocido", peso: 20,
    titulo: "Un desconocido inicia la conversación",
    explicacion: "Muchas estafas de inversión o amorosas empiezan con un «¿eres tú…?» o un «me he equivocado de número».",
    patrones: [
      /\b(eres|es usted)\b[^?]{0,40}\?/, /\bme he equivocado de numero\b/, /\bnos conocimos\b/,
      /\bme han pasado tu numero\b/, /\bhe visto tu (foto|perfil|anuncio)\b/, /\bme gustaria conocerte\b/,
      /\bhemos (visto tu perfil|recibido tu (curriculum|cv))\b/, /\bentrevista por (videollamada|whatsapp|telegram)\b/,
    ],
  },
  {
    id: "alarma", peso: 15,
    titulo: "Te alarma con un movimiento o acceso en tu cuenta",
    explicacion: "«Nuevo dispositivo», «cargo sospechoso», «transferencia programada»: el susto sirve para que actúes sin pensar.",
    patrones: [
      /\b(se ha (programado|registrado|iniciado|solicitado)|hemos detectado|detectamos)\b.{0,40}\b(transferencia|cargo|pago|dispositivo|acceso|operacion|compra|inicio de sesion|prestamo)\b/,
      /\b(nuevo dispositivo|dispositivo desconocido|acceso no autorizado|actividad inusual|operacion sospechosa|acceso sospechoso|uso fraudulento)\b/,
    ],
  },
  {
    id: "promocion", peso: 10,
    titulo: "Mensaje promocional",
    explicacion: "Las ofertas «solo hoy» son a veces publicidad legítima, pero también se usan para atraer a webs falsas.",
    patrones: [/\b(descuento|rebajas|oferta exclusiva|outlet|solo hoy|envio gratis)\b/, /\b(preaprobad|preconcedid)\w*/],
  },
  {
    id: "accion", peso: 10,
    titulo: "Te pide que hagas algo ya",
    explicacion: "Pulsar, confirmar, verificar o reclamar: los mensajes de estafa siempre buscan que hagas algo.",
    patrones: [
      /\b(acepte|acepta|confirme|confirma|verifique|verifica|verifiquela|actualice|actualicela|actualiza|inicie sesion|inicia sesion|restablezca|restaure|reactive|reactivala|desbloquee|desbloqueela|vincule|vincular|protegela|proteja|apele|apela|reclame|reclamelo|reclama|canjea|canjealo|canjealos|solicitelo|solicitela|cobrela|acceda|accede|pulse|pulsa|haga clic|haz clic|clic aqui|entra aqui|introduzca|introduce|rellene|completa|complete|reprograme|programe|seleccione|descargue|instale|escuchalo|participa|consigue|recibe|regularice|cancele|cancelelo|anulelo|anule|consulte|ver multa|evite|sigue las instrucciones|siga las instrucciones|indique|ver notificacion|descarguelo|descargalo)\b/,
    ],
  },
  // --- Timo del "Hola mamá": cambio de número de un familiar ---
  // "refuerzoSi": el refuerzo solo se suma si además aparece este patrón.
  // "excluir": si aparece este patrón, la regla no se aplica (p. ej. "te paso el
  // número nuevo DE LA PELUQUERÍA" no es un familiar cambiando de número).
  {
    id: "familiar", peso: 35, refuerzo: 15,
    excluir: /\bte paso el (numero|telefono|contacto) (nuevo )?(de|del)\b|\bel numero es el mismo\b|\bsigo con el mismo numero\b/,
    refuerzoSi: /\b(mama|papa|mami|papi|hijo|hija|abuela|abuelo|nieto|nieta|tia|tio|sobrino|sobrina|soy yo)\b/,
    titulo: "Un «familiar» con número nuevo",
    explicacion: "Es el timo del «Hola mamá»: alguien se hace pasar por tu hijo/a con un número nuevo y después pide dinero.",
    patrones: [
      /\b(se me ha|se me|he) (roto|rompio|caido|cayo|perdido|mojado|mojo|estropeado|estropeo)\b.{0,25}\b(movil|telefono|iphone)/,
      /\b(movil|telefono)\b.{0,15}\bse me ha (roto|caido|estropeado|mojado)\b/, /\b(perdi|he perdido) el (movil|telefono)\b/,
      /\bme (han|ha) robado el (movil|telefono)\b/,
      /\b(movil|telefono) (roto|estropeado|averiado)\b/, /\bdesde el (movil |telefono )?de (un|una) amig/,
      /\b(este es|es) mi nuevo numero\b/, /\bnumero (nuevo|temporal|provisional)\b/,
      /\bguarda(lo)? (este|mi) (nuevo )?numero\b/, /\bhe cambiado de (numero|movil)\b/,
      /\bmi (numero|movil) (antiguo|anterior|viejo)\b/, /\bel otro (ya no|se me ha)\b/, /\bborra(me)? el (numero )?(otro|anterior)\b/,
      /\bya no lo uso\b/, /\btengo (el )?(movil|telefono) nuevo\b/, /\bmientras (me )?(arreglan|reparan)\b/,
      /\b(apuntate|apunta|guarda|graba)(te)? este numero\b/, /\ben reparacion\b/, /\b(whatsapp|numero) nuevo\b/,
      /\bsoy tu (hijo|hija|nieto|nieta|sobrino|sobrina)\b/, /\bno (puedo|tengo) (acceder|entrar|acceso)\b.{0,30}\bbanco\b/,
      /\bno tengo (saldo|acceso)\b/, /\bagregame\b/, /\bescribeme por aqui\b/,
    ],
  },
  {
    id: "apuro", peso: 15,
    titulo: "Una supuesta emergencia de un familiar",
    explicacion: "«Estoy en comisaría», «he tenido un accidente», «viene alguien a por el dinero»: es el timo de la emergencia. Llama directamente a tu familiar.",
    patrones: [
      /\b(estoy|me han llevado|me llevan) (en |a )?(la )?(comisaria|el hospital|urgencias|calabozo)\b/, /\bhe tenido un (accidente|problema grave)\b/,
      /\bme han (atracado|detenido)\b/, /\b(viene|ira|vendra|mandare|pasara) (un|una) (abogado|mensajero|amigo|persona|empleado)\b.{0,30}\b(por|a por|recoger)\b/,
      /\bpara (pagar )?la fianza\b/, /\bno se lo (digas|cuentes) a\b/, /\bno me llames\b/, /\bestoy atrapad\w*\b/,
    ],
  },
  {
    id: "favor", peso: 10,
    titulo: "Te pide un favor",
    explicacion: "Un favor «urgente» suele ser el paso previo a pedir dinero.",
    patrones: [/\bnecesito (un favor|tu ayuda|que me (ayudes|hagas|pagues|prestes)|que (pagues|transfieras))\b/, /\b(me )?(haces|puedes hacer) un favor\b/,
               /\bme ayudes a pagar\b/, /\bayudar(me)? con un pago\b/, /\btengo un problema\b/, /\bestoy en un apuro\b/, /\bhe tenido un accidente\b/,
               /\btengo que pedirte\b/],
  },
  // --- Suplantaciones (pesan poco solas: lo grave es lo que piden) ---
  {
    id: "paqueteria", peso: 10, entidad: "paqueteria",
    titulo: "Dice ser de Correos o de una empresa de paquetería",
    explicacion: "Es la estafa más común: un paquete «retenido» y un enlace para pagar unas tasas.",
    patrones: [
      /\bcorreos\b/, /\b(paquete|envio|pedido|entrega)\b.{0,60}\b(retenid|pendiente|no (ha podido|se ha podido|pudo|hemos podido) (ser )?entreg|en espera|direccion|aduana|devuelt|fallad|ha fallado|suspendid|bloquead|detenid)\w*/,
      /\baduana\b/, /\b(seur|mrw|gls|dhl|ups|fedex|nacex|ctt|inpost)\b/, /\bno (hemos podido|pudimos) entregar/,
      /\bfranqueo\b/, /\brepartidor no (encontro|ha encontrado|ha podido)\b/, /\bintentado entregar\w*/,
    ],
  },
  {
    id: "dgt", peso: 10, entidad: "dgt",
    titulo: "Dice ser de la DGT o de Tráfico",
    explicacion: "La DGT no notifica multas por SMS con enlaces de pago: lo hace por carta o en la DEV (Dirección Electrónica Vial).",
    patrones: [/\bdgt\b/, /\btrafico\b/, /\bmulta\b/, /\b(sancion|infraccion)\b/, /\bpuntos del carne?t\b/, /\bdireccion electronica vial\b/],
  },
  {
    id: "hacienda", peso: 10, entidad: "hacienda",
    titulo: "Dice ser de Hacienda (Agencia Tributaria)",
    explicacion: "Hacienda no envía SMS con enlaces para cobrar devoluciones ni pide datos bancarios por mensaje.",
    patrones: [
      /\bhacienda\b/, /\bagencia tributaria\b/, /\baeat\b/, /\bcontribuyente\b/, /\bdevolucion fiscal\b/,
      /\bdevolucion\b.{0,40}\b(renta|impuestos?|irpf|fiscal)\b/, /\b(renta|irpf)\b.{0,40}\bdevolucion\b/,
    ],
  },
  {
    id: "organismo", peso: 10, entidad: "organismo",
    titulo: "Dice ser de un organismo público",
    explicacion: "Seguridad Social, SEPE, Policía o ayuntamientos no piden pagos ni datos por SMS con enlaces.",
    patrones: [/\b(seguridad social|sepe|policia|guardia civil|ayuntamiento|ministerio|gobierno|juzgado|tribunal|fiscalia|cl@ve|tarjeta sanitaria|ibi|pension|prestacion)\b/],
  },
  {
    id: "banco", peso: 10, entidad: "banco",
    titulo: "Dice ser de un banco",
    explicacion: "Los bancos no te piden que entres en enlaces ni que llames a números desconocidos para «verificar» nada.",
    patrones: [
      /\b(bbva|santander|caixabank|la caixa|sabadell|bankinter|unicaja|kutxabank|abanca|openbank|ibercaja|cajamar|ing|ing direct|evo banco)\b/,
      /\b(acceso|inicio de sesion|compra|cargo|movimiento|operacion|transaccion|pago)\b.{0,30}\b(no (autorizad|reconocid)|sospechos|inusual|irregular)\w*/,
      /\b(tu|su) banco\b/, /\bbanca (online|digital|movil)\b/, /\bcuenta bancaria\b/, /\btarjeta de (credito|debito)\b/,
    ],
  },
  {
    id: "servicio", peso: 10, entidad: "servicio",
    titulo: "Dice ser de una empresa conocida",
    explicacion: "Netflix, Amazon, eléctricas, operadoras o tiendas son suplantadas a diario para robar tarjetas.",
    patrones: [
      /\b(netflix|amazon|paypal|apple|google|microsoft|outlook|whatsapp|instagram|facebook|spotify|disney\+?|iberdrola|endesa|naturgy|movistar|vodafone|orange|repsol|mercadona|lidl|corte ingles|wallapop|vinted|booking|airbnb|tiktok|hbo|shein|carrefour|iberia|gmail)\b/,
      /\b(tu|su) (operador|compania)\b/, /\bcompania electrica\b/,
    ],
  },
];

// =====================================================================
// 3. UTILIDADES
// =====================================================================

/** Minúsculas, sin tildes y con los saltos de línea convertidos en espacios. */
function normalizar(texto) {
  return normalizarConMapa(texto).texto;
}

/**
 * Igual que normalizar(), pero además devuelve un "mapa": para cada letra
 * del texto normalizado, su posición en el texto original. Lo usamos para
 * subrayar las frases sospechosas en el mensaje tal y como lo escribió el usuario.
 */
function normalizarConMapa(original) {
  let texto = "";
  const mapa = [];
  for (let i = 0; i < original.length; i++) {
    const c = original[i];
    if (/\s/.test(c)) {
      if (texto.endsWith(" ")) continue;      // varios espacios/saltos -> uno
      texto += " ";
      mapa.push(i);
      continue;
    }
    const n = c.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    for (const letra of n) { texto += letra; mapa.push(i); }
  }
  return { texto, mapa };
}

/** ¿hostname pertenece a alguno de los dominios? (exacto o subdominio) */
function esDeDominio(hostname, dominios) {
  return dominios.some(d => hostname === d || hostname.endsWith("." + d));
}

/** ¿Es un dominio oficial de alguna entidad conocida? Devuelve la entidad o undefined. */
function entidadOficial(hostname) {
  return Object.values(ENTIDADES).find(ent => esDeDominio(hostname, ent.dominios));
}

/** Recorta un fragmento para mostrarlo como prueba. */
function recortar(t, max = 60) {
  t = t.trim();
  return t.length > max ? t.slice(0, max) + "…" : t;
}

// =====================================================================
// 4. EXTRACCIÓN Y ANÁLISIS DE ENLACES
// =====================================================================

/** Devuelve la lista de enlaces que aparecen en el texto. */
function extraerEnlaces(texto) {
  const encontrados = [];
  const limpiarFinal = s => s.replace(/[.,;:!?)\]»"'’]+$/, "");

  // a) Enlaces con http:// o https://
  let resto = texto.replace(/https?:\/\/[^\s<>"]+/gi, m => {
    encontrados.push({ original: limpiarFinal(m), conProtocolo: true });
    return " ";
  });

  // b) Quitamos los correos electrónicos para no confundirlos con webs
  resto = resto.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, " ");

  // b2) Direcciones IP sueltas ("158.60.88.17/login"): siempre sospechosas
  resto = resto.replace(/\b(?:www\.)?\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?(?:\/[^\s]*)?/g, m => {
    encontrados.push({ original: limpiarFinal(m.replace(/^www\./i, "")), conProtocolo: false });
    return " ";
  });

  // c) Enlaces sin protocolo: "www.algo.com", "algo.es/pagar"
  const sinProtocolo = /\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+([a-z]{2,24})\b(?:[/?#][^\s]*)?/gi;
  for (const m of resto.matchAll(sinProtocolo)) {
    if (TLD_CONOCIDOS.has(m[1].toLowerCase())) {
      encontrados.push({ original: limpiarFinal(m[0]), conProtocolo: false });
    }
  }

  // d) Convertimos cada uno en un objeto URL para obtener el dominio
  return encontrados.map(e => {
    try {
      const url = new URL(e.conProtocolo ? e.original : "http://" + e.original);
      return { ...e, url, host: url.hostname.toLowerCase().replace(/^www\./, "") };
    } catch {
      return null;
    }
  }).filter(Boolean);
}

/** Analiza un enlace y devuelve sus motivos de sospecha (o de confianza). */
function analizarEnlace(enlace) {
  const motivos = [];
  const { host, url, original, conProtocolo } = enlace;
  const etiquetas = host.split(".");
  const tld = etiquetas[etiquetas.length - 1];
  const evidencia = recortar(original);
  const add = (peso, titulo, explicacion, tipo, id) => motivos.push({ peso, titulo, explicacion, evidencia, tipo, id });

  const oficial = entidadOficial(host);
  if (oficial) {
    add(-15, `Enlace a una web oficial (${host})`,
      "El dominio coincide con una web oficial. Aun así, es más seguro escribir tú la dirección en el navegador.", "positivo");
    return motivos;
  }

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    add(35, "El enlace es una dirección IP", "Las webs legítimas usan un nombre (como correos.es), no números.", "grave", "ip");
    if (conProtocolo && url.protocol === "http:") add(10, "Enlace sin cifrar (http)", "Las webs oficiales usan https.");
    return motivos;   // en una IP no tiene sentido mirar subdominios ni marcas
  }
  if (ACORTADORES.includes(host)) {
    add(25, "Enlace acortado", "Los acortadores esconden a qué web te llevan de verdad.", "grave");
  }
  if (HOSTING_GRATUITO.some(h => esDeDominio(host, [h]))) {
    add(25, "Web alojada en un servicio gratuito", "Cualquiera puede crear ahí una página falsa en minutos.", "grave");
  }
  if (host.includes("xn--")) {
    add(35, "Dominio con letras camufladas", "Usa caracteres especiales que imitan letras normales para parecer una web conocida.", "grave", "camuflado");
  }
  if (TLD_SOSPECHOSOS.includes(tld)) {
    add(20, `Terminación de dominio poco fiable (.${tld})`, "Es una terminación barata muy usada en campañas de estafa.");
  }

  // Marca dentro de un dominio que NO es el oficial (p. ej. "correos-es.top")
  const trozos = host.split(/[.-]/);
  for (const marca of MARCAS_EN_DOMINIO) {
    const clave = marca.claves.find(c => host.includes(c)) || (marca.exactas || []).find(c => trozos.includes(c));
    if (clave) {
      const ent = ENTIDADES[marca.entidad];
      add(40, `El enlace imita a ${ent.nombre}`,
        `El dominio contiene «${clave}» pero no es una web oficial. Es una web falsa que se hace pasar por ella.`, "grave", "imita");
      motivos[motivos.length - 1].entidad = ent.nombre;
      motivos[motivos.length - 1].clave = clave;
      break;
    }
  }

  const sinTld = etiquetas.slice(0, -1).join(".");
  const palabra = PALABRAS_TRAMITE.find(p => sinTld.includes(p));
  if (palabra) {
    add(15, "El nombre de la web suena a trámite", `Contiene «${palabra}»: las webs falsas usan nombres así para parecer oficiales.`);
  }

  const principal = etiquetas.slice(-2, -1)[0] || "";
  if ((principal.match(/-/g) || []).length >= 2) {
    add(10, "Dominio con muchos guiones", "Nombres como 'pago-seguro-cliente' suelen ser webs falsas.");
  }
  if (etiquetas.length >= 4) {
    add(10, "Dirección con muchos subdominios", "Se usan para que el principio del enlace parezca de una empresa real.");
  }
  if (/[a-z][0-9]+[a-z]/.test(principal)) {
    add(10, "Mezcla letras y números en el nombre", "Por ejemplo 'c0rreos' o 'b8va', para imitar marcas conocidas.");
  }
  if (url.username || original.includes("@")) {
    add(25, "El enlace contiene una '@'", "Un truco para ocultar la web real: el navegador ignora lo que va antes de la @.", "grave");
  }
  if (conProtocolo && url.protocol === "http:") {
    add(10, "Enlace sin cifrar (http)", "Las webs oficiales usan https.");
  }
  return motivos;
}

// =====================================================================
// 4b. MODELO ESTADÍSTICO (regresión logística entrenada en Python)
// =====================================================================
// El texto se convierte en "características": palabras sueltas, pares de
// palabras seguidas y una marca especial si hay un enlace. El modelo tiene un
// peso para cada característica; se suman y se convierten en probabilidad.
// IMPORTANTE: entrenamiento/entrenar.py hace exactamente lo mismo en Python.

const PATRON_ENLACE_MODELO = /https?:\/\/|www\.|\b[a-z0-9-]+\.(com|es|net|org|info|xyz|top|online|site|shop|click|link|app|me|ly|co|vip|icu|buzz|help|cc|gd|at)\b/;

// Palabras vacías: no aportan nada y el modelo se "agarraría" a ellas por casualidad.
const PALABRAS_VACIAS = new Set((
  "de la las el los un una unos unas y o a en con por para su sus tu tus te le les lo me mi se que es " +
  "al del ya mas muy hola este esta esto ese eso hay ha has he hemos han sera ser como pero mas").split(" "));

function caracteristicasModelo(texto) {
  const t = normalizar(texto);
  const palabras = (t.match(/[a-z]+|[0-9]+|€/g) || [])
    .filter(p => !PALABRAS_VACIAS.has(p))
    .map(p => /^[0-9]+$/.test(p) ? "znum" : p);
  const c = new Set(palabras);
  for (let i = 0; i + 1 < palabras.length; i++) c.add(palabras[i] + "_" + palabras[i + 1]);
  if (PATRON_ENLACE_MODELO.test(t)) c.add("zenlace");
  return c;
}

function puntuarConModelo(texto) {
  let z = MODELO.sesgo;
  const aportes = [];
  for (const c of caracteristicasModelo(texto)) {
    const w = MODELO.pesos[c];
    if (w) { z += w; if (w > 0) aportes.push([c, w]); }
  }
  const probabilidad = 1 / (1 + Math.exp(-z));
  const claves = aportes.sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([c]) => "«" + c.replace(/_/g, " ").replace("zenlace", "tiene enlace").replace(/znum/g, "nº") + "»");
  return { probabilidad, claves };
}

// =====================================================================
// 5. ANÁLISIS COMPLETO DEL MENSAJE
// =====================================================================

function analizarMensaje(textoOriginal, { usarModelo = true } = {}) {
  const { texto, mapa } = normalizarConMapa(textoOriginal);
  const motivos = [];
  const activadas = new Set();
  const marcas = [];   // trozos del texto original a subrayar: {inicio, fin, tipo}
  const tiene = (...ids) => ids.some(id => activadas.has(id));
  const combinar = (peso, titulo, explicacion, evidencia = "") =>
    motivos.push({ peso, titulo, explicacion, evidencia, tipo: peso >= 25 ? "grave" : peso < 0 ? "positivo" : "" });

  // 5.1 Reglas de texto: cada regla puntúa una vez (más el refuerzo si
  //     coinciden varios patrones). Guardamos las frases como prueba.
  for (const regla of REGLAS) {
    if (regla.excluir && regla.excluir.test(texto)) continue;
    const coincidencias = regla.patrones.map(p => texto.match(p)).filter(Boolean);
    if (!coincidencias.length) continue;
    activadas.add(regla.id);
    if (!regla.peso) continue;   // reglas "pista": solo para combinaciones
    for (const m of coincidencias) {
      marcas.push({
        inicio: mapa[m.index],
        fin: mapa[m.index + m[0].length - 1] + 1,
        tipo: regla.peso >= 30 ? "grave" : "aviso",
      });
    }
    const pruebas = [...new Set(coincidencias.map(m => `«${recortar(m[0], 40)}»`))];
    const extra = regla.refuerzo && pruebas.length >= 2 && (!regla.refuerzoSi || regla.refuerzoSi.test(texto))
      ? regla.refuerzo : 0;
    motivos.push({
      peso: regla.peso + extra, titulo: regla.titulo, explicacion: regla.explicacion,
      evidencia: "Encontrado: " + pruebas.join(", "),
      tipo: regla.peso >= 30 ? "grave" : "",
    });
  }

  // 5.2 Enlaces
  const enlaces = extraerEnlaces(textoOriginal);
  for (const enlace of enlaces) {
    const delEnlace = analizarEnlace(enlace);
    motivos.push(...delEnlace);
    const inicio = textoOriginal.indexOf(enlace.original);
    if (inicio >= 0) {
      const tipo = delEnlace.some(m => m.tipo === "grave") ? "grave"
                 : delEnlace.some(m => m.tipo === "positivo") ? "positivo" : "aviso";
      marcas.push({ inicio, fin: inicio + enlace.original.length, tipo });
    }
  }
  const noOficiales = enlaces.filter(e => !entidadOficial(e.host));
  if (noOficiales.length) {
    combinar(10, "Incluye un enlace",
      "Los mensajes de estafa casi siempre quieren que pulses un enlace. Mejor no hacerlo.",
      noOficiales.map(e => recortar(e.original, 40)).join(", "));
  }

  // 5.3 Combinaciones (juntas son más graves que por separado)
  // (No incluye "accion": "introduce el código" o "consulte la app" son normales en avisos reales.)
  const PETICIONES = ["datos", "pide_codigo", "amenaza", "legal", "pago_fallido", "llamar", "dinero", "premio", "solicitud_falsa", "cuenta_segura", "alarma", "soporte", "responder"];
  let suplantacionContada = false;
  for (const regla of REGLAS.filter(r => r.entidad && activadas.has(r.id))) {
    const ent = ENTIDADES[regla.entidad];
    const malos = enlaces.filter(e => !esDeDominio(e.host, ent.dominios) && !entidadOficial(e.host));
    if (malos.length) {
      combinar(30, `Dice ser ${ent.nombre}, pero el enlace no es oficial`,
        "El enlace no lleva a la web oficial, sino a otro sitio.", malos.map(e => e.host).join(", "));
    }
    if (!suplantacionContada && tiene(...PETICIONES)) {
      suplantacionContada = true;
      combinar(20, `Usa el nombre de ${ent.nombre} para pedirte algo`,
        "Una entidad real no te pide pagos, datos, códigos o llamadas urgentes por mensaje.");
    }
  }
  const canal = noOficiales.length > 0 || tiene("chat_externo");
  if (canal && tiene("amenaza", "datos", "dinero", "premio", "pago_fallido", "accion", "legal", "dinero_facil", "soporte", "cebo", "alarma", "solicitud_falsa")) {
    combinar(20, "Enlace o chat + petición",
      "Te pide algo (pagar, verificar, reclamar…) y te manda a un enlace o chat que no es oficial.");
  }
  if (tiene("apuro") && tiene("dinero", "importe", "favor", "familiar")) {
    combinar(30, "Emergencia + petición de dinero",
      "Un familiar en apuros que necesita dinero ya es el guion exacto de este timo. Cuelga y llama tú a su número de siempre.");
  }
  if (tiene("cebo", "dinero_facil") && tiene("dinero")) {
    combinar(25, "Te piden pagar para conseguir un trabajo o ganancia",
      "Ninguna empresa seria cobra por darte un empleo (cursos, kits, «formalizar el contrato»…).");
  }
  if (tiene("premio") && tiene("dinero")) {
    combinar(20, "Te pide pagar para cobrar un premio",
      "Si de verdad hubieras ganado algo, no tendrías que pagar gastos para recibirlo.");
  }
  if (tiene("familiar") && tiene("dinero", "urgencia", "favor", "importe")) {
    combinar(30, "Número nuevo + petición de dinero, favor o prisa",
      "Es exactamente el guion del timo del «Hola mamá». Llama al número ANTIGUO de tu familiar para comprobarlo.");
  }
  if (tiene("llamar", "responder") && tiene("amenaza", "legal", "soporte", "pago_fallido", "urgencia", "alarma",
                               "banco", "paqueteria", "servicio", "organismo", "dgt", "hacienda", "premio")) {
    combinar(15, "Te hace llamar por un supuesto problema",
      "Te asustan con un cargo, un bloqueo o un virus para que llames a un número controlado por estafadores.");
  }
  // El propio número delata: bancos y empresas no usan móviles particulares
  // ni números de tarificación especial (803, 806, 807, 905).
  const telefonoPedido = texto.match(/\b(llame|llama|llamame|llameme|llamenos|llamanos|contacte|marque)\b[^0-9]{0,40}(\+?34 ?)?([0-9][0-9 .]{7,12})/);
  if (telefonoPedido) {
    const num = telefonoPedido[3].replace(/[ .]/g, "");
    if (/^[67]/.test(num)) {
      combinar(15, "Te pide llamar a un móvil particular",
        "Un banco, empresa u organismo usa números fijos o gratuitos (900), no un móvil personal.", telefonoPedido[3].trim());
    } else if (/^(803|806|807|905)/.test(num)) {
      combinar(25, "Te pide llamar a un número de pago",
        "Los números que empiezan por 803, 806, 807 o 905 son de tarificación especial: cada minuto te cuesta dinero.", telefonoPedido[3].trim());
    }
  }
  if (tiene("urgencia") && (enlaces.length || tiene("datos", "dinero", "llamar", "pide_codigo"))) {
    combinar(10, "Prisa + acción inmediata",
      "Combinar urgencia con un enlace, un pago, una llamada o tus datos es la receta clásica del fraude.");
  }
  // Señal a favor: los códigos de verificación auténticos te dan un código
  // y te advierten de que no lo compartas; no te lo piden.
  const daCodigo = /\b(codigo|clave)\b.{0,40}[0-9]{4,8}|[0-9]{4,8}\b.{0,10}\bes tu (codigo|clave)\b/.test(texto);
  if (daCodigo && !noOficiales.length && !tiene("pide_codigo", "cuenta_segura", "solicitud_falsa", "llamar")) {
    combinar(-25, "Parece un código de verificación auténtico",
      "Te da un código y te advierte de que no lo compartas: así son los avisos legítimos. Recuerda: no se lo des a nadie.");
  }

  // Señal a favor: los avisos reales del banco muestran los últimos dígitos de
  // TU tarjeta ("...4410", "terminada en 7788"); un estafador masivo no los sabe.
  // Solo resta si no hay peticiones peligrosas ni enlaces raros, y nunca
  // basta para que una estafa salga en verde (como mucho baja a ámbar).
  const tarjetaEnmascarada = /(\.{2,}|\*+ ?|terminada en |acabada en )[0-9]{4}\b/.test(texto);
  if (tarjetaEnmascarada && !noOficiales.length &&
      !tiene("datos", "pide_codigo", "cuenta_segura", "solicitud_falsa", "amenaza", "urgencia")) {
    combinar(-25, "Muestra los últimos dígitos de tu tarjeta",
      "Los avisos reales del banco suelen incluirlos. Aun así, si tienes dudas llama al número de tu tarjeta, no al del mensaje.");
  }

  // 5.4 Segunda opinión: el modelo estadístico entrenado (modelo.js).
  //     Solo puede SUMAR riesgo, nunca restarlo: así no crea falsos negativos.
  if (usarModelo && typeof MODELO !== "undefined" && MODELO) {
    const { probabilidad, claves } = puntuarConModelo(textoOriginal);
    const extra = MODELO.tramos.find(t => probabilidad >= t.desde)?.puntos || 0;
    if (extra) {
      motivos.push({
        peso: extra, tipo: extra >= 30 ? "grave" : "",
        titulo: "Se parece a estafas que conocemos",
        explicacion: `Nuestro modelo, entrenado con ${MODELO.casos} mensajes de ejemplo, calcula un ${Math.min(99, Math.round(probabilidad * 100))} % de parecido con una estafa.`,
        evidencia: claves.length ? "Lo que más pesa: " + claves.join(", ") : "",
      });
    }
  }

  // 5.5 Puntuación final y nivel
  const puntos = Math.max(0, motivos.reduce((s, m) => s + m.peso, 0));
  const nivel = puntos >= UMBRAL_ESTAFA ? "estafa" : puntos >= UMBRAL_DUDOSO ? "dudoso" : "seguro";

  // Ordenamos: primero lo más grave
  motivos.sort((a, b) => b.peso - a.peso);
  return { puntos, nivel, motivos, activadas, marcas };
}

// =====================================================================
// 6. TEXTOS DEL RESULTADO Y CONSEJOS
// =====================================================================

const VEREDICTOS = {
  seguro: { titulo: "Parece seguro", resumen: "No vemos señales de estafa. Aun así, nunca compartas claves ni códigos que te lleguen por mensaje." },
  dudoso: { titulo: "Dudoso", resumen: "Tiene señales sospechosas. Antes de pulsar, pagar o responder, compruébalo por otra vía." },
  estafa: { titulo: "Probable estafa", resumen: "No respondas, no pulses ningún enlace y no des ningún dato." },
};

function generarConsejos({ nivel, activadas }) {
  if (nivel === "seguro") {
    return [
      "Aun así, nunca compartas claves, PIN ni códigos que te lleguen por SMS.",
      "Si el mensaje cambia de tono y te pide dinero o datos, vuelve a analizarlo.",
    ];
  }
  const c = ["No pulses ningún enlace del mensaje ni respondas."];
  if (activadas.has("paqueteria")) c.push("Consulta tu envío escribiendo tú mismo la web oficial (correos.es, seur.com…) o en su app.");
  if (activadas.has("dgt")) c.push("Comprueba si tienes multas en sede.dgt.gob.es o en la app miDGT.");
  if (activadas.has("hacienda")) c.push("Consulta tu situación en agenciatributaria.gob.es entrando tú directamente.");
  if (activadas.has("organismo")) c.push("Contacta con el organismo por su web oficial (terminada en .gob.es) o por teléfono oficial.");
  if (activadas.has("banco") || activadas.has("llamar")) c.push("Llama a tu banco al número que aparece en tu tarjeta o en su app oficial, nunca al del mensaje.");
  if (activadas.has("servicio")) c.push("Entra en tu cuenta desde la app oficial de la empresa, no desde el enlace.");
  if (activadas.has("apuro")) c.push("Ante una «emergencia», cuelga y llama tú a tu familiar o a alguien cercano. Nunca entregues dinero a un mensajero o «abogado».");
  if (activadas.has("adelantado")) c.push("Paga siempre dentro de la plataforma (Airbnb, Wallapop…): fuera de ella pierdes toda protección.");
  if (activadas.has("familiar")) c.push("Llama a tu familiar a su número de siempre, o hazle una pregunta que solo él/ella sepa responder.");
  if (activadas.has("pide_codigo")) c.push("No reenvíes ningún código: con él pueden robarte WhatsApp o tu banca online.");
  if (activadas.has("cuenta_segura")) c.push("No muevas tu dinero a ninguna cuenta. Cuelga y llama tú a tu banco.");
  if (activadas.has("datos")) c.push("Nunca des claves, PIN, CVV, tu tarjeta ni fotos del DNI por mensaje.");
  if (activadas.has("dinero") || activadas.has("adelantado")) c.push("No hagas pagos, transferencias ni Bizum sin confirmarlo antes por otra vía.");
  if (activadas.has("dinero_facil") || activadas.has("cebo")) c.push("Desconfía de cualquier ganancia fácil o «garantizada». Consulta la web de la CNMV antes de invertir.");
  if (activadas.has("chantaje")) c.push("No pagues: es un mensaje masivo. Cambia tus contraseñas y denúncialo.");
  if (nivel === "estafa") {
    c.push("Bloquea el número y borra el mensaje.");
    c.push("Si ya pulsaste o diste datos: llama a tu banco cuanto antes y denuncia en Policía o Guardia Civil.");
  }
  return c;
}
