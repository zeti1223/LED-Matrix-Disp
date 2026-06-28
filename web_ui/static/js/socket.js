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
    } catch (e) {}
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
        try { window.applyPorts(list); } catch (e) {}
    }
});

// receive console broadcasts from server and append without echoing back
socket.on('console', (data) => {
    const text = data && data.text ? data.text : '';
    if (!text) return;
    window.suppressConsoleEmit = true;
    try { appendConsole(text); } catch (e) {}
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