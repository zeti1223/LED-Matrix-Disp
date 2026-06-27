const socket = io();

function $(id) { return document.getElementById(id); }

function appendConsole(text) {
    const el = $('console');
    el.textContent += text;
    el.scrollTop = el.scrollHeight;
    setConsoleLastLine();
}
// update data-last attribute to show last line when collapsed
function setConsoleLastLine() {
    const el = $('console');
    if (!el) return;
    const lines = el.textContent.trim().split(/\r?\n/).filter(l=>l.length>0);
    const last = lines.length ? lines[lines.length-1] : '';
    el.dataset.last = last;
}

function refreshPorts() {
    fetch('/ports').then(r => r.json()).then(list => {
        const sel = $('ports');
        sel.innerHTML = '';
        list.forEach(p => {
            const opt = document.createElement('option'); opt.value = p; opt.textContent = p; sel.appendChild(opt);
        });
        if (list.length) $('status').textContent = 'Ports refreshed';
        else $('status').textContent = 'No ports found';
    }).catch(e => { $('status').textContent = 'Error fetching ports'; });
}

// simple debounce helper
function debounce(fn, wait) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); }; }

let canvas = null;
let ctx = null;
let connected = false;
let frameSendEnabled = false;
let lastFrameSent = 0;
const FRAME_SEND_INTERVAL = 80;

document.addEventListener('DOMContentLoaded', () => {
    refreshPorts();

    $('refresh').addEventListener('click', refreshPorts);

    $('connect').addEventListener('click', () => {
        const port = $('ports').value;
        socket.emit('connect_port', { port });
    });

    $('disconnect').addEventListener('click', () => {
        socket.emit('disconnect_port', {});
    });

    // Input change listeners
    ['r', 'g', 'b'].forEach(id => {
        const el = $(id);
        if (el) el.addEventListener('input', () => { updatePreviewState(); });
    });

    const briEl = $('brightness');
    if (briEl) briEl.addEventListener('input', () => { updatePreviewState(); });

    const patEl = $('pattern');
    if (patEl) patEl.addEventListener('change', () => { updatePreviewState(); });

    // Strobe controls: update preview on change (on/off, speed + fill)
    const strobeControls = ['strobe-on','strobe-speed','strobe-duty'];
    strobeControls.forEach(id => {
        const el = $(id);
        if (!el) return;
        el.addEventListener('input', () => { updatePreviewState(); });
        el.addEventListener('change', () => { updatePreviewState(); });
    });

    // Speed label live update (show Hz)
    const speedEl = $('strobe-speed');
    const speedValEl = $('strobe-speed-val');
    function updateSpeedLabel(v) { if (speedValEl) speedValEl.textContent = v + ' Hz'; }
    if (speedEl) {
        updateSpeedLabel(speedEl.value);
        speedEl.addEventListener('input', (e) => { updateSpeedLabel(e.target.value); });
    }

    // Toggle console visibility
    const toggleConsoleBtn = $('toggle-console');
    if (toggleConsoleBtn) {
        toggleConsoleBtn.addEventListener('click', () => {
            const consoleEl = $('console');
            const isHidden = consoleEl.style.display === 'none';
            consoleEl.style.display = isHidden ? 'block' : 'none';
            toggleConsoleBtn.textContent = isHidden ? 'Hide' : 'Show';
        });
    }

    // Toggle preview visibility
    const togglePreviewBtn = $('toggle-preview');
    if (togglePreviewBtn) {
        togglePreviewBtn.addEventListener('click', () => {
            const previewEl = $('preview');
            const isHidden = previewEl.style.display === 'none';
            previewEl.style.display = isHidden ? 'block' : 'none';
            togglePreviewBtn.textContent = isHidden ? 'Hide' : 'Show';
            if (isHidden && connected) startPreview();
        });
    }

    // Auto-start preview on connect
    startPreview();
});

socket.on('connect_result', (d) => {
    connected = !!d.ok;
    $('status').textContent = d.msg || JSON.stringify(d);
    appendConsole(`[connect] ${d.msg}\n`);
});

socket.on('disconnect_result', (d) => {
    connected = false;
    $('status').textContent = 'Disconnected';
    appendConsole('[disconnect]\n');
});

socket.on('send_result', (d) => {
    appendConsole(`[sent] ${d.command} -> ${d.msg}\n`);
});

function sendFrame(frame) {
    if (!connected || !frameSendEnabled) return;
    const now = Date.now();
    if (now - lastFrameSent < FRAME_SEND_INTERVAL) return;
    lastFrameSent = now;
    socket.emit('send_frame', { frame });
}

socket.on('serial_data', (d) => {
    appendConsole(d.data);
});

// --- Preview implementation ---
const PREVIEW_W = 8;
const PREVIEW_H = 8;
let previewAnim = null;
let previewState = { pattern: 0, r: 255, g: 255, b: 255, brightness: 128, step: 0 };

function getSelectedState() {
    return {
        pattern: parseInt($('pattern').value || 0),
        r: parseInt($('r').value || 0),
        g: parseInt($('g').value || 0),
        b: parseInt($('b').value || 0),
        brightness: parseInt($('brightness').value || 128),
        strobeOn: $('strobe-on') ? !!$('strobe-on').checked : false,
        strobeSpeed: $('strobe-speed') ? parseInt($('strobe-speed').value || 8) : 8,
        strobeFill: $('strobe-duty') ? parseInt($('strobe-duty').value || 50) : 50,
    };
}

