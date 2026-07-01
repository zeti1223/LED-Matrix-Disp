document.addEventListener('DOMContentLoaded', () => {
    loadAnimations();

    setSelectedMode(0);
    setSelectedPattern(0);
    setTextColorMode(0);
    syncModeDependentControls();

    // Set up serial data listener for dimensions
    if (window.serialManager) {
        window.serialManager.onData((data) => {
            // Log all incoming serial data to console
            appendConsole(`[serial] ${data}\n`);

            // Parse dimension response (format: "8x8")
            const match = data.trim().match(/^(\d+)x(\d+)$/);
            if (match) {
                const width = parseInt(match[1], 10);
                const height = parseInt(match[2], 10);
                const dimensionsEl = $('dimensions');
                if (dimensionsEl) {
                    dimensionsEl.textContent = `${width} x ${height}`;
                    dimensionsEl.classList.remove('hidden');
                }
                
                // Store dimensions globally for animation maker
                window.matrixDimensions = { width, height };
                
                // Notify animation maker to update grid if it's loaded
                if (window.updateAnimationMakerGrid) {
                    try { window.updateAnimationMakerGrid(width, height); } catch (e) { }
                }
            }
        });
    }

    $('refresh-animations').addEventListener('click', loadAnimations);
    $('upload-animation').addEventListener('click', () => {
        $('upload-animation-input').click();
    });
    $('upload-animation-input').addEventListener('change', handleAnimationUpload);

    $('connect').addEventListener('click', async () => {
        try {
            await serialManager.requestPort();
            await serialManager.connect();
            const status = $('status');
            if (status) status.textContent = 'Connected';

            // Request dimensions after connection
            if (window.getDimensions) {
                try { window.getDimensions(); } catch (e) { }
            }
        } catch (error) {
            appendConsole(`[connect] Error: ${error.message}\n`);
            const status = $('status');
            if (status) status.textContent = `Error: ${error.message}`;
        }
    });

    $('disconnect').addEventListener('click', async () => {
        try {
            await serialManager.disconnect();
            const status = $('status');
            if (status) status.textContent = 'Disconnected';
        } catch (error) {
            appendConsole(`[disconnect] Error: ${error.message}\n`);
        }
    });

    function getCurrentRgb() {
        return {
            r: clamp(parseInt($('r').value || 0, 10), 0, 255),
            g: clamp(parseInt($('g').value || 0, 10), 0, 255),
            b: clamp(parseInt($('b').value || 0, 10), 0, 255),
        };
    }

    function sendColorUpdate(r, g, b) {
        const mode = getSelectedMode();
        if (mode === 0) {
            if (window.sendFillColor) {
                try { window.sendFillColor(r, g, b); } catch (e) { }
            }
            return;
        }

        if (mode === 1 || mode === 3) {
            if (window.sendEffectColor) {
                try { window.sendEffectColor(r, g, b); } catch (e) { }
            }
        }
    }

    function syncPreviewToMode(mode) {
        if (!window.previewState) return;

        window.previewState.displayMode = mode;

        if (mode === 2) {
            const select = $('animation-select');
            const animationName = select ? select.value : null;
            if (animationName) {
                const animationsJson = localStorage.getItem('led_animations_data');
                const animationsData = animationsJson ? JSON.parse(animationsJson) : {};
                const animation = animationsData[animationName];
                if (animation && window.setPreviewAnimation) {
                    try { window.setPreviewAnimation(animation); } catch (e) { }
                }
            }
        }
    }

    function applyMode(mode) {
        setSelectedMode(mode);
        syncModeDependentControls();
        syncPreviewToMode(mode);
        updatePreviewState();

        if (window.sendDisplayMode) {
            try { window.sendDisplayMode(mode); } catch (e) { }
        }

        const { r, g, b } = getCurrentRgb();

        if (mode === 0) {
            if (window.sendFillColor) {
                try { window.sendFillColor(r, g, b); } catch (e) { }
            }
        } else if (mode === 1) {
            if (window.sendPattern) {
                try { window.sendPattern(getSelectedPattern()); } catch (e) { }
            }
            if (window.sendEffectColor) {
                try { window.sendEffectColor(r, g, b); } catch (e) { }
            }
        } else if (mode === 3) {
            const textInput = $('text-value');
            const text = textInput ? textInput.value : '';
            if (window.sendText) {
                try { window.sendText(text); } catch (e) { }
            }
            if (window.sendTextColorMode) {
                try { window.sendTextColorMode(getSelectedTextColorMode()); } catch (e) { }
            }
            if (window.sendEffectColor) {
                try { window.sendEffectColor(r, g, b); } catch (e) { }
            }
        }
    }

    document.querySelectorAll('.mode-btn').forEach(button => {
        button.addEventListener('click', () => {
            applyMode(parseInt(button.dataset.mode || '0', 10));
        });
    });

    document.querySelectorAll('.pattern-btn').forEach(button => {
        button.addEventListener('click', () => {
            const pattern = parseInt(button.dataset.pattern || '0', 10);
            setSelectedPattern(pattern);
            updateColorCardContext();

            if (getSelectedMode() === 1) {
                if (window.sendPattern) {
                    try { window.sendPattern(pattern); } catch (e) { }
                }
            }
        });
    });

    document.querySelectorAll('.text-color-mode-btn').forEach(button => {
        button.addEventListener('click', () => {
            const mode = parseInt(button.dataset.mode || '0', 10);
            setTextColorMode(mode);
            updateColorCardContext();
            updatePreviewState();

            if (window.sendTextColorMode) {
                try { window.sendTextColorMode(mode); } catch (e) { }
            }
        });
    });

    document.querySelectorAll('.color-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setColorMode(btn.dataset.mode);
        });
    });

    const osPicker = $('os-color-picker');
    if (osPicker) {
        osPicker.addEventListener('input', (e) => {
            setColorFromHex(e.target.value);
            updatePreviewState();
            const rgb = hexToRgb(e.target.value);
            if (rgb) {
                sendColorUpdate(rgb.r, rgb.g, rgb.b);
            }
        });
    }

    const hexInput = $('hex');
    if (hexInput) {
        hexInput.addEventListener('change', (e) => {
            let value = e.target.value.trim();
            if (!value.startsWith('#')) value = '#' + value;
            e.target.value = value.toLowerCase();
            setColorFromHex(value);
            updatePreviewState();
            const rgb = hexToRgb(value);
            if (rgb) {
                sendColorUpdate(rgb.r, rgb.g, rgb.b);
            }
        });
    }

    const textInput = $('text-value');
    if (textInput) {
        const sendTextUpdate = debounce(() => {
            if (window.sendText) {
                try { window.sendText(textInput.value || ''); } catch (e) { }
            }
        }, 200);

        textInput.addEventListener('input', () => {
            updatePreviewState();
            sendTextUpdate();
        });

        textInput.addEventListener('change', () => {
            sendTextUpdate();
        });
    }

    ['r', 'g', 'b'].forEach(id => {
        const el = $(id);
        if (!el) return;

        el.addEventListener('input', () => {
            const r = clamp(parseInt($('r').value || 0, 10), 0, 255);
            const g = clamp(parseInt($('g').value || 0, 10), 0, 255);
            const b = clamp(parseInt($('b').value || 0, 10), 0, 255);

            setColorInputsFromRGB(r, g, b);
            updatePreviewState();
            sendColorUpdate(r, g, b);
        });
    });

    const initialR = clamp($('r').value, 0, 255);
    const initialG = clamp($('g').value, 0, 255);
    const initialB = clamp($('b').value, 0, 255);
    setColorInputsFromRGB(initialR, initialG, initialB);
    setColorMode('rgb');

    if ($('text-value') && !$('text-value').value) {
        $('text-value').value = 'HELLO';
    }

    applyMode(0);

    document.querySelectorAll('.card-toggle').forEach(button => {
        button.addEventListener('click', () => {
            const card = button.closest('.collapsible-card');
            if (card && button.id !== 'strobe-toggle') {
                toggleCard(card);
            }
        });
    });

    document.querySelectorAll('.collapsible-card').forEach(card => setCardCollapsed(card, false));

    // Animation controls
    $('send-animation').addEventListener('click', sendSelectedAnimation);
    $('toggle-animation-play').addEventListener('click', toggleAnimationPlay);

    const brightnessEl = $('brightness');
    if (brightnessEl) {
        brightnessEl.addEventListener('input', () => {
            updatePreviewState();
            // Send brightness command to Arduino
            const brightness = parseInt(brightnessEl.value || 128, 10);
            if (window.sendBrightness) {
                try { window.sendBrightness(brightness); } catch (e) { }
            }
        });
    }

    const effectSpeedEl = $('speed');
    if (effectSpeedEl) {
        const updateSpeedValue = () => {
            const delay = parseInt(effectSpeedEl.value || 100, 10);
            const valueDisplay = $('speed-value');
            if (valueDisplay) {
                valueDisplay.textContent = `${delay} ms`;
            }
            return delay;
        };

        effectSpeedEl.addEventListener('input', () => {
            const delay = updateSpeedValue();
            if (window.sendEffectSpeed) {
                try { window.sendEffectSpeed(delay); } catch (e) { }
            }
        });

        // Initialize display value
        updateSpeedValue();
    }
    startPreview();
});

