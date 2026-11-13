# Avizor · Detector de timos en SMS y WhatsApp

**Pruébalo:** https://robertocm08.github.io/avizor/

¿Te ha llegado un mensaje raro? Pégalo en Avizor, o sube una captura, y en un segundo te dice si tiene las señales de las estafas más comunes en España, **por qué** y **qué hacer**.

Pensado para cualquier persona, no solo para técnicos: lenguaje sencillo, botones grandes y un semáforo fácil de entender.

- 🔴 **Probable estafa**: no respondas, no pulses ningún enlace y no des ningún dato.
- 🟡 **Dudoso**: tiene señales sospechosas; compruébalo por otra vía antes de hacer nada.
- 🟢 **Parece seguro**: no vemos señales de estafa (aun así, nunca compartas claves ni códigos).

## Qué detecta

- **Suplantaciones**: Correos y paqueterías, DGT, Hacienda, Seguridad Social, SEPE, Policía, bancos, eléctricas, operadoras, Netflix, Amazon…
- **El timo del «Hola mamá»**: un familiar con número nuevo que pide dinero, y el de la falsa emergencia.
- **Peticiones peligrosas**: claves, PIN, tarjeta, códigos SMS, mover dinero a una «cuenta segura», aceptar un Bizum para «recibir» dinero.
- **Enlaces trampa**: webs que imitan marcas (`correos-envios.top`), acortadores, direcciones IP, terminaciones baratas, letras camufladas.
- **Otros cebos**: premios, falsas ofertas de empleo e inversión, chantajes, falso soporte técnico, compraventas y alquileres con pago por adelantado.

## Cómo funciona

Todo ocurre **en tu propio navegador**:

1. **Reglas** escritas a mano para las señales conocidas (`motor.js`).
2. **Análisis de cada enlace**: dominio oficial o imitación, acortadores, terminaciones, etc.
3. **Combinaciones**: señales que juntas son más graves (marca conocida + enlace no oficial, número nuevo + petición de dinero…).
4. **Un modelo estadístico** (regresión logística entrenada con 7.679 mensajes, `modelo.js`) que da una segunda opinión. Solo puede **sumar** riesgo, nunca restarlo, para no dejar pasar estafas.
5. **Lectura de capturas** (OCR) con Tesseract.js, también dentro del navegador.

Además es una **app instalable** (PWA): se puede añadir a la pantalla de inicio, funciona sin conexión y en Android aparece en el menú «Compartir».

## Privacidad

- Los mensajes y las imágenes **nunca salen de tu dispositivo** y no se guardan.
- Estadísticas anónimas con [GoatCounter](https://www.goatcounter.com/): solo visitas y el color del resultado, sin cookies y nunca el texto.
- Servicios externos que se cargan: las tipografías de Google Fonts y, solo al subir una imagen, el lector Tesseract.js desde jsDelivr.

## Aviso

Avizor es una **ayuda orientativa** y no sustituye a tu sentido común. Si dudas, contacta con la entidad por sus canales oficiales.
**¿Ya has pulsado o pagado?** Llama a tu banco cuanto antes y pide ayuda gratuita en el **017**, la línea de ciberseguridad de INCIBE.

## Pruebas

`pruebas/casos.json` contiene una batería de estafas típicas y mensajes legítimos. Para ejecutarla (necesita Node.js, sin instalar nada más):

```bash
node pruebas/ejecutar.js          # resumen y fallos
node pruebas/ejecutar.js --todo   # cada mensaje con su puntuación
```

La prueba falla si alguna estafa sale en verde, que es el error que nunca nos podemos permitir. GitHub la ejecuta automáticamente en cada cambio.

Resultado actual: **60/60 estafas** detectadas (56 en rojo) y **49/49 mensajes normales** en verde.

## Estructura

| Archivo | Para qué sirve |
| --- | --- |
| `index.html` | La página |
| `styles.css` | El diseño (modo claro y oscuro) |
| `motor.js` | Reglas, análisis de enlaces y puntuación |
| `modelo.js` | Pesos del modelo entrenado (generado, no editar a mano) |
| `app.js` | Interfaz, lectura de capturas y app instalable |
| `sw.js` | Funcionamiento sin conexión |
| `pruebas/` | Batería de pruebas |

Al publicar cambios, sube el número de versión (`?v=`) en `index.html` y en `sw.js` para que los móviles se actualicen.

## Contribuir

¿Te ha llegado una estafa que Avizor no detecta, o un mensaje normal que marca como sospechoso? Abre un *issue* con el texto **quitando antes tus datos personales** (nombre, teléfono, enlaces con códigos tuyos).

Hecho por Roberto, estudiante de Ciberseguridad e Inteligencia Artificial.
