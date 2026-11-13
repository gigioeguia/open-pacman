# SPEC 04 — Comer fantasmas asustados y retorno al corral

> **Estado:** Aprovada  
> **Depende de:** SPEC 03 — Power pellets y modo asustado  
> **Fecha:** 2026-11-12  
> **Objetivo:** Permitir que Pac-Man coma fantasmas durante el modo asustado, otorgando puntuación progresiva, mostrando el puntaje y haciendo que los fantasmas regresen como ojos al corral para reaparecer y reintegrarse al juego.

## Por qué existe esta spec

SPEC 03 introduce power pellets y el modo asustado, pero el contacto Pac-Man/fantasma en ese estado no tiene efecto (no mata ni come). Esta spec completa el ciclo clásico: comer fantasmas asustados, puntuar por cada uno, retornar al corral en modo ojos y reanudar su participación en la partida sin alterar el ciclo global scatter/chase.

## Alcance

**In:**

- Durante el **modo asustado activo** (`game.frightenedTimer > 0`), Pac-Man puede **comer** un fantasma al colisionar con él si el fantasma **no está en modo ojos** y **no está saliendo/dentro del corral** (es decir, no está en ruta de salida/interior según la lógica existente; debe estar en el mapa jugable). No se puede comer un fantasma en modo ojos ni fuera de estas condiciones.
- **Puntuación progresiva por periodo de asustado:** el 1.º, 2.º, 3.º y 4.º fantasma comido dentro del **mismo** periodo de asustado otorgan **200, 400, 800 y 1600** puntos respectivamente, sumados a `game.score`. El contador de secuencia se **reinicia** al comer una nueva power pellet (que también reinicia `frightenedTimer` según SPEC 03).
- **Popup de puntaje:** al comer un fantasma se muestra el valor obtenido (200/400/800/1600) en la posición donde fue comido durante **60 frames (~1 s)**. El juego **sigue corriendo** (sin pausa). Los popups no bloquean la lógica ni la colisión.
- **Modo ojos (fantasma comido):** al ser comido, el fantasma pasa a estado **ojos**: deja de huir en modo asustado, **no es peligroso** (no mata a Pac-Man), **no puede ser comido de nuevo**, y se renderiza como ojos (ver Visualización). Abandona el objetivo de huida/scatter/chase normal mientras está en ojos.
- **Retorno al corral (pathfinding):** el fantasma en ojos navega por el laberinto (sin teletransporte) con objetivo primero **`PEN_EXIT` (13,11)** y luego su **posición inicial en `GHOST_STARTS` según su `kind`** (casilla de “llegada”). La velocidad de retorno es **`0.2` celdas/frame** (2× `GHOST_SPEED`) durante todo el trayecto, **incluido el tramo dentro del corral**. Usa la navegación/pathfinding existente adaptada al objetivo de retorno, respetando las reglas de movimiento por celdas y muros para fantasmas.
- **Llegada y reaparición:** al alcanzar la casilla de llegada (`GHOST_STARTS` de su `kind`), el fantasma **reaparece inmediatamente** allí, finaliza el modo ojos y vuelve a estado normal.
- **Reintegración inmediata:** tras reaparecer en su posición del corral, el fantasma **sale de inmediato** hacia `PEN_EXIT`/mapa usando la misma lógica de salida del corral (`isExiting`/pathfinding a `PEN_EXIT`) ya existente, **sin** nuevo retardo de liberación relativo a `game.time`. No se reinicia la partida, ni `game.time`, ni el ciclo global **scatter/chase** (`mode`, `modeIndex`, `modeFrames`), ni el `frightenedTimer` global (sigue corriendo normalmente durante el retorno de ojos).
- **Interacción con asustado global:** si `frightenedTimer` expira mientras hay fantasmas en ojos, estos continúan su retorno hasta llegar y reaparecer; los fantasmas no comidos vuelven a comportamiento normal según SPEC 03. Comer una nueva power pellet reinicia el temporizador asustado y la secuencia de puntuación (1.a), pero no revierte fantasmas que ya están en ojos.
- **Reinicio:** `createGame` y `resetPositions` limpian el estado de ojos, contadores de puntuación de asustado y popups activos, dejando una partida/vida en estado consistente.

**Out of scope (para futuras specs):**

- Pausa breve (“freeze”) al comer un fantasma.
- Sonido, HUD adicional o animaciones distintas al popup de texto indicado.
- Cambios en duración/velocidad del modo asustado, personalidades, scatter/chase, laberinto o tiempos de salida iniciales, salvo lo imprescindible para la reintegración descrita.
- Puntajes o comportamientos distintos a 200/400/800/1600 por periodo de asustado.

