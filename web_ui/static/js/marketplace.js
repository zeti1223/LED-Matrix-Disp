import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getFirestore, collection, addDoc, getDocs, getDoc, doc, setDoc,
    updateDoc, increment, serverTimestamp, query, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
let currentDetailId = null;
let detailPreviewInterval = null;
let pendingShareName = null;
const previewIntervals = new Map();
const trendingPreviewIntervals = new Map();

window.downloadMarketAnimation = downloadMarketAnimation;
window.shareLocalAnimation = shareLocalAnimation;

// --- User identity (localStorage-based) ---

function getUserId() {
    let id = localStorage.getItem('market_user_id');
    if (!id) {
        id = 'user_' + crypto.randomUUID().slice(0, 12);
        localStorage.setItem('market_user_id', id);
    }
    return id;
}

function getDisplayName() {
    const input = document.getElementById('market-user-name');
    const name = input?.value.trim() || localStorage.getItem('market_display_name') || 'Anonymous';
    return name.slice(0, 30);
}

function saveDisplayName() {
    const input = document.getElementById('market-user-name');
    if (input) {
        localStorage.setItem('market_display_name', input.value.trim());
    }
}

// --- Rating helpers ---

function getAverageRating(data) {
    const count = data.ratingCount || 0;
    if (count === 0) return 0;
    return (data.ratingSum || 0) / count;
}

function renderStars(rating, interactive = false, onRate = null) {
    const container = document.createElement('div');
    container.className = 'flex items-center gap-0.5';

    for (let i = 1; i <= 5; i++) {
        const star = document.createElement('button');
        star.type = 'button';
        star.className = interactive
            ? 'text-lg transition hover:scale-110 cursor-pointer'
            : 'text-sm pointer-events-none';
        star.textContent = i <= Math.round(rating) ? '★' : '☆';
        star.style.color = i <= Math.round(rating) ? '#f59e0b' : '#94a3b8';

        if (interactive) {
            star.addEventListener('mouseenter', () => {
                container.querySelectorAll('button').forEach((s, idx) => {
                    s.textContent = idx + 1 <= i ? '★' : '☆';
                    s.style.color = idx + 1 <= i ? '#f59e0b' : '#94a3b8';
                });
            });
            star.addEventListener('click', () => onRate?.(i));
        }

        container.appendChild(star);
    }

    if (interactive) {
        container.addEventListener('mouseleave', () => {
            container.querySelectorAll('button').forEach((s, idx) => {
                const filled = idx + 1 <= Math.round(rating);
                s.textContent = filled ? '★' : '☆';
                s.style.color = filled ? '#f59e0b' : '#94a3b8';
            });
        });
    }

    return container;
}

function getTrendingScore(data) {
    const downloads = data.downloadCount || 0;
    const ratingSum = data.ratingSum || 0;
    const ratingCount = data.ratingCount || 0;
    const avgRating = ratingCount > 0 ? ratingSum / ratingCount : 0;

    let recencyBonus = 0;
    if (data.sharedAt?.seconds) {
        const ageMs = Date.now() - data.sharedAt.seconds * 1000;
        const ageDays = ageMs / (1000 * 60 * 60 * 24);
        recencyBonus = Math.max(0, 10 - ageDays);
    }

    return downloads * 3 + ratingSum + avgRating * 2 + recencyBonus;
}

// --- DOM helpers ---

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

function stopAllPreviews(map = previewIntervals) {
    map.forEach((id) => clearInterval(id));
    map.clear();
}

