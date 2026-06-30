// Animation Maker State
const MAX_FRAMES = 10; // Arduino can only accept 10 frames

let animation = {
    name: '',
    delay: 100,
    frames: []
};

let currentFrameIndex = 0;
let selectedColor = '1';
let isDrawing = false;
let previewInterval = null;
let isPlayingPreview = false;

// Color mapping (Arduino protocol)
const colorMap = {
    '0': { r: 0, g: 0, b: 0 },
    '1': { r: 255, g: 0, b: 0 },
    '2': { r: 0, g: 255, b: 0 },
    '3': { r: 0, g: 0, b: 255 },
    '4': { r: 255, g: 255, b: 0 },
    '5': { r: 255, g: 0, b: 255 },
    '6': { r: 0, g: 255, b: 255 },
    '7': { r: 255, g: 255, b: 255 }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeLEDGrid();
    initializeColorPalette();
    initializeEventListeners();
    addFrame(); // Start with one frame
    updateFrameCounter();
    renderFrameList();
});

function initializeLEDGrid() {
    const grid = $('led-grid');
    grid.innerHTML = '';

    for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
            const cell = document.createElement('div');
            cell.className = 'led-cell w-8 h-8 rounded cursor-pointer transition hover:scale-110 border border-slate-700';
            cell.dataset.x = x;
            cell.dataset.y = y;
            cell.style.backgroundColor = '#000000';

            cell.addEventListener('mousedown', (e) => {
                isDrawing = true;
                paintLED(cell);
            });

            cell.addEventListener('mouseenter', () => {
                if (isDrawing) paintLED(cell);
            });

            cell.addEventListener('mouseup', () => {
                isDrawing = false;
            });

            grid.appendChild(cell);
        }
    }

    document.addEventListener('mouseup', () => {
        isDrawing = false;
    });
}

function initializeColorPalette() {
    const buttons = document.querySelectorAll('.color-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('border-white', 'ring-2', 'ring-cyan-400'));
            btn.classList.add('border-white', 'ring-2', 'ring-cyan-400');
            selectedColor = btn.dataset.color;
        });
    });

    // Select first color by default
    buttons[1].click();
}

function initializeEventListeners() {
    $('add-frame').addEventListener('click', addFrame);
    $('delete-frame').addEventListener('click', deleteFrame);
    $('prev-frame').addEventListener('click', () => navigateFrame(-1));
    $('next-frame').addEventListener('click', () => navigateFrame(1));
    $('save-animation').addEventListener('click', saveAnimation);
    $('load-animation').addEventListener('click', loadAnimation);
    $('download-json').addEventListener('click', downloadJSON);
    $('play-preview').addEventListener('click', playPreview);
    $('stop-preview').addEventListener('click', stopPreview);

    $('frame-delay').addEventListener('change', (e) => {
        animation.delay = parseInt(e.target.value, 10);
    });
}

function paintLED(cell) {
    const x = parseInt(cell.dataset.x, 10);
    const y = parseInt(cell.dataset.y, 10);
    const color = colorMap[selectedColor];

    cell.style.backgroundColor = `rgb(${color.r}, ${color.g}, ${color.b})`;

    // Update current frame data
    if (animation.frames[currentFrameIndex]) {
        const ledIndex = y * 8 + x;
        animation.frames[currentFrameIndex][ledIndex] = selectedColor;
        renderFrameList();
    }
}

function addFrame() {
    if (animation.frames.length >= MAX_FRAMES) {
        alert(`Maximum ${MAX_FRAMES} frames allowed (Arduino limit)`);
        return;
    }

    // Create new frame with all LEDs off
    const newFrame = Array(64).fill('0');
    animation.frames.push(newFrame);
    currentFrameIndex = animation.frames.length - 1;
    updateFrameCounter();
    loadFrameToGrid(currentFrameIndex);
    renderFrameList();
}

function deleteFrame() {
    if (animation.frames.length <= 1) {
        alert('Cannot delete the last frame');
        return;
    }

    animation.frames.splice(currentFrameIndex, 1);
    if (currentFrameIndex >= animation.frames.length) {
        currentFrameIndex = animation.frames.length - 1;
    }
    updateFrameCounter();
    loadFrameToGrid(currentFrameIndex);
    renderFrameList();
}

function navigateFrame(direction) {
    const newIndex = currentFrameIndex + direction;
    if (newIndex >= 0 && newIndex < animation.frames.length) {
        currentFrameIndex = newIndex;
        updateFrameCounter();
        loadFrameToGrid(currentFrameIndex);
        renderFrameList();
    }
}

function updateFrameCounter() {
    $('frame-counter').textContent = `Frame ${currentFrameIndex + 1} / ${animation.frames.length}`;
}

