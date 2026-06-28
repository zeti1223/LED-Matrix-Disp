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
    const lines = el.textContent.trim().split(/\r?\n/).filter(l => l.length > 0);
    const last = lines.length ? lines[lines.length - 1] : '';
    el.dataset.last = last;
}

function refreshPorts() {
    fetch('/ports').then(r => r.json()).then(list => {
        const sel = $('ports');
        sel.innerHTML = '';
        list.forEach(p => {
            const opt = document.createElement('option'); opt.value = p; opt.textContent = p; sel.appendChild(opt);
        });
        appendConsole(list.length ? '[ports] refreshed\n' : '[ports] no ports found\n');
    }).catch(e => { appendConsole('[ports] error fetching ports\n'); });
}

function getSelectedPattern() {
    const activeButton = document.querySelector('.pattern-btn.active');
    return activeButton ? parseInt(activeButton.dataset.pattern || '0', 10) : 0;
}

function setSelectedPattern(pattern) {
    document.querySelectorAll('.pattern-btn').forEach(button => {
        button.classList.toggle('active', parseInt(button.dataset.pattern || '0', 10) === pattern);
    });
}

function getStrobeEnabled() {
    const button = $('strobe-toggle');
    return !!(button && button.classList.contains('active'));
}

function setStrobeEnabled(enabled) {
    const button = $('strobe-toggle');
    if (!button) return;
    button.classList.toggle('active', enabled);
    button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    button.textContent = enabled ? 'Strobe on' : 'Strobe off';
}

function setColorControlsDisabled(disabled) {
    const colorCard = document.querySelector('[data-card-id="color"]');
    if (colorCard) {
        colorCard.classList.toggle('disabled', disabled);
        colorCard.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    }

    ['r', 'g', 'b'].forEach(id => {
        const input = $(id);
        if (input) input.disabled = disabled;
    });
}

function syncPatternDependentControls() {
    const pattern = getSelectedPattern();
    setColorControlsDisabled([1, 2, 3, 4].includes(pattern));
}

