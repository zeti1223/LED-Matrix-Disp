const socket = io();
window.socket = socket;

let connected = false;
let frameSendEnabled = false;
let lastFrameSent = 0;
const FRAME_SEND_INTERVAL = 80;

socket.on('connect_result', (data) => {
    connected = !!data.ok;
    const status = $('status');
    if (status) status.textContent = data.msg || JSON.stringify(data);
    appendConsole(`[connect] ${data.msg}\n`);
});

socket.on('disconnect_result', () => {
    connected = false;
    const status = $('status');
    if (status) status.textContent = 'Disconnected';
    appendConsole('[disconnect]\n');
});

socket.on('send_result', (data) => {
    appendConsole(`[sent] ${data.command} -> ${data.msg}\n`);
});

socket.on('serial_data', (data) => {
    appendConsole(data.data);
});

function sendFrame(frame) {
    if (!connected || !frameSendEnabled) return;
    const now = Date.now();
    if (now - lastFrameSent < FRAME_SEND_INTERVAL) return;
    lastFrameSent = now;
    socket.emit('send_frame', { frame });
}

// request canonical state on raw socket connection
socket.on('connect', () => {
    try {
        socket.emit('get_state');
        socket.emit('list_ports');
    } catch (e) { }
});

// when server broadcasts canonical state, forward to page handler
socket.on('state', (data) => {
    if (window.applyServerState && typeof window.applyServerState === 'function') {
        window.applyServerState(data);
    }
});

// when server supplies ports, forward to controls
socket.on('ports', (list) => {
    if (window.applyPorts && typeof window.applyPorts === 'function') {
        try { window.applyPorts(list); } catch (e) { }
    }
});

// receive console broadcasts from server and append without echoing back
socket.on('console', (data) => {
    const text = data && data.text ? data.text : '';
    if (!text) return;
    window.suppressConsoleEmit = true;
    try { appendConsole(text); } catch (e) { }
    setTimeout(() => { window.suppressConsoleEmit = false; }, 120);
});

// throttled state updater for UI control changes
let _lastStateSent = 0;
const STATE_SEND_INTERVAL = 250;
function sendState(state) {
    if (!socket || !socket.connected) return;
    if (window.suppressStateEmit) return;
    const now = Date.now();
    if (now - _lastStateSent < STATE_SEND_INTERVAL) return;
    _lastStateSent = now;
    socket.emit('update_state', state);
}

window.sendState = sendState;

// New Arduino protocol command senders - delegate to commands.js if available
function sendBrightness(brightness) {
    if (window.sendBrightness && typeof window.sendBrightness === 'function') {
        window.sendBrightness(brightness);
    } else if (socket && socket.connected) {
        socket.emit('set_brightness', { brightness });
    }
}

function sendFillColor(r, g, b) {
    if (window.sendFillColor && typeof window.sendFillColor === 'function') {
        window.sendFillColor(r, g, b);
    } else if (socket && socket.connected) {
        socket.emit('fill_color', { r, g, b });
    }
}

function sendDisplayMode(mode) {
    if (window.sendDisplayMode && typeof window.sendDisplayMode === 'function') {
        window.sendDisplayMode(mode);
    } else if (socket && socket.connected) {
        socket.emit('set_display_mode', { mode });
    }
}

// Animation commands - delegate to commands.js if available
function sendAnimationFrameCount(count) {
    if (window.sendAnimationFrameCount && typeof window.sendAnimationFrameCount === 'function') {
        window.sendAnimationFrameCount(count);
    } else if (socket && socket.connected) {
        socket.emit('set_animation_frame_count', { count });
    }
}

function sendAnimationFrame(frameIndex, data) {
    if (window.sendAnimationFrame && typeof window.sendAnimationFrame === 'function') {
        window.sendAnimationFrame(frameIndex, data);
    } else if (socket && socket.connected) {
        socket.emit('set_animation_frame', { frame_index: frameIndex, data });
    }
}

function sendAnimationDelay(delay) {
    if (window.sendAnimationDelay && typeof window.sendAnimationDelay === 'function') {
        window.sendAnimationDelay(delay);
    } else if (socket && socket.connected) {
        socket.emit('set_animation_delay', { delay });
    }
}

function toggleAnimation() {
    if (window.toggleAnimation && typeof window.toggleAnimation === 'function') {
        window.toggleAnimation();
    } else if (socket && socket.connected) {
        socket.emit('toggle_animation', {});
    }
}

window.sendBrightness = sendBrightness;
window.sendFillColor = sendFillColor;
window.sendDisplayMode = sendDisplayMode;
// window.sendPattern = sendPattern;
window.sendAnimationFrameCount = sendAnimationFrameCount;
window.sendAnimationFrame = sendAnimationFrame;
window.sendAnimationDelay = sendAnimationDelay;
window.toggleAnimation = toggleAnimation;