async function loadAnimations() {
    try {
        // Load animations from localStorage
        const animationsJson = localStorage.getItem('led_animations');
        const animations = animationsJson ? JSON.parse(animationsJson) : [];

        const select = $('animation-select');
        if (select) {
            select.innerHTML = '<option value="">Select animation...</option>';
            animations.forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading animations:', error);
        appendConsole('[animations] error loading animations\n');
    }
}

async function handleAnimationUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const animation = JSON.parse(text);

        if (!animation.name || !animation.frames || !Array.isArray(animation.frames)) {
            throw new Error('Invalid animation file format');
        }

        // Save to localStorage
        const animationsJson = localStorage.getItem('led_animations_data');
        const animationsData = animationsJson ? JSON.parse(animationsJson) : {};
        animationsData[animation.name] = animation;
        localStorage.setItem('led_animations_data', JSON.stringify(animationsData));

        // Update animation list
        const animationsListJson = localStorage.getItem('led_animations');
        const animationsList = animationsListJson ? JSON.parse(animationsListJson) : [];
        if (!animationsList.includes(animation.name)) {
            animationsList.push(animation.name);
            localStorage.setItem('led_animations', JSON.stringify(animationsList));
        }

        // Refresh the dropdown
        loadAnimations();

        // Select the uploaded animation
        const select = $('animation-select');
        if (select) {
            select.value = animation.name;
        }

        appendConsole(`[animation] uploaded "${animation.name}"\n`);
    } catch (error) {
        console.error('Error uploading animation:', error);
        appendConsole(`[animation] error: ${error.message}\n`);
        alert(`Error uploading animation: ${error.message}`);
    }

    // Reset file input
    event.target.value = '';
}

