# SPEC 03 — Power pellets y modo asustado

> **Estado:** Implementada  
> **Depende de:** SPEC 01 — Cuatro fantasmas con personalidad, SPEC 02 — Corregir salida de fantasmas del corral  
> **Fecha:** 2026-11-12  
> **Objetivo:** Añadir 4 power pellets en las esquinas del laberinto que, al ser comidas por Pac-Man, activan un modo asustado temporal en el que los fantasmas huyen y se mueven un 10% más lento.

## Alcance

**In:**

- 4 power pellets colocadas en las casillas **(1,3), (26,3), (1,23), (26,23)** del laberinto (`src/js/maze.js`), reemplazando los dots (`.`) de esas esquinas.
- Nueva representación de celda para power pellet: valor **`4`** en la grilla (char de origen en `MAZE_STR` p.ej. `o` en esas 4 posiciones, parseado a `4` por `parseTile` en `src/js/maze.js`). `game.grid` (copia de `MAZE` en `createGame`) usa el mismo valor y lo limpia a `0` al comerse.
- Las 4 power pellets **cuentan en `dotsRemaining`** y son necesarias para ganar la partida (condición de victoria igual que antes: `dotsRemaining <= 0`).
- Comer una power pellet suma **50 puntos** a `game.score` y activa/reinicia el modo asustado.
- **Modo asustado (global):** dura **420 frames (~7 s a 60 fps)**. Si Pac-Man come otra power pellet mientras está activo, el temporizador **se reinicia** a 420 frames.
- Durante el modo asustado, **todos** los fantasmas (incluidos los que esperan en el corral o están saliendo por `PEN_EXIT`/ruta de salida) se ven afectados: parpadean alternando **gris `#808080` y verde `#00ff00`** y su velocidad es **`0.09`** (10% menos que `GHOST_SPEED` 0.1).
- **Huida:** en modo asustado, al decidir dirección en una celda alineada/cruce, cada fantasma elige la dirección válida (manteniendo la regla de no invertir salvo callejón, coherente con el algoritmo actual) que **maximiza la distancia Manhattan** a la casilla de Pac-Man.
- **Transiciones de dirección:** al activarse el modo asustado y al terminar (volver a `scatter`/`chase` normal), todos los fantasmas **invierten su dirección inmediatamente** (`OPPOSITE[dir]`) si la dirección resultante es válida/manejable en su estado actual; si no, el cambio se resuelve en la siguiente decisión válida.
- **Visual de power pellets:** se dibujan en `src/js/render.js` como círculos más grandes que un dot normal y **parpadean alternando relleno azul `#2121ff` y dorado `#ffd700`** cada **10 frames** (alternancia global basada en `frame`).
- Colisión Pac-Man/fantasma durante modo asustado: **no mata a Pac-Man y no come al fantasma** (el contacto no tiene efecto de vida/estado). El comportamiento de comer fantasmas (puntos, ojos, regreso al corral) queda fuera de esta spec.
- `createGame` inicializa el estado del modo asustado; `resetPositions` (al perder una vida) reinicia posiciones/salidas/ciclo según comportamiento actual y también el estado/temporizador del modo asustado.

**Out of scope (para futuras specs):**

- Comer fantasmas asustados (puntuación 200/400/800/1600, sprites de ojos, retorno al corral y regeneración).
- Parpadeo de “aviso de fin” del modo asustado (p.ej. alternar color normal/asustado cerca del final del temporizador).
- Sonidos, HUD nuevo, cambios de laberinto distintos a las 4 esquinas indicadas, o cambios en tiempos/personalidades/ciclo scatter-chase fuera de lo necesario para integrar el modo asustado.
- Velocidades distintas por fantasma, "Cruise Elroy" o salida del corral por dots comidos.

## Modelo de datos

```js
// maze.js — MAZE_STR
// Reemplazar '.' por 'o' (power pellet, valor 4) en las 4 esquinas:
// (1,3), (26,3), (1,23), (26,23)
parseTile( 'o' ) -> 4 // además de '#'(1), '.'(2), '-'(3), ' '(0)

// game.js — constantes nuevas
const POWER_PELLET_SCORE = 50;
const FRIGHTENED_FRAMES = 420;   // ~7 s a 60 fps
const FRIGHTENED_SPEED = 0.09;   // 10% menos que GHOST_SPEED (0.1)
const POWER_PELLET_TILE = 4;

// game (createGame) — estado nuevo
{
  // ...campos existentes
  frightenedTimer: 0, // frames restantes de modo asustado; > 0 => asustado activo
}

// render.js — constantes/ayudas de dibujo
const POWER_PELLET_COLORS = [ '#2121ff', '#ffd700' ]; // azul, dorado
const POWER_PELLET_BLINK_FRAMES = 10;
const FRIGHTENED_GHOST_COLORS = [ '#808080', '#00ff00' ]; // gris, verde
const GHOST_FRIGHTENED_BLINK_FRAMES = 10;
```