## Modelo de datos

```js
// game.js — constantes nuevas
const GHOST_EAT_SCORES = [ 200, 400, 800, 1600 ];
const EYES_SPEED = 0.2;        // 2x GHOST_SPEED, incluye tramo dentro del corral
const GHOST_SCORE_POPUP_FRAMES = 60;

// game (createGame) — estado nuevo/extendido
{
  // ...campos existentes (incl. frightenedTimer de SPEC 03)
  frightenedEatenCount: 0, // fantasmas comidos en el periodo de asustado actual (0..4)
  ghostScorePopups: [
    // { x, y, score, timer } — posición (celda/mundo) y frames restantes
  ],
}

// ghost — estado extendido (por fantasma)
{
  // ...campos existentes (x,y,dir,speed,kind,releaseAt)
  eyes: false, // true => retornando al corral como ojos
}

// render.js — apoyo visual (valores concretos a definir en implementación)
// - Fantasma con eyes === true: dibujar solo ojos/pupilas (sin cuerpo de color normal/asustado)
// - Popup: texto del score (200/400/800/1600) en (x,y) del fantasma comido durante GHOST_SCORE_POPUP_FRAMES
```

Convenciones:

- “Comible” durante asustado: `frightenedTimer > 0 && !g.eyes && !isExiting(g)` (y no en interior/ruta de corral según la lógica de salida; coherente con “no está saliendo/dentro del corral”).
- Secuencia de puntuación: índice `frightenedEatenCount` antes de incrementar, limitado al último valor si se excede (defensivo).
- Objetivo en ojos: fase 1 `PEN_EXIT` (13,11) mientras no se haya alcanzado para entrar; fase 2 `GHOST_STARTS` del `kind` hasta llegada exacta/alineada a esa casilla. Al llegar: `eyes = false`, reposicionar a `GHOST_STARTS[kind]`, `dir` coherente para salida inmediata y estado que haga `isExiting`/ruta de salida válida sin depender de `releaseAt`.
- Popups en coordenadas de juego; el render los dibuja y `update` decrementa/elimina timers.
- `resetPositions`: además de lo actual, poner `frightenedTimer = 0` (SPEC 03), `frightenedEatenCount = 0`, vaciar `ghostScorePopups` y limpiar `eyes`/posiciones/direcciones de fantasmas a estado inicial.

## Plan de implementación

1. **Estado y puntuación base.** En `src/js/game.js`, añadir constantes (`GHOST_EAT_SCORES`, `EYES_SPEED`, `GHOST_SCORE_POPUP_FRAMES`) y extender `createGame` con `frightenedEatenCount` y `ghostScorePopups`; extender cada fantasma con `eyes: false`. Al activar/reiniciar asustado por power pellet, reiniciar `frightenedEatenCount`. En `resetPositions`, limpiar contadores, popups y flags de ojos. Prueba manual: sin regresiones, partida inicia y reinicia correctamente.
2. **Comer fantasmas y popup.** En `src/js/game.js`, en la resolución de colisiones, si el fantasma es comible en asustado (asustado activo, sin ojos, fuera de corral/salida), marcarlo `eyes = true`, sumar el score correspondiente según `frightenedEatenCount`, incrementar el contador, crear popup `{x,y,score,timer}` y **no** restar vida ni llamar `resetPositions`; si está asustado pero en ojos o no comible, mantener sin daño. En `update`, decrementar y purgar popups expirados. Prueba manual: comer fantasmas otorga 200/400/800/1600 en el mismo periodo y se reinicia la secuencia al tomar otra power pellet.
3. **Retorno de ojos al corral y reintegración.** En `src/js/game.js`, implementar movimiento/targeting en modo ojos: velocidad `EYES_SPEED`, objetivo `PEN_EXIT` y luego `GHOST_STARTS[kind]`, ignorando huida/scatter/chase mientras `eyes`. Al llegar a la casilla inicial del `kind`, limpiar `eyes`, colocar en esa posición y configurar estado de salida inmediata (pathfinding/lógica de salida existente, sin `releaseAt` bloqueante) preservando el ciclo scatter/chase global. Asegurar que ojos no son peligrosos ni comibles. Prueba manual: fantasmas comidos vuelven como ojos al corral, reaparecen y salen de inmediato al mapa.
4. **Render de ojos y popups.** En `src/js/render.js`, dibujar fantasmas con `eyes === true` como solo ojos (sin cuerpo asustado/normal) y renderizar los popups de score en su posición durante su timer (texto legible, p.ej. encima del punto de colisión). Mantener parpadeo/colores de asustado para fantasmas no-ojos según SPEC 03. Prueba manual: se ven ojos retornando y los valores 200/400/800/1600 ~1 s sin pausar el juego.
5. **Ajustes de robustez y verificación.** Revisar interacciones de borde: expiración de asustado con ojos en ruta, comer varios fantasmas, colisiones simultáneas, reinicio por muerte/partida y que no se altere scatter/chase global. Ajustes mínimos en `src/js/game.js`/`src/js/render.js`/`src/js/maze.js` solo si son estrictamente necesarios. Prueba manual: ejecutar todos los criterios de aceptación sin errores en consola.

