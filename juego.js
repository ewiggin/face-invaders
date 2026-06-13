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

const pantallaCamara   = document.getElementById('pantalla-camara');
const videoCamara      = document.getElementById('video-camara');
const instruccionFoto  = document.getElementById('instruccion-foto');
const cuentaAtrasEl    = document.getElementById('cuenta-atras');
const miniaturasFotos  = document.getElementById('miniaturas-fotos');
const btnOmitirCamara  = document.getElementById('btn-omitir-camara');

const ANCHO = canvas.width;   // 560
const ALTO  = canvas.height;  // 580


// --- 1B. SONIDO ---

const musicaFondo = new Audio('music.mp3');
musicaFondo.loop   = true;
musicaFondo.volume = 0.35;

const sonidoGolpeJefe = new Audio('hitboss.mp3');
sonidoGolpeJefe.volume = 0.6;

const sonidoJefeMuere = new Audio('bossdead.mp3');
sonidoJefeMuere.volume = 0.7;

// Permite que un sonido se solape con su propia reproducción anterior
function reproducir(audio) {
  const copia = audio.cloneNode();
  copia.volume = audio.volume;
  copia.play().catch(() => {});
}


// --- 2. ESTADO DEL JUEGO ---

let jugadores, balas, enemigos, particulas, items;
let nivel, juegoActivo, animacionId;
let teclas = {};
let dirEnemigos, velocidadEnemigos, timerItem, timerRevivir, timerEscudo;

// Fotos del jugador para el jefe: [normal, golpe, muerte]
let fotosJefe       = [];
let streamCamara    = null;
let capturaCancelada = false;


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
      invulnerable: 0,
      escudo:    0,
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
      invulnerable: 0,
      escudo:    0,
      izquierda: 'ArrowLeft',
      derecha:   'ArrowRight',
      disparo:   'ArrowUp'
    }
  ];
}


// --- 3B. CÁMARA: CAPTURA DE FOTOS PARA EL JEFE ---

const INSTRUCCIONES_FOTO = [
  'Foto 1/4 — Pose NORMAL del jefe (A). Mira al frente con cara tranquila.',
  'Foto 2/4 — Pose NORMAL del jefe (B). Otra expresión tranquila distinta: el jefe irá alternando entre esta y la foto 1.',
  'Foto 3/4 — Cara de IMPACTO. Pon cara de dolor o sorpresa, ¡el jefe la pondrá al recibir un golpe!',
  'Foto 4/4 — Cara de DERROTA. Pon cara de fuera de combate, ¡el jefe la pondrá al morir!'
];

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function cuentaAtras(segundos) {
  for (let i = segundos; i >= 1; i--) {
    cuentaAtrasEl.textContent = i;
    await esperar(700);
    if (capturaCancelada) return;
  }
  cuentaAtrasEl.textContent = '📸';
  await esperar(250);
  cuentaAtrasEl.textContent = '';
}

function capturarFotograma() {
  const lado = Math.min(videoCamara.videoWidth, videoCamara.videoHeight);
  const sx   = (videoCamara.videoWidth  - lado) / 2;
  const sy   = (videoCamara.videoHeight - lado) / 2;

  const lienzo = document.createElement('canvas');
  lienzo.width  = 160;
  lienzo.height = 160;

  const lctx = lienzo.getContext('2d');
  // Espejar horizontalmente para que coincida con la previsualización
  lctx.translate(160, 0);
  lctx.scale(-1, 1);
  lctx.drawImage(videoCamara, sx, sy, lado, lado, 0, 0, 160, 160);

  return lienzo;
}

function agregarMiniatura(lienzo) {
  const img = document.createElement('img');
  img.src = lienzo.toDataURL('image/png');
  miniaturasFotos.appendChild(img);
}

function detenerCamara() {
  if (streamCamara) {
    streamCamara.getTracks().forEach(t => t.stop());
    streamCamara = null;
  }
  videoCamara.srcObject = null;
}

