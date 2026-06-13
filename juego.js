// ============================================================
//  SPACE SHOOTER — 2 JUGADORES LOCAL
//  Jugador 1: A/D mover, W disparar  (nave azul, izquierda)
//  Jugador 2: ←/→ mover, ↑ disparar  (nave naranja, derecha)
// ============================================================


// --- 1. CANVAS Y ELEMENTOS HTML ---

const canvas = document.getElementById('juego');
const ctx    = canvas.getContext('2d');

const pantallaInicio  = document.getElementById('pantalla-inicio');
const pantallaFin     = document.getElementById('pantalla-fin');
const tituloFin       = document.getElementById('titulo-fin');
const puntosP1Fin     = document.getElementById('puntos-p1-fin');
const puntosP2Fin     = document.getElementById('puntos-p2-fin');
const btnJugar        = document.getElementById('btn-jugar');
const btnReiniciar    = document.getElementById('btn-reiniciar');

const ANCHO = canvas.width;   // 560
const ALTO  = canvas.height;  // 580


// --- 2. ESTADO DEL JUEGO ---

let jugadores, balas, enemigos, particulas;
let nivel, juegoActivo, animacionId;
let teclas = {};
let dirEnemigos, velocidadEnemigos;


// --- 3. DEFINICIÓN DE LOS DOS JUGADORES ---
// Cada jugador es un objeto con sus propiedades y controles

function crearJugadores() {
  return [
    {
      // Jugador 1 — azul — izquierda
      id:        1,
      x:         ANCHO / 4 - 20,
      y:         ALTO - 70,
      ancho:     40,
      alto:      32,
      velocidad: 5,
      vidas:     3,
      puntos:    0,
      color:     '#4af',
      colorCabina: '#8df',
      vivo:      true,
      cooldown:  0,
      // Teclas de control
      izquierda: 'a',
      derecha:   'd',
      disparo:   'w'
    },
    {
      // Jugador 2 — naranja — derecha
      id:        2,
      x:         (ANCHO / 4) * 3 - 20,
      y:         ALTO - 70,
      ancho:     40,
      alto:      32,
      velocidad: 5,
      vidas:     3,
      puntos:    0,
      color:     '#f84',
      colorCabina: '#fba',
      vivo:      true,
      cooldown:  0,
      izquierda: 'ArrowLeft',
      derecha:   'ArrowRight',
      disparo:   'ArrowUp'
    }
  ];
}


// --- 4. INICIAR / REINICIAR ---

function iniciarJuego() {
  jugadores         = crearJugadores();
  balas             = [];
  enemigos          = [];
  particulas        = [];
  nivel             = 1;
  dirEnemigos       = 1;
  velocidadEnemigos = 0.7;
  juegoActivo       = true;

  crearEnemigos();

  pantallaInicio.classList.add('oculto');
  pantallaFin.classList.add('oculto');

  cancelAnimationFrame(animacionId);
  animacionId = requestAnimationFrame(bucle);
}


// --- 5. CREAR OLEADA DE ENEMIGOS ---

function crearEnemigos() {
  const filas    = 3;
  const columnas = 9;

  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < columnas; c++) {
      enemigos.push({
        x:    20 + c * 58,
        y:    30 + f * 44,
        ancho: 32,
        alto:  22,
        tipo:  f,
        timerDisparo: 100 + Math.random() * 200
      });
    }
  }
}


// --- 6. BUCLE PRINCIPAL ---

function bucle() {
  if (!juegoActivo) return;
  actualizar();
  dibujar();
  animacionId = requestAnimationFrame(bucle);
}


// --- 7. ACTUALIZAR ---

function actualizar() {
  moverJugadores();
  moverBalas();
  moverEnemigos();
  enemigosDisparar();
  comprobarColisiones();
  actualizarParticulas();

  // Nueva oleada si no quedan enemigos
  if (enemigos.length === 0) {
    nivel++;
    velocidadEnemigos = Math.min(velocidadEnemigos + 0.35, 3.5);
    crearEnemigos();
  }
}


// --- 8. MOVER JUGADORES ---

function moverJugadores() {
  jugadores.forEach(j => {
    if (!j.vivo) return;

    if (teclas[j.izquierda]) j.x -= j.velocidad;
    if (teclas[j.derecha])   j.x += j.velocidad;

    // Limitar dentro del canvas
    j.x = Math.max(0, Math.min(ANCHO - j.ancho, j.x));

    // Disparo
    j.cooldown--;
    if (teclas[j.disparo] && j.cooldown <= 0) {
      balas.push({
        x:         j.x + j.ancho / 2 - 2,
        y:         j.y,
        ancho:     4,
        alto:      14,
        velocidad: 10,
        esJugador: true,
        jugadorId: j.id,   // para saber quién mató al enemigo
        color:     j.color
      });
      j.cooldown = 18;
    }
  });
}


// --- 9. MOVER BALAS ---