// Color helpers
function clamp(v, a, b) { return Math.min(b, Math.max(a, Number(v) || 0)); }
function padHex(n) { return n.toString(16).padStart(2, '0'); }
function rgbToHex(r, g, b) { return '#' + padHex(r) + padHex(g) + padHex(b); }
function hexToRgb(hex) {
    if (!hex) return null;
    const h = hex.replace('#', '');
    if (h.length === 3) {
        return { r: parseInt(h[0] + h[0], 16), g: parseInt(h[1] + h[1], 16), b: parseInt(h[2] + h[2], 16) };
    }
    if (h.length !== 6) return null;
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

function setColorMode(mode) {
    document.querySelectorAll('.color-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    const showHex = mode === 'hex';
    document.querySelector('.hex-inputs').style.display = showHex ? 'flex' : 'none';
    document.querySelector('.rgb-inputs').style.display = showHex ? 'none' : 'flex';
}

function setColorInputsFromRGB(r, g, b) {
    const hexInput = $('hex');
    if (hexInput) hexInput.value = rgbToHex(r, g, b);
    ['r', 'g', 'b'].forEach((id, idx) => { const el = $(id); if (el) el.value = [r, g, b][idx]; });
    // update OS picker
    const os = $('os-color-picker'); if (os) os.value = rgbToHex(r, g, b);
}

function setColorFromHex(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return;
    setColorInputsFromRGB(rgb.r, rgb.g, rgb.b);
}

function setCardCollapsed(card, collapsed) {
    if (!card) return;
    card.classList.toggle('collapsed', collapsed);
    const button = card.querySelector('.card-toggle');
    if (!button) return;
    button.classList.toggle('collapsed', collapsed);
    button.innerHTML = '<span class="toggle-icon" aria-hidden="true"></span><span class="toggle-label">' + (collapsed ? 'Expand' : 'Collapse') + '</span>';
    button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    button.setAttribute('aria-label', (collapsed ? 'Expand ' : 'Collapse ') + (card.dataset.cardId || 'panel'));
}

function toggleCard(card) {
    if (!card) return;
    setCardCollapsed(card, !card.classList.contains('collapsed'));
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

    setSelectedPattern(0);
    setStrobeEnabled(false);
    syncPatternDependentControls();

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

    document.querySelectorAll('.pattern-btn').forEach(button => {
        button.addEventListener('click', () => {
            setSelectedPattern(parseInt(button.dataset.pattern || '0', 10));
            syncPatternDependentControls();
            updatePreviewState();
        });
    });

    // Color mode buttons
    document.querySelectorAll('.color-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => { setColorMode(btn.dataset.mode); });
    });

    // OS color picker
    const osPicker = $('os-color-picker');
    if (osPicker) {
        osPicker.addEventListener('input', (e) => {
            const hex = e.target.value;
            setColorFromHex(hex);
            updatePreviewState();
        });
    }

    // Hex input
    const hexInput = $('hex');
    if (hexInput) {
        hexInput.addEventListener('change', (e) => {
            let v = e.target.value.trim(); if (!v.startsWith('#')) v = '#' + v; e.target.value = v.toLowerCase();
            setColorFromHex(v);
            updatePreviewState();
        });
    }

    // RGB inputs
    ['r', 'g', 'b'].forEach(id => {
        const el = $(id);
        if (!el) return;
        el.addEventListener('input', () => {
            const r = clamp($('r').value, 0, 255), g = clamp($('g').value, 0, 255), b = clamp($('b').value, 0, 255);
            setColorInputsFromRGB(r, g, b);
            updatePreviewState();
        });
    });

    // initialize color inputs (sync picker and hex)
    const initialR = clamp($('r').value, 0, 255), initialG = clamp($('g').value, 0, 255), initialB = clamp($('b').value, 0, 255);
    setColorInputsFromRGB(initialR, initialG, initialB);
    setColorMode('rgb');

    const strobeToggleBtn = $('strobe-toggle');
    if (strobeToggleBtn) {
        strobeToggleBtn.addEventListener('click', () => {
            setStrobeEnabled(!getStrobeEnabled());
            updatePreviewState();
        });
    }

    document.querySelectorAll('.card-toggle').forEach(button => {
        button.addEventListener('click', () => {
            const card = button.closest('.collapsible-card');
            if (card && button.id !== 'strobe-toggle') {
                toggleCard(card);
            }
        });
    });

    document.querySelectorAll('.collapsible-card').forEach(card => setCardCollapsed(card, false));

    const briEl = $('brightness');
    if (briEl) briEl.addEventListener('input', () => { updatePreviewState(); });

    // Strobe controls: update preview on change (on/off, speed + fill)
    const strobeControls = ['strobe-speed', 'strobe-duty'];
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
        pattern: getSelectedPattern(),
        r: parseInt($('r').value || 0),
        g: parseInt($('g').value || 0),
        b: parseInt($('b').value || 0),
        brightness: parseInt($('brightness').value || 128),
        strobeOn: getStrobeEnabled(),
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
    let color = [0, 0, 0];
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
            color = on ? hsvToRgb(((idx * 10 + step) & 255) / 255, 1, bri) : [0, 0, 0];
            break;
        }
        case 3: {
            const pos = Math.floor((step / 6) % (PREVIEW_W * 2));
            const scanX = pos < PREVIEW_W ? pos : (PREVIEW_W * 2 - 1 - pos);
            color = x === scanX ? hsvToRgb(((step * 5) & 255) / 255, 1, bri) : [0, 0, 0];
            break;
        }
        case 4: {
            const total = PREVIEW_W * PREVIEW_H;
            const index = (step % total);
            const idx = y * PREVIEW_W + x;
            color = idx <= index ? hsvToRgb(((idx * 4 + step) & 255) / 255, 1, bri) : [0, 0, 0];
            break;
        }
        case 5: {
            const pulse = (Math.sin(step / 6) + 1) / 2;
            color = [state.r * bri * pulse, state.g * bri * pulse, state.b * bri * pulse];
            break;
        }
        case 6: {
            const checker = ((x + y + Math.floor(step / 8)) % 2) === 0;
            const wave = 0.35 + 0.65 * ((Math.sin((x * 1.4) + (y * 1.1) + step / 5) + 1) / 2);
            color = checker
                ? [state.r * bri * wave, state.g * bri * wave, state.b * bri * wave]
                : hsvToRgb(((step * 3 + x * 12 + y * 12) & 255) / 255, 0.75, bri * 0.65);
            break;
        }
        default:
            color = [0, 0, 0];
    }

    // Simple strobe on/off overlay: toggle button enables strobing of the animation
    const enabled = !!state.strobeOn;
    if (!enabled) return color;

    const now = state.now || Date.now();
    const speed = state.strobeSpeed || 8; // Hz
    const duty = (state.strobeFill || state.strobeDuty || 50) / 100.0;
    const periodMs = Math.max(1, 1000 / Math.max(1, speed));
    const phase = (now % periodMs) / periodMs;
    const strobeOn = phase < duty;

    // overlay: when strobe phase is ON show the animation pixel, otherwise black
    return strobeOn ? color : [0, 0, 0];
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

