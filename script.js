// ============================================================
// Neuro-Kinetic Web Hub — script.js
// Progetto Capolavoro — Liceo Scientifico Sportivo
//
// MODULI:
//   1. Navigazione e Utilità
//   2. Gestione Sport e Sessione
//   3. Vision Engine (TensorFlow.js + MoveNet)
//   4. Kinetic Sensor (DeviceMotionEvent - Accelerometro)
//   5. Grafici (Chart.js)
//   6. Dashboard e Log Impatti
//   7. PWA Service Worker
// ============================================================

'use strict'; // Modalità rigorosa ES6: previene errori silenziosi

// ============================================================
// SEZIONE 1: COSTANTI E CONFIGURAZIONE GLOBALE
// ============================================================

// Indici dei keypoints nel modello MoveNet (17 punti corporei)
const KP = {
  NASO:            0,
  OCCHIO_SX:       1, OCCHIO_DX:        2,
  ORECCHIO_SX:     3, ORECCHIO_DX:      4,
  SPALLA_SX:       5, SPALLA_DX:        6,
  GOMITO_SX:       7, GOMITO_DX:        8,
  POLSO_SX:        9, POLSO_DX:         10,
  ANCA_SX:        11, ANCA_DX:          12,
  GINOCCHIO_SX:   13, GINOCCHIO_DX:     14,
  CAVIGLIA_SX:    15, CAVIGLIA_DX:      16,
};

// Colori per il rendering dello scheletro sul canvas
const SKELETON_COLOR    = 'rgba(0, 245, 212, 0.85)';  // Linee: cyan neon
const KEYPOINT_COLOR    = 'rgba(0, 245, 212, 1)';     // Punti: cyan pieno
const CRITICAL_COLOR    = 'rgba(247, 37, 133, 1)';    // Ginocchio in angolo critico
const KEYPOINT_RADIUS   = 5;    // Raggio cerchio keypoint (px)
const MIN_CONFIDENCE    = 0.35; // Soglia minima di confidenza per disegnare un keypoint

// Connessioni scheletro: coppie di keypoint da collegare con linee
const SKELETON_CONNECTIONS = [
  [KP.SPALLA_SX,    KP.SPALLA_DX],
  [KP.SPALLA_SX,    KP.GOMITO_SX],   [KP.GOMITO_SX,    KP.POLSO_SX],
  [KP.SPALLA_DX,    KP.GOMITO_DX],   [KP.GOMITO_DX,    KP.POLSO_DX],
  [KP.SPALLA_SX,    KP.ANCA_SX],     [KP.SPALLA_DX,    KP.ANCA_DX],
  [KP.ANCA_SX,      KP.ANCA_DX],
  [KP.ANCA_SX,      KP.GINOCCHIO_SX],[KP.GINOCCHIO_SX, KP.CAVIGLIA_SX],
  [KP.ANCA_DX,      KP.GINOCCHIO_DX],[KP.GINOCCHIO_DX, KP.CAVIGLIA_DX],
];

// Configurazione dei sport: soglia G e emoji
const SPORT_CONFIG = {
  rugby:     { nome: 'Rugby',     emoji: '🏉', soglia: 3.5 },
  calcio:    { nome: 'Calcio',    emoji: '⚽', soglia: 2.5 },
  pallavolo: { nome: 'Pallavolo', emoji: '🏐', soglia: 2.0 },
  atletica:  { nome: 'Atletica',  emoji: '🏃', soglia: 4.0 },
};

// ============================================================
// SEZIONE 2: STATO GLOBALE DELL'APPLICAZIONE
// ============================================================

const stato = {
  // Sport e sessione
  sportAttivo: 'rugby',
  sogliaImpatto: 3.5,         // in G (unità di gravità)
  sessioneAttiva: false,
  tempoInizio: null,
  timerInterval: null,

  // Vision Engine
  fotocameraAttiva: false,
  modelloMoveNet: null,        // istanza del modello TF.js
  streamCamera: null,          // MediaStream dalla fotocamera
  animationFrameId: null,      // ID requestAnimationFrame per stop

  // Angoli articolari (aggiornati ogni frame)
  angoloGinocchioSx: null,
  angoloGinocchioDx: null,
  angoloMinSessione: Infinity, // minimo registrato in sessione

  // Kinetic Sensor
  sensoreAttivo: false,
  emaGforce: 0,                // Media Mobile Esponenziale corrente
  EMA_ALPHA: 0.15,             // Fattore di smorzamento EMA (0=lento, 1=reattivo)
  gforceMax: 0,                // massima G-Force registrata in sessione
  impatti: [],                 // array di oggetti impatto {tempo, valore, sport}
  inCooldownImpatto: false,    // evita doppio-conteggio di uno stesso picco
  COOLDOWN_MS: 800,            // millisecondi minimi tra un impatto e l'altro

  // Grafici Chart.js
  graficoAngolo: null,
  graficoGforce: null,
  MAX_PUNTI_GRAFICO: 60,       // numero massimo di campioni visibili sul grafico
};

// ============================================================
// SEZIONE 3: RIFERIMENTI DOM
// Raccogliamo tutti gli elementi HTML una sola volta, all'avvio
// ============================================================

