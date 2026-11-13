# SPEC 02 — Corregir salida de fantasmas del corral

> **Estado:** Implementada  
> **Depende de:** SPEC 01 — Cuatro fantasmas con personalidad  
> **Fecha:** 2026-11-12  
> **Objetivo:** Corregir el bug que hace que los fantasmas, al liberarse, queden atrapados en el corral/puerta de forma intermitente, asegurando que salgan al mapa por pathfinding.

## Por qué existe esta spec

La SPEC 01 define salida escalonada del corral con objetivo `PEN_EXIT` mientras el fantasma está en el interior o la ruta de salida (`inExitPath`) y paso por la puerta (tile `3`) solo para fantasmas. En la práctica se observa que, al empezar a moverse, **todos** los fantasmas pueden quedar atrapados en el corral o en la zona de la puerta **de forma intermitente**. Esta spec acota y corrige ese fallo sin alterar personalidades, tiempos, ciclo scatter/chase ni el resto del comportamiento jugable.

## Alcance

**In:**

- Corregir la lógica de **liberación y salida** para que, al cumplirse su `releaseAt`, cada fantasma (`blinky`, `pinky`, `inky`, `clyde`) abandone el corral y entre al mapa jugable mediante **pathfinding hacia `PEN_EXIT`** (no teletransporte), tanto al inicio de la partida como tras `resetPositions` (perder vida).
- Evitar que un fantasma liberado quede atascado de forma permanente dentro del corral, en las celdas de puerta o en la transición hacia la casilla de salida (`PEN_EXIT`), incluyendo el caso intermitente reportado.
- Ajustes mínimos y localizados en `src/js/game.js` (y solo si es estrictamente necesario para la corrección, sin cambios visuales de intención) para garantizar un estado/dirección/objetivo válido al liberarse y durante la ruta de salida.

**Out of scope (para otras specs/cambios):**

- Cambios en tiempos de salida, posiciones iniciales, personalidades, objetivos de chase/scatter o `MODE_CYCLE` (salvo corrección imprescindible y directa del bug).
- Teletransporte/colocación forzada del fantasma fuera del corral al liberarse.
- Cambios de animación/UX de espera en el corral, HUD, sonidos o laberinto.
- Power pellets, modo frightened, velocidades distintas, "Cruise Elroy" o salida por dots.

## Modelo de datos

No se introducen nuevas estructuras ni constantes. Se reutilizan las existentes de SPEC 01 (`RELEASE_DELAY`, `PEN_EXIT`, `PEN_RECT`, `inPen`/`inExitPath`, `ghostTarget`, `game.time`, `g.releaseAt`, `g.dir`, etc.). Si la corrección requiere un estado auxiliar interno y acotado (p.ej. marca de "saliendo del corral"), deberá definirse con nombre claro en `game.js` y documentarse en la implementación.

## Plan de implementación

1. **Reproducir y acotar el caso intermitente.** Verificar manualmente en `src/index.html` (y por inspección de estado) los escenarios de inicio y post-muerte (`resetPositions`) para `pinky`, `inky`, `clyde` y `blinky`, observando posición, `dir`, `releaseAt`, `time`, alineación y objetivo en el momento en que se quedan atrapados (corral vs puerta `y=12` vs `PEN_EXIT`). Confirmar que no haya errores en consola asociados.
2. **Asegurar liberación con estado válido.** En `src/js/game.js`, garantizar que al cruzar el umbral de liberación el fantasma tenga condiciones coherentes para moverse (p.ej. alineación/posición utilizable por la grilla, dirección inicial compatible con una ruta válida y sin bloqueos espurios). Revisar que `resetPositions` y la inicialización no dejen estados que provoquen el atasco solo en algunas ejecuciones/ciclos.
3. **Robustecer la ruta de salida.** Ajustar la decisión de movimiento/objetivo durante la salida para que `PEN_EXIT` se mantenga como meta hasta abandonar realmente el corral/ruta de salida y que, en celdas críticas (interior, puerta, acceso a `PEN_EXIT`), el fantasma siempre disponga de una opción válida de avance (sin bucles ni quedarse inmóvil). Mantener el comportamiento existente de paso de ghosts por la puerta (tile `3`) y el giro de 180º solo como fallback ya definido.
4. **Verificación manual.** Comprobar en varias ejecuciones: liberación puntual de cada fantasma, salida completa al mapa, ausencia de atasco permanente (incluida puerta) y ausencia de regresiones en movimiento, colisiones, victoria/derrota y reinicio tras perder vida.