function stopTrendingPreviews() {
    stopAllPreviews(trendingPreviewIntervals);
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

function createTagBadge(tag) {
    const span = document.createElement('span');
    span.className = 'rounded-full bg-cyan-500/10 px-2 py-0.5 text-xs font-medium text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-200';
    span.textContent = tag;
    return span;
}

function createAnimationCard({ id, name, animation, sizeLabel, frameCount, delay, data, onAction, actionLabel, actionClass, previewMap, onClick }) {
    const card = document.createElement('div');
    card.className = 'flex cursor-pointer flex-col overflow-hidden rounded-xl border border-slate-200 bg-white/80 transition hover:border-cyan-500/40 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-cyan-400/30 dark:hover:bg-slate-800/80';

    const previewWrap = document.createElement('div');
    previewWrap.className = 'aspect-square bg-slate-100 p-2 dark:bg-slate-950/60';

    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 160;
    canvas.className = 'h-full w-full rounded-lg';
    previewWrap.appendChild(canvas);

    const info = document.createElement('div');
    info.className = 'flex flex-1 flex-col gap-1.5 p-3';

    const title = document.createElement('p');
    title.className = 'truncate font-semibold text-cyan-700 dark:text-cyan-200';
    title.textContent = name;
    title.title = name;

    const meta = document.createElement('p');
    meta.className = 'text-xs text-slate-500 dark:text-slate-400';
    meta.textContent = `${sizeLabel} • ${frameCount} frames • ${delay}ms`;

    const statsRow = document.createElement('div');
    statsRow.className = 'flex items-center justify-between text-xs text-slate-500 dark:text-slate-400';

    const ratingEl = renderStars(getAverageRating(data || {}));
    const ratingCount = document.createElement('span');
    ratingCount.textContent = data?.ratingCount ? `(${data.ratingCount})` : '';
    ratingEl.appendChild(ratingCount);

    const downloads = document.createElement('span');
    downloads.textContent = `↓ ${data?.downloadCount || 0}`;

    statsRow.appendChild(ratingEl);
    statsRow.appendChild(downloads);

    if (data?.authorName) {
        const author = document.createElement('p');
        author.className = 'truncate text-xs text-slate-400 dark:text-slate-500';
        author.textContent = `by ${data.authorName}`;
        info.appendChild(title);
        info.appendChild(author);
    } else {
        info.appendChild(title);
    }

    info.appendChild(meta);
    info.appendChild(statsRow);

    if (onAction) {
        const btn = document.createElement('button');
        btn.className = actionClass;
        btn.textContent = actionLabel;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            onAction();
        });
        info.appendChild(btn);
    }

    card.appendChild(previewWrap);
    card.appendChild(info);

    setupHoverPreview(canvas, animation, card, previewMap);

    if (onClick) {
        card.addEventListener('click', () => onClick(id, data));
    }

    return card;
}

// --- Filtering, sorting, rendering ---

