/* ════════════════════════════════
   CANLI TV — script1.js
   ════════════════════════════════ */

/* ── STATE ── */
let activePlayer = 0;
let players      = [];
let hlsInstances = [];
let playerInfos  = [];

/* ── REFERRER — selcuksports formatı ── */
const REFERRER = 'https%3A%2F%2Fwww.selcuksportshd0.xyz';

/* ── SİDEBAR ── */
function toggleSidebar() {
    const sidebar   = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebar-toggle');
    const collapsed = sidebar.classList.toggle('collapsed');
    toggleBtn.innerText = collapsed ? '▶' : '◀';
}

/* ── SİNEMA MODU ── */
function toggleCinemaMode() {
    const isEntering = !document.body.classList.contains('cinema-mode');
    const btn = document.getElementById('cinema-btn');

    if (isEntering) {
        // Butonu body'ye taşı ki header gizlenince kaybolmasın
        document.body.appendChild(btn);
        document.body.classList.add('cinema-mode');
        btn.innerText = '✕ Çık';
    } else {
        document.body.classList.remove('cinema-mode');
        // Butonu tekrar layout-buttons'a geri taşı
        const layoutButtons = document.querySelector('.layout-buttons');
        layoutButtons.appendChild(btn);
        btn.innerText = '🎬 Sinema';
    }
}

/* ── PiP ── */
async function togglePiP(index) {
    const video = players[index];
    if (!video) return;
    try {
        if (video !== document.pictureInPictureElement)
            await video.requestPictureInPicture();
        else
            await document.exitPictureInPicture();
    } catch (e) {
        console.warn('PiP Hatası:', e);
    }
}

/* ── PLAYER KUTULARINI OLUŞTUR ── */
function createPlayers(count) {
    const container  = document.getElementById('players');
    container.innerHTML = '';
    players      = [];
    hlsInstances = [];
    playerInfos  = [];

    const isMobile = window.innerWidth <= 768;

    /* Grid ayarları */
    if (isMobile) {
        container.style.gridTemplateColumns = (count === 4) ? '1fr 1fr' : '1fr';
        container.style.gridTemplateRows    = '';
    } else {
        if (count === 1) {
            container.style.gridTemplateColumns = '1fr';
            container.style.gridTemplateRows    = '1fr';
        } else if (count === 2) {
            container.style.gridTemplateColumns = '1fr';
            container.style.gridTemplateRows    = '1fr 1fr';
        } else {
            container.style.gridTemplateColumns = '1fr 1fr';
            container.style.gridTemplateRows    = '1fr 1fr';
        }
    }

    for (let i = 0; i < count; i++) {
        /* Kutu */
        const box = document.createElement('div');
        box.className     = 'player-box' + (i === activePlayer ? ' active' : '');
        box.dataset.index = i;

        /* Info etiketi */
        const info       = document.createElement('div');
        info.className   = 'player-info';
        info.innerText   = 'YAYIN BEKLENİYOR...';
        box.appendChild(info);
        playerInfos.push(info);

        /* PiP butonu */
        const pipBtn     = document.createElement('button');
        pipBtn.className = 'pip-btn';
        pipBtn.title     = 'Resim içinde resim';
        pipBtn.innerHTML = '⧉';
        pipBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            togglePiP(i);
        });
        box.appendChild(pipBtn);

        /* Video elementi */
        const video       = document.createElement('video');
        video.controls    = true;
        video.autoplay    = true;
        video.playsInline = true;
        video.muted       = (i !== activePlayer);
        box.appendChild(video);
        players.push(video);
        hlsInstances.push(null);

        /* Seçim olayları */
        const handleSelect = (e) => {
            if (e.target.classList.contains('pip-btn')) return;
            selectPlayer(i);
        };
        box.addEventListener('click',      handleSelect);
        box.addEventListener('touchstart', handleSelect, { passive: true });

        container.appendChild(box);
    }
}