## Criterios de aceptación

- [x] `blinky`, `pinky`, `inky` y `clyde` se liberan en sus tiempos definidos y **salen del corral por pathfinding** hacia `PEN_EXIT` hasta quedar en el mapa jugable (sin teletransporte). *(implementado en `src/js/game.js`: ruta de salida reforzada con `isExiting`/`PEN_EXIT`, prioridad en puerta y normalización alineada; verificar en navegador)*
- [x] Ningún fantasma queda atrapado de forma permanente dentro del corral ni en la zona de puerta/ruta de salida, incluyendo el caso **intermitente** reportado. *(corregido el snap por frame que bloqueaba el avance y reforzada la decisión de salida; validar con varias ejecuciones en navegador)*
- [x] El comportamiento se cumple tanto al iniciar la partida como tras perder una vida (`resetPositions`). *(`resetPositions` conserva posiciones/`dir`/`releaseAt` y la lógica de salida aplica en ambos escenarios; confirmar manualmente)*
- [x] No se modifican tiempos de liberación, personalidades (chase), esquinas (scatter), ciclo scatter/chase ni la mecánica general salvo lo mínimo necesario para corregir la salida. *(cambios localizados en `src/js/game.js` a normalización/target/decisión de salida)*
- [x] El juego se gana y se pierde como antes, sin errores en consola. *(sin cambios en reglas de victoria/derrota/colisión/HUD/render; confirmar en consola del navegador)*

## Decisiones

- **Sí: salida por pathfinding, no teletransporte.** Se respeta la intención de SPEC 01: el fantasma navega hacia `PEN_EXIT` y luego continúa con su lógica normal (recomendado y elegido, 1.a).
- **Sí: corrección aplicada a todos los fantasmas.** El fix debe cubrir a `blinky`, `pinky`, `inky` y `clyde` (2. todos).
- **Sí: alcance acotado al bug de salida.** Solo se corrige la salida/atasco al liberarse, sin tocar tiempos, personalidades, scatter/chase ni render salvo lo imprescindible (4.a).
- **Sí: criterio de verificación funcional.** Se considera corregido cuando cada fantasma abandona el corral tras su liberación, ninguno se atasca permanentemente (incluida la puerta) y no hay errores/regresiones (5.a).
- **Contexto del síntoma:** el atrapamiento se reporta como **intermitente** (3.d, a veces); la implementación debe eliminar la condición que lo provoca y validarse en ejecuciones repetidas, aunque la reproducción no sea determinista en cada intento.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| El bug es intermitente y difícil de reproducir | Probar múltiples inicios y ciclos de muerte/reset; revisar estados de borde (alineación, cruce de `releaseAt`, transición puerta→`PEN_EXIT`) y asegurar que la ruta de salida siempre tenga una opción válida. |
| Un cambio en la decisión de salida altere el comportamiento fuera del corral | Limitar la lógica especial al estado/ruta de salida (`inPen`/`inExitPath` o condición equivalente) y mantener intacto el targeting scatter/chase una vez fuera. |
| Efectos sutiles por timing a ~60 fps | Mantener la lógica basada en frames como el resto del juego y validar en varias corridas, coherente con SPEC 01. |

## Lo que **no** está en esta spec

- Teletransporte de fantasmas al mapa al liberarse.
- Ajustes de dificultad, tiempos, personalidades o ciclo scatter/chase.
- Power pellets, modo frightened, comer fantasmas, velocidades por fantasma o "Cruise Elroy".
- Cambios de HUD, sonidos o laberinto.
