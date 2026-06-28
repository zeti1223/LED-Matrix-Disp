function $(id) {
    return document.getElementById(id);
}

function appendConsole(text) {
    const el = $('console');
    if (!el) return;
    el.textContent += text;
    el.scrollTop = el.scrollHeight;
    setConsoleLastLine();
}

function setConsoleLastLine() {
    const el = $('console');
    if (!el) return;
    const lines = el.textContent.trim().split(/\r?\n/).filter(line => line.length > 0);
    const last = lines.length ? lines[lines.length - 1] : '';
    el.dataset.last = last;
}

function swapClasses(element, addClasses, removeClasses) {
    if (!element) return;
    removeClasses.forEach(cls => element.classList.remove(cls));
    addClasses.forEach(cls => element.classList.add(cls));
}

function clamp(v, min, max) {
    return Math.min(max, Math.max(min, Number(v) || 0));
}

function padHex(n) {
    return n.toString(16).padStart(2, '0');
}

function rgbToHex(r, g, b) {
    return '#' + padHex(r) + padHex(g) + padHex(b);
}

function hexToRgb(hex) {
    if (!hex) return null;
    const value = hex.replace('#', '');
    if (value.length === 3) {
        return {
            r: parseInt(value[0] + value[0], 16),
            g: parseInt(value[1] + value[1], 16),
            b: parseInt(value[2] + value[2], 16),
        };
    }
    if (value.length !== 6) return null;
    return {
        r: parseInt(value.slice(0, 2), 16),
        g: parseInt(value.slice(2, 4), 16),
        b: parseInt(value.slice(4, 6), 16),
    };
}

function debounce(fn, wait) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), wait);
    };
}