async function sendSelectedAnimation() {
    const select = $('animation-select');
    const animationName = select ? select.value : null;

    if (!animationName) {
        alert('Please select an animation first');
        return;
    }

    try {
        // Load animation from localStorage
        const animationsJson = localStorage.getItem('led_animations_data');
        const animationsData = animationsJson ? JSON.parse(animationsJson) : {};
        const animation = animationsData[animationName];

        if (!animation) {
            throw new Error('Animation not found');
        }

        // Set display mode to animation mode (mode 2)
        if (window.sendDisplayMode) {
            try { window.sendDisplayMode(2); } catch (e) { }
        }

        setSelectedMode(2);
        syncModeDependentControls();
        updatePreviewState();

        // Send frame count
        if (window.sendAnimationFrameCount) {
            try { window.sendAnimationFrameCount(animation.frames.length); } catch (e) { }
        }

        // Send each frame
        if (window.sendAnimationFrame) {
            animation.frames.forEach((frame, index) => {
                const frameData = frame.join('');
                try { window.sendAnimationFrame(index, frameData); } catch (e) { }
            });
        }

        // Send delay
        if (window.sendAnimationDelay) {
            try { window.sendAnimationDelay(animation.delay || 100); } catch (e) { }
        }

        // Set preview to show animation
        if (window.setPreviewAnimation) {
            try { window.setPreviewAnimation(animation); } catch (e) { }
        }

        // Wait a bit for Arduino to process all frames, then start playing
        setTimeout(() => {
            if (window.toggleAnimation) {
                try { window.toggleAnimation(); } catch (e) { }
            }
        }, 500);

        appendConsole(`[animation] sent "${animationName}" with ${animation.frames.length} frames\n`);
    } catch (error) {
        console.error('Error sending animation:', error);
        appendConsole(`[animation] error: ${error.message}\n`);
    }
}

function toggleAnimationPlay() {
    if (window.toggleAnimation) {
        try { window.toggleAnimation(); } catch (e) { }
        appendConsole('[animation] toggled play/pause\n');
    }
}