async function iniciarSecuenciaCamara() {
  pantallaInicio.classList.add('oculto');
  pantallaCamara.classList.remove('oculto');

  fotosJefe          = [];
  capturaCancelada   = false;
  miniaturasFotos.innerHTML = '';
  instruccionFoto.textContent = 'Pidiendo acceso a la cámara...';
  cuentaAtrasEl.textContent = '';

  try {
    streamCamara = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
    videoCamara.srcObject = streamCamara;
    await videoCamara.play();

    for (let i = 0; i < 4 && !capturaCancelada; i++) {
      instruccionFoto.textContent = INSTRUCCIONES_FOTO[i];
      await cuentaAtras(3);
      if (capturaCancelada) break;

      const foto = capturarFotograma();
      fotosJefe.push(foto);
      agregarMiniatura(foto);
      await esperar(400);
    }
  } catch (err) {
    console.warn('No se pudo acceder a la cámara:', err);
  }

  if (fotosJefe.length < 4) fotosJefe = [];

  detenerCamara();
  pantallaCamara.classList.add('oculto');
  iniciarJuego();
}


// --- 4. INICIAR / REINICIAR ---

function iniciarJuego() {
  jugadores         = crearJugadores();
  balas             = [];
  enemigos          = [];
  particulas        = [];
  items             = [];
  nivel             = 1;
  dirEnemigos       = 1;
  velocidadEnemigos = 0.7;
  timerItem         = 360 + Math.random() * 360;
  timerRevivir      = 1800 + Math.random() * 1200;
  timerEscudo       = 1200 + Math.random() * 1200;
  juegoActivo       = true;

  crearEnemigos();

  pantallaInicio.classList.add('oculto');
  pantallaFin.classList.add('oculto');

  musicaFondo.currentTime = 0;
  musicaFondo.play().catch(() => {});

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


// --- 5B. CREAR JEFE (cada 3 niveles) ---

function crearJefe() {
  const numero  = nivel / 3;          // 1º, 2º, 3º jefe...
  const vidaMax = 16 + (numero - 1) * 8;  // cada jefe tiene más vida que el anterior
  const ancho   = 100;
  const alto    = 90;

  enemigos.push({
    esJefe:       true,
    numero:       numero,
    x:            ANCHO / 2 - ancho / 2,
    y:            40,
    yBase:        40,
    ancho:        ancho,
    alto:         alto,
    vida:         vidaMax,
    vidaMax:      vidaMax,
    golpeFlash:   0,
    muriendo:     false,
    muerteTimer:  0,
    tiempo:       0,
    dir:          1,
    velocidad:    Math.min(1.5 + (numero - 1) * 0.4, 4),
    timerDisparo: 90
  });
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
  actualizarJefe();
  actualizarItems();

  // Nueva oleada si no quedan enemigos
  if (enemigos.length === 0) {
    nivel++;
    if (nivel % 3 === 0) {
      crearJefe();
    } else {
      velocidadEnemigos = Math.min(velocidadEnemigos + 0.35, 3.5);
      crearEnemigos();
    }
  }
}


// --- 7B. ACTUALIZAR JEFE (flash de golpe / animación de muerte) ---

function actualizarJefe() {
  const jefe = enemigos.find(e => e.esJefe);
  if (!jefe) return;

  jefe.tiempo++;
  if (jefe.golpeFlash > 0) jefe.golpeFlash--;

  if (jefe.muriendo) {
    jefe.muerteTimer--;
    if (jefe.muerteTimer <= 0) {
      enemigos.splice(enemigos.indexOf(jefe), 1);
    }
  }
}


// --- 8. MOVER JUGADORES ---

function moverJugadores() {
  jugadores.forEach(j => {
    if (j.invulnerable > 0) j.invulnerable--;
    if (j.escudo > 0) j.escudo--;

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
  const jefe = enemigos.find(e => e.esJefe);
  if (jefe) {
    moverJefe(jefe);
    return;
  }

  let tocoBorde = false;

  enemigos.forEach(e => {
    e.x += dirEnemigos * velocidadEnemigos;
    if (e.x + e.ancho > ANCHO - 5 || e.x < 5) tocoBorde = true;
  });

  if (tocoBorde) {
    dirEnemigos *= -1;
    // Bajan hasta un límite, sin llegar nunca a la zona de los jugadores
    enemigos.forEach(e => { e.y = Math.min(e.y + 16, ALTO - 142); });
  }
}

function moverJefe(jefe) {
  if (jefe.muriendo) return;

  // Cambios de dirección erráticos, más frecuentes en jefes avanzados
  if (Math.random() < 0.01 + jefe.numero * 0.004) {
    jefe.dir *= -1;
  }

  jefe.x += jefe.dir * jefe.velocidad;
  if (jefe.x + jefe.ancho > ANCHO - 10 || jefe.x < 10) {
    jefe.dir *= -1;
    jefe.x = Math.max(10, Math.min(ANCHO - 10 - jefe.ancho, jefe.x));
  }

  // Ligero balanceo vertical
  jefe.y = jefe.yBase + Math.sin(jefe.tiempo * 0.05) * 12;
}


// --- 11. ENEMIGOS DISPARAN ---

function enemigosDisparar() {
  enemigos.forEach(e => {
    if (e.esJefe) {
      if (e.muriendo) return;
      e.timerDisparo--;
      if (e.timerDisparo <= 0) {
        jefeDisparar(e);

        // Cuanto más dañado está, más rápido dispara (hasta el doble de ritmo)
        const factorEnfado = 0.5 + 0.5 * (e.vida / e.vidaMax);
        const base = Math.max(18, 55 - e.numero * 6);
        e.timerDisparo = Math.max(12, base * factorEnfado) + Math.random() * 15;
      }
      return;
    }

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

function jefeDisparar(jefe) {
  // Los jefes más avanzados disparan ráfagas en abanico más amplias
  const disparos = Math.min(3 + (jefe.numero - 1), 5);
  const centroX  = jefe.x + jefe.ancho / 2;

  for (let i = 0; i < disparos; i++) {
    const offset = (i - (disparos - 1) / 2) * 22;
    balas.push({
      x:         centroX + offset - 3,
      y:         jefe.y + jefe.alto,
      ancho:     6,
      alto:      14,
      velocidad: -4,
      esJugador: false,
      color:     '#a4f'
    });
  }
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
      const enemigo = enemigos[j];

      // El jefe absorbe varios golpes antes de morir
      if (enemigo.esJefe) {
        if (enemigo.muriendo) continue;
        if (!seTocan(b, enemigo)) continue;

        explotar(b.x + b.ancho / 2, b.y, '#a4f', 8);

        const jugador = jugadores.find(p => p.id === b.jugadorId);
        enemigo.vida--;
        enemigo.golpeFlash = 14;
        balas.splice(i, 1);
        reproducir(sonidoGolpeJefe);

        if (enemigo.vida <= 0) {
          enemigo.muriendo    = true;
          enemigo.muerteTimer = 90;
          explotar(enemigo.x + enemigo.ancho / 2, enemigo.y + enemigo.alto / 2, '#a4f', 40);
          reproducir(sonidoJefeMuere);
          if (jugador) jugador.puntos += 100 * enemigo.numero;
        } else if (jugador) {
          jugador.puntos += 5 * nivel;
        }

        break;
      }

      if (seTocan(b, enemigo)) {
        explotar(
          enemigo.x + enemigo.ancho / 2,
          enemigo.y + enemigo.alto / 2,
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
        balas.splice(balas.indexOf(b), 1);

        // Invulnerable (tras un golpe o por escudo): el impacto no hace daño
        if (j.invulnerable > 0) {
          explotar(j.x + j.ancho / 2, j.y + j.alto / 2, '#0ff', 6);
          return;
        }

        explotar(j.x + j.ancho / 2, j.y + j.alto / 2, j.color, 14);
        j.vidas--;
        j.invulnerable = 60; // 1s de invulnerabilidad tras recibir un golpe

        if (j.vidas <= 0) {
          j.vivo = false;
          reproducir(sonidoJefeMuere);
          // ¿Los dos han muerto?
          if (jugadores.every(p => !p.vivo)) {
            terminarJuego();
          }
        }
      }
    });
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


// --- 13B. ITEMS: CAJA DE PROVISIONES (+1 vida) Y REANIMACIÓN ---

function crearItem(tipo) {
  items.push({
    tipo,
    x:         20 + Math.random() * (ANCHO - 60),
    y:        -30,
    ancho:     26,
    alto:      26,
    velocidad: 2
  });
}

function actualizarItems() {
  timerItem--;
  if (timerItem <= 0) {
    crearItem('caja');
    timerItem = 500 + Math.random() * 500;
  }

  // Muy de vez en cuando, si hay un jugador eliminado, puede caer una reanimación
  timerRevivir--;
  if (timerRevivir <= 0) {
    if (jugadores.some(j => !j.vivo)) {
      crearItem('revivir');
    }
    timerRevivir = 1800 + Math.random() * 1200;
  }

  // Muy de vez en cuando cae un escudo de invulnerabilidad temporal
  timerEscudo--;
  if (timerEscudo <= 0) {
    crearItem('escudo');
    timerEscudo = 1200 + Math.random() * 1200;
  }

  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    it.y += it.velocidad;

    if (it.y > ALTO + 20) {
      items.splice(i, 1);
      continue;
    }

    let recogido = false;
    jugadores.forEach(j => {
      if (!j.vivo) return;
      if (seTocan(it, j)) {
        if (it.tipo === 'caja') {
          j.vidas = Math.min(3, j.vidas + 1);
        } else if (it.tipo === 'revivir') {
          const companero = jugadores.find(p => !p.vivo);
          if (companero) {
            companero.vivo  = true;
            companero.vidas = 1;
          }
        } else if (it.tipo === 'escudo') {
          j.invulnerable = 300; // 5s de invulnerabilidad
          j.escudo       = 300;
        }
        recogido = true;
      }
    });

    if (recogido) {
      const colores = { caja: '#4f4', revivir: '#ff0', escudo: '#0ff' };
      explotar(it.x + it.ancho / 2, it.y + it.alto / 2, colores[it.tipo], 16);
      items.splice(i, 1);
    }
  }
}


// --- 14. DIBUJAR ---

function dibujar() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, ANCHO, ALTO);

  dibujarEstrellas();
  dibujarEnemigos();
  dibujarBalas();
  dibujarItems();
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
  ctx.save();
  // Parpadeo durante la invulnerabilidad breve tras recibir un golpe
  if (p.invulnerable > 0 && p.escudo === 0) {
    ctx.globalAlpha = Math.floor(p.invulnerable / 4) % 2 === 0 ? 1 : 0.3;
  }

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
  ctx.restore();

  // Escudo de invulnerabilidad (recogido como item)
  if (p.escudo > 0) {
    ctx.save();
    ctx.globalAlpha = 0.4 + Math.sin(Date.now() * 0.015) * 0.25;
    ctx.strokeStyle = '#0ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x + p.ancho / 2, p.y + p.alto / 2, Math.max(p.ancho, p.alto) * 0.78, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function dibujarEnemigos() {
  const colores = ['#f44', '#f80', '#fa0'];
  enemigos.forEach(e => {
    if (e.esJefe) {
      dibujarJefe(e);
      return;
    }

    dibujarOvni(e, colores[e.tipo] || '#f44');
  });
}

function dibujarOvni(e, color) {
  const cx = e.x + e.ancho / 2;

  // Cúpula de cristal
  ctx.fillStyle = 'rgba(170,230,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(cx, e.y + e.alto * 0.35, e.ancho * 0.26, e.alto * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();

  // Plato
  const platoCy = e.y + e.alto * 0.62;
  const platoRx = e.ancho * 0.5;
  const platoRy = e.alto * 0.3;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(cx, platoCy, platoRx, platoRy, 0, 0, Math.PI * 2);
  ctx.fill();

  // Luces parpadeantes en el borde
  for (let i = -1; i <= 1; i++) {
    const lx = cx + i * platoRx * 0.6;
    const ly = platoCy + platoRy * 0.5;
    const encendida = Math.floor(Date.now() / 200 + i) % 2 === 0;
    ctx.fillStyle = encendida ? '#fff' : 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(lx, ly, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}


// --- 14B. DIBUJAR JEFE ---

function dibujarJefe(jefe) {
  const cx = jefe.x + jefe.ancho / 2;
  const cy = jefe.y + jefe.alto / 2;

  let estado = 'normal';
  if (jefe.muriendo) estado = 'muerte';
  else if (jefe.golpeFlash > 0) estado = 'golpe';

  if (fotosJefe.length === 4) {
    dibujarJefeConFoto(jefe, cx, cy, estado);
  } else {
    dibujarJefeFallback(jefe, cx, cy, estado);
  }

  // Barra de vida y etiqueta
  if (!jefe.muriendo) {
    const pct = Math.max(0, jefe.vida / jefe.vidaMax);
    ctx.fillStyle = '#333';
    ctx.fillRect(jefe.x, jefe.y - 16, jefe.ancho, 6);
    ctx.fillStyle = pct > 0.5 ? '#4f4' : pct > 0.25 ? '#ff4' : '#f44';
    ctx.fillRect(jefe.x, jefe.y - 16, jefe.ancho * pct, 6);

    ctx.fillStyle = '#fff';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`JEFE ${jefe.numero}`, cx, jefe.y - 20);
    ctx.textAlign = 'left';
  }
}

function dibujarJefeConFoto(jefe, cx, cy, estado) {
  let img;
  if (estado === 'muerte') {
    img = fotosJefe[3];
  } else if (estado === 'golpe') {
    img = fotosJefe[2];
  } else {
    // Pose normal: alterna entre las fotos 1 y 2 para dar sensación de animación
    img = Math.floor(jefe.tiempo / 30) % 2 === 0 ? fotosJefe[0] : fotosJefe[1];
  }

  const radioX = jefe.ancho / 2;
  const radioY = jefe.alto / 2;

  ctx.save();
  if (jefe.muriendo) {
    ctx.globalAlpha = Math.max(0.1, jefe.muerteTimer / 90);
  }

  // Marco exterior tipo nave
  ctx.fillStyle = estado === 'golpe' ? '#fff' : '#a4f';
  ctx.beginPath();
  ctx.ellipse(cx, cy, radioX + 6, radioY + 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Foto recortada en óvalo
  ctx.beginPath();
  ctx.ellipse(cx, cy, radioX, radioY, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, jefe.x, jefe.y, jefe.ancho, jefe.alto);

  // Destello rojo al recibir un golpe
  if (estado === 'golpe') {
    ctx.fillStyle = 'rgba(255,0,0,0.35)';
    ctx.fillRect(jefe.x, jefe.y, jefe.ancho, jefe.alto);
  }

  ctx.restore();
}

function dibujarJefeFallback(jefe, cx, cy, estado) {
  ctx.save();
  if (jefe.muriendo) {
    ctx.globalAlpha = Math.max(0.1, jefe.muerteTimer / 90);
  }

  let color = '#a4f';
  if (estado === 'golpe')  color = '#fff';
  if (estado === 'muerte') color = '#666';

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx,                        jefe.y + jefe.alto);
  ctx.lineTo(jefe.x,                    jefe.y + jefe.alto * 0.35);
  ctx.lineTo(jefe.x + jefe.ancho * 0.15, jefe.y);
  ctx.lineTo(jefe.x + jefe.ancho * 0.85, jefe.y);
  ctx.lineTo(jefe.x + jefe.ancho,       jefe.y + jefe.alto * 0.35);
  ctx.closePath();
  ctx.fill();

  const ojoY = jefe.y + jefe.alto * 0.35;

  if (estado === 'muerte') {
    ctx.strokeStyle = '#f44';
    ctx.lineWidth = 3;
    [cx - jefe.ancho * 0.18, cx + jefe.ancho * 0.18].forEach(ox => {
      ctx.beginPath();
      ctx.moveTo(ox - 6, ojoY - 6);
      ctx.lineTo(ox + 6, ojoY + 6);
      ctx.moveTo(ox + 6, ojoY - 6);
      ctx.lineTo(ox - 6, ojoY + 6);
      ctx.stroke();
    });
  } else {
    ctx.fillStyle = estado === 'golpe' ? '#f00' : 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(cx - jefe.ancho * 0.18, ojoY, 7, 0, Math.PI * 2);
    ctx.arc(cx + jefe.ancho * 0.18, ojoY, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
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

const ICONOS_ITEM = { caja: '📦', revivir: '💖', escudo: '🛡️' };

function dibujarItems() {
  ctx.textAlign = 'center';
  ctx.font = '22px monospace';
  items.forEach(it => {
    ctx.globalAlpha = 0.7 + Math.sin(it.y * 0.15) * 0.3;
    ctx.fillText(ICONOS_ITEM[it.tipo], it.x + it.ancho / 2, it.y + it.alto);
  });
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
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
  const hayJefe = enemigos.some(e => e.esJefe);
  ctx.fillStyle = hayJefe ? '#a4f' : '#888';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(hayJefe ? `¡JEFE! · NIVEL ${nivel}` : `NIVEL ${nivel}`, ANCHO / 2, 20);
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
  musicaFondo.pause();

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

btnJugar.addEventListener('click', iniciarSecuenciaCamara);
btnReiniciar.addEventListener('click', iniciarJuego);
btnOmitirCamara.addEventListener('click', () => { capturaCancelada = true; });
