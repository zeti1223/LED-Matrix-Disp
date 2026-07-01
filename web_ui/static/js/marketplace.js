import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBgEEcRV1E62aInldEk6df1gu2LGSj31hI",
    authDomain: "led-matrix-a1111.firebaseapp.com",
    projectId: "led-matrix-a1111",
    storageBucket: "led-matrix-a1111.firebasestorage.app",
    messagingSenderId: "634264196499",
    appId: "1:634264196499:web:a99c86cbd7390b7f870466",
    measurementId: "G-YQ7B74G6RL"
};

const COLOR_MAP = {
    '0': { r: 0, g: 0, b: 0 },
    '1': { r: 255, g: 0, b: 0 },
    '2': { r: 0, g: 255, b: 0 },
    '3': { r: 0, g: 0, b: 255 },
    '4': { r: 255, g: 255, b: 0 },
    '5': { r: 255, g: 0, b: 255 },
    '6': { r: 0, g: 255, b: 255 },
    '7': { r: 255, g: 255, b: 255 }
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let allMarketAnimations = [];
const previewIntervals = new Map();

window.downloadMarketAnimation = downloadMarketAnimation;
window.shareLocalAnimation = shareLocalAnimation;

document.addEventListener('DOMContentLoaded', () => {
    loadMarketplace();

    document.getElementById('refresh-market').addEventListener('click', loadMarketplace);
    document.getElementById('market-size-filter').addEventListener('change', filterAndRenderMarketplace);
    document.getElementById('upload-animation-btn').addEventListener('click', openUploadModal);
    document.getElementById('upload-modal-close').addEventListener('click', closeUploadModal);
    document.getElementById('upload-modal-backdrop').addEventListener('click', closeUploadModal);
});

function parseAnimationFrames(data) {
    const anim = { ...data };
    if (typeof anim.frames === 'string') {
        anim.frames = JSON.parse(anim.frames);
    }
    return anim;
}

function getAnimationSize(anim) {
    if (anim.gridWidth && anim.gridHeight) {
        return { width: anim.gridWidth, height: anim.gridHeight };
    }
    const len = anim.frames?.[0]?.length || 0;
    const side = Math.sqrt(len);
    if (Number.isInteger(side) && side > 0) {
        return { width: side, height: side };
    }
    return { width: 8, height: 8 };
}

function formatSize(size) {
    return `${size.width}×${size.height}`;
}

function stopAllPreviews() {
    previewIntervals.forEach((id) => clearInterval(id));
    previewIntervals.clear();
}

function drawAnimationFrame(canvas, animation, frameIndex) {
    const size = getAnimationSize(animation);
    const ctx = canvas.getContext('2d');
    const frames = animation.frames;
    if (!frames || frames.length === 0) return;

    const frame = frames[frameIndex];
    if (!frame) return;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cellW = canvas.width / size.width;
    const cellH = canvas.height / size.height;

    for (let i = 0; i < frame.length; i++) {
        const x = (i % size.width) * cellW;
        const y = Math.floor(i / size.width) * cellH;
        const colorCode = frame[i] || '0';
        const color = COLOR_MAP[colorCode] || COLOR_MAP['0'];
        ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
        ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);
    }
}

function setupHoverPreview(canvas, animation, card, intervalMap = previewIntervals) {
    let frameIndex = 0;

    function stopPlayback() {
        const intervalId = intervalMap.get(canvas);
        if (intervalId) {
            clearInterval(intervalId);
            intervalMap.delete(canvas);
        }
        frameIndex = 0;
        drawAnimationFrame(canvas, animation, 0);
    }

    function startPlayback() {
        if (intervalMap.has(canvas)) return;

        frameIndex = 0;
        drawAnimationFrame(canvas, animation, 0);

        const intervalId = setInterval(() => {
            const frames = animation.frames;
            if (!frames || frames.length === 0) return;
            frameIndex = (frameIndex + 1) % frames.length;
            drawAnimationFrame(canvas, animation, frameIndex);
        }, animation.delay || 100);

        intervalMap.set(canvas, intervalId);
    }

    drawAnimationFrame(canvas, animation, 0);

    card.addEventListener('mouseenter', startPlayback);
    card.addEventListener('mouseleave', stopPlayback);
}

