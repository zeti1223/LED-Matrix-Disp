const GIFUCT_JS_URL = 'https://cdn.jsdelivr.net/npm/gifuct-js@2.1.2/+esm';

let gifuctModule = null;

async function loadGifuct() {
    if (!gifuctModule) {
        gifuctModule = await import(GIFUCT_JS_URL);
    }
    return gifuctModule;
}

function rgbToNearestColorCode(r, g, b, colorMap) {
    if (r < 25 && g < 25 && b < 25) return '0';

    let minDist = Infinity;
    let best = '0';
    for (const [code, color] of Object.entries(colorMap)) {
        if (code === '0') continue;
        const dr = r - color.r;
        const dg = g - color.g;
        const db = b - color.b;
        const dist = dr * dr + dg * dg + db * db;
        if (dist < minDist) {
            minDist = dist;
            best = code;
        }
    }
    return best;
}

function sampleCanvasToFrame(ctx, gridWidth, gridHeight, colorMap) {
    const pixels = ctx.getImageData(0, 0, gridWidth, gridHeight).data;
    const frame = [];
    for (let i = 0; i < gridWidth * gridHeight; i++) {
        const idx = i * 4;
        frame.push(rgbToNearestColorCode(pixels[idx], pixels[idx + 1], pixels[idx + 2], colorMap));
    }
    return frame;
}

function getContentBounds(imageData) {
    const { width, height, data } = imageData;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            if (data[idx + 3] > 10) {
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }
    }

    if (minX > maxX) {
        const size = Math.min(width, height);
        return { x: Math.floor((width - size) / 2), y: Math.floor((height - size) / 2), size };
    }

    const contentWidth = maxX - minX + 1;
    const contentHeight = maxY - minY + 1;
    const size = Math.max(contentWidth, contentHeight);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    let x = Math.floor(centerX - size / 2);
    let y = Math.floor(centerY - size / 2);
    x = Math.max(0, Math.min(x, width - size));
    y = Math.max(0, Math.min(y, height - size));

    return { x, y, size: Math.min(size, width - x, height - y) };
}

function drawFramePatch(frame, tempCanvas, tempCtx, compositeCtx) {
    const dims = frame.dims;
    tempCanvas.width = dims.width;
    tempCanvas.height = dims.height;

    const frameImageData = tempCtx.createImageData(dims.width, dims.height);
    frameImageData.data.set(frame.patch);
    tempCtx.putImageData(frameImageData, 0, 0);
    compositeCtx.drawImage(tempCanvas, dims.left, dims.top);
}

function compositeGifFrames(gif, gifFrames) {
    const width = gif.lsd.width;
    const height = gif.lsd.height;

    const compositeCanvas = document.createElement('canvas');
    compositeCanvas.width = width;
    compositeCanvas.height = height;
    const compositeCtx = compositeCanvas.getContext('2d');

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');

    const backupCanvas = document.createElement('canvas');
    backupCanvas.width = width;
    backupCanvas.height = height;
    const backupCtx = backupCanvas.getContext('2d');

    const composited = [];

    for (let i = 0; i < gifFrames.length; i++) {
        const frame = gifFrames[i];

        if (i > 0) {
            const prevDisposal = gifFrames[i - 1].disposalType;
            if (prevDisposal === 2) {
                compositeCtx.clearRect(0, 0, width, height);
            } else if (prevDisposal === 3) {
                compositeCtx.clearRect(0, 0, width, height);
                compositeCtx.drawImage(backupCanvas, 0, 0);
            }
        }

        if (frame.disposalType === 3) {
            backupCtx.clearRect(0, 0, width, height);
            backupCtx.drawImage(compositeCanvas, 0, 0);
        }

        drawFramePatch(frame, tempCanvas, tempCtx, compositeCtx);

        const snapshot = document.createElement('canvas');
        snapshot.width = width;
        snapshot.height = height;
        snapshot.getContext('2d').drawImage(compositeCanvas, 0, 0);

        composited.push({
            delay: frame.delay ?? 100,
            canvas: snapshot
        });
    }

    return composited;
}

async function parseGifFile(file, gridWidth, gridHeight, colorMap, maxFrames = 20) {
    const { parseGIF, decompressFrames } = await loadGifuct();
    const buffer = await file.arrayBuffer();
    const gif = parseGIF(buffer);
    const gifFrames = decompressFrames(gif, true);

    if (!gifFrames.length) {
        throw new Error('GIF contains no frames');
    }

    const compositedFrames = compositeGifFrames(gif, gifFrames);

    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = gridWidth;
    sampleCanvas.height = gridHeight;
    const sampleCtx = sampleCanvas.getContext('2d');
    sampleCtx.imageSmoothingEnabled = false;

    const frames = [];
    let totalDelay = 0;
    const frameLimit = Math.min(compositedFrames.length, maxFrames);
    const truncated = compositedFrames.length > maxFrames;

    for (let i = 0; i < frameLimit; i++) {
        const { canvas, delay } = compositedFrames[i];
        const bounds = getContentBounds(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height));

        sampleCtx.clearRect(0, 0, gridWidth, gridHeight);
        sampleCtx.drawImage(
            canvas,
            bounds.x, bounds.y, bounds.size, bounds.size,
            0, 0, gridWidth, gridHeight
        );
        frames.push(sampleCanvasToFrame(sampleCtx, gridWidth, gridHeight, colorMap));
        totalDelay += delay;
    }

    const delay = Math.round(totalDelay / frameLimit);
    const baseName = file.name.replace(/\.gif$/i, '') || 'gif-import';

    return {
        name: baseName,
        delay: Math.max(10, Math.min(5000, delay)),
        frames,
        gridWidth,
        gridHeight,
        truncated,
        totalFrames: compositedFrames.length,
        importedFrames: frameLimit
    };
}

window.GifImport = { parseGifFile, rgbToNearestColorCode };