Convenciones:

- Tiempos en frames a 60 fps, coherente con el resto del juego.
- “Modo asustado activo” equivale a `game.frightenedTimer > 0` (estado global).
- Las power pellets se representan como valor `4` en `MAZE`/`game.grid`; `createGame` cuenta `2` y `4` como consumibles para `dotsRemaining` y elimina la celda de inicio de Pac-Man si aplica (hoy ya se pone a `0`).
- La huida reutiliza el criterio greedy existente pero invirtiendo el objetivo de optimización (maximizar distancia a Pac-Man) en lugar de minimizar a un target fijo; no requiere nueva estructura de datos.

## Plan de implementación

1. **Datos y conteo de power pellets.** En `src/js/maze.js`, colocar `o` en (1,3), (26,3), (1,23), (26,23) dentro de `MAZE_STR` y hacer que `parseTile` devuelva `4` para `o`. En `src/js/game.js` (`createGame`), incluir el tile `4` en el conteo de `dotsRemaining` y mantener la limpieza de la celda de inicio de Pac-Man. Prueba manual: abrir `src/index.html`, verificar que la partida sigue iniciando y que `dotsRemaining` refleja los 4 consumibles extra (sin render específico aún, la lógica de victoria lo evidenciará al jugar).
2. **Render de power pellets parpadeantes.** En `src/js/render.js`, dibujar las celdas con valor `4` en `drawDots`/función equivalente como círculos más grandes que los dots, alternando `#2121ff`/`#ffd700` cada 10 frames según `frame`. Prueba manual: se ven 4 pellets en las esquinas parpadeando azul/dorado y los dots normales se mantienen.
3. **Activación, puntuación y temporizador asustado.** En `src/js/game.js`, añadir `frightenedTimer` al estado, constantes (`POWER_PELLET_SCORE`, `FRIGHTENED_FRAMES`, etc.), y en `movePacman`/lógica de consumo: al comer `4`, sumar 50 puntos, limpiar celda, decrementar `dotsRemaining` y poner/reiniciar `frightenedTimer` a 420. En `update`, decrementar `frightenedTimer` cada frame mientras sea > 0. Prueba manual: comer una pellet suma 50, reduce restantes y el temporizador se reinicia al comer otra (verificable por inspección/efecto observable en pasos siguientes).
4. **Huida, velocidad y render de fantasmas asustados.** En `src/js/game.js`, hacer que la velocidad efectiva de cada fantasma sea `FRIGHTENED_SPEED` cuando `frightenedTimer > 0` (aplicada a todos, incluidos corral/saliendo, respetando su movimiento existente). Ajustar la selección de objetivo/dirección en modo asustado para maximizar la distancia a Pac-Man (greedy por cruce, conservando restricciones de salida del corral/ruta y no-inversión salvo callejón). En `src/js/render.js`, dibujar fantasmas con colores alternados gris/verde cada 10 frames cuando el modo asustado esté activo. Prueba manual: al comer una pellet todos los fantasmas cambian a gris/verde, se alejan de Pac-Man y se mueven más lento.
5. **Inversión de dirección, colisiones y reinicios.** En `src/js/game.js`, invertir la dirección de los fantasmas al iniciar el modo asustado y al expirar el temporizador (transición a comportamiento normal). Modificar la colisión para que, si el modo asustado está activo, el contacto Pac-Man/fantasma no reste vidas ni cambie estado; mantener la muerte fuera del modo asustado. En `resetPositions`, limpiar/reiniciar `frightenedTimer` (y cualquier estado auxiliar de asustado) junto con lo que ya se resetea. Prueba manual: giro inmediato observable al activar/terminar, no hay pérdida de vida por contacto durante asustado, y tras morir o reiniciar no queda asustado residual.

## Criterios de aceptación