/* ── KUTU SEÇ ── */
function selectPlayer(index) {
    activePlayer = index;
    document.querySelectorAll('.player-box').forEach((el, i) => {
        el.classList.toggle('active', i === index);
        if (players[i]) players[i].muted = (i !== index);
    });
    const name = playerInfos[index]?.innerText || 'Yayın Merkezi';
    document.getElementById('current-channel').innerText = name;
}

/* ── URL TİPİ TESPİT ET ── */
function isDirectStream(url) {
    return url.includes('.m3u8') || url.includes('.ts') || url.includes('.mpd');
}

/* ── YAYINI OYNAT ── */
function playStream(url, name = 'Bilinmeyen Kanal') {
    if (players.length === 0) createPlayers(1);

    /* Info güncelle */
    if (playerInfos[activePlayer])
        playerInfos[activePlayer].innerText = name;
    document.getElementById('current-channel').innerText = name;

    /* Mevcut HLS instance temizle */
    if (hlsInstances[activePlayer]) {
        hlsInstances[activePlayer].destroy();
        hlsInstances[activePlayer] = null;
    }

    const box   = document.querySelectorAll('.player-box')[activePlayer];
    const video = players[activePlayer];

    if (isDirectStream(url)) {
        /* ── Direkt m3u8 → Hls.js veya native ── */
        const oldIframe = box.querySelector('.stream-iframe');
        if (oldIframe) { oldIframe.src = ''; oldIframe.remove(); }
        video.style.display = 'block';

        if (typeof Hls !== 'undefined' && Hls.isSupported()) {
            const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
            hls.loadSource(url);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
            hls.on(Hls.Events.ERROR, (_, data) => {
                if (data.fatal) { console.error('HLS hata:', data.type); hls.destroy(); }
            });
            hlsInstances[activePlayer] = hls;
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = url;
            video.play().catch(() => {});
        } else {
            console.warn('Bu tarayıcı HLS desteklemiyor.');
        }

    } else {
        /* ── iframe player (uxsyplayer vb.) ── */
        video.style.display = 'none';
        video.src = '';

        let iframe = box.querySelector('.stream-iframe');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.className = 'stream-iframe';
            iframe.allowFullscreen = true;
            iframe.setAttribute('allow',          'autoplay; fullscreen; encrypted-media; picture-in-picture');
            iframe.setAttribute('scrolling',      'no');
            iframe.setAttribute('referrerpolicy', 'origin');
            box.appendChild(iframe);
        }

        /* URL'e referrer parametresi ekle — selcuksports formatı */
        const hashIdx  = url.indexOf('#');
        const baseUrl  = hashIdx !== -1 ? url.slice(0, hashIdx) : url;
        const hashPart = hashIdx !== -1 ? url.slice(hashIdx)    : '';
        const sep      = baseUrl.includes('?') ? '&' : '?';
        iframe.src     = baseUrl + sep + 'referrer=' + REFERRER + hashPart;
    }
}

/* ── EKRAN DÜZENİ ── */
function setLayout(count) {
    activePlayer = 0;
    createPlayers(count);
}

