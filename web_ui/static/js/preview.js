const PREVIEW_W = 8;
const PREVIEW_H = 8;

let canvas = null;
let ctx = null;
let previewAnim = null;
let previewState = { pattern: 0, r: 255, g: 255, b: 255, brightness: 128, step: 0 };

function getSelectedState() {
    return {
        pattern: getSelectedPattern(),
        r: parseInt($('r').value || 0, 10),
        g: parseInt($('g').value || 0, 10),
        b: parseInt($('b').value || 0, 10),
        brightness: parseInt($('brightness').value || 128, 10),
        strobeOn: getStrobeEnabled(),
        strobeSpeed: $('strobe-speed') ? parseInt($('strobe-speed').value || 8, 10) : 8,
        strobeFill: $('strobe-duty') ? parseInt($('strobe-duty').value || 50, 10) : 50,
    };
}

function startPreview() {
    if (!canvas) canvas = document.getElementById('preview');
    if (!canvas) return;
    if (!ctx) ctx = canvas.getContext('2d');

    frameSendEnabled = true;

    const state = getSelectedState();
    previewState.pattern = state.pattern;
    previewState.r = state.r;
    previewState.g = state.g;
    previewState.b = state.b;
    previewState.brightness = state.brightness;
    previewState.strobeOn = state.strobeOn;
    previewState.strobeSpeed = state.strobeSpeed;
    previewState.strobeFill = state.strobeFill;
    previewState.step = 0;

    if (previewAnim) cancelAnimationFrame(previewAnim);

    function loop() {
        previewState.now = Date.now();
        renderPreviewFrame(previewState);
        sendFrame(buildFramePixels(previewState));
        previewState.step = (previewState.step + 1) % 1024;
        previewAnim = requestAnimationFrame(loop);
    }

    previewAnim = requestAnimationFrame(loop);

    // notify server of our current state
    if (window.sendState) {
        try { window.sendState(getSelectedState()); } catch (e) {}
    }
}

function stopPreview() {
    if (previewAnim) cancelAnimationFrame(previewAnim);
    previewAnim = null;
    frameSendEnabled = false;
}

function renderPreviewFrame(state) {
    const width = canvas.width;
    const height = canvas.height;
    const cellWidth = Math.floor(width / PREVIEW_W);
    const cellHeight = Math.floor(height / PREVIEW_H);

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    for (let y = 0; y < PREVIEW_H; y++) {
        for (let x = 0; x < PREVIEW_W; x++) {
            const color = getPixelColor(state, x, y);
            ctx.fillStyle = `rgb(${Math.round(color[0])},${Math.round(color[1])},${Math.round(color[2])})`;
            ctx.fillRect(x * cellWidth + 1, y * cellHeight + 1, cellWidth - 2, cellHeight - 2);
        }
    }
}

function getPixelColor(state, x, y) {
    const brightness = state.brightness / 255;
    const step = state.step;
    let color = [0, 0, 0];

    switch (state.pattern) {
        case 0:
            color = [state.r * brightness, state.g * brightness, state.b * brightness];
            break;
        case 1: {
            const hue = (step * 4 + (x + y) * 8) % 360;
            color = hsvToRgb(hue / 360, 1, brightness);
            break;
        }
        case 2: {
            const index = y * PREVIEW_W + x;
            const on = ((index + Math.floor(step / 6)) % 3) === 0;
            color = on ? hsvToRgb(((index * 10 + step) & 255) / 255, 1, brightness) : [0, 0, 0];
            break;
        }
        case 3: {
            const pos = Math.floor((step / 6) % (PREVIEW_W * 2));
            const scanX = pos < PREVIEW_W ? pos : (PREVIEW_W * 2 - 1 - pos);
            color = x === scanX ? hsvToRgb(((step * 5) & 255) / 255, 1, brightness) : [0, 0, 0];
            break;
        }
        case 4: {
            const total = PREVIEW_W * PREVIEW_H;
            const index = step % total;
            const pixelIndex = y * PREVIEW_W + x;
            color = pixelIndex <= index ? hsvToRgb(((pixelIndex * 4 + step) & 255) / 255, 1, brightness) : [0, 0, 0];
            break;
        }
        case 5: {
            const pulse = (Math.sin(step / 6) + 1) / 2;
            color = [state.r * brightness * pulse, state.g * brightness * pulse, state.b * brightness * pulse];
            break;
        }
        case 6: {
            const checker = ((x + y + Math.floor(step / 8)) % 2) === 0;
            const wave = 0.35 + 0.65 * ((Math.sin((x * 1.4) + (y * 1.1) + step / 5) + 1) / 2);
            color = checker
                ? [state.r * brightness * wave, state.g * brightness * wave, state.b * brightness * wave]
                : hsvToRgb(((step * 3 + x * 12 + y * 12) & 255) / 255, 0.75, brightness * 0.65);
            break;
        }
        default:
            color = [0, 0, 0];
    }

    if (!state.strobeOn) return color;

    const now = state.now || Date.now();
    const speed = state.strobeSpeed || 8;
    const duty = (state.strobeFill || state.strobeDuty || 50) / 100.0;
    const periodMs = Math.max(1, 1000 / Math.max(1, speed));
    const phase = (now % periodMs) / periodMs;

    return phase < duty ? color : [0, 0, 0];
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
    const state = getSelectedState();
    previewState.pattern = state.pattern;
    previewState.r = state.r;
    previewState.g = state.g;
    previewState.b = state.b;
    previewState.brightness = state.brightness;
    previewState.strobeOn = state.strobeOn;
    previewState.strobeSpeed = state.strobeSpeed;
    previewState.strobeFill = state.strobeFill;

    if (!previewAnim) {
        startPreview();
    } else if (ctx) {
        renderPreviewFrame(previewState);
    }

    // send updated UI state to server (throttled by socket.js)
    if (window.sendState && !window.suppressStateEmit) {
        try { window.sendState(state); } catch (e) {}
    }
}


// apply a canonical state received from server to local controls
window.applyServerState = function(s) {
    if (!s || typeof s !== 'object') return;
    window.suppressStateEmit = true;
    try {
        if (typeof s.pattern !== 'undefined') {
            setSelectedPattern(parseInt(s.pattern || 0, 10));
            // ensure controls that depend on pattern (like color inputs) are updated
            if (typeof syncPatternDependentControls === 'function') {
                try { syncPatternDependentControls(); } catch (e) {}
            }
        }
        if (typeof s.r !== 'undefined' && typeof s.g !== 'undefined' && typeof s.b !== 'undefined') {
            setColorInputsFromRGB(parseInt(s.r || 0,10), parseInt(s.g || 0,10), parseInt(s.b || 0,10));
        }
        if (typeof s.brightness !== 'undefined') {
            const b = $('brightness'); if (b) b.value = parseInt(s.brightness || 0,10);
        }
        if (typeof s.strobeOn !== 'undefined') setStrobeEnabled(!!s.strobeOn);
        if (typeof s.strobeSpeed !== 'undefined') { const el = $('strobe-speed'); if (el) el.value = parseInt(s.strobeSpeed||8,10); }
        if (typeof s.strobeFill !== 'undefined') { const el = $('strobe-duty'); if (el) el.value = parseInt(s.strobeFill||50,10); }

        // update rendered preview
        updatePreviewState();
    } finally {
        setTimeout(() => { window.suppressStateEmit = false; }, 120);
    }
};

function hsvToRgb(h, s, v) {
    let r = 0;
    let g = 0;
    let b = 0;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);

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