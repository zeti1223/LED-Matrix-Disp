let connected = false;
let frameSendEnabled = false;
let lastFrameSent = 0;
const FRAME_SEND_INTERVAL = 80;

// Update connection status based on serial manager
if (window.serialManager) {
    window.serialManager.onConnect(() => {
        connected = true;
    });

    window.serialManager.onDisconnect(() => {
        connected = false;
    });
}

function sendFrame(frame) {
    if (!connected || !frameSendEnabled) return;
    const now = Date.now();
    if (now - lastFrameSent < FRAME_SEND_INTERVAL) return;
    lastFrameSent = now;

    // Send frame using serial manager
    if (window.serialManager && window.serialManager.isConnected()) {
        // Convert frame to individual LED commands
        for (let i = 0; i < frame.length; i += 3) {
            if (i + 2 >= frame.length) break;
            const r = frame[i];
            const g = frame[i + 1];
            const b = frame[i + 2];
            const ledIndex = i / 3;
            const x = ledIndex % 8;
            const y = Math.floor(ledIndex / 8);

            window.serialManager.send(`o ${x} ${y} ${r} ${g} ${b}`);
        }

        // Trigger display update
        window.serialManager.send('d');
    }
}

// New Arduino protocol command senders
async function sendBrightness(brightness) {
    if (!window.serialManager || !window.serialManager.isConnected()) return;
    try {
        await window.serialManager.send(`sb ${brightness}`);
        await window.serialManager.send('d');
        appendConsole(`[sent] sb ${brightness}\n`);
    } catch (error) {
        console.error('Error sending brightness:', error);
    }
}

async function sendFillColor(r, g, b) {
    if (!window.serialManager || !window.serialManager.isConnected()) return;
    try {
        await window.serialManager.send(`f ${r} ${g} ${b}`);
        await window.serialManager.send('d');
        appendConsole(`[sent] f ${r} ${g} ${b}\n`);
    } catch (error) {
        console.error('Error sending fill color:', error);
    }
}

async function sendDisplayMode(mode) {
    if (!window.serialManager || !window.serialManager.isConnected()) return;
    try {
        await window.serialManager.send(`sm ${mode}`);
        appendConsole(`[sent] sm ${mode}\n`);
    } catch (error) {
        console.error('Error sending display mode:', error);
    }
}

// Pattern-related
async function sendPattern(pattern) {
    if (!window.serialManager || !window.serialManager.isConnected()) return;
    try {
        await window.serialManager.send(`em ${pattern}`);
        appendConsole(`[sent] em ${pattern}\n`);
    } catch (error) {
        console.error('Error sending pattern:', error);
    }
}

async function sendEffectColor(r, g, b) {
    if (!window.serialManager || !window.serialManager.isConnected()) return;
    try {
        await window.serialManager.send(`ec ${r} ${g} ${b}`);
        appendConsole(`[sent] ec ${r} ${g} ${b}\n`);
    } catch (error) {
        console.error('Error sending effect color:', error);
    }
}

// Animation commands
async function sendAnimationFrameCount(count) {
    if (!window.serialManager || !window.serialManager.isConnected()) return;
    try {
        await window.serialManager.send(`as ${count}`);
        appendConsole(`[sent] as ${count}\n`);
    } catch (error) {
        console.error('Error sending animation frame count:', error);
    }
}

async function sendAnimationFrame(frameIndex, data) {
    if (!window.serialManager || !window.serialManager.isConnected()) return;
    try {
        await window.serialManager.send(`af ${frameIndex} ${data}`);
        appendConsole(`[sent] af ${frameIndex}\n`);
    } catch (error) {
        console.error('Error sending animation frame:', error);
    }
}

async function sendAnimationDelay(delay) {
    if (!window.serialManager || !window.serialManager.isConnected()) return;
    try {
        await window.serialManager.send(`aw ${delay}`);
        appendConsole(`[sent] aw ${delay}\n`);
    } catch (error) {
        console.error('Error sending animation delay:', error);
    }
}

async function toggleAnimation() {
    if (!window.serialManager || !window.serialManager.isConnected()) return;
    try {
        await window.serialManager.send('ap');
        appendConsole(`[sent] ap\n`);
    } catch (error) {
        console.error('Error toggling animation:', error);
    }
}

window.sendBrightness = sendBrightness;
window.sendFillColor = sendFillColor;
window.sendDisplayMode = sendDisplayMode;
window.sendAnimationFrameCount = sendAnimationFrameCount;
window.sendAnimationFrame = sendAnimationFrame;
window.sendAnimationDelay = sendAnimationDelay;
window.toggleAnimation = toggleAnimation;
window.sendPattern = sendPattern;
window.sendEffectColor = sendEffectColor;