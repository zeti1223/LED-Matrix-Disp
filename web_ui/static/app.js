document.addEventListener('DOMContentLoaded', () => {
    refreshPorts();

    // Pattern-related (commented out until Arduino implements patterns)
    // setSelectedPattern(0);
    // setStrobeEnabled(false);
    // syncPatternDependentControls();

    $('refresh').addEventListener('click', refreshPorts);

    $('connect').addEventListener('click', () => {
        const port = $('ports').value;
        socket.emit('connect_port', { port });
    });

    $('disconnect').addEventListener('click', () => {
        socket.emit('disconnect_port', {});
    });

    ['r', 'g', 'b'].forEach(id => {
        const el = $(id);
        if (el) {
            el.addEventListener('input', () => {
                updatePreviewState();
                // Send fill color command to Arduino
                const r = parseInt($('r').value || 0, 10);
                const g = parseInt($('g').value || 0, 10);
                const b = parseInt($('b').value || 0, 10);
                if (window.sendFillColor) {
                    try { window.sendFillColor(r, g, b); } catch (e) { }
                }
            });
        }
    });

    // Pattern-related (commented out until Arduino implements patterns)
    // document.querySelectorAll('.pattern-btn').forEach(button => {
    //     button.addEventListener('click', () => {
    //         setSelectedPattern(parseInt(button.dataset.pattern || '0', 10));
    //         syncPatternDependentControls();
    //         updatePreviewState();
    //     });
    // });

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
            // Send fill color command to Arduino
            const rgb = hexToRgb(e.target.value);
            if (rgb && window.sendFillColor) {
                try { window.sendFillColor(rgb.r, rgb.g, rgb.b); } catch (e) { }
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
        });
    }

    ['r', 'g', 'b'].forEach(id => {
        const el = $(id);
        if (!el) return;
        el.addEventListener('input', () => {
            const r = clamp($('r').value, 0, 255);
            const g = clamp($('g').value, 0, 255);
            const b = clamp($('b').value, 0, 255);
            setColorInputsFromRGB(r, g, b);
            updatePreviewState();
        });
    });

    const initialR = clamp($('r').value, 0, 255);
    const initialG = clamp($('g').value, 0, 255);
    const initialB = clamp($('b').value, 0, 255);
    setColorInputsFromRGB(initialR, initialG, initialB);
    setColorMode('rgb');
    
    // Send initial fill color to Arduino
    if (window.sendFillColor) {
        try { window.sendFillColor(initialR, initialG, initialB); } catch (e) { }
    }

    // Strobe-related (commented out until Arduino implements strobe)
    // const strobeToggleBtn = $('strobe-toggle');
    // if (strobeToggleBtn) {
    //     strobeToggleBtn.addEventListener('click', () => {
    //         setStrobeEnabled(!getStrobeEnabled());
    //         updatePreviewState();
    //     });
    // }

    document.querySelectorAll('.card-toggle').forEach(button => {
        button.addEventListener('click', () => {
            const card = button.closest('.collapsible-card');
            if (card && button.id !== 'strobe-toggle') {
                toggleCard(card);
            }
        });
    });

    document.querySelectorAll('.collapsible-card').forEach(card => setCardCollapsed(card, false));

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

    // Strobe-related (commented out until Arduino implements strobe)
    // ['strobe-speed', 'strobe-duty'].forEach(id => {
    //     const el = $(id);
    //     if (!el) return;
    //     el.addEventListener('input', () => {
    //         updatePreviewState();
    //     });
    //     el.addEventListener('change', () => {
    //         updatePreviewState();
    //     });
    // });

    // const speedEl = $('strobe-speed');
    // const speedValEl = $('strobe-speed-val');
    // function updateSpeedLabel(value) {
    //     if (speedValEl) speedValEl.textContent = value + ' Hz';
    // }
    // if (speedEl) {
    //     updateSpeedLabel(speedEl.value);
    //     speedEl.addEventListener('input', (e) => {
    //         updateSpeedLabel(e.target.value);
    //     });
    // }

    startPreview();
});