## Criterios de aceptación

- [ ] En modo asustado activo, Pac-Man puede comer un fantasma comible (no en ojos y no saliendo/dentro del corral) al colisionar, sin perder vida.
- [ ] Los puntos otorgados por fantasmas comidos en un mismo periodo de asustado son 200, 400, 800 y 1600 en secuencia; al comer una nueva power pellet la secuencia se reinicia y el asustado se reinicia según SPEC 03.
- [ ] Al comer un fantasma se muestra su puntaje (200/400/800/1600) en la posición del fantasma durante 60 frames (~1 s) y el juego continúa sin pausa.
- [ ] Un fantasma comido pasa a modo ojos, no es peligroso, no puede volver a comerse y deja de comportarse como fantasma asustado/normal mientras retorna.
- [ ] El fantasma en ojos regresa por pathfinding a `PEN_EXIT` (13,11) y luego a su `GHOST_STARTS` de `kind` a velocidad `0.2` celdas/frame (incluido dentro del corral), sin teletransporte.
- [ ] Al llegar a su casilla inicial, el fantasma reaparece inmediatamente, sale de inmediato hacia `PEN_EXIT`/mapa con la lógica de salida existente (sin nuevo retardo de liberación) y se reintegra al juego.
- [ ] El `frightenedTimer` global y el ciclo scatter/chase global se mantienen coherentes; la expiración del asustado no interrumpe el retorno de ojos.
- [ ] `createGame` y `resetPositions` dejan sin ojos activos, sin popups y con contadores de comida en asustado reiniciados.
- [ ] El juego se gana y se pierde como antes, sin errores en consola.

## Decisiones

- **Sí:** puntuación 200/400/800/1600 por periodo de asustado, reiniciada al comer nueva power pellet (1.a).
- **Sí:** flujo ojos → retorno por pathfinding a `PEN_EXIT` y luego a `GHOST_STARTS[kind]` → reaparición inmediata (2 sí, 1).
- **Sí:** velocidad de ojos `0.2` celdas/frame en todo el retorno, ojos no comibles y no peligrosos, `frightenedTimer` global continúa (3.a, 5).
- **Sí:** reintegración con salida inmediata por lógica de salida existente, sin retardo de liberación y sin alterar scatter/chase global (4.a).
- **Sí:** solo comibles si asustado activo, sin ojos y fuera de corral/salida (3).
- **Sí:** popup de puntaje en posición del fantasma durante 60 frames, sin pausa (4, 5.a).
- **No:** pausa/freeze al comer fantasmas.
- **No:** cambios de audio/HUD adicionales o mecánicas fuera de alcance.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| El retorno de ojos puede interferir con la lógica de corral/puerta (`inPen`, `inExitPath`, tile 3) | Reutilizar y acotar las reglas de movimiento/salida existentes, definiendo claramente el objetivo por fases (PEN_EXIT → home) y probando entrada/salida del corral. |
| Estados combinados (asustado expira durante retorno, múltiples comidos, reinicios) pueden dejar flags inconsistentes | Centralizar transiciones de estado del fantasma (normal ↔ asustado-comible ↔ ojos → salida) y limpiar todo en `createGame`/`resetPositions`. |
| La velocidad `0.2` puede agravar problemas de alineación en la grilla | Aplicar el mismo tratamiento de cruce/snap de celdas usado para movimientos con velocidades no alineadas y validar llegadas exactas a casillas objetivo. |
| Popups múltiples pueden ensuciar render o lógica | Gestionar `ghostScorePopups` como lista con timer decreciente y eliminación determinista por frame. |

## Lo que **no** está en esta spec

- Pausa breve al comer fantasmas.
- Sonidos, animaciones adicionales o cambios de HUD no especificados.
- Cambios en reglas de asustado (duración/parpadeo final), personalidades, scatter/chase o laberinto.
- Mecánicas de bonus o puntuaciones distintas a 200/400/800/1600.

Cada una de esas, si llega, va en su propia spec.