const DOM = {
  // Header
  sportBadge:      document.getElementById('sportBadge'),
  sessionDot:      document.getElementById('sessionDot'),

  // Pannelli
  panels:          document.querySelectorAll('.panel'),
  navBtns:         document.querySelectorAll('.nav-btn'),

  // Sport buttons
  sportBtns:       document.querySelectorAll('.sport-btn'),

  // Dashboard / Statistiche
  statMinAngle:    document.getElementById('statMinAngle'),
  statMaxG:        document.getElementById('statMaxG'),
  statImpacts:     document.getElementById('statImpacts'),
  statDuration:    document.getElementById('statDuration'),
  impactLog:       document.getElementById('impactLog'),
  logEmpty:        document.getElementById('logEmpty'),

  // Vision Engine
  btnStartCamera:  document.getElementById('btnStartCamera'),
  btnStopCamera:   document.getElementById('btnStopCamera'),
  aiStatusDot:     document.getElementById('aiStatusDot'),
  aiStatusText:    document.getElementById('aiStatusText'),
  visionContainer: document.getElementById('visionContainer'),
  visionPlaceholder: document.getElementById('visionPlaceholder'),
  videoElement:    document.getElementById('videoElement'),
  poseCanvas:      document.getElementById('poseCanvas'),
  angleAlert:      document.getElementById('angleAlert'),
  angleLeft:       document.getElementById('angleLeft'),
  angleRight:      document.getElementById('angleRight'),
  angleBarLeft:    document.getElementById('angleBarLeft'),
  angleBarRight:   document.getElementById('angleBarRight'),

  // Kinetic Sensor
  btnStartSensor:  document.getElementById('btnStartSensor'),
  btnStopSensor:   document.getElementById('btnStopSensor'),
  thresholdSlider: document.getElementById('thresholdSlider'),
  thresholdValue:  document.getElementById('thresholdValue'),
  gforceValue:     document.getElementById('gforceValue'),
  axisBarX:        document.getElementById('axisBarX'),
  axisBarY:        document.getElementById('axisBarY'),
  axisBarZ:        document.getElementById('axisBarZ'),
  axisValueX:      document.getElementById('axisValueX'),
  axisValueY:      document.getElementById('axisValueY'),
  axisValueZ:      document.getElementById('axisValueZ'),
  impactCounter:   document.getElementById('impactCounter'),
  impactLast:      document.getElementById('impactLast'),

  // Grafici
  angleChartCanvas: document.getElementById('angleChart'),
  gforceChartCanvas: document.getElementById('gforceChart'),

  // Export
  btnExportLog:    document.getElementById('btnExportLog'),

  // Toast
  toastContainer:  document.getElementById('toastContainer'),
};

// ============================================================
// SEZIONE 4: UTILITÀ GENERALI
// ============================================================

/**
 * Mostra una notifica toast temporanea.
 * Nota: attualmente disabilitata per non coprire l'interfaccia.
 * Le chiamate rimangono nel codice per documentare gli eventi applicativi.
 * @param {string} messaggio - Testo da mostrare
 * @param {string} tipo - 'info' | 'success' | 'warning' | 'error'
 * @param {number} durata - Millisecondi prima della scomparsa
 */
function mostraToast(messaggio, tipo = 'info', durata = 3500) {
  // Toast disabilitati — tutti gli eventi vengono comunque loggati in console
  console.log(`[NKHub Toast][${tipo.toUpperCase()}] ${messaggio}`);
}

/**
 * Formatta i millisecondi come stringa MM:SS.
 * @param {number} ms - Millisecondi trascorsi
 * @returns {string} - es. "03:47"
 */
function formatDurata(ms) {
  const secs = Math.floor(ms / 1000);
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * Limpa una barra di progressione CSS (width in %)
 * @param {HTMLElement} barEl - Elemento barra
 * @param {number} percentuale - Valore 0-100
 * @param {string} colore - Colore CSS opzionale
 */
function aggiornaBarraProgressione(barEl, percentuale, colore = null) {
  barEl.style.width = `${Math.min(100, Math.max(0, percentuale))}%`;
  if (colore) barEl.style.background = colore;
}

// ============================================================
// SEZIONE 5: NAVIGAZIONE TRA PANNELLI
// ============================================================

/**
 * Attiva il pannello corrispondente al bottone di navigazione premuto.
 * Mostra il pannello target e aggiorna lo stato aria-pressed.
 */
function inizializzaNavigazione() {
  DOM.navBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;

      // Rimuovi stato attivo da tutti i pannelli e bottoni
      DOM.panels.forEach((p) => p.classList.remove('active'));
      DOM.navBtns.forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });

      // Attiva pannello target
      document.getElementById(targetId).classList.add('active');
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
    });
  });
}

// ============================================================
// SEZIONE 6: GESTIONE SPORT
// ============================================================

/**
 * Imposta lo sport attivo e aggiorna soglia impatti e UI.
 * @param {string} sport - Chiave sport (rugby, calcio, pallavolo, atletica)
 * @param {boolean} silenzioso - Se true, non mostra il toast di conferma
 */
function impostaSport(sport, silenzioso = false) {
  const config = SPORT_CONFIG[sport];
  if (!config) return;

  stato.sportAttivo   = sport;
  stato.sogliaImpatto = config.soglia;

  // Aggiorna badge header
  DOM.sportBadge.textContent = `${config.emoji} ${config.nome}`;

  // Aggiorna slider soglia nel Kinetic Sensor
  DOM.thresholdSlider.value = config.soglia;
  DOM.thresholdValue.textContent = `${config.soglia.toFixed(1)}G`;

  // Aggiorna stile bottoni sport
  DOM.sportBtns.forEach((btn) => {
    const isActive = btn.dataset.sport === sport;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });

  // Mostra toast solo su selezione esplicita dell'utente
  if (!silenzioso) {
    mostraToast(`Sport impostato: ${config.emoji} ${config.nome} (soglia ${config.soglia}G)`, 'info');
  }
}

/**
 * Inizializza i bottoni di selezione sport.
 */
function inizializzaSportSelector() {
  DOM.sportBtns.forEach((btn) => {
    btn.addEventListener('click', () => impostaSport(btn.dataset.sport));
  });

  DOM.thresholdSlider.addEventListener('input', (e) => {
    stato.sogliaImpatto = parseFloat(e.target.value);
    DOM.thresholdValue.textContent = `${stato.sogliaImpatto.toFixed(1)}G`;
  });
}

// ============================================================
// SEZIONE 7: TIMER SESSIONE
// ============================================================

/**
 * Avvia il timer della sessione (usato quando almeno un modulo è attivo).
 */
function avviaTimerSessione() {
  if (stato.sessioneAttiva) return;
  stato.sessioneAttiva = true;
  stato.tempoInizio = Date.now();
  DOM.sessionDot.classList.add('active');

  stato.timerInterval = setInterval(() => {
    const elapsed = Date.now() - stato.tempoInizio;
    DOM.statDuration.textContent = formatDurata(elapsed);
  }, 1000);
}

/**
 * Ferma il timer (solo se tutti e due i moduli sono fermi).
 */
function controllaStopSessione() {
  if (!stato.fotocameraAttiva && !stato.sensoreAttivo) {
    stato.sessioneAttiva = false;
    clearInterval(stato.timerInterval);
    DOM.sessionDot.classList.remove('active');
  }
}

// ============================================================
// SEZIONE 8: VISION ENGINE — TENSORFLOW.JS + MOVENET
// ============================================================