function startPreview() {
    // lazy init canvas/context
    if (!canvas) canvas = document.getElementById('preview');
    if (!canvas) return;
    if (!ctx) ctx = canvas.getContext('2d');
    frameSendEnabled = true;
    // initialize
    const s = getSelectedState();
    previewState.pattern = s.pattern;
    previewState.r = s.r; previewState.g = s.g; previewState.b = s.b; previewState.brightness = s.brightness;
    previewState.strobeOn = s.strobeOn;
    previewState.strobeSpeed = s.strobeSpeed;
    previewState.strobeFill = s.strobeFill;
    previewState.step = 0;
    if (previewAnim) cancelAnimationFrame(previewAnim);
    function loop() {
        previewState.now = Date.now();
        renderPreviewFrame(previewState);
        const frame = buildFramePixels(previewState);
        sendFrame(frame);
        previewState.step = (previewState.step + 1) % 1024;
        previewAnim = requestAnimationFrame(loop);
    }
    previewAnim = requestAnimationFrame(loop);
}

function stopPreview() {
    if (previewAnim) cancelAnimationFrame(previewAnim);
    previewAnim = null;
    frameSendEnabled = false;
}

function renderPreviewFrame(state) {
    const w = canvas.width;
    const h = canvas.height;
    const cellW = Math.floor(w / PREVIEW_W);
    const cellH = Math.floor(h / PREVIEW_H);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);

    for (let y = 0; y < PREVIEW_H; y++) {
        for (let x = 0; x < PREVIEW_W; x++) {
            const color = getPixelColor(state, x, y);
            ctx.fillStyle = `rgb(${Math.round(color[0])},${Math.round(color[1])},${Math.round(color[2])})`;
            ctx.fillRect(x * cellW + 1, y * cellH + 1, cellW - 2, cellH - 2);
        }
    }
}

function getPixelColor(state, x, y) {
    const bri = state.brightness / 255;
    const step = state.step;
    // compute base color first
    let color = [0,0,0];
    switch (state.pattern) {
        case 0:
            color = [state.r * bri, state.g * bri, state.b * bri];
            break;
        case 1: {
            const hue = (step * 4 + (x + y) * 8) % 360;
            color = hsvToRgb(hue / 360, 1, bri);
            break;
        }
        case 2: {
            const idx = (y * PREVIEW_W + x);
            const on = ((idx + Math.floor(step / 6)) % 3) === 0;
            color = on ? hsvToRgb(((idx * 10 + step) & 255) / 255, 1, bri) : [0,0,0];
            break;
        }
        case 3: {
            const pos = Math.floor((step / 6) % (PREVIEW_W * 2));
            const scanX = pos < PREVIEW_W ? pos : (PREVIEW_W * 2 - 1 - pos);
            color = x === scanX ? hsvToRgb(((step * 5) & 255) / 255, 1, bri) : [0,0,0];
            break;
        }
        case 4: {
            const total = PREVIEW_W * PREVIEW_H;
            const index = (step % total);
            const idx = y * PREVIEW_W + x;
            color = idx <= index ? hsvToRgb(((idx * 4 + step) & 255) / 255, 1, bri) : [0,0,0];
            break;
        }
        case 5: {
            // built-in strobe pattern (legacy) — use selected color
            const flash = (Math.floor(step / 6) % 2) === 0;
            color = flash ? [state.r * bri, state.g * bri, state.b * bri] : [0,0,0];
            break;
        }
        default:
            color = [0,0,0];
    }

    // Simple strobe on/off overlay: checkbox enables strobing of the animation
    const enabled = !!state.strobeOn;
    if (!enabled) return color;

    const now = state.now || Date.now();
    const speed = state.strobeSpeed || 8; // Hz
    const duty = (state.strobeFill || state.strobeDuty || 50) / 100.0;
    const periodMs = Math.max(1, 1000 / Math.max(1, speed));
    const phase = (now % periodMs) / periodMs;
    const strobeOn = phase < duty;

    // overlay: when strobe phase is ON show the animation pixel, otherwise black
    return strobeOn ? color : [0,0,0];
}

function buildFramePixels(state) {
    const pixels = [];
    for (let y = 0; y < PREVIEW_H; y++) {
        for (let x = 0; x < PREVIEW_W; x++) {
            const color = getPixelColor(state, x, y);
            pixels.push(Math.round(color[0]), Math.round(color[1]), Math.round(color[2]));
        }
    }
    return pixels;
}

function updatePreviewState() {
    const s = getSelectedState();
    previewState.pattern = s.pattern;
    previewState.r = s.r; previewState.g = s.g; previewState.b = s.b; previewState.brightness = s.brightness;
    previewState.strobeOn = s.strobeOn;
    previewState.strobeSpeed = s.strobeSpeed;
    previewState.strobeFill = s.strobeFill;
    // if preview not running, start it; otherwise render one frame immediately
    if (!previewAnim) { startPreview(); }
    else if (ctx) { renderPreviewFrame(previewState); }
}

// simple HSV to RGB (v in [0..1])
function hsvToRgb(h, s, v) {
    let r = 0, g = 0, b = 0;
    let i = Math.floor(h * 6);
    let f = h * 6 - i;
    let p = v * (1 - s);
    let q = v * (1 - f * s);
    let t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
    }
    return [r * 255, g * 255, b * 255];
}