function moverBalas() {
  for (let i = balas.length - 1; i >= 0; i--) {
    balas[i].y -= balas[i].velocidad;
    if (balas[i].y < -20 || balas[i].y > ALTO + 20) {
      balas.splice(i, 1);
    }
  }
}


// --- 10. MOVER ENEMIGOS ---

function moverEnemigos() {
  let tocoBorde = false;

  enemigos.forEach(e => {
    e.x += dirEnemigos * velocidadEnemigos;
    if (e.x + e.ancho > ANCHO - 5 || e.x < 5) tocoBorde = true;
  });

  if (tocoBorde) {
    dirEnemigos *= -1;
    enemigos.forEach(e => { e.y += 16; });
  }
}


// --- 11. ENEMIGOS DISPARAN ---

function enemigosDisparar() {
  enemigos.forEach(e => {
    e.timerDisparo--;
    if (e.timerDisparo <= 0) {
      balas.push({
        x:         e.x + e.ancho / 2 - 2,
        y:         e.y + e.alto,
        ancho:     4,
        alto:      10,
        velocidad: -3.5,
        esJugador: false,
        color:     '#f55'
      });
      e.timerDisparo = 100 + Math.random() * 160;
    }
  });
}


// --- 12. COLISIONES ---

function seTocan(a, b) {
  return (
    a.x < b.x + b.ancho &&
    a.x + a.ancho > b.x &&
    a.y < b.y + b.alto &&
    a.y + a.alto > b.y
  );
}

function comprobarColisiones() {
  // Balas de jugadores contra enemigos
  for (let i = balas.length - 1; i >= 0; i--) {
    const b = balas[i];
    if (!b.esJugador) continue;

    for (let j = enemigos.length - 1; j >= 0; j--) {
      if (seTocan(b, enemigos[j])) {
        explotar(
          enemigos[j].x + enemigos[j].ancho / 2,
          enemigos[j].y + enemigos[j].alto / 2,
          '#f80', 10
        );
        // Dar puntos al jugador que disparó
        const jugador = jugadores.find(p => p.id === b.jugadorId);
        if (jugador) jugador.puntos += 10 * nivel;

        balas.splice(i, 1);
        enemigos.splice(j, 1);
        break;
      }
    }
  }

  // Balas enemigas contra jugadores
  for (let i = balas.length - 1; i >= 0; i--) {
    const b = balas[i];
    if (b.esJugador) continue;

    jugadores.forEach(j => {
      if (!j.vivo) return;
      if (seTocan(b, j)) {
        explotar(j.x + j.ancho / 2, j.y + j.alto / 2, j.color, 14);
        balas.splice(balas.indexOf(b), 1);
        j.vidas--;

        if (j.vidas <= 0) {
          j.vivo = false;
          // ¿Los dos han muerto?
          if (jugadores.every(p => !p.vivo)) {
            terminarJuego();
          }
        }
      }
    });
  }

  // Enemigos llegan abajo
  if (enemigos.some(e => e.y + e.alto >= ALTO - 60)) {
    terminarJuego();
  }
}


// --- 13. PARTÍCULAS ---

function explotar(x, y, color, cantidad) {
  for (let i = 0; i < cantidad; i++) {
    const angulo = Math.random() * Math.PI * 2;
    const fuerza = 1 + Math.random() * 3;
    particulas.push({
      x, y,
      vx: Math.cos(angulo) * fuerza,
      vy: Math.sin(angulo) * fuerza,
      vida: 1,
      color,
      tamaño: 2 + Math.random() * 3
    });
  }
}

function actualizarParticulas() {
  for (let i = particulas.length - 1; i >= 0; i--) {
    particulas[i].x    += particulas[i].vx;
    particulas[i].y    += particulas[i].vy;
    particulas[i].vida -= 0.04;
    if (particulas[i].vida <= 0) particulas.splice(i, 1);
  }
}


// --- 14. DIBUJAR ---

function dibujar() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, ANCHO, ALTO);

  dibujarEstrellas();
  dibujarEnemigos();
  dibujarBalas();
  jugadores.forEach(j => { if (j.vivo) dibujarJugador(j); });
  dibujarParticulas();
  dibujarHUD();
}

function dibujarEstrellas() {
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 55; i++) {
    const x = (i * 137) % ANCHO;
    const y = (i * 97 + Date.now() * 0.02 * (i % 3 + 1)) % ALTO;
    ctx.fillRect(x, y, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1);
  }
}