// --- 8.1 Caricamento Modello MoveNet ---

/**
 * Carica il modello MoveNet Lightning via TensorFlow.js.
 * MoveNet è ottimizzato per la velocità su dispositivi mobili.
 * Lightning = più veloce ma meno preciso (vs Thunder)
 */
async function caricaModelloMoveNet() {
  aggiornaStatoAI('loading', '⏳ Caricamento TensorFlow.js...');

  try {
    // Imposta il backend WebGL (GPU del browser) per massima performance
    await tf.setBackend('webgl');
    await tf.ready();

    aggiornaStatoAI('loading', '🧠 Caricamento modello MoveNet...');

    // Crea il detector usando l'API poseDetection di TensorFlow.js
    // MoveNet.SinglePose.Lightning: 17 keypoints, ~50 FPS su mobile
    stato.modelloMoveNet = await poseDetection.createDetector(
      poseDetection.SupportedModels.MoveNet,
      {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
        // enableSmoothing applica un filtro al segnale per ridurre il tremolìo
        enableSmoothing: true,
      }
    );

    aggiornaStatoAI('ready', '✅ Modello IA pronto');
    mostraToast('MoveNet caricato! Premi Avvia Fotocamera.', 'success');
    DOM.btnStartCamera.disabled = false;

  } catch (errore) {
    console.error('[MoveNet] Errore caricamento:', errore);
    aggiornaStatoAI('error', '❌ Errore caricamento modello');
    mostraToast('Errore caricamento IA. Ricarica la pagina.', 'error');
  }
}

/**
 * Aggiorna l'indicatore visivo dello stato del modello IA.
 * @param {string} stato - 'idle' | 'loading' | 'ready' | 'running' | 'error'
 * @param {string} testo - Descrizione testuale dello stato
 */
function aggiornaStatoAI(nuovoStato, testo) {
  DOM.aiStatusDot.className = `ai-status-dot ${nuovoStato}`;
  DOM.aiStatusText.textContent = testo;
}

// --- 8.2 Inizializzazione Fotocamera ---

/**
 * Richiede l'accesso alla fotocamera posteriore (o frontale su mobile)
 * e avvia lo stream video nell'elemento <video>.
 */
async function avviaFotocamera() {
  DOM.btnStartCamera.disabled = true;

  try {
    // getUserMedia: API browser per accesso a fotocamera e microfono
    // 'environment' = fotocamera posteriore (ideale per analisi sportiva)
    // 'user' = fotocamera frontale (selfie)
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode:  'user',       // Frontale per vedere se stesso durante l'esercizio
        width:       { ideal: 640 },
        height:      { ideal: 480 },
        frameRate:   { ideal: 30 },
      },
      audio: false, // Non ci serve l'audio
    });

    stato.streamCamera = stream;
    DOM.videoElement.srcObject = stream;

    // Attendi che il video sia pronto prima di avviare l'analisi
    await new Promise((resolve) => {
      DOM.videoElement.onloadedmetadata = () => {
        DOM.videoElement.play();
        resolve();
      };
    });

    // Adatta il canvas alle dimensioni reali del video
    DOM.poseCanvas.width  = DOM.videoElement.videoWidth;
    DOM.poseCanvas.height = DOM.videoElement.videoHeight;

    // Mostra il video e nasconde il placeholder
    DOM.visionContainer.classList.add('camera-active');
    DOM.visionPlaceholder.classList.add('hidden');

    stato.fotocameraAttiva = true;
    DOM.btnStopCamera.disabled = false;

    // Avvia il loop di analisi frame-per-frame
    aggiornaStatoAI('running', '🔴 Analisi in corso...');
    avviaTimerSessione();
    loopAnalisiPosa();

    mostraToast('Fotocamera avviata! Mettiti in posa.', 'success');

  } catch (errore) {
    console.error('[Fotocamera] Errore:', errore);
    DOM.btnStartCamera.disabled = false;

    if (errore.name === 'NotAllowedError') {
      mostraToast('Permesso fotocamera negato. Controlla le impostazioni.', 'error');
    } else {
      mostraToast(`Errore fotocamera: ${errore.message}`, 'error');
    }
    aggiornaStatoAI('ready', '✅ Modello pronto (fotocamera off)');
  }
}

/**
 * Ferma la fotocamera e il loop di analisi.
 */
function fermaFotocamera() {
  stato.fotocameraAttiva = false;

  // Cancella il prossimo frame animazione
  if (stato.animationFrameId) {
    cancelAnimationFrame(stato.animationFrameId);
    stato.animationFrameId = null;
  }

  // Ferma tutti i track dello stream (rilascia ressource fotocamera)
  if (stato.streamCamera) {
    stato.streamCamera.getTracks().forEach((track) => track.stop());
    stato.streamCamera = null;
  }

  // Reimposta UI
  DOM.videoElement.srcObject = null;
  DOM.visionContainer.classList.remove('camera-active', 'critical-angle');
  DOM.visionPlaceholder.classList.remove('hidden');
  DOM.angleAlert.classList.remove('visible');

  DOM.btnStartCamera.disabled = false;
  DOM.btnStopCamera.disabled  = true;
  aggiornaStatoAI('ready', '✅ Modello pronto');

  controllaStopSessione();
  mostraToast('Fotocamera fermata.', 'info');
}

// --- 8.3 Loop di Analisi Posa (frame-per-frame) ---

/**
 * Loop principale del Vision Engine.
 * Eseguito ad ogni frame del browser (~30 FPS) tramite requestAnimationFrame.
 * Ad ogni chiamata:
 *   1. Esegue l'inferenza MoveNet sul frame corrente
 *   2. Disegna scheletro e keypoints sul canvas
 *   3. Calcola gli angoli articolari del ginocchio
 *   4. Aggiorna grafici e feedback visivo
 */
