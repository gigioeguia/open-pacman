# SPEC 01 — Cuatro fantasmas con personalidad

> **Estado:** Completada
> **Depende de:** ninguna (primera spec del proyecto)
> **Fecha:** 2026-11-09
> **Objetivo:** Reemplazar los 2 fantasmas actuales por los 4 clásicos del arcade —Blinky agresivo, Pinky emboscador, Inky flanqueador y Clyde tímido— con salida escalonada del corral y ciclo global scatter/chase.

## Por qué existe esta spec

La IA actual de `decideGhost` (`src/js/game.js`) es binaria: `hunter` persigue y `random` vaga. El arcade original consigue personalidades con un único algoritmo: en cada cruce, cada fantasma elige la dirección válida (sin invertir) que minimiza su distancia Manhattan a una **casilla objetivo** propia. La personalidad vive solo en cómo se calcula esa casilla. Esta spec adopta ese modelo y elimina la rama aleatoria.

## Alcance

**In:**

- 4 fantasmas con `kind` propio en `GHOST_STARTS` (`src/js/maze.js`) y color por `kind` en `GHOST_COLORS` (`src/js/render.js`):
  - **blinky** (rojo, el agresivo): objetivo = casilla de Pac-Man.
  - **pinky** (rosa): objetivo = 4 casillas delante de Pac-Man según su dirección actual.
  - **inky** (cian): objetivo = espejo de blinky respecto a un pivote situado 2 casillas delante de Pac-Man.
  - **clyde** (naranja): objetivo = casilla de Pac-Man si dista más de 8 casillas; si no, su esquina.
- Salida escalonada del corral por tiempo: blinky fuera desde el frame 0; pinky a los 120 frames (~2 s); inky a los 360 (~6 s); clyde a los 600 (~10 s).
- Ciclo global scatter/chase: 420 frames (~7 s) de scatter —cada fantasma va a su esquina— y 1200 (~20 s) de chase —aplica su personalidad—, en bucle.
- Mientras un fantasma espera en el corral, oscila verticalmente (solo visual).
- Dentro del corral, el objetivo de un fantasma liberado es la casilla de salida (13, 11).
- `resetPositions` reinicia posiciones, salidas y el ciclo scatter/chase tras perder una vida.

**Out of scope (para specs futuras):**

- Power pellets y modo frightened (huir, comer fantasmas, ojos de regreso al corral).
- "Cruise Elroy" (blinky acelera quedando pocos dots) y velocidades distintas por fantasma.
- Salida del corral por dots comidos (contadores del arcade original).
- Sonidos, HUD nuevo o cambios de laberinto.

## Modelo de datos

```js
// maze.js — GHOST_STARTS pasa de 2 a 4 entradas
const GHOST_STARTS = [
  { x: 13, y: 11, kind: 'blinky' }, // fuera del corral, sobre la puerta
  { x: 13, y: 14, kind: 'pinky'  }, // centro del corral
  { x: 11, y: 14, kind: 'inky'   }, // izquierda del corral
  { x: 15, y: 14, kind: 'clyde'  }, // derecha del corral
];

// game.js — constantes nuevas
const RELEASE_DELAY = { blinky: 0, pinky: 120, inky: 360, clyde: 600 }; // frames
const SCATTER_CORNERS = {
  blinky: { x: 26, y: 1 },
  pinky:  { x: 1,  y: 1 },
  inky:   { x: 26, y: 29 },
  clyde:  { x: 1,  y: 29 },
};
const MODE_CYCLE = [
  { mode: 'scatter', frames: 420 },
  { mode: 'chase',   frames: 1200 },
];
const PEN_EXIT = { x: 13, y: 11 };                    // casilla sobre la puerta
const PEN_RECT = { x1: 11, x2: 16, y1: 13, y2: 15 };  // interior del corral

// game (createGame) — campos nuevos
{
  time: 0,        // frames jugados
  mode: 'scatter',
  modeIndex: 0,
  modeFrames: 0,
  ghosts: [ /* cada fantasma añade */ {
    releaseAt: RELEASE_DELAY[ g.kind ], // frame en que sale del corral
  } ],
}

// render.js — color por kind en lugar de por índice
const GHOST_COLORS = {
  blinky: '#ff0000',
  pinky:  '#ffb8ff',
  inky:   '#00ffff',
  clyde:  '#ffb852',
};
```

Convenciones:

- Tiempos en frames a 60 fps (1 s = 60 frames), igual que las velocidades existentes (`PACMAN_SPEED`).
- Distancias Manhattan en celdas.
- Una casilla objetivo puede no ser transitable (p. ej. "4 delante" cayendo en una pared): el algoritmo solo compara distancias, nunca pisa esa celda.
- `inky` usa `game.ghosts[ 0 ]` (blinky) para calcular su espejo.

## Plan de implementación