function createAnimationCard({ name, animation, sizeLabel, frameCount, delay, onAction, actionLabel, actionClass, previewMap }) {
    const card = document.createElement('div');
    card.className = 'flex flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-800/50 transition hover:border-cyan-400/30 hover:bg-slate-800/80';

    const previewWrap = document.createElement('div');
    previewWrap.className = 'aspect-square bg-slate-950/60 p-2';

    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 160;
    canvas.className = 'h-full w-full rounded-lg';
    previewWrap.appendChild(canvas);

    const info = document.createElement('div');
    info.className = 'flex flex-1 flex-col gap-2 p-3';

    const title = document.createElement('p');
    title.className = 'truncate font-semibold text-cyan-200';
    title.textContent = name;
    title.title = name;

    const meta = document.createElement('p');
    meta.className = 'text-xs text-slate-400';
    meta.textContent = `${sizeLabel} • ${frameCount} frames • ${delay}ms`;

    const btn = document.createElement('button');
    btn.className = actionClass;
    btn.textContent = actionLabel;
    btn.addEventListener('click', onAction);

    info.appendChild(title);
    info.appendChild(meta);
    info.appendChild(btn);
    card.appendChild(previewWrap);
    card.appendChild(info);

    setupHoverPreview(canvas, animation, card, previewMap);

    return card;
}

function createMarketItem(id, rawData) {
    const data = parseAnimationFrames(rawData);
    const size = getAnimationSize(data);
    const frameCount = data.frames?.length || 0;

    return createAnimationCard({
        name: data.name || 'Unnamed',
        animation: data,
        sizeLabel: formatSize(size),
        frameCount,
        delay: data.delay || 100,
        actionLabel: 'Download',
        actionClass: 'mt-auto w-full rounded-lg border border-emerald-400/20 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/25',
        onAction: () => downloadMarketAnimation(data)
    });
}

function updateSizeFilterOptions() {
    const filter = document.getElementById('market-size-filter');
    const currentValue = filter.value;
    const sizes = new Set();

    allMarketAnimations.forEach(({ data }) => {
        const anim = parseAnimationFrames(data);
        sizes.add(formatSize(getAnimationSize(anim)));
    });

    filter.innerHTML = '<option value="all">All sizes</option>';
    [...sizes].sort((a, b) => {
        const [aw, ah] = a.split('×').map(Number);
        const [bw, bh] = b.split('×').map(Number);
        return aw * ah - bw * bh;
    }).forEach((size) => {
        const option = document.createElement('option');
        option.value = size;
        option.textContent = size;
        filter.appendChild(option);
    });

    if (currentValue === 'all' || sizes.has(currentValue)) {
        filter.value = currentValue;
    }
}

function filterAndRenderMarketplace() {
    const filterValue = document.getElementById('market-size-filter').value;
    const marketList = document.getElementById('market-list');
    stopAllPreviews();
    marketList.innerHTML = '';

    const filtered = filterValue === 'all'
        ? allMarketAnimations
        : allMarketAnimations.filter(({ data }) => {
            const anim = parseAnimationFrames(data);
            return formatSize(getAnimationSize(anim)) === filterValue;
        });

    if (filtered.length === 0) {
        marketList.innerHTML = '<p class="col-span-full text-sm text-slate-400">No animations match this filter.</p>';
        return;
    }

    filtered.forEach(({ id, data }) => {
        marketList.appendChild(createMarketItem(id, data));
    });
}