function getFilteredAnimations() {
    const searchQuery = (document.getElementById('market-search')?.value || '').toLowerCase().trim();
    const sizeFilter = document.getElementById('market-size-filter')?.value || 'all';
    const sortBy = document.getElementById('market-sort')?.value || 'newest';

    let filtered = allMarketAnimations.filter(({ data }) => {
        const anim = parseAnimationFrames(data);

        if (sizeFilter !== 'all' && formatSize(getAnimationSize(anim)) !== sizeFilter) {
            return false;
        }

        if (searchQuery) {
            const name = (data.name || '').toLowerCase();
            const desc = (data.description || '').toLowerCase();
            const tags = (data.tags || []).join(' ').toLowerCase();
            const author = (data.authorName || '').toLowerCase();
            if (!name.includes(searchQuery) && !desc.includes(searchQuery) && !tags.includes(searchQuery) && !author.includes(searchQuery)) {
                return false;
            }
        }

        return true;
    });

    filtered.sort((a, b) => {
        const da = a.data;
        const db = b.data;

        switch (sortBy) {
            case 'trending':
                return getTrendingScore(db) - getTrendingScore(da);
            case 'top-rated':
                return getAverageRating(db) - getAverageRating(da) || (db.ratingCount || 0) - (da.ratingCount || 0);
            case 'most-downloaded':
                return (db.downloadCount || 0) - (da.downloadCount || 0);
            case 'newest':
            default:
                return (db.sharedAt?.seconds || 0) - (da.sharedAt?.seconds || 0);
        }
    });

    return filtered;
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

function renderTrending() {
    const trendingList = document.getElementById('trending-list');
    stopTrendingPreviews();
    trendingList.innerHTML = '';

    const sorted = [...allMarketAnimations]
        .sort((a, b) => getTrendingScore(b.data) - getTrendingScore(a.data))
        .slice(0, 8);

    if (sorted.length === 0) {
        trendingList.innerHTML = '<p class="text-sm text-slate-500 dark:text-slate-400">No trending animations yet.</p>';
        return;
    }

    sorted.forEach(({ id, data }) => {
        const anim = parseAnimationFrames(data);
        const size = getAnimationSize(anim);
        const card = createAnimationCard({
            id,
            name: data.name || 'Unnamed',
            animation: anim,
            sizeLabel: formatSize(size),
            frameCount: anim.frames?.length || 0,
            delay: data.delay || 100,
            data,
            previewMap: trendingPreviewIntervals,
            onClick: openDetailModal
        });
        card.classList.add('w-40', 'shrink-0');
        trendingList.appendChild(card);
    });
}

function filterAndRenderMarketplace() {
    const marketList = document.getElementById('market-list');
    stopAllPreviews();
    marketList.innerHTML = '';

    const filtered = getFilteredAnimations();

    if (filtered.length === 0) {
        marketList.innerHTML = '<p class="col-span-full text-sm text-slate-500 dark:text-slate-400">No animations match your search.</p>';
        return;
    }

    filtered.forEach(({ id, data }) => {
        const anim = parseAnimationFrames(data);
        const size = getAnimationSize(anim);

        const card = createAnimationCard({
            id,
            name: data.name || 'Unnamed',
            animation: anim,
            sizeLabel: formatSize(size),
            frameCount: anim.frames?.length || 0,
            delay: data.delay || 100,
            data,
            actionLabel: 'Download',
            actionClass: 'mt-auto w-full rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500/20 dark:border-emerald-400/20 dark:bg-emerald-500/15 dark:text-emerald-100 dark:hover:bg-emerald-500/25',
            onAction: () => downloadMarketAnimation(data, id),
            onClick: openDetailModal
        });

        marketList.appendChild(card);
    });
}

async function loadMarketplace() {
    const marketList = document.getElementById('market-list');
    stopAllPreviews();
    marketList.innerHTML = '<p class="col-span-full text-sm text-slate-500 dark:text-slate-400">Loading marketplace data...</p>';

    try {
        const querySnapshot = await getDocs(collection(db, "animations"));
        allMarketAnimations = [];

        querySnapshot.forEach((docSnap) => {
            allMarketAnimations.push({ id: docSnap.id, data: docSnap.data() });
        });

        updateSizeFilterOptions();
        renderTrending();
        filterAndRenderMarketplace();
    } catch (error) {
        console.error("Error loading marketplace:", error);
        marketList.innerHTML = `<p class="col-span-full text-sm text-rose-400">Error: ${error.message}</p>`;
    }
}

// --- Detail modal ---

function stopDetailPreview() {
    if (detailPreviewInterval) {
        clearInterval(detailPreviewInterval);
        detailPreviewInterval = null;
    }
}

async function openDetailModal(id, rawData) {
    currentDetailId = id;
    const data = rawData || allMarketAnimations.find(a => a.id === id)?.data;
    if (!data) return;

    const anim = parseAnimationFrames(data);
    const size = getAnimationSize(anim);

    document.getElementById('detail-title').textContent = data.name || 'Unnamed';
    document.getElementById('detail-meta').textContent =
        `${formatSize(size)} • ${anim.frames?.length || 0} frames • ${data.delay || 100}ms • ${data.downloadCount || 0} downloads`;
    document.getElementById('detail-author').textContent = data.authorName ? `Shared by ${data.authorName}` : '';
    document.getElementById('detail-description').textContent = data.description || 'No description provided.';

    const tagsEl = document.getElementById('detail-tags');
    tagsEl.innerHTML = '';
    (data.tags || []).forEach(tag => tagsEl.appendChild(createTagBadge(tag)));

    const ratingDisplay = document.getElementById('detail-rating-display');
    ratingDisplay.innerHTML = '';
    const avg = getAverageRating(data);
    ratingDisplay.appendChild(renderStars(avg));
    const ratingLabel = document.createElement('span');
    ratingLabel.className = 'text-sm text-slate-500 dark:text-slate-400';
    ratingLabel.textContent = avg > 0 ? `${avg.toFixed(1)} (${data.ratingCount || 0} ratings)` : 'No ratings yet';
    ratingDisplay.appendChild(ratingLabel);

    const ratingInput = document.getElementById('detail-rating-input');
    ratingInput.innerHTML = '';
    const rateLabel = document.createElement('span');
    rateLabel.className = 'mr-2 text-xs text-slate-500 dark:text-slate-400';
    rateLabel.textContent = 'Rate:';
    ratingInput.appendChild(rateLabel);
    ratingInput.appendChild(renderStars(0, true, (stars) => submitRating(id, stars)));

    const canvas = document.getElementById('detail-canvas');
    stopDetailPreview();
    let frameIdx = 0;
    drawAnimationFrame(canvas, anim, 0);
    detailPreviewInterval = setInterval(() => {
        frameIdx = (frameIdx + 1) % (anim.frames?.length || 1);
        drawAnimationFrame(canvas, anim, frameIdx);
    }, anim.delay || 100);

    document.getElementById('detail-download').onclick = () => downloadMarketAnimation(data, id);

    await loadComments(id);

    document.getElementById('detail-comment-input').value = '';
    document.getElementById('detail-modal').classList.remove('hidden');
}

function closeDetailModal() {
    stopDetailPreview();
    currentDetailId = null;
    document.getElementById('detail-modal').classList.add('hidden');
}

async function loadComments(animationId) {
    const commentsEl = document.getElementById('detail-comments');
    commentsEl.innerHTML = '<p class="text-xs text-slate-400">Loading comments...</p>';

    try {
        const q = query(
            collection(db, "animations", animationId, "comments"),
            orderBy("createdAt", "desc"),
            limit(50)
        );
        const snap = await getDocs(q);

        commentsEl.innerHTML = '';
        if (snap.empty) {
            commentsEl.innerHTML = '<p class="text-xs text-slate-400">No comments yet. Be the first!</p>';
            return;
        }

        snap.forEach((docSnap) => {
            const c = docSnap.data();
            const div = document.createElement('div');
            div.className = 'rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50';

            const header = document.createElement('div');
            header.className = 'flex items-center justify-between';
            const author = document.createElement('span');
            author.className = 'text-xs font-semibold text-cyan-700 dark:text-cyan-300';
            author.textContent = c.authorName || 'Anonymous';
            const time = document.createElement('span');
            time.className = 'text-xs text-slate-400';
            if (c.createdAt?.seconds) {
                time.textContent = new Date(c.createdAt.seconds * 1000).toLocaleDateString();
            }
            header.appendChild(author);
            header.appendChild(time);

            const text = document.createElement('p');
            text.className = 'mt-1 text-sm text-slate-700 dark:text-slate-300';
            text.textContent = c.text;

            div.appendChild(header);
            div.appendChild(text);
            commentsEl.appendChild(div);
        });
    } catch (error) {
        console.error("Error loading comments:", error);
        commentsEl.innerHTML = '<p class="text-xs text-rose-400">Failed to load comments.</p>';
    }
}

async function submitComment() {
    if (!currentDetailId) return;

    const input = document.getElementById('detail-comment-input');
    const text = input.value.trim();
    if (!text) return;

    const displayName = getDisplayName();
    if (displayName === 'Anonymous') {
        alert('Please set your display name before commenting.');
        return;
    }

    try {
        await addDoc(collection(db, "animations", currentDetailId, "comments"), {
            authorName: displayName,
            authorId: getUserId(),
            text,
            createdAt: serverTimestamp()
        });

        input.value = '';
        await loadComments(currentDetailId);
    } catch (error) {
        console.error("Error posting comment:", error);
        alert(`Failed to post comment: ${error.message}`);
    }
}

async function submitRating(animationId, stars) {
    const userId = getUserId();
    const displayName = getDisplayName();

    try {
        const ratingRef = doc(db, "animations", animationId, "ratings", userId);
        const existing = await getDoc(ratingRef);
        const oldRating = existing.exists() ? existing.data().rating : 0;

        const animRef = doc(db, "animations", animationId);
        const updates = {
            ratingSum: increment(stars - oldRating)
        };
        if (!existing.exists()) {
            updates.ratingCount = increment(1);
        }
        await updateDoc(animRef, updates);

        await setDoc(ratingRef, {
            rating: stars,
            authorName: displayName,
            createdAt: serverTimestamp()
        });

        const animDoc = await getDoc(animRef);
        if (animDoc.exists()) {
            const item = allMarketAnimations.find(a => a.id === animationId);
            if (item) {
                item.data = animDoc.data();
            }
            openDetailModal(animationId, animDoc.data());
            renderTrending();
            filterAndRenderMarketplace();
        }
    } catch (error) {
        console.error("Error submitting rating:", error);
        alert(`Failed to submit rating: ${error.message}`);
    }
}

// --- Upload / Share ---

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

function openShareForm(name) {
    pendingShareName = name;
    document.getElementById('share-form-name').textContent = name;
    document.getElementById('share-description').value = '';
    document.getElementById('share-tags').value = '';
    closeUploadModal();
    document.getElementById('share-form-modal').classList.remove('hidden');
}

function closeShareForm() {
    pendingShareName = null;
    document.getElementById('share-form-modal').classList.add('hidden');
}

function renderUploadModalList() {
    stopUploadModalPreviews();
    const list = document.getElementById('upload-modal-list');
    list.innerHTML = '';

    const animationsJson = localStorage.getItem('led_animations_data');
    const animationsData = animationsJson ? JSON.parse(animationsJson) : {};
    const names = Object.keys(animationsData);

    if (names.length === 0) {
        list.innerHTML = '<p class="col-span-full text-sm text-slate-500 dark:text-slate-400">No local animations found. Create one in the Animation Maker first.</p>';
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
            data: {},
            actionLabel: 'Share',
            actionClass: 'mt-auto w-full rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-500/20 dark:border-cyan-400/20 dark:bg-cyan-500/15 dark:text-cyan-100 dark:hover:bg-cyan-500/25',
            onAction: () => openShareForm(name),
            previewMap: uploadModalPreviews
        });

        list.appendChild(card);
    });
}