1. **4 fantasmas visibles.** En `src/js/maze.js`, `GHOST_STARTS` con los 4 kinds; en `src/js/render.js`, `GHOST_COLORS` como mapa por kind. Prueba manual: abrir `src/index.html` y ver 4 fantasmas de colores distintos desde el frame 1; el juego es jugable (los kinds nuevos aún caen en la rama aleatoria de `decideGhost`).
2. **IA por casilla objetivo (chase).** En `src/js/game.js`, refactorizar `decideGhost`: función `chaseTarget( game, g )` con las 4 personalidades y una única elección greedy que generaliza el bucle de distancia que hoy tiene `hunter`. Eliminar la rama `random`. Prueba manual: blinky pega a Pac-Man, pinky le corta el paso, clyde se retira al acercarse.
3. **Salida escalonada del corral.** `game.time`, `g.releaseAt`, saltar el movimiento de fantasmas no liberados en `update`, objetivo fijo `PEN_EXIT` mientras `inPen( g )`, y oscilación vertical de espera en `src/js/render.js`. Prueba manual: blinky fuera de inmediato; pinky, inky y clyde salen a ~2 s, ~6 s y ~10 s sin atascarse.
4. **Ciclo scatter/chase y reinicio.** `game.mode`, `game.modeIndex` y `game.modeFrames` con `MODE_CYCLE` y `SCATTER_CORNERS`; `resetPositions` reinicia también `time`, el ciclo y los `releaseAt`. Prueba manual: los 4 van a su esquina ~7 s, luego persiguen ~20 s y el ciclo se repite; tras morir todo se reinicia.

## Criterios de aceptación

- [x] Al iniciar se ven 4 fantasmas: rojo, rosa, cian y naranja.
- [x] blinky elige siempre la dirección que minimiza la distancia a la casilla de Pac-Man (sin aleatoriedad).
- [x] pinky apunta 4 casillas delante de la dirección de movimiento de Pac-Man.
- [x] inky calcula su objetivo como espejo de blinky respecto al pivote 2 casillas delante de Pac-Man (verificable en `chaseTarget`).
- [x] clyde va a su esquina cuando está a 8 casillas o menos de Pac-Man, y vuelve a perseguir al alejarse.
- [x] blinky está fuera del corral desde el frame 0; pinky, inky y clyde salen a ~2 s, ~6 s y ~10 s.
- [x] Los fantasmas en espera oscilan dentro del corral sin atravesar paredes.
- [x] Durante scatter los 4 se dirigen cada uno a su esquina y al terminar persiguen; el ciclo se repite indefinidamente.
- [x] Perder una vida reinicia posiciones, salidas escalonadas y ciclo scatter/chase.
- [x] Ningún fantasma se atasca de forma permanente (el giro de 180º en callejón sigue funcionando).
- [x] El juego se gana y se pierde como antes, sin errores en consola.

## Decisiones

- **Sí: personalidades clásicas por casilla objetivo.** Un solo algoritmo greedy para todos; la personalidad está en el cálculo del objetivo. DRY y fiel al arcade.
- **Sí: salida escalonada por tiempo (frames).** Simple de implementar y de verificar; la salida por dots del arcade queda aplazada.
- **Sí: ciclo scatter/chase simple (420/1200 frames en bucle).** Regula la dificultad ahora que hay 4 cazadores activos.
- **Sí: color por `kind` en render.** Mapa `GHOST_COLORS[ kind ]` en vez de índice: robusto si se reordena `GHOST_STARTS`.
- **Sí: toda la IA en `src/js/game.js`.** Según AGENTS.md, `game.js` es "estado y reglas" sin DOM; un `ghosts.js` crearía dependencia circular entre scripts clásicos por el orden de carga.
- **Sí: reinicio completo tras perder vida (posiciones, salidas y ciclo).** Comportamiento clásico y estado más simple que conservar ciclos a medias.
- **No: modo frightened / power pellets.** Sistema completo aparte (huir, comer, ojos, puntos); merece spec propia.
- **No: reproducir el bug del arcade con pinky mirando arriba.** Implementamos el comportamiento "intendido" (4 casillas delante de la dirección actual); es más simple de explicar y depurar.
- **No: velocidades distintas ni "Cruise Elroy".** "Agresivo" se define por el objetivo directo de blinky, no por velocidad; menos variables de balance en la primera versión.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| El greedy sin invertir podría atascar la salida del corral | El interior del corral es un rectángulo abierto y el objetivo dentro de él es fijo (`PEN_EXIT`); el giro de 180º en callejón ya existe. |
| 4 cazadores activos pueden hacer el juego muy difícil | El ciclo scatter da respiros periódicos y solo blinky fija la casilla de Pac-Man. |
| `requestAnimationFrame` no siempre corre a 60 fps | Todo el juego ya mide en frames (`PACMAN_SPEED`); la exactitud por delta-time, si se desea, es otra spec. |
| Caché desalineada entre scripts (`game.js` nuevo con `maze.js` antiguo) puede dejar `kind`/objetivo indefinido y congelar el juego (p. ej. `target` undefined en `decideGhost`) | Versionado/caché-busting conjunto de scripts dependientes en `src/index.html` (`?v=2`) y defensas en `src/js/game.js`: `releaseAt` por defecto, `ghostTarget` siempre devuelve un objetivo válido y `decideGhost` usa fallback antes de calcular distancias. |
| Fantasma liberado puede quedar en bucle en la puerta si al llegar a las celdas de puerta (`y=12`, `x=13|14`) cambia a su objetivo normal antes de cruzar a la salida | `ghostTarget` mantiene `PEN_EXIT` mientras el fantasma esté en el corral o en la ruta de salida (`inExitPath`: interior del corral o celdas de puerta), hasta alcanzar la casilla de salida. |

## Lo que **no** está en esta spec

- Power pellets, modo frightened y comer fantasmas.
- "Cruise Elroy" y velocidades por fantasma.
- Salida del corral por dots comidos.
- Sonidos o cambios de HUD o laberinto.

Cada una de esas, si llega, va en su propia spec.