async function loopAnalisiPosa() {
  if (!stato.fotocameraAttiva) return;

  const ctx = DOM.poseCanvas.getContext('2d');

  // ---- Inferenza MoveNet ----
  // Passa il frame video al modello e ottieni i keypoints
  let pose = null;
  try {
    const risultati = await stato.modelloMoveNet.estimatePoses(DOM.videoElement);
    if (risultati && risultati.length > 0) {
      pose = risultati[0]; // MoveNet SINGLEPOSE: un solo atleta per frame
    }
  } catch (e) {
    console.warn('[MoveNet] Errore inferenza frame:', e);
  }

  // ---- Rendering Canvas ----
  // Cancella il canvas prima di disegnare il nuovo frame
  ctx.clearRect(0, 0, DOM.poseCanvas.width, DOM.poseCanvas.height);

  if (pose && pose.keypoints) {
    disegnaScheletro(ctx, pose.keypoints, DOM.poseCanvas.width, DOM.poseCanvas.height);

    // ---- Calcolo Angoli Articolari ----
    const angoloSx = calcolaAngoloGinocchio(pose.keypoints, 'sinistra');
    const angoloDx = calcolaAngoloGinocchio(pose.keypoints, 'destra');

    stato.angoloGinocchioSx = angoloSx;
    stato.angoloGinocchioDx = angoloDx;

    // Aggiorna display angoli
    aggiornaDisplayAngolo(DOM.angleLeft, DOM.angleBarLeft, angoloSx);
    aggiornaDisplayAngolo(DOM.angleRight, DOM.angleBarRight, angoloDx);

    // Rileva angolo critico (<90°) in almeno uno dei due ginocchi
    const angoloMin = Math.min(
      angoloSx ?? Infinity,
      angoloDx ?? Infinity
    );

    if (angoloMin < Infinity && angoloMin < stato.angoloMinSessione) {
      stato.angoloMinSessione = angoloMin;
      DOM.statMinAngle.textContent = `${Math.round(angoloMin)}°`;
    }

    // Feedback visivo per angolo critico (<90°)
    const isAngolocritico = angoloMin < 90;
    DOM.visionContainer.classList.toggle('critical-angle', isAngolocritico);
    DOM.angleAlert.classList.toggle('visible', isAngolocritico);

    // Aggiorna grafico angolo (usa il minore tra i due ginocchi)
    if (angoloMin < Infinity) {
      aggiungiPuntoGraficoAngolo(angoloMin);
    }
  } else {
    // Nessuna posa rilevata: reimposta display
    DOM.angleLeft.textContent  = '--°';
    DOM.angleRight.textContent = '--°';
    DOM.visionContainer.classList.remove('critical-angle');
    DOM.angleAlert.classList.remove('visible');
  }

  // Ripianifica il prossimo frame (60 FPS max, limitato dal modello)
  stato.animationFrameId = requestAnimationFrame(loopAnalisiPosa);
}

// --- 8.4 Calcolo Angolo Ginocchio (Formula Prodotto Scalare) ---

/**
 * Calcola l'angolo di flessione del ginocchio usando il PRODOTTO SCALARE
 * tra due vettori:
 *   - v1 = vettore da ANCA a GINOCCHIO
 *   - v2 = vettore da CAVIGLIA a GINOCCHIO
 *
 * FORMULA MATEMATICA (trigonometria vettoriale):
 *   cos(θ) = (v1 · v2) / (|v1| × |v2|)
 *   dove:
 *     v1 · v2 = prodotto scalare = v1.x*v2.x + v1.y*v2.y
 *     |v| = modulo (lunghezza) del vettore = sqrt(x²+y²)
 *   θ = arccos(prodottoScalare / (|v1| × |v2|)) × (180 / π) → gradi
 *
 * Un angolo di 180° = gamba completamente estesa
 * Un angolo di 90°  = massimo caricamento in fase di salto/squat
 * Un angolo <90°    = situazione critica o flessione profonda
 *
 * @param {Array} keypoints - Array keypoints dal modello MoveNet
 * @param {string} lato - 'sinistra' o 'destra'
 * @returns {number|null} Angolo in gradi, o null se punti non affidabili
 */
function calcolaAngoloGinocchio(keypoints, lato) {
  // Seleziona i tre keypoints giusti in base al lato
  const kpAnca     = keypoints[lato === 'sinistra' ? KP.ANCA_SX     : KP.ANCA_DX];
  const kpGinocchio= keypoints[lato === 'sinistra' ? KP.GINOCCHIO_SX: KP.GINOCCHIO_DX];
  const kpCaviglia = keypoints[lato === 'sinistra' ? KP.CAVIGLIA_SX : KP.CAVIGLIA_DX];

  // Verifica che tutti e tre i keypoints abbiano confidenza sufficiente
  if (!kpAnca || !kpGinocchio || !kpCaviglia) return null;
  if (kpAnca.score < MIN_CONFIDENCE ||
      kpGinocchio.score < MIN_CONFIDENCE ||
      kpCaviglia.score < MIN_CONFIDENCE) {
    return null; // Keypoint non abbastanza visibile
  }

  // --- CALCOLO VETTORI ---
  // v1 = da ginocchio verso anca (vettore verso il segmento coscia)
  const v1 = {
    x: kpAnca.x - kpGinocchio.x,
    y: kpAnca.y - kpGinocchio.y,
  };

  // v2 = da ginocchio verso caviglia (vettore verso il segmento stinco)
  const v2 = {
    x: kpCaviglia.x - kpGinocchio.x,
    y: kpCaviglia.y - kpGinocchio.y,
  };

  // --- PRODOTTO SCALARE: v1 · v2 ---
  // Il prodotto scalare tra due vettori 2D è la somma dei prodotti componente per componente
  const prodottoScalare = v1.x * v2.x + v1.y * v2.y;

  // --- MODULI (LUNGHEZZE) DEI VETTORI ---
  // Teorema di Pitagora applicato ai vettori 2D: |v| = sqrt(x² + y²)
  const moduloV1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const moduloV2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

  // Evita divisione per zero (keypoints sovrapposti)
  if (moduloV1 === 0 || moduloV2 === 0) return null;

  // --- ANGOLO: arccos(cos(θ)) → angolo in radianti → convertito in gradi ---
  // Math.acos restituisce l'angolo in radianti
  // Clamp tra -1 e 1 per evitare errori numerici (floating point)
  const cosTheta = Math.max(-1, Math.min(1, prodottoScalare / (moduloV1 * moduloV2)));
  const angoloRadianti = Math.acos(cosTheta);

  // Conversione da radianti a gradi: θ° = θrad × (180 / π)
  const angoloGradi = angoloRadianti * (180 / Math.PI);

  return angoloGradi;
}

// --- 8.5 Disegno Scheletro sul Canvas ---