async function downloadMarketAnimation(animationOrEncoded, docId) {
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

        if (docId) {
            try {
                await updateDoc(doc(db, "animations", docId), {
                    downloadCount: increment(1)
                });
                const item = allMarketAnimations.find(a => a.id === docId);
                if (item) {
                    item.data.downloadCount = (item.data.downloadCount || 0) + 1;
                }
                renderTrending();
                filterAndRenderMarketplace();
            } catch (e) {
                console.warn("Could not increment download count:", e);
            }
        }

        alert(`Animation "${name}" successfully added to your local library!`);
    } catch (error) {
        alert(`Error downloading: ${error.message}`);
    }
}

async function shareLocalAnimation(name) {
    openShareForm(name);
}

async function submitShare() {
    if (!pendingShareName) return;

    const name = pendingShareName;
    const description = document.getElementById('share-description').value.trim();
    const tagsRaw = document.getElementById('share-tags').value.trim();
    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean).slice(0, 10) : [];
    const authorName = getDisplayName();

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
            description,
            tags,
            authorName,
            authorId: getUserId(),
            downloadCount: 0,
            ratingSum: 0,
            ratingCount: 0,
            sharedAt: serverTimestamp()
        });

        alert(`"${name}" has been shared to the Marketplace!`);
        closeShareForm();
        loadMarketplace();
    } catch (error) {
        console.error("Error sharing animation:", error);
        alert(`Failed to share: ${error.message}`);
    }
}

