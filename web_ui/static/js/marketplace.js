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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Globális elérhetőség a HTML eseménykezelők számára
window.downloadMarketAnimation = downloadMarketAnimation;
window.shareLocalAnimation = shareLocalAnimation;

document.addEventListener('DOMContentLoaded', () => {
    loadMarketplace();
    renderLocalAnimations();

    document.getElementById('refresh-market').addEventListener('click', loadMarketplace);
});

async function loadMarketplace() {
    const marketList = document.getElementById('market-list');
    marketList.innerHTML = '<p class="text-sm text-slate-400">Loading marketplace data...</p>';

    try {
        const querySnapshot = await getDocs(collection(db, "animations"));
        marketList.innerHTML = '';

        if (querySnapshot.empty) {
            marketList.innerHTML = '<p class="text-sm text-slate-400">No animations found in the marketplace.</p>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const item = createMarketItem(doc.id, data);
            marketList.appendChild(item);
        });
    } catch (error) {
        console.error("Error loading marketplace:", error);
        marketList.innerHTML = `<p class="text-sm text-rose-400">Error: ${error.message}</p>`;
    }
}

function createMarketItem(id, data) {
    const div = document.createElement('div');
    div.className = 'flex items-center justify-between p-3 rounded-xl border border-slate-700 bg-slate-800/50';

    // Safely figure out frame count whether it's an array or a serialized string
    let frameCount = 0;
    try {
        frameCount = typeof data.frames === 'string' ? JSON.parse(data.frames).length : (data.frames?.length || 0);
    } catch (e) {
        frameCount = 0;
    }

    const animJson = encodeURIComponent(JSON.stringify(data));

    div.innerHTML = `
        <div>
            <p class="font-semibold text-cyan-200">${data.name || 'Unnamed'}</p>
            <p class="text-xs text-slate-400">${frameCount} frames • ${data.delay || 100}ms delay</p>
        </div>
        <button onclick="downloadMarketAnimation('${animJson}')" class="rounded-lg border border-emerald-400/20 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/25">
            ⬇ Download
        </button>
    `;
    return div;
}

function renderLocalAnimations() {
    const localList = document.getElementById('local-list');
    localList.innerHTML = '';

    const animationsJson = localStorage.getItem('led_animations_data');
    const animationsData = animationsJson ? JSON.parse(animationsJson) : {};
    const names = Object.keys(animationsData);

    if (names.length === 0) {
        localList.innerHTML = '<p class="text-sm text-slate-400">No local animations found.</p>';
        return;
    }

    names.forEach(name => {
        const data = animationsData[name];
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between p-3 rounded-xl border border-slate-700 bg-slate-800/50';

        div.innerHTML = `
            <div>
                <p class="font-semibold text-slate-200">${name}</p>
                <p class="text-xs text-slate-400">${data.frames ? data.frames.length : 0} frames</p>
            </div>
            <button onclick="shareLocalAnimation('${name}')" class="rounded-lg border border-cyan-400/20 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/25">
                ☁ Share
            </button>
        `;
        localList.appendChild(div);
    });
}

function downloadMarketAnimation(encodedData) {
    try {
        const animation = JSON.parse(decodeURIComponent(encodedData));
        const name = animation.name;

        if (!name) throw new Error("Animation data is missing a name.");

        // If the frames are serialized as a string from Firestore, parse them back into an array for local use
        if (typeof animation.frames === 'string') {
            animation.frames = JSON.parse(animation.frames);
        }

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
        renderLocalAnimations();
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

        // Convert the nested frames array to a string to bypass Firestore's nested array limitation
        const serializedFrames = JSON.stringify(animation.frames);

        const docRef = await addDoc(collection(db, "animations"), {
            name: animation.name || name,
            delay: animation.delay || 100,
            frames: serializedFrames, // Stored as a string
            sharedAt: serverTimestamp()
        });

        alert(`"${name}" has been shared to the Marketplace!`);
        loadMarketplace();
    } catch (error) {
        console.error("Error sharing animation:", error);
        alert(`Failed to share: ${error.message}`);
    }
}