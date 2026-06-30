const PREVIEW_W = 8;
const PREVIEW_H = 8;

let canvas = null;
let ctx = null;
let previewAnim = null;
window.previewState = { r: 255, g: 255, b: 255, brightness: 128, step: 0, displayMode: 0 };
const previewState = window.previewState;
let currentAnimation = null;
let animationFrameIndex = 0;
let lastAnimationFrameTime = 0;

function getSelectedState() {
    return {
        // Pattern-related (commented out until Arduino implements patterns)
        // pattern: getSelectedPattern(),
        r: parseInt($('r').value || 0, 10),
        g: parseInt($('g').value || 0, 10),
        b: parseInt($('b').value || 0, 10),
        brightness: parseInt($('brightness').value || 128, 10),
    };
}

function startPreview() {
    if (!canvas) canvas = document.getElementById('preview');
    if (!canvas) return;
    if (!ctx) ctx = canvas.getContext('2d');

    // Disable continuous frame sending - only send on state changes
    frameSendEnabled = false;

    const state = getSelectedState();
    // Pattern-related (commented out until Arduino implements patterns)
    // previewState.pattern = state.pattern;
    previewState.r = state.r;
    previewState.g = state.g;
    previewState.b = state.b;
    previewState.brightness = state.brightness;
    previewState.step = 0;

    if (previewAnim) cancelAnimationFrame(previewAnim);

    // Only render preview, don't send frames continuously
    function loop() {
        previewState.now = Date.now();
        renderPreviewFrame(previewState);
        // Don't send frame automatically - only on state changes
        previewState.step = (previewState.step + 1) % 1024;
        previewAnim = requestAnimationFrame(loop);
    }

    previewAnim = requestAnimationFrame(loop);

    // notify server of our current state
    if (window.sendState) {
        try { window.sendState(getSelectedState()); } catch (e) { }
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

    // If in animation mode (displayMode 2) and we have animation data
    if (state.displayMode === 2 && currentAnimation && currentAnimation.frames && currentAnimation.frames.length > 0) {
        const now = Date.now();
        const delay = currentAnimation.delay || 100;

        if (now - lastAnimationFrameTime >= delay) {
            animationFrameIndex = (animationFrameIndex + 1) % currentAnimation.frames.length;
            lastAnimationFrameTime = now;
        }

        const frame = currentAnimation.frames[animationFrameIndex];
        const colorMap = {
            '0': [0, 0, 0],
            '1': [255, 0, 0],
            '2': [0, 255, 0],
            '3': [0, 0, 255],
            '4': [255, 255, 0],
            '5': [255, 0, 255],
            '6': [0, 255, 255],
            '7': [255, 255, 255]
        };

        for (let y = 0; y < PREVIEW_H; y++) {
            for (let x = 0; x < PREVIEW_W; x++) {
                const ledIndex = y * PREVIEW_W + x;
                const colorCode = frame[ledIndex] || '0';
                const color = colorMap[colorCode] || [0, 0, 0];
                const brightness = state.brightness / 255;
                ctx.fillStyle = `rgb(${Math.round(color[0] * brightness)},${Math.round(color[1] * brightness)},${Math.round(color[2] * brightness)})`;
                ctx.fillRect(x * cellWidth + 1, y * cellHeight + 1, cellWidth - 2, cellHeight - 2);
            }
        }
    } else {
        // Normal static color mode
        for (let y = 0; y < PREVIEW_H; y++) {
            for (let x = 0; x < PREVIEW_W; x++) {
                const color = getPixelColor(state, x, y);
                ctx.fillStyle = `rgb(${Math.round(color[0])},${Math.round(color[1])},${Math.round(color[2])})`;
                ctx.fillRect(x * cellWidth + 1, y * cellHeight + 1, cellWidth - 2, cellHeight - 2);
            }
        }
    }
}

function getPixelColor(state, x, y) {
    const brightness = state.brightness / 255;
    const step = state.step;
    let color = [0, 0, 0];


    // Only support static color fill for now
    color = [state.r * brightness, state.g * brightness, state.b * brightness];

    return color;
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
    // Pattern-related (commented out until Arduino implements patterns)
    // previewState.pattern = state.pattern;
    previewState.r = state.r;
    previewState.g = state.g;
    previewState.b = state.b;
    previewState.brightness = state.brightness;

    if (!previewAnim) {
        startPreview();
    } else if (ctx) {
        renderPreviewFrame(previewState);
    }

    // send updated UI state to server (throttled by socket.js)
    if (window.sendState && !window.suppressStateEmit) {
        try { window.sendState(state); } catch (e) { }
    }
}



// apply a canonical state received from server to local controls
window.applyServerState = function (s) {
    if (!s || typeof s !== 'object') return;
    window.suppressStateEmit = true;
    try {
        if (typeof s.r !== 'undefined' && typeof s.g !== 'undefined' && typeof s.b !== 'undefined') {
            setColorInputsFromRGB(parseInt(s.r || 0, 10), parseInt(s.g || 0, 10), parseInt(s.b || 0, 10));
        }
        if (typeof s.brightness !== 'undefined') {
            const b = $('brightness'); if (b) b.value = parseInt(s.brightness || 0, 10);
        }
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

// Set the current animation for preview
function setPreviewAnimation(animation) {
    currentAnimation = animation;
    animationFrameIndex = 0;
    lastAnimationFrameTime = Date.now();
    previewState.displayMode = 2;
}