// --- Init ---

document.addEventListener('DOMContentLoaded', () => {
    const nameInput = document.getElementById('market-user-name');
    if (nameInput) {
        nameInput.value = localStorage.getItem('market_display_name') || '';
        nameInput.addEventListener('change', saveDisplayName);
        nameInput.addEventListener('blur', saveDisplayName);
    }

    loadMarketplace();

    document.getElementById('refresh-market').addEventListener('click', loadMarketplace);
    document.getElementById('market-size-filter').addEventListener('change', filterAndRenderMarketplace);
    document.getElementById('market-sort').addEventListener('change', filterAndRenderMarketplace);

    const searchInput = document.getElementById('market-search');
    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(filterAndRenderMarketplace, 250);
    });

    document.getElementById('upload-animation-btn').addEventListener('click', openUploadModal);
    document.getElementById('upload-modal-close').addEventListener('click', closeUploadModal);
    document.getElementById('upload-modal-backdrop').addEventListener('click', closeUploadModal);

    document.getElementById('share-form-cancel').addEventListener('click', closeShareForm);
    document.getElementById('share-form-backdrop').addEventListener('click', closeShareForm);
    document.getElementById('share-form-submit').addEventListener('click', submitShare);

    document.getElementById('detail-modal-close').addEventListener('click', closeDetailModal);
    document.getElementById('detail-modal-backdrop').addEventListener('click', closeDetailModal);
    document.getElementById('detail-comment-submit').addEventListener('click', submitComment);
    document.getElementById('detail-comment-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitComment();
    });
});
