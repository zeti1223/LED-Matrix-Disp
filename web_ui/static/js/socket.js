const socket = io();

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