/* ── KANAL LİSTESİ ── */
const channels = [
    /* Ücretsiz / TRT */
    { name: 'TRT 1',             logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRpwQZNaSbzqW7QAujHGhuGicMIlYpTgJFr_Q&s', url: 'https://tv-trt1.medya.trt.com.tr/master.m3u8' },
    { name: 'TRT Spor',          logo: 'https://www.trgoals124.top/lib/img/channels/trt-spor.png',                                         url: 'https://tv-trtspor1.medya.trt.com.tr/master.m3u8' },
    { name: 'TRT Spor Yıldız',        logo: '',                                                                                                   url: 'https://main.uxsyplayer0e0c6aba22.click/index.php?id=selcuktrtspor2' },
    { name: 'TRT 1 (uxsy)',      logo: '',                                                                                                   url: 'https://main.uxsyplayer0e0c6aba22.click/index.php?id=selcuktrt1' },

    /* BeIN Sports */
    { name: 'Bein Sports 1',     logo: 'https://trgooltv61.top/img/beinsports1.png',    url: 'https://main.uxsyplayer0e0c6aba22.click/index.php?id=selcukbeinsports1' },
    { name: 'Bein Sports 2',     logo: 'https://trgooltv61.top/img/beinsports2.png',    url: 'https://main.uxsyplayer0e0c6aba22.click/index.php?id=selcukbeinsports2' },
    { name: 'Bein Sports 3',     logo: 'https://trgooltv61.top/img/beinsports3.png',    url: 'https://main.uxsyplayer0e0c6aba22.click/index.php?id=selcukbeinsports3' },
    { name: 'Bein Sports 4',     logo: 'https://trgooltv61.top/img/beinsports4.png',    url: 'https://main.uxsyplayer0e0c6aba22.click/index.php?id=selcukbeinsports4' },
    { name: 'Bein Sports 5',     logo: 'https://trgooltv61.top/img/beinsports5.png',    url: 'https://main.uxsyplayer0e0c6aba22.click/index.php?id=selcukbeinsports5' },
    { name: 'Bein Sports Haber', logo: '',                                               url: 'https://main.uxsyplayer0e0c6aba22.click/index.php?id=selcukbeinsportshaber' },
    { name: 'Bein Sports Max 1', logo: 'https://trgooltv61.top/img/beinsportsmax1.png', url: 'https://main.uxsyplayer0e0c6aba22.click/index.php?id=selcukbeinsportsmax1' },

    /* S Sport */
    { name: 'S Sport',           logo: 'https://www.trgoals125.top/lib/img/channels/s-sport.png',   url: 'https://main.uxsyplayer0e0c6aba22.click/index.php?id=selcukssport' },
    { name: 'S Sport 2',         logo: 'https://www.trgoals125.top/lib/img/channels/s-sport-2.png', url: 'https://main.uxsyplayer0e0c6aba22.click/index.php?id=selcukssport2' },

    /* A Spor */
    { name: 'A Spor',            logo: 'https://www.trgoals124.top/lib/img/channels/a-spor.png', url: 'https://main.uxsyplayer0e0c6aba22.click/index.php?id=selcukaspor' },

    /* Tabii Spor */
    { name: 'Tabii Spor',        logo: '', url: 'https://kl9mr2vxw7nq5py1sh4tj3gb6.medya.trt.com.tr/master_1080p.m3u8' },
    { name: 'Tabii Spor 1',      logo: '', url: 'https://pz4qt7nw1mr9sh2vl5xk8jg3y.medya.trt.com.tr/master.m3u8' },
    { name: 'Tabii Spor 2',      logo: '', url: 'https://mr8bv4kl1nq7sh9tw2xp5zj6g.medya.trt.com.tr/master_1440p.m3u8' },
    { name: 'Tabii Spor 3',      logo: '', url: 'https://mR4vL7nQ2sH9tW5xP1zK3gJ8b.medya.trt.com.tr/master.m3u8' },
];

/* ── KANALLARI RENDER ET ── */
function renderChannels(filter = '') {
    const list  = document.getElementById('channels');
    const lower = filter.toLowerCase();
    list.innerHTML = '';

    channels
        .filter(c => c.name.toLowerCase().includes(lower))
        .forEach(c => {
            const div = document.createElement('div');
            div.className = 'channel';
            div.innerHTML = `
                <div class="channel-logo">
                    ${c.logo
                        ? `<img src="${c.logo}" alt="${c.name}" loading="lazy">`
                        : '📺'}
                </div>
                <div class="channel-name">${c.name}</div>
            `;
            div.addEventListener('click', () => {
                document.querySelectorAll('.channel').forEach(el => el.classList.remove('selected-chan'));
                div.classList.add('selected-chan');
                playStream(c.url, c.name);
                if (window.innerWidth <= 768) toggleSidebar();
            });
            list.appendChild(div);
        });
}

/* ── INIT ── */
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('search')
        .addEventListener('input', e => renderChannels(e.target.value));
    renderChannels();
});