/**
 * Disegna keypoints e connessioni scheletro sul canvas overlay.
 * Ogni keypoint sopra la soglia di confidenza viene visualizzato come cerchio.
 * Le connessioni tra keypoints appaiono come linee.
 *
 * @param {CanvasRenderingContext2D} ctx - Contesto 2D del canvas
 * @param {Array} keypoints - Array di keypoints dal modello
 * @param {number} larghezza - Larghezza canvas
 * @param {number} altezza - Altezza canvas
 */
function disegnaScheletro(ctx, keypoints, larghezza, altezza) {
  // --- Disegna le LINEE delle connessioni ---
  ctx.lineWidth   = 2.5;
  ctx.strokeStyle = SKELETON_COLOR;
  ctx.lineCap     = 'round';

  SKELETON_CONNECTIONS.forEach(([idxA, idxB]) => {
    const kpA = keypoints[idxA];
    const kpB = keypoints[idxB];

    // Disegna la linea solo se entrambi i keypoints sono affidabili
    if (kpA.score >= MIN_CONFIDENCE && kpB.score >= MIN_CONFIDENCE) {
      ctx.beginPath();
      ctx.moveTo(kpA.x, kpA.y);
      ctx.lineTo(kpB.x, kpB.y);
      ctx.stroke();
    }
  });

  // --- Disegna i CERCHI dei keypoints ---
  keypoints.forEach((kp, idx) => {
    if (kp.score < MIN_CONFIDENCE) return; // Salta punti non visibili

    // Colora di magenta i ginocchi critici (<90°)
    const isGinocchio = idx === KP.GINOCCHIO_SX || idx === KP.GINOCCHIO_DX;
    const angoloRilevante = isGinocchio
      ? (idx === KP.GINOCCHIO_SX ? stato.angoloGinocchioSx : stato.angoloGinocchioDx)
      : null;
    const isCritico = angoloRilevante !== null && angoloRilevante < 90;

    // Cerchio esterno (glow effect)
    ctx.beginPath();
    ctx.arc(kp.x, kp.y, KEYPOINT_RADIUS + 2, 0, Math.PI * 2);
    ctx.fillStyle = isCritico
      ? 'rgba(247, 37, 133, 0.3)'
      : 'rgba(0, 245, 212, 0.2)';
    ctx.fill();

    // Cerchio interno pieno
    ctx.beginPath();
    ctx.arc(kp.x, kp.y, KEYPOINT_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = isCritico ? CRITICAL_COLOR : KEYPOINT_COLOR;
    ctx.fill();
  });
}

// --- 8.6 Aggiornamento Display Angolo ---

/**
 * Aggiorna il valore angolo visualizzato e la barra di progresso.
 * Cambia colore in base alla soglia: verde > 120°, giallo 90-120°, rosso <90°.
 * @param {HTMLElement} elValore - Elemento testo angolo
 * @param {HTMLElement} elBarra - Elemento barra progressione
 * @param {number|null} angolo - Angolo in gradi
 */
function aggiornaDisplayAngolo(elValore, elBarra, angolo) {
  if (angolo === null) {
    elValore.textContent = '--°';
    elValore.className   = 'angle-value';
    aggiornaBarraProgressione(elBarra, 0);
    return;
  }

  elValore.textContent = `${Math.round(angolo)}°`;

  // Categoria visiva in base all'angolo
  if (angolo < 90) {
    elValore.className = 'angle-value danger';
    aggiornaBarraProgressione(elBarra, (angolo / 180) * 100, 'var(--clr-magenta)');
  } else if (angolo < 120) {
    elValore.className = 'angle-value warning';
    aggiornaBarraProgressione(elBarra, (angolo / 180) * 100, 'var(--clr-yellow)');
  } else {
    elValore.className = 'angle-value';
    aggiornaBarraProgressione(elBarra, (angolo / 180) * 100, 'var(--clr-cyan)');
  }
}

// ============================================================
// SEZIONE 9: KINETIC SENSOR — ACCELEROMETRO
// ============================================================

// --- 9.1 Avvio Sensore ---

/**
 * Avvia il listener per gli eventi dell'accelerometro.
 * Su iOS 13+ serve una richiesta esplicita di permesso.
 * Su Android e altri browser il listener si aggiunge direttamente.
 *
 * L'evento DeviceMotionEvent fornisce:
 *   event.accelerationIncludingGravity.x  → accelerazione asse X (m/s²)
 *   event.accelerationIncludingGravity.y  → accelerazione asse Y (m/s²)
 *   event.accelerationIncludingGravity.z  → accelerazione asse Z (m/s²)
 */
async function avviaSensore() {
  DOM.btnStartSensor.disabled = true;

  try {
    // iOS 13+ richiede un permesso esplicito per DeviceMotionEvent
    if (typeof DeviceMotionEvent !== 'undefined' &&
        typeof DeviceMotionEvent.requestPermission === 'function') {
      const risposta = await DeviceMotionEvent.requestPermission();
      if (risposta !== 'granted') {
        mostraToast('Permesso sensore negato. Controlla le impostazioni iOS.', 'error');
        DOM.btnStartSensor.disabled = false;
        return;
      }
    }

    // Verifica che il browser supporti DeviceMotionEvent
    if (!window.DeviceMotionEvent) {
      mostraToast('Accelerometro non supportato da questo browser/dispositivo.', 'warning');
      DOM.btnStartSensor.disabled = false;
      // Modalità Demo: simula movimenti per testing su desktop
      avviaDemoSensore();
      return;
    }

    // Registra il listener per gli eventi di movimento
    window.addEventListener('devicemotion', gestisciMovimento);
    stato.sensoreAttivo = true;
    DOM.btnStopSensor.disabled = false;

    avviaTimerSessione();
    mostraToast('📡 Sensore avviato! Muovi il dispositivo.', 'success');

  } catch (errore) {
    console.error('[Sensore] Errore:', errore);
    mostraToast(`Errore sensore: ${errore.message}`, 'error');
    DOM.btnStartSensor.disabled = false;
    // Fallback: avvia demo su desktop
    avviaDemoSensore();
  }
}

/**
 * Ferma il sensore accelerometro.
 */
function fermaSensore() {
  window.removeEventListener('devicemotion', gestisciMovimento);
  stato.sensoreAttivo = false;

  // Ferma anche eventuale demo
  if (stato._demoInterval) {
    clearInterval(stato._demoInterval);
    stato._demoInterval = null;
  }

  DOM.btnStartSensor.disabled = false;
  DOM.btnStopSensor.disabled  = true;

  // Reimposta display assi
  ['X','Y','Z'].forEach((asse) => {
    document.getElementById(`axisBar${asse}`).style.width = '0%';
    document.getElementById(`axisValue${asse}`).textContent = '0.00';
  });
  DOM.gforceValue.textContent = '0.00';
  DOM.gforceValue.className   = 'gforce-value';

  controllaStopSessione();
  mostraToast('Sensore fermato.', 'info');
}

// --- 9.2 Demo Sensore per Desktop ---

/**
 * Simula il segnale dell'accelerometro per testare l'app su desktop
 * (dove DeviceMotionEvent non è disponibile).
 * Genera un segnale sinusoidale con picchi casuali.
 */
function avviaDemoSensore() {
  mostraToast('Demo Sensore attiva (nessun accelerometro rilevato).', 'warning', 5000);
  stato.sensoreAttivo = true;
  DOM.btnStopSensor.disabled = false;
  DOM.btnStartSensor.disabled = true;
  avviaTimerSessione();

  let t = 0;
  stato._demoInterval = setInterval(() => {
    // Simula oscillazione normale con picchi casuali ogni ~3 secondi
    const baseSignal = Math.sin(t * 0.4) * 1.2 + 1.0;
    const noise      = (Math.random() - 0.5) * 0.8;
    const spike      = Math.random() < 0.02 ? (Math.random() * 5 + 3) : 0;

    const ax = Math.sin(t * 0.3) * 1.5 + noise;
    const ay = baseSignal + noise;
    const az = Math.cos(t * 0.2) * 0.8 + noise + spike;

    // Processa i valori simulati come se fossero reali (in m/s²)
    elaboraDatiAccelerometro(ax, ay, az);
    t += 0.2;
  }, 100); // 10 campioni al secondo (10 Hz)
}

// --- 9.3 Gestore Evento DeviceMotion ---

/**
 * Callback chiamata ad ogni evento devicemotion del browser.
 * Legge i valori dell'accelerometro comprensiva della gravità
 * e li converte in unità G per la formula risultante.
 *
 * @param {DeviceMotionEvent} event - Evento browser con dati accelerometro
 */
function gestisciMovimento(event) {
  // accelerationIncludingGravity include la forza di gravità terrestre (~9.81 m/s²)
  // Questo è utile per la formula G-Force complessiva
  const acc = event.accelerationIncludingGravity;
  if (!acc) return;

  const ax = acc.x ?? 0; // Accelerazione asse X in m/s²
  const ay = acc.y ?? 0; // Accelerazione asse Y in m/s²
  const az = acc.z ?? 0; // Accelerazione asse Z in m/s²

  elaboraDatiAccelerometro(ax, ay, az);
}

// --- 9.4 Elaborazione Dati Accelerometro ---

/**
 * Elabora i valori degli assi accelerometro:
 *   1. Calcola la G-Force risultante
 *   2. Aggiorna la media mobile esponenziale (EMA)
 *   3. Rileva picchi di impatto
 *   4. Aggiorna display e grafico
 *
 * @param {number} ax - Accelerazione asse X (m/s²)
 * @param {number} ay - Accelerazione asse Y (m/s²)
 * @param {number} az - Accelerazione asse Z (m/s²)
 */
function elaboraDatiAccelerometro(ax, ay, az) {
  // ---- FORMULA G-FORCE ----
  // L'accelerazione risultante è il MODULO del vettore tridimensionale
  // Formula: G = sqrt(ax² + ay² + az²)
  // Dividiamo per 9.81 per convertire da m/s² a multipli della gravità (G)
  // (g ≈ 9.81 m/s² = 1G sull'asse verticale a riposo)
  const G_RAW = Math.sqrt(ax * ax + ay * ay + az * az) / 9.81;

  // ---- MEDIA MOBILE ESPONENZIALE (EMA) ----
  // EMA serve a "smussare" il segnale rumoroso dell'accelerometro.
  // Formula: EMA_t = α × G_t + (1 - α) × EMA_{t-1}
  // Con α = 0.15: risponde ai cambiamenti ma non al rumore istantaneo
  stato.emaGforce = stato.EMA_ALPHA * G_RAW + (1 - stato.EMA_ALPHA) * stato.emaGforce;

  // ---- Aggiorna massimo sessione ----
  if (G_RAW > stato.gforceMax) {
    stato.gforceMax = G_RAW;
    DOM.statMaxG.textContent = `${G_RAW.toFixed(2)}G`;
  }

  // ---- Aggiorna display G-Force ----
  DOM.gforceValue.textContent = G_RAW.toFixed(2);

  // Cambia colore in base all'intensità
  if (G_RAW >= stato.sogliaImpatto) {
    DOM.gforceValue.className = 'gforce-value danger';
  } else if (G_RAW >= stato.sogliaImpatto * 0.6) {
    DOM.gforceValue.className = 'gforce-value warning';
  } else {
    DOM.gforceValue.className = 'gforce-value';
  }

  // ---- Aggiorna barre assi ----
  // Normalizziamo i valori per la barra: max visualizzato = ±15 m/s²
  const maxAsse = 15;
  aggiornaBarraProgressione(DOM.axisBarX, (Math.abs(ax) / maxAsse) * 100);
  aggiornaBarraProgressione(DOM.axisBarY, (Math.abs(ay) / maxAsse) * 100);
  aggiornaBarraProgressione(DOM.axisBarZ, (Math.abs(az) / maxAsse) * 100);
  DOM.axisValueX.textContent = ax.toFixed(2);
  DOM.axisValueY.textContent = ay.toFixed(2);
  DOM.axisValueZ.textContent = az.toFixed(2);

  // ---- Aggiorna grafico G-Force ----
  aggiungiPuntoGraficoGforce(G_RAW);

  // ---- Rilevamento impatto ----
  rilevaPiccoImpatto(G_RAW);
}

// --- 9.5 Rilevamento Picchi di Impatto ---

/**
 * Rileva un picco di impatto quando la G-Force supera la soglia sport.
 * Un sistema di cooldown evita di contare più volte lo stesso impatto.
 *
 * @param {number} gforce - G-Force attuale calcolata
 */
function rilevaPiccoImpatto(gforce) {
  if (gforce < stato.sogliaImpatto) return;  // Sotto soglia: nessun impatto
  if (stato.inCooldownImpatto) return;       // In cooldown: già rilevato

  // ---- IMPATTO RILEVATO! ----
  stato.inCooldownImpatto = true;

  const config     = SPORT_CONFIG[stato.sportAttivo];
  const ora        = new Date();
  const timestamp  = ora.toLocaleTimeString('it-IT');

  // Crea record impatto
  const impatto = {
    id:        Date.now(),
    tempo:     timestamp,
    valore:    gforce,
    sport:     stato.sportAttivo,
    sogliaUsata: stato.sogliaImpatto,
  };
  stato.impatti.push(impatto);

  // Aggiorna contatore impatti
  const nImpatti = stato.impatti.length;
  DOM.impactCounter.textContent = nImpatti;
  DOM.statImpacts.textContent   = nImpatti;

  // Animazione bump sul contatore
  DOM.impactCounter.classList.remove('bump');
  requestAnimationFrame(() => DOM.impactCounter.classList.add('bump'));

  // Aggiorna testo ultimo impatto
  DOM.impactLast.textContent = `Ultimo: ${gforce.toFixed(2)}G alle ${timestamp}`;

  // Aggiungi voce nel log della Dashboard
  aggiungiVoceLog(impatto, config);

  // Notifica toast
  mostraToast(`${config.emoji} Impatto rilevato: ${gforce.toFixed(2)}G!`, 'warning', 2500);

  // Reset cooldown dopo COOLDOWN_MS millisecondi
  setTimeout(() => {
    stato.inCooldownImpatto = false;
  }, stato.COOLDOWN_MS);
}

/**
 * Aggiunge una voce al log impatti nella Dashboard.
 * @param {Object} impatto - Oggetto dati impatto
 * @param {Object} config - Configurazione sport corrente
 */
function aggiungiVoceLog(impatto, config) {
  // Rimuovi messaggio "vuoto" se presente
  if (DOM.logEmpty) DOM.logEmpty.style.display = 'none';

  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `
    <span class="log-entry-icon">${config.emoji}</span>
    <div class="log-entry-info">
      <span class="log-entry-sport">${config.nome} — Impatto #${stato.impatti.length}</span>
      <span class="log-entry-time">⏱ ${impatto.tempo}</span>
    </div>
    <span class="log-entry-value">${impatto.valore.toFixed(2)}G</span>
  `;

  // Inserisci in cima al log (più recente in alto)
  DOM.impactLog.insertBefore(entry, DOM.impactLog.firstChild);

  // Limita il log a 50 voci per non appesantire il DOM
  while (DOM.impactLog.children.length > 51) {
    DOM.impactLog.removeChild(DOM.impactLog.lastChild);
  }
}

// ============================================================
// SEZIONE 10: GRAFICI — CHART.JS
// ============================================================

/**
 * Configurazione condivisa per lo stile dei grafici.
 * Tema scuro coerente con il design system dell'app.
 */
const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 0 }, // Disabilita animazione per aggiornamenti real-time
  plugins: {
    legend: {
      labels: {
        color:     '#7b82a0',
        font:      { family: 'Space Mono', size: 11 },
        boxWidth:  12,
        padding:   12,
      }
    },
    tooltip: {
      backgroundColor: 'rgba(10,14,26,0.95)',
      titleColor: '#00f5d4',
      bodyColor:  '#e8eaf2',
      borderColor:'rgba(0,245,212,0.3)',
      borderWidth: 1,
    }
  },
  scales: {
    x: {
      grid:   { color: 'rgba(255,255,255,0.04)', drawBorder: false },
      ticks:  { color: '#4a5070', font: { size: 10 }, maxTicksLimit: 8 },
    },
    y: {
      grid:   { color: 'rgba(255,255,255,0.06)', drawBorder: false },
      ticks:  { color: '#7b82a0', font: { family: 'Space Mono', size: 10 } },
    }
  }
};

