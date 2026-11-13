// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame

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

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    grid,
    time: 0,
    mode: 'scatter',
    modeIndex: 0,
    modeFrames: 0,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
      releaseAt: RELEASE_DELAY[ g.kind ] ?? 0,
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado solo por pared (1)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor === 'pacman' ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function inPen( g ) {
  const x = Math.round( g.x );
  const y = Math.round( g.y );
  return x >= PEN_RECT.x1 && x <= PEN_RECT.x2 && y >= PEN_RECT.y1 && y <= PEN_RECT.y2;
}

function inExitPath( g ) {
  const x = Math.round( g.x );
  const y = Math.round( g.y );
  return inPen( g ) || ( y === 12 && ( x === 13 || x === 14 ) );
}

function manhattan( ax, ay, bx, by ) {
  return Math.abs( ax - bx ) + Math.abs( ay - by );
}

function chaseTarget( game, g ) {
  const p = game.pacman;
  const px = Math.round( p.x );
  const py = Math.round( p.y );
  const pd = DIRS[ p.dir ] || DIRS.left;

  if ( g.kind === 'blinky' ) {
    return { x: px, y: py };
  }

  if ( g.kind === 'pinky' ) {
    return { x: px + pd.x * 4, y: py + pd.y * 4 };
  }

  if ( g.kind === 'inky' ) {
    const pivotX = px + pd.x * 2;
    const pivotY = py + pd.y * 2;
    const blinky = game.ghosts[ 0 ];
    const bx = Math.round( blinky.x );
    const by = Math.round( blinky.y );
    return { x: pivotX + ( pivotX - bx ), y: pivotY + ( pivotY - by ) };
  }

  if ( g.kind === 'clyde' ) {
    const gx = Math.round( g.x );
    const gy = Math.round( g.y );
    if ( manhattan( gx, gy, px, py ) > 8 ) return { x: px, y: py };
    return SCATTER_CORNERS.clyde;
  }

  return { x: px, y: py };
}

function ghostTarget( game, g ) {
  if ( inExitPath( g ) ) return PEN_EXIT;
  const px = Math.round( game.pacman.x );
  const py = Math.round( game.pacman.y );
  const fallback = { x: px, y: py };
  if ( game.mode === 'scatter' ) {
    return SCATTER_CORNERS[ g.kind ] || SCATTER_CORNERS.blinky || fallback;
  }
  return chaseTarget( game, g ) || fallback;
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

function decideGhost( game, g ) {
  const grid = game.grid;
  const px = Math.round( game.pacman.x );
  const py = Math.round( game.pacman.y );
  const target = ghostTarget( game, g ) || { x: px, y: py };

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = g.x + d.x;
    const ny = g.y + d.y;
    const dist = manhattan( nx, ny, target.x, target.y );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  g.dir = best;
}

function moveGhost( game, g ) {
  if ( game.time < g.releaseAt ) return;

  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;

  game.time = 0;
  game.mode = 'scatter';
  game.modeIndex = 0;
  game.modeFrames = 0;

  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    g.releaseAt = RELEASE_DELAY[ g.kind ] ?? 0;
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function updateMode( game ) {
  game.modeFrames++;
  const current = MODE_CYCLE[ game.modeIndex ];
  if ( game.modeFrames >= current.frames ) {
    game.modeFrames = 0;
    game.modeIndex = ( game.modeIndex + 1 ) % MODE_CYCLE.length;
    game.mode = MODE_CYCLE[ game.modeIndex ].mode;
  }
}

function update( game ) {
  game.time++;
  updateMode( game );

  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
