// Manual LED Control State
let manualSelectedColor = '1';
let manualIsDrawing = false;
let manualGridWidth = 8;
let manualGridHeight = 8;
let manualUseCustomColor = false;
let manualCustomColor = { r: 255, g: 0, b: 0 };

// Color mapping (Arduino protocol) - same as animation-maker
const manualColorMap = {
    '0': { r: 0, g: 0, b: 0 },
    '1': { r: 255, g: 0, b: 0 },
    '2': { r: 0, g: 255, b: 0 },
    '3': { r: 0, g: 0, b: 255 },
    '4': { r: 255, g: 255, b: 0 },
    '5': { r: 255, g: 0, b: 255 },
    '6': { r: 0, g: 255, b: 255 },
    '7': { r: 255, g: 255, b: 255 }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeManualLEDGrid();
    initializeManualColorPalette();
    initializeManualEventListeners();
});

// Initialize the manual LED grid
function initializeManualLEDGrid() {
    const grid = $('manual-led-grid');
    if (!grid) return;
    
    grid.innerHTML = '';

    // Update grid CSS to match dimensions
    grid.style.gridTemplateColumns = `repeat(${manualGridWidth}, minmax(0, 1fr))`;

    // Calculate cell size based on grid dimensions to fit in container
    const maxContainerWidth = 600;
    const cellSize = Math.floor(maxContainerWidth / Math.max(manualGridWidth, manualGridHeight));
    const finalCellSize = Math.max(20, Math.min(32, cellSize)); // Clamp between 20px and 32px

    for (let y = 0; y < manualGridHeight; y++) {
        for (let x = 0; x < manualGridWidth; x++) {
            const cell = document.createElement('div');
            cell.className = 'manual-led-cell rounded cursor-pointer transition hover:scale-110 border border-slate-700';
            cell.style.width = `${finalCellSize}px`;
            cell.style.height = `${finalCellSize}px`;
            cell.dataset.x = x;
            cell.dataset.y = y;
            cell.style.backgroundColor = '#000000';

            cell.addEventListener('mousedown', (e) => {
                manualIsDrawing = true;
                paintManualLED(cell);
            });

            cell.addEventListener('mouseenter', () => {
                if (manualIsDrawing) paintManualLED(cell);
            });

            cell.addEventListener('mouseup', () => {
                manualIsDrawing = false;
            });

            grid.appendChild(cell);
        }
    }

    document.addEventListener('mouseup', () => {
        manualIsDrawing = false;
    });
}

// Initialize manual color palette
function initializeManualColorPalette() {
    const buttons = document.querySelectorAll('.manual-color-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('border-white', 'ring-2', 'ring-cyan-400'));
            btn.classList.add('border-white', 'ring-2', 'ring-cyan-400');
            manualSelectedColor = btn.dataset.color;
            manualUseCustomColor = false;
        });
    });

    // Select first color by default (red)
    buttons[1].click();

    // Initialize custom color inputs
    initializeCustomColorInputs();
}

// Initialize custom RGB/Hex color inputs
function initializeCustomColorInputs() {
    // RGB/Hex mode toggle
    document.querySelectorAll('.manual-color-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            setManualColorMode(mode);
        });
    });

    // OS color picker
    const osPicker = $('manual-os-color-picker');
    if (osPicker) {
        osPicker.addEventListener('input', (e) => {
            setManualColorFromHex(e.target.value);
            const rgb = hexToRgb(e.target.value);
            if (rgb) {
                manualCustomColor = rgb;
                manualUseCustomColor = true;
                updateManualColorInputs(rgb.r, rgb.g, rgb.b);
            }
        });
    }

    // Hex input
    const hexInput = $('manual-hex');
    if (hexInput) {
        hexInput.addEventListener('change', (e) => {
            let value = e.target.value.trim();
            if (!value.startsWith('#')) value = '#' + value;
            e.target.value = value.toLowerCase();
            setManualColorFromHex(value);
            const rgb = hexToRgb(value);
            if (rgb) {
                manualCustomColor = rgb;
                manualUseCustomColor = true;
                updateManualColorInputs(rgb.r, rgb.g, rgb.b);
            }
        });
    }

    // RGB inputs
    ['manual-r', 'manual-g', 'manual-b'].forEach(id => {
        const el = $(id);
        if (!el) return;

        el.addEventListener('input', () => {
            const r = clamp(parseInt($('manual-r').value || 0, 10), 0, 255);
            const g = clamp(parseInt($('manual-g').value || 0, 10), 0, 255);
            const b = clamp(parseInt($('manual-b').value || 0, 10), 0, 255);

            manualCustomColor = { r, g, b };
            manualUseCustomColor = true;
            updateManualColorInputs(r, g, b);
        });
    });

    // Set initial mode to RGB
    setManualColorMode('rgb');
}

