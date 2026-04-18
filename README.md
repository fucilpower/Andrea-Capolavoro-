# ⚡ Neuro-Kinetic Web Hub

> **Progetto Capolavoro — Liceo Scientifico Sportivo**  
> Analisi biomeccanica sportiva in tempo reale tramite Intelligenza Artificiale e sensori fisici

[![PWA Ready](https://img.shields.io/badge/PWA-Ready-00f5d4?style=flat-square&logo=pwa)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
[![TensorFlow.js](https://img.shields.io/badge/TensorFlow.js-MoveNet-f72585?style=flat-square&logo=tensorflow)](https://www.tensorflow.org/js)
[![Chart.js](https://img.shields.io/badge/Chart.js-4.x-7209b7?style=flat-square)](https://www.chartjs.org/)
[![Vanilla JS](https://img.shields.io/badge/JavaScript-ES6+-ffd60a?style=flat-square&logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

---

## 📖 Cos'è Neuro-Kinetic Hub?

**Neuro-Kinetic Hub (NKHub)** è una **Progressive App (PWA)** che porta l'analisi biomeccanica sportiva — fino ad oggi riservata a laboratori universitari e centri di alto livello — direttamente sullo smartphone dell'atleta, senza costi e senza installare nulla.

L'app combina tre tecnologie all'avanguardia:

| Tecnologia | Cosa fa |
|---|---|
| 🤖 **Intelligenza Artificiale** (MoveNet) | Traccia il corpo in tempo reale dalla fotocamera |
| 📡 **Accelerometro** (Generic Sensor API) | Misura forze e impatti fisici durante il movimento |
| 📊 **Grafici dinamici** (Chart.js) | Visualizza i dati in tempo reale con grafici interattivi |

---

## 🏅 A cosa serve? Applicazioni pratiche

### 🏉 Rugby — Analisi dei Placcaggi
L'accelerometro rileva i **picchi di G-Force** durante i contatti fisici. Ogni placcaggio genera un'accelerazione superiore a 3-4G: l'app la misura, la registra e la classifica. Utile per:
- Monitorare l'intensità degli scontri in allenamento
- Studiare la distribuzione degli impatti durante una partita
- Valutare il rischio di infortuni da contatto

### ⚽ Calcio — Cambio di Direzione e Accelerazioni
Tramite il Vision Engine, l'app analizza l'**angolo di flessione del ginocchio** durante i cambi di direzione. Un angolo inferiore a 90° indica una fase di massimo caricamento muscolare — momento critico per le lesioni del legamento crociato anteriore (LCA).

### 🏐 Pallavolo — Analisi del Salto
La combinazione di fotocamera e accelerometro permette di:
- Rilevare la fase di **preparazione al salto** (angolo ginocchio < 90°)
- Misurare la G-Force all'atterraggio (impatto sul suolo)
- Confrontare la tecnica di salto tra atleticamente diverse

### 🏃 Atletica — Biomeccanica della Corsa
L'analisi posturale tramite MoveNet consente di valutare la posizione del baricentro e la meccanica degli arti inferiori. Utile per allenatori e preparatori atletici che vogliono ottimizzare la tecnica di corsa.

---

## 🧮 Formule Fisiche e Matematiche Applicate

Questo progetto dimostra l'applicazione pratica di **Fisica** e **Matematica** allo sport:

### 1. Angolo Articolare — Prodotto Scalare tra Vettori

Per calcolare l'angolo di flessione del ginocchio, utilizziamo la formula del **prodotto scalare**:

$$\cos(\theta) = \frac{\vec{v_1} \cdot \vec{v_2}}{|\vec{v_1}| \times |\vec{v_2}|}$$

Dove:
- **v₁** = vettore da ginocchio → anca (segmento coscia)
- **v₂** = vettore da ginocchio → caviglia (segmento stinco)
- **θ** = angolo di flessione del ginocchio in gradi

```javascript
// Prodotto scalare tra i due vettori
const prodottoScalare = v1.x * v2.x + v1.y * v2.y;

// Modulo (lunghezza) dei vettori — Teorema di Pitagora
const moduloV1 = Math.sqrt(v1.x² + v1.y²);
const moduloV2 = Math.sqrt(v2.x² + v2.y²);

// Angolo in gradi
const angolo = Math.acos(prodottoScalare / (moduloV1 * moduloV2)) * (180 / Math.PI);
```

| Angolo | Significato Biomeccanico |
|---|---|
| **> 120°** | Posizione eretta, gamba estesa |
| **90° – 120°** | Fase di caricamento muscolare |
| **< 90°** | Massima flessione — momento critico |

---

### 2. Accelerazione Risultante — G-Force

La **forza G** è calcolata come il modulo del vettore tridimensionale dell'accelerazione:

$$G = \frac{\sqrt{a_x^2 + a_y^2 + a_z^2}}{9{,}81 \text{ m/s}^2}$$

Dove aₓ, aᵧ, a_z sono le accelerazioni sui tre assi spaziali in m/s², divise per g ≈ 9,81 m/s² per ottenere il valore adimensionale in "G".

```javascript
// Forza G risultante dai tre assi dell'accelerometro
const G = Math.sqrt(ax*ax + ay*ay + az*az) / 9.81;
```

| G-Force | Contesto Sportivo |
|---|---|
| ~1G | Camminata normale |
| 2–3G | Salto, accelerazione sprint |
| 3–5G | Placcaggio rugby, caduta |
| > 5G | Impatto ad alta intensità |

---

### 3. Media Mobile Esponenziale (EMA) — Smoothing del Segnale

Per ridurre il rumore del sensore, applichiamo una **media mobile esponenziale**:

$$EMA_t = \alpha \times G_t + (1 - \alpha) \times EMA_{t-1}$$

Con **α = 0,15**: il segnale risponde ai cambiamenti reali ma ignora le fluttuazioni istantanee del sensore.

---

## 🛠️ Stack Tecnologico

```
Neuro-Kinetic Web Hub
├── HTML5          → Struttura semantica e accessibilità
├── CSS3           → Dark mode, glassmorphism, animazioni
├── JavaScript ES6 → Logica, sensori, grafici (Vanilla, no framework)
│
├── TensorFlow.js  → Motore IA (backend WebGL per accelerazione GPU)
│   └── MoveNet    → Modello di pose estimation (17 keypoints, ~50 FPS)
│
├── Chart.js       → Grafici real-time (angoli, G-force)
│
└── PWA APIs
    ├── Service Worker   → Cache offline
    ├── Web App Manifest → Installabilità
    ├── getUserMedia     → Accesso fotocamera
    └── DeviceMotionEvent → Accelerometro
```

---

## 📱 Installazione e Utilizzo

### Requisiti
- Smartphone con **Chrome** (Android) o **Safari** (iOS 13+)
- Connessione internet per il primo caricamento (poi funziona offline)
- Permesso **fotocamera** per Vision Engine
- Permesso **sensori di movimento** per Kinetic Sensor (iOS richiede conferma)

### Avvio rapido

1. Apri l'URL dell'app nel browser del telefono
2. Su **Android** → tocca il banner "*Aggiungi alla schermata Home*"
3. Su **iOS** → tocca **Condividi** → **"Aggiungi alla schermata Home"**
4. L'app si comporta come una vera app nativa

### Utilizzo in allenamento

```
1. Seleziona lo sport dalla Dashboard
2. Tab "Vision IA" → Avvia Fotocamera → posiziona il dispositivo
   a livello della vita o su un treppiede per vedere l'atleta intero
3. Tab "Sensore" → Avvia Sensore → tieni il telefono in tasca o
   fissalo sull'atleta
4. Esporta i dati in JSON dalla Dashboard per l'analisi post-sessione
```

---

## 📁 Struttura del Progetto

```
capolavoro/
├── index.html      # Struttura HTML5, CDN imports, pannelli
├── style.css       # Design system, dark mode, animazioni
├── script.js       # Logica IA, sensori, grafici (commenti in italiano)
├── manifest.json   # Configurazione PWA
├── sw.js           # Service Worker — gestione cache offline
├── icon.svg        # Icona app
└── README.md       # Questo file
```

---

## 🔬 Connessioni con le Materie Scolastiche

| Materia | Applicazione nel Progetto |
|---|---|
| **Informatica** | PWA, Service Worker, API browser, TensorFlow.js |
| **Fisica** | G-Force vettoriale, cinematica, dinamica degli impatti |
| **Matematica** | Prodotto scalare, modulo vettoriale, arcoseno, EMA |
| **Scienze Motorie** | Biomeccanica, analisi posturale, fisiologia sportiva |
| **Inglese** | Documentazione tecnica, API in lingua inglese |

---

## 👨‍💻 Autore

**Andrea Manai**  
3ASS — Liceo Scientifico Sportivo  
Anno Scolastico 2025/2026

---

## 📄 Licenza

Progetto didattico — uso libero per scopi educativi.  
Librerie esterne: [TensorFlow.js](https://github.com/tensorflow/tfjs) (Apache 2.0) · [Chart.js](https://github.com/chartjs/Chart.js) (MIT)