function loadFrameToGrid(frameIndex) {
    const frame = animation.frames[frameIndex];
    if (!frame) return;

    const cells = document.querySelectorAll('.led-cell');
    cells.forEach((cell, index) => {
        const colorCode = frame[index] || '0';
        const color = colorMap[colorCode];
        cell.style.backgroundColor = `rgb(${color.r}, ${color.g}, ${color.b})`;
    });
}

function renderFrameList() {
    const list = $('frame-list');
    list.innerHTML = '';

    animation.frames.forEach((frame, index) => {
        const item = document.createElement('div');
        item.className = `p-2 rounded-lg cursor-pointer transition ${index === currentFrameIndex ? 'bg-cyan-500/20 border border-cyan-400/40' : 'bg-slate-800/50 border border-slate-700 hover:bg-slate-700'}`;

        // Create mini preview
        const miniGrid = document.createElement('div');
        miniGrid.className = 'grid grid-cols-8 gap-0.5';

        for (let i = 0; i < 64; i++) {
            const pixel = document.createElement('div');
            const colorCode = frame[i] || '0';
            const color = colorMap[colorCode];
            pixel.style.backgroundColor = `rgb(${color.r}, ${color.g}, ${color.b})`;
            pixel.className = 'w-2 h-2 rounded-sm';
            miniGrid.appendChild(pixel);
        }

        const label = document.createElement('div');
        label.className = 'text-xs text-slate-300 mt-1';
        label.textContent = `Frame ${index + 1}`;

        item.appendChild(miniGrid);
        item.appendChild(label);

        item.addEventListener('click', () => {
            currentFrameIndex = index;
            updateFrameCounter();
            loadFrameToGrid(currentFrameIndex);
            renderFrameList();
        });

        list.appendChild(item);
    });
}

async function saveAnimation() {
    const name = $('animation-name').value.trim();
    if (!name) {
        alert('Please enter an animation name');
        return;
    }

    animation.name = name;
    animation.delay = parseInt($('frame-delay').value, 10);

    try {
        // Save to localStorage
        const animationsJson = localStorage.getItem('led_animations_data');
        const animationsData = animationsJson ? JSON.parse(animationsJson) : {};
        animationsData[name] = animation;
        localStorage.setItem('led_animations_data', JSON.stringify(animationsData));

        // Update animation list
        const animationsListJson = localStorage.getItem('led_animations');
        const animationsList = animationsListJson ? JSON.parse(animationsListJson) : [];
        if (!animationsList.includes(name)) {
            animationsList.push(name);
            localStorage.setItem('led_animations', JSON.stringify(animationsList));
        }

        alert(`Animation "${name}" saved successfully!`);
    } catch (error) {
        alert(`Error saving animation: ${error.message}`);
    }
}

async function loadAnimation() {
    const name = prompt('Enter animation name to load:');
    if (!name) return;

    try {
        // Load from localStorage
        const animationsJson = localStorage.getItem('led_animations_data');
        const animationsData = animationsJson ? JSON.parse(animationsJson) : {};
        const result = animationsData[name];

        if (result) {
            animation = result;
            $('animation-name').value = animation.name || '';
            $('frame-delay').value = animation.delay || 100;
            currentFrameIndex = 0;
            updateFrameCounter();
            loadFrameToGrid(currentFrameIndex);
            renderFrameList();
            alert(`Animation "${name}" loaded successfully!`);
        } else {
            alert(`Animation "${name}" not found`);
        }
    } catch (error) {
        alert(`Error loading animation: ${error.message}`);
    }
}

function downloadJSON() {
    animation.name = $('animation-name').value.trim() || 'animation';
    animation.delay = parseInt($('frame-delay').value, 10);

    const dataStr = JSON.stringify(animation, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${animation.name}.json`;
    link.click();

    URL.revokeObjectURL(url);
}

function playPreview() {
    if (isPlayingPreview) return;
    isPlayingPreview = true;

    let frameIndex = 0;
    const canvas = $('preview-canvas');
    const ctx = canvas.getContext('2d');

    function renderFrame() {
        if (!isPlayingPreview) return;

        const frame = animation.frames[frameIndex];
        if (!frame) return;

        // Clear canvas
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw LEDs
        const ledSize = canvas.width / 8;
        for (let i = 0; i < 64; i++) {
            const x = (i % 8) * ledSize;
            const y = Math.floor(i / 8) * ledSize;
            const colorCode = frame[i] || '0';
            const color = colorMap[colorCode];

            ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
            ctx.fillRect(x + 1, y + 1, ledSize - 2, ledSize - 2);
        }

        frameIndex = (frameIndex + 1) % animation.frames.length;
    }

    renderFrame();
    previewInterval = setInterval(renderFrame, animation.delay);
}

function stopPreview() {
    isPlayingPreview = false;
    if (previewInterval) {
        clearInterval(previewInterval);
        previewInterval = null;
    }
}

// Helper function
function $(id) {
    return document.getElementById(id);
}
