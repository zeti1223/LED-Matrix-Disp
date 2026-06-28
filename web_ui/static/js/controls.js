function refreshPorts() {
    fetch('/ports')
        .then(response => response.json())
        .then(list => {
            const select = $('ports');
            if (!select) return;
            select.innerHTML = '';
            list.forEach(port => {
                const option = document.createElement('option');
                option.value = port;
                option.textContent = port;
                select.appendChild(option);
            });
            appendConsole(list.length ? '[ports] refreshed\n' : '[ports] no ports found\n');
        })
        .catch(() => {
            appendConsole('[ports] error fetching ports\n');
        });
}

function getSelectedPattern() {
    const activeButton = document.querySelector('.pattern-btn.active');
    return activeButton ? parseInt(activeButton.dataset.pattern || '0', 10) : 0;
}

function setSelectedPattern(pattern) {
    document.querySelectorAll('.pattern-btn').forEach(button => {
        const isActive = parseInt(button.dataset.pattern || '0', 10) === pattern;
        button.classList.toggle('active', isActive);
        swapClasses(
            button,
            isActive
                ? ['border-cyan-400/50', 'bg-cyan-400/15', 'text-cyan-100', 'shadow-lg', 'shadow-cyan-500/10']
                : ['border-slate-700', 'bg-slate-800/70', 'text-slate-200'],
            isActive
                ? ['border-slate-700', 'bg-slate-800/70', 'text-slate-200']
                : ['border-cyan-400/50', 'bg-cyan-400/15', 'text-cyan-100', 'shadow-lg', 'shadow-cyan-500/10']
        );
    });
}

function getStrobeEnabled() {
    const button = $('strobe-toggle');
    return !!(button && button.classList.contains('active'));
}

function setStrobeEnabled(enabled) {
    const button = $('strobe-toggle');
    if (!button) return;
    button.classList.toggle('active', enabled);
    button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    button.textContent = enabled ? 'Strobe on' : 'Strobe off';
    swapClasses(
        button,
        enabled
            ? ['border-cyan-400/40', 'bg-cyan-400/15', 'text-cyan-100', 'shadow-lg', 'shadow-cyan-500/10']
            : ['border-slate-700', 'bg-slate-800/70', 'text-slate-200'],
        enabled
            ? ['border-slate-700', 'bg-slate-800/70', 'text-slate-200']
            : ['border-cyan-400/40', 'bg-cyan-400/15', 'text-cyan-100', 'shadow-lg', 'shadow-cyan-500/10']
    );
}

function setColorControlsDisabled(disabled) {
    const colorCard = document.querySelector('[data-card-id="color"]');
    if (colorCard) {
        colorCard.classList.toggle('opacity-50', disabled);
        colorCard.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    }

    const colorBody = colorCard ? colorCard.querySelector('.card-body') : null;
    if (colorBody) {
        colorBody.classList.toggle('pointer-events-none', disabled);
    }

    ['r', 'g', 'b'].forEach(id => {
        const input = $(id);
        if (input) input.disabled = disabled;
    });
}

function syncPatternDependentControls() {
    setColorControlsDisabled([1, 2, 3, 4].includes(getSelectedPattern()));
}

function setColorMode(mode) {
    document.querySelectorAll('.color-mode-btn').forEach(button => {
        const isActive = button.dataset.mode === mode;
        button.classList.toggle('active', isActive);
        swapClasses(
            button,
            isActive
                ? ['bg-cyan-400', 'text-slate-950', 'shadow-md', 'shadow-cyan-500/20']
                : ['text-slate-300', 'hover:bg-slate-800'],
            isActive
                ? ['text-slate-300', 'hover:bg-slate-800']
                : ['bg-cyan-400', 'text-slate-950', 'shadow-md', 'shadow-cyan-500/20']
        );
    });

    const showHex = mode === 'hex';
    const hexInputs = document.querySelector('.hex-inputs');
    const rgbInputs = document.querySelector('.rgb-inputs');
    if (hexInputs) hexInputs.classList.toggle('hidden', !showHex);
    if (rgbInputs) rgbInputs.classList.toggle('hidden', showHex);
}

function setColorInputsFromRGB(r, g, b) {
    const hexInput = $('hex');
    if (hexInput) hexInput.value = rgbToHex(r, g, b);
    ['r', 'g', 'b'].forEach((id, index) => {
        const input = $(id);
        if (input) input.value = [r, g, b][index];
    });

    const osPicker = $('os-color-picker');
    if (osPicker) osPicker.value = rgbToHex(r, g, b);
}

function setColorFromHex(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return;
    setColorInputsFromRGB(rgb.r, rgb.g, rgb.b);
}

function setCardCollapsed(card, collapsed) {
    if (!card) return;
    card.classList.toggle('collapsed', collapsed);
    card.classList.toggle('p-5', !collapsed);
    card.classList.toggle('px-5', collapsed);
    card.classList.toggle('py-5', !collapsed);
    card.classList.toggle('py-3', collapsed);

    const body = card.querySelector('.card-body');
    if (body) {
        body.classList.toggle('max-h-0', collapsed);
        body.classList.toggle('max-h-[1000px]', !collapsed);
        body.classList.toggle('opacity-0', collapsed);
        body.classList.toggle('opacity-100', !collapsed);
        body.classList.toggle('pointer-events-none', collapsed);
        body.classList.toggle('mt-0', collapsed);
        body.classList.toggle('mt-4', !collapsed);
        body.classList.toggle('mb-0', collapsed);
        body.classList.toggle('mb-4', !collapsed);
        body.classList.toggle('-translate-y-2', collapsed);
        body.classList.toggle('translate-y-0', !collapsed);
    }

    if (card.dataset.cardId === 'strobe') {
        const strobeButton = card.querySelector('#strobe-toggle');
        if (strobeButton) strobeButton.classList.toggle('hidden', collapsed);
    }

    const button = card.querySelector('.card-toggle');
    if (!button) return;
    button.classList.toggle('collapsed', collapsed);
    button.textContent = collapsed ? '▸ Expand' : '▾ Collapse';
    button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    button.setAttribute('aria-label', (collapsed ? 'Expand ' : 'Collapse ') + (card.dataset.cardId || 'panel'));
}

function toggleCard(card) {
    if (!card) return;
    setCardCollapsed(card, !card.classList.contains('collapsed'));
}