/**
 * Crea il grafico a linea per l'andamento dell'angolo articolare nel tempo.
 * Aggiornato ad ogni frame del Vision Engine.
 */
function creaGraficoAngolo() {
  const ctx = DOM.angleChartCanvas.getContext('2d');

  stato.graficoAngolo = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label:           'Angolo Ginocchio (°)',
        data:            [],
        borderColor:     '#00f5d4',
        backgroundColor: 'rgba(0,245,212,0.08)',
        borderWidth:     2,
        pointRadius:     0,      // Nessun punto visibile (troppo rumoroso)
        fill:            true,
        tension:         0.4,    // Curva smooth
      }, {
        label:           'Soglia Critica 90°',
        data:            [],
        borderColor:     'rgba(247,37,133,0.6)',
        borderWidth:     1.5,
        borderDash:      [6, 4], // Linea tratteggiata
        pointRadius:     0,
        fill:            false,
      }]
    },
    options: {
      ...CHART_DEFAULTS,
      scales: {
        ...CHART_DEFAULTS.scales,
        y: {
          ...CHART_DEFAULTS.scales.y,
          min: 0,
          max: 200,
          ticks: {
            ...CHART_DEFAULTS.scales.y.ticks,
            callback: (v) => `${v}°`,
          }
        }
      }
    }
  });
}