// Set color mode (RGB or Hex)
function setManualColorMode(mode) {
    const rgbInputs = document.querySelector('.manual-rgb-inputs');
    const hexInputs = document.querySelector('.manual-hex-inputs');
    const buttons = document.querySelectorAll('.manual-color-mode-btn');

    buttons.forEach(btn => {
        if (btn.dataset.mode === mode) {
            btn.classList.add('bg-cyan-500/20', 'text-cyan-100');
        } else {
            btn.classList.remove('bg-cyan-500/20', 'text-cyan-100');
        }
    });

    if (mode === 'rgb') {
        rgbInputs.classList.remove('hidden');
        hexInputs.classList.add('hidden');
    } else {
        rgbInputs.classList.add('hidden');
        hexInputs.classList.remove('hidden');
    }
}

// Update color inputs from RGB values
function updateManualColorInputs(r, g, b) {
    const rInput = $('manual-r');
    const gInput = $('manual-g');
    const bInput = $('manual-b');
    const hexInput = $('manual-hex');
    const osPicker = $('manual-os-color-picker');

    if (rInput) rInput.value = r;
    if (gInput) gInput.value = g;
    if (bInput) bInput.value = b;

    const hex = rgbToHex(r, g, b);
    if (hexInput) hexInput.value = hex;
    if (osPicker) osPicker.value = hex;
}

// Set color from hex value
function setManualColorFromHex(hex) {
    const rgb = hexToRgb(hex);
    if (rgb) {
        updateManualColorInputs(rgb.r, rgb.g, rgb.b);
    }
}

// Helper functions
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

// Initialize manual event listeners
function initializeManualEventListeners() {
    const clearBtn = $('clear-manual-grid');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearManualGrid);
    }

    const setModeBtn = $('set-mode-zero');
    if (setModeBtn) {
        setModeBtn.addEventListener('click', setModeToZero);
    }

    // Brightness control
    const brightnessEl = $('manual-brightness');
    if (brightnessEl) {
        brightnessEl.addEventListener('input', () => {
            const brightness = parseInt(brightnessEl.value || 255, 10);
            sendManualBrightness(brightness);
        });
    }
}

// Paint a single LED and send 'o' command
function paintManualLED(cell) {
    const x = parseInt(cell.dataset.x, 10);
    const y = parseInt(cell.dataset.y, 10);
    
    let color;
    if (manualUseCustomColor) {
        color = manualCustomColor;
    } else {
        color = manualColorMap[manualSelectedColor];
    }

    // Update visual appearance
    cell.style.backgroundColor = `rgb(${color.r}, ${color.g}, ${color.b})`;

    // Send 'o' command to Arduino
    sendManualLEDCommand(x, y, color.r, color.g, color.b);
}

// Send 'o' command to Arduino
async function sendManualLEDCommand(x, y, r, g, b) {
    if (!window.serialManager || !window.serialManager.isConnected()) {
        console.log('Not connected, skipping command');
        return;
    }

    try {
        await window.serialManager.send(`o ${x} ${y} ${r} ${g} ${b}`);
        appendConsole(`[sent] o ${x} ${y} ${r} ${g} ${b}\n`);
    } catch (error) {
        console.error('Error sending manual LED command:', error);
        appendConsole(`[error] Failed to send o command: ${error.message}\n`);
    }
}

// Clear all LEDs
async function clearManualGrid() {
    // Reset visual appearance
    const cells = document.querySelectorAll('.manual-led-cell');
    cells.forEach(cell => {
        cell.style.backgroundColor = '#000000';
    });

    // Send ec 0 0 0 and f commands to clear the entire matrix
    if (!window.serialManager || !window.serialManager.isConnected()) {
        console.log('Not connected, skipping clear commands');
        return;
    }

    try {
        await window.serialManager.send('ec 0 0 0');
        appendConsole(`[sent] ec 0 0 0\n`);
        await window.serialManager.send('f');
        appendConsole(`[sent] f\n`);
    } catch (error) {
        console.error('Error clearing grid:', error);
        appendConsole(`[error] Failed to clear grid: ${error.message}\n`);
    }
}

// Send brightness command to Arduino
async function sendManualBrightness(brightness) {
    if (!window.serialManager || !window.serialManager.isConnected()) {
        console.log('Not connected, skipping brightness command');
        return;
    }

    try {
        await window.serialManager.send(`sb ${brightness}`);
        appendConsole(`[sent] sb ${brightness}\n`);
    } catch (error) {
        console.error('Error sending brightness:', error);
        appendConsole(`[error] Failed to send brightness: ${error.message}\n`);
    }
}

// Set mode to 0
async function setModeToZero() {
    if (!window.serialManager || !window.serialManager.isConnected()) {
        alert('Please connect to the device first');
        return;
    }

    try {
        await window.serialManager.send('sm 0');
        appendConsole(`[sent] sm 0\n`);
        alert('Mode set to 0 (Single frame mode)');
    } catch (error) {
        console.error('Error setting mode:', error);
        alert(`Error setting mode: ${error.message}`);
    }
}

// Update manual LED grid when matrix dimensions change
function updateManualLEDGrid(width, height) {
    if (width && height) {
        manualGridWidth = width;
        manualGridHeight = height;
        initializeManualLEDGrid();
        console.log(`Manual LED grid updated to ${width}x${height}`);
    }
}

// Register function globally so app.js can call it
window.updateManualLEDGrid = updateManualLEDGrid;

// Helper function
function $(id) {
    return document.getElementById(id);
}