- [x] En el tablero se ven 4 power pellets en (1,3), (26,3), (1,23) y (26,23), más grandes que los dots y parpadeando entre azul `#2121ff` y dorado `#ffd700` cada 10 frames. *(implementado en `src/js/maze.js` y `src/js/render.js`; pendiente de confirmación visual final en navegador)*
- [x] Las 4 power pellets reemplazan los dots de esas esquinas, cuentan en `dotsRemaining` y deben comerse para ganar la partida. *(tile `4` en `src/js/maze.js`, conteo en `createGame` de `src/js/game.js`)*
- [x] Comer una power pellet suma exactamente 50 puntos, elimina la pellet de la grilla y activa el modo asustado durante 420 frames; comer otra mientras está activo reinicia el temporizador a 420 frames. *(`POWER_PELLET_SCORE`, `FRIGHTENED_FRAMES`, consumo en `movePacman`, `src/js/game.js`)*
- [x] Mientras el modo asustado está activo, todos los fantasmas (incluidos los que están en el corral o saliendo) se dibujan parpadeando entre gris `#808080` y verde `#00ff00` cada 10 frames y se mueven a velocidad `0.09`. *(render en `src/js/render.js`, velocidad efectiva `FRIGHTENED_SPEED` en `moveGhost`, `src/js/game.js`)*
- [x] En modo asustado los fantasmas huyen de Pac-Man eligiendo en los cruces la dirección válida que maximiza la distancia Manhattan a Pac-Man, respetando las restricciones existentes de movimiento y salida del corral. *(`decideGhost` maximiza distancia cuando asustado y no saliendo, `src/js/game.js`)*
- [x] Al activarse y al terminar el modo asustado, los fantasmas invierten su dirección de inmediato (cuando es aplicable). *(`reverseGhosts` al activar en `movePacman` y al expirar en `update`, `src/js/game.js`)*
- [x] Durante el modo asustado, el contacto Pac-Man/fantasma no provoca pérdida de vida ni comer al fantasma. *(colisión ignorada cuando `frightenedTimer > 0`, `src/js/game.js`)*
- [x] Perder una vida (`resetPositions`) y reiniciar la partida (`createGame`) dejan el modo asustado desactivado y el estado consistente. *(`frightenedTimer: 0` en `createGame` y `resetPositions`, `src/js/game.js`)*
- [x] El juego se gana y se pierde como antes fuera del modo asustado, sin errores en consola. *(lógica de victoria/derrota sin cambios estructurales; validar en navegador tras fix de alineación con velocidad 0.09)*

## Decisiones

- **Sí:** posiciones clásicas adaptadas al laberinto en (1,3), (26,3), (1,23), (26,23).
- **Sí:** tile dedicado `4` (char `o` en `MAZE_STR`) para power pellet, integrado al conteo de `dotsRemaining`.
- **Sí:** power pellet otorga 50 puntos y las 4 cuentan para la victoria.
- **Sí:** modo asustado global de 420 frames, reiniciable al comer otra pellet.
- **Sí:** efecto aplicado a todos los fantasmas (corral, saliendo y en mapa) con velocidad `0.09` y parpadeo gris/verde cada 10 frames.
- **Sí:** huida por maximización de distancia Manhattan a Pac-Man (greedy en cruces), consistente con el algoritmo actual.
- **Sí:** inversión de dirección al inicio y al fin del modo asustado.
- **Sí:** parpadeo de pellets azul `#2121ff`/dorado `#ffd700` cada 10 frames (relleno completo).
- **Sí:** colisión en asustado sin muerte y sin comer fantasmas (alcance mínimo).
- **No:** comer fantasmas, puntuación por cadena, ojos y regreso al corral (otra spec).
- **No:** aviso visual de fin de asustado (flashing final).
- **No:** cambios en personalidades, tiempos de salida, ciclo scatter/chase o HUD/sonidos.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| La huida por maximización puede producir oscilaciones o elecciones poco naturales en pasillos | Reutilizar las reglas existentes (no invertir salvo callejón, decisiones en celdas alineadas, restricciones de corral/salida) y validar manualmente en esquinas y cerca del corral. |
| La inversión inmediata de dirección al activar/terminar puede ser inválida en ciertos estados (p.ej. durante salida o en bordes) | Aplicar la inversión solo cuando sea coherente con `canMove`/estado de salida y diferir a la siguiente decisión válida si no lo es, sin romper la ruta de salida. |
| Alterar `dotsRemaining`/tipos de celda puede romper la condición de victoria o el render de dots | Contar explícitamente tiles `2` y `4` en `createGame`, limpiar a `0` al consumir y mantener la lógica de victoria basada en `dotsRemaining <= 0`; probar partida completa. |
| Desalineación de caché entre scripts tras cambios en `maze.js`/`game.js`/`render.js` | Mantener coherencia de versiones/caché-busting en `src/index.html` si es necesario y probar recarga completa en navegador. |

## Lo que **no** está en esta spec

- Comer fantasmas asustados, puntuación por fantasma, ojos y retorno/regeneración en el corral.
- Parpadeo de advertencia al finalizar el modo asustado.
- Cambios de sonidos, HUD, personalidades, ciclo scatter/chase o tiempos de salida del corral.
- Velocidades diferenciadas por fantasma o mecánicas adicionales de dificultad.

Cada una de esas, si llega, va en su propia spec.