/**
 * Crea il grafico a linea per la G-Force in tempo reale.
 * Aggiornato ad ogni campione dell'accelerometro (10 Hz).
 */
function creaGraficoGforce() {
  const ctx = DOM.gforceChartCanvas.getContext('2d');

  stato.graficoGforce = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label:           'G-Force (G)',
        data:            [],
        borderColor:     '#f72585',
        backgroundColor: 'rgba(247,37,133,0.08)',
        borderWidth:     2,
        pointRadius:     0,
        fill:            true,
        tension:         0.3,
      }, {
        label:           'Soglia Impatto',
        data:            [],
        borderColor:     'rgba(255,214,10,0.7)',
        borderWidth:     1.5,
        borderDash:      [6, 4],
        pointRadius:     0,
        fill:            false,
      }]
    },
    options: {
      ...CHART_DEFAULTS,
      scales: {
        ...CHART_DEFAULTS.scales,
        y: {
          ...CHART_DEFAULTS.scales.y,
          min: 0,
          suggestedMax: 5,
          ticks: {
            ...CHART_DEFAULTS.scales.y.ticks,
            callback: (v) => `${v}G`,
          }
        }
      }
    }
  });
}

/**
 * Aggiunge un punto al grafico dell'angolo articolare.
 * Mantiene al massimo MAX_PUNTI_GRAFICO campioni visibili (finestra scorrevole).
 * @param {number} angolo - Angolo in gradi
 */