async function loadMarketplace() {
    const marketList = document.getElementById('market-list');
    stopAllPreviews();
    marketList.innerHTML = '<p class="col-span-full text-sm text-slate-400">Loading marketplace data...</p>';

    try {
        const querySnapshot = await getDocs(collection(db, "animations"));
        allMarketAnimations = [];

        querySnapshot.forEach((doc) => {
            allMarketAnimations.push({ id: doc.id, data: doc.data() });
        });

        updateSizeFilterOptions();
        filterAndRenderMarketplace();
    } catch (error) {
        console.error("Error loading marketplace:", error);
        marketList.innerHTML = `<p class="col-span-full text-sm text-rose-400">Error: ${error.message}</p>`;
    }
}

function openUploadModal() {
    renderUploadModalList();
    document.getElementById('upload-modal').classList.remove('hidden');
}

function closeUploadModal() {
    stopUploadModalPreviews();
    document.getElementById('upload-modal').classList.add('hidden');
}

const uploadModalPreviews = new Map();

function stopUploadModalPreviews() {
    uploadModalPreviews.forEach((id) => clearInterval(id));
    uploadModalPreviews.clear();
}

function renderUploadModalList() {
    stopUploadModalPreviews();
    const list = document.getElementById('upload-modal-list');
    list.innerHTML = '';

    const animationsJson = localStorage.getItem('led_animations_data');
    const animationsData = animationsJson ? JSON.parse(animationsJson) : {};
    const names = Object.keys(animationsData);

    if (names.length === 0) {
        list.innerHTML = '<p class="col-span-full text-sm text-slate-400">No local animations found. Create one in the Animation Maker first.</p>';
        return;
    }

    names.forEach((name) => {
        const data = animationsData[name];
        const size = getAnimationSize(data);
        const frameCount = data.frames?.length || 0;

        const card = createAnimationCard({
            name,
            animation: data,
            sizeLabel: formatSize(size),
            frameCount,
            delay: data.delay || 100,
            actionLabel: 'Share',
            actionClass: 'mt-auto w-full rounded-lg border border-cyan-400/20 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/25',
            onAction: () => shareLocalAnimation(name),
            previewMap: uploadModalPreviews
        });

        list.appendChild(card);
    });
}

function downloadMarketAnimation(animationOrEncoded) {
    try {
        const animation = typeof animationOrEncoded === 'string'
            ? parseAnimationFrames(JSON.parse(decodeURIComponent(animationOrEncoded)))
            : parseAnimationFrames(animationOrEncoded);
        const name = animation.name;

        if (!name) throw new Error("Animation data is missing a name.");

        const animationsJson = localStorage.getItem('led_animations_data');
        const animationsData = animationsJson ? JSON.parse(animationsJson) : {};
        animationsData[name] = animation;
        localStorage.setItem('led_animations_data', JSON.stringify(animationsData));

        const animationsListJson = localStorage.getItem('led_animations');
        const animationsList = animationsListJson ? JSON.parse(animationsListJson) : [];
        if (!animationsList.includes(name)) {
            animationsList.push(name);
            localStorage.setItem('led_animations', JSON.stringify(animationsList));
        }

        alert(`Animation "${name}" successfully added to your local library!`);
    } catch (error) {
        alert(`Error downloading: ${error.message}`);
    }
}

async function shareLocalAnimation(name) {
    try {
        const animationsJson = localStorage.getItem('led_animations_data');
        const animationsData = animationsJson ? JSON.parse(animationsJson) : {};
        const animation = animationsData[name];

        if (!animation) throw new Error("Animation not found locally.");

        const serializedFrames = JSON.stringify(animation.frames);
        const size = getAnimationSize(animation);

        await addDoc(collection(db, "animations"), {
            name: animation.name || name,
            delay: animation.delay || 100,
            frames: serializedFrames,
            gridWidth: size.width,
            gridHeight: size.height,
            sharedAt: serverTimestamp()
        });

        alert(`"${name}" has been shared to the Marketplace!`);
        closeUploadModal();
        loadMarketplace();
    } catch (error) {
        console.error("Error sharing animation:", error);
        alert(`Failed to share: ${error.message}`);
    }
}