function dibujarJugador(p) {
  // Cuerpo
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.moveTo(p.x + p.ancho / 2, p.y);
  ctx.lineTo(p.x + p.ancho,     p.y + p.alto);
  ctx.lineTo(p.x + p.ancho * 0.65, p.y + p.alto * 0.7);
  ctx.lineTo(p.x + p.ancho * 0.35, p.y + p.alto * 0.7);
  ctx.lineTo(p.x,                  p.y + p.alto);
  ctx.closePath();
  ctx.fill();

  // Cabina
  ctx.fillStyle = p.colorCabina;
  ctx.fillRect(p.x + p.ancho * 0.35, p.y + p.alto * 0.15, p.ancho * 0.3, p.alto * 0.45);

  // Motor
  ctx.fillStyle = '#f80';
  ctx.fillRect(p.x + p.ancho * 0.38, p.y + p.alto, 5, 8);
  ctx.fillRect(p.x + p.ancho * 0.60, p.y + p.alto, 5, 8);

  // Etiqueta P1 / P2 debajo de la nave
  ctx.fillStyle = p.color;
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`P${p.id}`, p.x + p.ancho / 2, p.y + p.alto + 22);
  ctx.textAlign = 'left';
}

function dibujarEnemigos() {
  const colores = ['#f44', '#f80', '#fa0'];
  enemigos.forEach(e => {
    ctx.fillStyle = colores[e.tipo] || '#f44';
    ctx.beginPath();
    ctx.moveTo(e.x + e.ancho / 2, e.y + e.alto);
    ctx.lineTo(e.x,               e.y + e.alto * 0.4);
    ctx.lineTo(e.x + e.ancho * 0.15, e.y);
    ctx.lineTo(e.x + e.ancho * 0.85, e.y);
    ctx.lineTo(e.x + e.ancho,    e.y + e.alto * 0.4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(e.x + e.ancho * 0.33, e.y + e.alto * 0.35, 4, 0, Math.PI * 2);
    ctx.arc(e.x + e.ancho * 0.67, e.y + e.alto * 0.35, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

function dibujarBalas() {
  balas.forEach(b => {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.ancho, b.alto);
    // Estela
    ctx.globalAlpha = 0.3;
    ctx.fillRect(b.x, b.y + b.alto, b.ancho, 8);
    ctx.globalAlpha = 1;
  });
}

function dibujarParticulas() {
  particulas.forEach(p => {
    ctx.globalAlpha = p.vida;
    ctx.fillStyle   = p.color;
    ctx.fillRect(p.x, p.y, p.tamaño, p.tamaño);
  });
  ctx.globalAlpha = 1;
}

function dibujarHUD() {
  const corazones = ['💀', '❤️', '❤️❤️', '❤️❤️❤️'];

  // Jugador 1 (izquierda)
  const p1 = jugadores[0];
  ctx.fillStyle = p1.vivo ? p1.color : '#555';
  ctx.font = '13px monospace';
  ctx.fillText(`P1: ${p1.puntos} pts`, 10, 20);
  ctx.font = '12px monospace';
  ctx.fillText(corazones[Math.max(0, p1.vidas)], 10, 38);

  // Jugador 2 (derecha)
  const p2 = jugadores[1];
  ctx.fillStyle = p2.vivo ? p2.color : '#555';
  ctx.font = '13px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`P2: ${p2.puntos} pts`, ANCHO - 10, 20);
  ctx.font = '12px monospace';
  ctx.fillText(corazones[Math.max(0, p2.vidas)], ANCHO - 10, 38);
  ctx.textAlign = 'left';

  // Nivel (centro)
  ctx.fillStyle = '#888';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${nivel}`, ANCHO / 2, 20);
  ctx.textAlign = 'left';

  // Jugador muerto — mensaje en pantalla
  jugadores.forEach(j => {
    if (!j.vivo) {
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = j.color;
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`P${j.id} ELIMINADO`, ANCHO / 2, ALTO / 2 + (j.id === 1 ? -10 : 10));
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    }
  });
}


// --- 15. FIN DEL JUEGO ---

function terminarJuego() {
  juegoActivo = false;
  cancelAnimationFrame(animacionId);

  const p1 = jugadores[0];
  const p2 = jugadores[1];

  // Determinar ganador
  let titulo;
  if (!p1.vivo && !p2.vivo) {
    titulo = '💀 LOS DOS ELIMINADOS';
  } else if (p1.puntos > p2.puntos) {
    titulo = '🏆 GANA JUGADOR 1';
  } else if (p2.puntos > p1.puntos) {
    titulo = '🏆 GANA JUGADOR 2';
  } else {
    titulo = '🤝 EMPATE';
  }

  tituloFin.textContent  = titulo;
  puntosP1Fin.textContent = `${p1.puntos} pts`;
  puntosP2Fin.textContent = `${p2.puntos} pts`;
  pantallaFin.classList.remove('oculto');
}


// --- 16. TECLADO ---

document.addEventListener('keydown', e => {
  teclas[e.key] = true;
  // Evitar scroll con flechas y espacio
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) {
    e.preventDefault();
  }
});

document.addEventListener('keyup', e => {
  teclas[e.key] = false;
});


// --- 17. BOTONES ---

btnJugar.addEventListener('click', iniciarJuego);
btnReiniciar.addEventListener('click', iniciarJuego);