function aggiungiPuntoGraficoAngolo(angolo) {
  if (!stato.graficoAngolo) return;

  const grafico  = stato.graficoAngolo;
  const secondi  = ((Date.now() - stato.tempoInizio) / 1000).toFixed(1);

  grafico.data.labels.push(`${secondi}s`);
  grafico.data.datasets[0].data.push(Math.round(angolo));
  // Linea soglia critica al 90°
  grafico.data.datasets[1].data.push(90);

  // Finestra scorrevole: rimuovi il punto più vecchio se superiamo il limite
  if (grafico.data.labels.length > stato.MAX_PUNTI_GRAFICO) {
    grafico.data.labels.shift();
    grafico.data.datasets[0].data.shift();
    grafico.data.datasets[1].data.shift();
  }

  grafico.update('none'); // 'none': aggiornamento senza animazione (performance)
}

/**
 * Aggiunge un punto al grafico della G-Force.
 * @param {number} gforce - Valore G-Force corrente
 */
function aggiungiPuntoGraficoGforce(gforce) {
  if (!stato.graficoGforce) return;

  const grafico = stato.graficoGforce;
  const ora     = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  grafico.data.labels.push(ora);
  grafico.data.datasets[0].data.push(parseFloat(gforce.toFixed(3)));
  // Linea soglia dinamica (aggiornata con lo slider)
  grafico.data.datasets[1].data.push(stato.sogliaImpatto);

  if (grafico.data.labels.length > stato.MAX_PUNTI_GRAFICO) {
    grafico.data.labels.shift();
    grafico.data.datasets[0].data.shift();
    grafico.data.datasets[1].data.shift();
  }

  grafico.update('none');
}

// ============================================================
// SEZIONE 11: ESPORTAZIONE DATI
// ============================================================

/**
 * Esporta i dati della sessione come file JSON scaricabile.
 * Include: sport, durata, statistiche e tutti gli impatti registrati.
 */
function esportaDatiJSON() {
  if (stato.impatti.length === 0) {
    mostraToast('Nessun dato da esportare. Avvia una sessione prima.', 'warning');
    return;
  }

  const durata = stato.tempoInizio
    ? formatDurata(Date.now() - stato.tempoInizio)
    : '00:00';

  const esportazione = {
    app:             'Neuro-Kinetic Web Hub',
    versione:        '1.0',
    dataEsportazione: new Date().toISOString(),
    sessione: {
      sport:          SPORT_CONFIG[stato.sportAttivo]?.nome,
      durata:         durata,
      sogliaUsata:    `${stato.sogliaImpatto}G`,
      angoloMinGinocchio: stato.angoloMinSessione < Infinity
        ? `${Math.round(stato.angoloMinSessione)}°`
        : 'N/A',
      gforceMax:      `${stato.gforceMax.toFixed(2)}G`,
      totaleImpatti:  stato.impatti.length,
    },
    impatti: stato.impatti,
  };

  // Crea un file JSON e avvia il download
  const blob    = new Blob([JSON.stringify(esportazione, null, 2)], { type: 'application/json' });
  const url     = URL.createObjectURL(blob);
  const anchor  = document.createElement('a');
  anchor.href   = url;
  anchor.download = `nkhub_sessione_${stato.sportAttivo}_${Date.now()}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);

  mostraToast(`Dati esportati: ${stato.impatti.length} impatti.`, 'success');
}

// ============================================================
// SEZIONE 12: PWA — SERVICE WORKER
// ============================================================

/**
 * Registra il Service Worker per il supporto offline e l'installabilità PWA.
 * Il Service Worker intercetta le richieste di rete e gestisce la cache.
 */
function registraServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registrazione = await navigator.serviceWorker.register('./sw.js');
        console.log('[SW] Service Worker registrato:', registrazione.scope);
      } catch (errore) {
        console.warn('[SW] Registrazione fallita:', errore);
        // Non critico: l'app funziona anche senza SW
      }
    });
  }
}

// ============================================================
// SEZIONE 13: INIZIALIZZAZIONE APPLICAZIONE
// ============================================================

/**
 * Funzione principale di inizializzazione.
 * Eseguita al termine del caricamento del DOM (DOMContentLoaded).
 * Collega tutti i listener degli eventi e avvia i moduli.
 */
async function inizializzaApp() {
  console.log('🚀 Neuro-Kinetic Web Hub — Avvio...');

  // 1. Navigazione
  inizializzaNavigazione();

  // 2. Selettore sport
  inizializzaSportSelector();

  // 3. Grafici Chart.js
  creaGraficoAngolo();
  creaGraficoGforce();

  // 4. Bottoni Vision Engine
  DOM.btnStartCamera.disabled = true; // Disabilitato finché il modello non è caricato
  DOM.btnStartCamera.addEventListener('click', avviaFotocamera);
  DOM.btnStopCamera.addEventListener('click',  fermaFotocamera);

  // 5. Bottoni Kinetic Sensor
  DOM.btnStartSensor.addEventListener('click', avviaSensore);
  DOM.btnStopSensor.addEventListener('click',  fermaSensore);

  // 6. Esportazione dati
  DOM.btnExportLog.addEventListener('click', esportaDatiJSON);

  // 7. Carica il modello MoveNet in background
  // (non blocca il rendering dell'interfaccia)
  caricaModelloMoveNet();

  // 8. Registra Service Worker per PWA
  registraServiceWorker();

  // 9. Prompt installazione PWA — mostrato solo se il browser lo supporta
  // (non viene mostrato all'avvio, ma disponibile come banner)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    // Non disturbiamo l'utente con un toast immediato
    console.log('[PWA] App installabile. Evento beforeinstallprompt catturato.');
  });

  console.log('✅ App inizializzata con successo!');
  // Toast rimosso — l'UI parla da sola
}

// ============================================================
// AVVIO — Esegui solo quando il DOM è completamente caricato
// ============================================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inizializzaApp);
} else {
  // Il DOM è già pronto (script caricato con defer)
  inizializzaApp();
}
