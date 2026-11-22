const TIKTOK_API = "https://tikwm.com/api/";
const INSTAGRAM_API = "https://api.nexray.eu.cc/downloader/v2/instagram";
const FACEBOOK_API = "https://api.nexray.eu.cc/downloader/facebook";

let currentMedia = null;
let currentPlatform = "tiktok";

const input = document.getElementById("videoUrl");
const loading = document.getElementById("loading");
const result = document.getElementById("result");
const errorBox = document.getElementById("error");
const downloadBtn = document.getElementById("downloadBtn");

const preview = document.getElementById("preview");
const imagePreview = document.getElementById("imagePreview");

// GENERATE RANDOM FILENAME
function generateFileName(type) {
    const random = Array.from(
        { length: 24 },
        () => "abcdefghijklmnopqrstuvwxyz"[
            Math.floor(Math.random() * 26)
        ]
    ).join("");

    return `retikwm-${random}.${type === "video" ? "mp4" : "jpg"}`;
}

// PLATFORM SELECT
document.querySelectorAll(".platform-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".platform-btn").forEach(b => {
            b.classList.remove("active");
        });

        btn.classList.add("active");
        currentPlatform = btn.dataset.platform;
        input.value = "";

        const placeholders = {
            tiktok: "https://www.tiktok.com/...",
            instagram: "https://www.instagram.com/reel/...",
            facebook: "https://www.facebook.com/share/v/..."
        };

        input.placeholder = placeholders[currentPlatform] || "Masukkan link...";

        resetResult();
    });
});

// PASTE LINK
async function pasteLink() {
    try {
        input.value = await navigator.clipboard.readText();
    } catch {
        showError("Tidak bisa mengakses clipboard. Silakan paste manual.");
    }
}

// FORMAT NUMBER
function formatNumber(num) {
    return new Intl.NumberFormat("id-ID", {
        notation: "compact",
        maximumFractionDigits: 1
    }).format(Number(num) || 0);
}

// ERROR
function showError(message) {
    errorBox.style.display = "block";
    errorBox.textContent = message;
}

// RESET RESULT
function resetResult() {
    result.style.display = "none";
    errorBox.style.display = "none";

    preview.pause();
    preview.removeAttribute("src");
    preview.removeAttribute("poster");
    preview.load();

    imagePreview.removeAttribute("src");
    imagePreview.style.display = "none";

    currentMedia = null;
}

// MAIN DOWNLOAD
async function downloadMedia() {
    const url = input.value.trim();

    resetResult();

    if (!url) {
        showError("Masukkan link terlebih dahulu!");
        return;
    }

    const domains = {
        tiktok: /tiktok\.com/i,
        instagram: /instagram\.com/i,
        facebook: /(facebook\.com|fb\.watch)/i
    };

    if (!domains[currentPlatform]?.test(url)) {
        showError(`Link yang dimasukkan bukan link ${currentPlatform}!`);
        return;
    }

    loading.style.display = "block";
    downloadBtn.disabled = true;

    try {
        if (currentPlatform === "tiktok") {
            await downloadTikTok(url);
        } else if (currentPlatform === "instagram") {
            await downloadInstagram(url);
        } else if (currentPlatform === "facebook") {
            await downloadFacebook(url);
        }
    } catch (err) {
        showError(err.message || "Terjadi kesalahan.");
        console.error(err);
    } finally {
        loading.style.display = "none";
        downloadBtn.disabled = false;
    }
}

// TIKTOK API
async function downloadTikTok(url) {
    const params = new URLSearchParams({
        url,
        hd: "1"
    });

    const response = await fetch(TIKTOK_API, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Accept": "application/json"
        },
        body: params
    });

    if (!response.ok) {
        throw new Error("Server TikTok error: " + response.status);
    }

    const json = await response.json();

    if (json.code !== 0 || !json.data) {
        throw new Error(json.msg || "Gagal mengambil video TikTok.");
    }

    const data = json.data;

    if (data.duration === 0 && data.images?.length) {
        throw new Error("Konten TikTok ini berupa foto/slideshow.");
    }

    const videoUrl = data.hdplay || data.play;

    if (!videoUrl) {
        throw new Error("Link video tidak ditemukan.");
    }

    currentMedia = {
        platform: "tiktok",
        type: "video",
        url: videoUrl,
        title: data.title || "TikTok Video"
    };

    preview.style.display = "block";
    imagePreview.style.display = "none";

    preview.src = videoUrl;
    preview.poster = data.cover || "";

    setAuthor(
        data.author?.nickname || "TikTok User",
        "@" + (data.author?.unique_id || "unknown"),
        data.author?.avatar || "",
        data.author?.verified
    );

    document.getElementById("caption").textContent =
        data.title || "Tidak ada caption.";

    document.getElementById("views").textContent =
        formatNumber(data.play_count);

    document.getElementById("likes").textContent =
        formatNumber(data.digg_count);

    document.getElementById("comments").textContent =
        formatNumber(data.comment_count);

    document.getElementById("qualityTitle").textContent =
        "Video Original";

    document.getElementById("qualityDescription").textContent =
        "Tanpa watermark • HD Quality";

    document.getElementById("extraDownloads").innerHTML = "";

    document.getElementById("saveBtn").innerHTML =
        '<i class="fas fa-download"></i> Download Tanpa Watermark';

    result.style.display = "block";
    scrollResult();
}

// INSTAGRAM API
async function downloadInstagram(url) {
    const response = await fetch(
        `${INSTAGRAM_API}?url=${encodeURIComponent(url)}`
    );

    if (!response.ok) {
        throw new Error("Server Instagram error: " + response.status);
    }

    const json = await response.json();

    if (!json.status || !json.result) {
        throw new Error("Gagal mengambil media Instagram.");
    }

    const data = json.result;

    if (!Array.isArray(data.data) || !data.data.length) {
        throw new Error("Media Instagram tidak ditemukan.");
    }

    const media = data.data.filter(item =>
        item.url && ["video", "image"].includes(item.type)
    );

    if (!media.length) {
        throw new Error("Link media tidak tersedia.");
    }

    showMediaResult({
        platform: "instagram",
        data,
        media,
        author: data.author || {},
        title: data.title || "Instagram Media",
        views: "-",
        likes: formatNumber(data.stats?.likes),
        comments: formatNumber(data.stats?.comments)
    });
}

// FACEBOOK API
async function downloadFacebook(url) {
    const response = await fetch(
        `${FACEBOOK_API}?url=${encodeURIComponent(url)}`
    );

    if (!response.ok) {
        throw new Error("Server Facebook error: " + response.status);
    }

    const json = await response.json();

    if (!json.status || !json.result) {
        throw new Error("Gagal mengambil media Facebook.");
    }

    const data = json.result;

    if (!Array.isArray(data.data) || !data.data.length) {
        throw new Error("Media Facebook tidak ditemukan.");
    }

    const media = data.data.filter(item =>
        item.url && ["video", "image"].includes(item.type)
    );

    if (!media.length) {
        throw new Error("Link media Facebook tidak tersedia.");
    }

    showMediaResult({
        platform: "facebook",
        data,
        media,
        author: data.author || {},
        title: data.title || "Facebook Media",
        views: data.stats?.views || "-",
        likes: data.stats?.likes || "-",
        comments: data.stats?.comments || "-"
    });
}

// DISPLAY INSTAGRAM & FACEBOOK RESULT
function showMediaResult({
    platform,
    data,
    media,
    author,
    title,
    views,
    likes,
    comments
}) {
    const first = media[0];

    currentMedia = {
        platform,
        type: first.type,
        url: first.url,
        title,
        media
    };

    if (first.type === "video") {
        preview.style.display = "block";
        imagePreview.style.display = "none";

        preview.src = first.url;
        preview.poster = first.thumbnail || "";
    } else {
        preview.pause();
        preview.style.display = "none";

        imagePreview.style.display = "block";
        imagePreview.src = first.url;
    }

    const fallbackName = platform === "facebook"
        ? "Facebook User"
        : "Instagram User";

    const username = author.username && author.username !== "-"
        ? "@" + author.username
        : "@" + (platform === "facebook" ? "facebook" : "instagram");

    setAuthor(
        author.fullname && author.fullname !== "-"
            ? author.fullname
            : author.username && author.username !== "-"
                ? author.username
                : fallbackName,
        username,
        author.avatar || first.thumbnail || "",
        author.verified
    );

    document.getElementById("caption").textContent =
        title || "Tidak ada caption.";

    document.getElementById("views").textContent = views;
    document.getElementById("likes").textContent = likes;
    document.getElementById("comments").textContent = comments;

    document.getElementById("qualityTitle").textContent =
        media.length > 1
            ? `${media.length} Media Tersedia`
            : `${platform === "facebook" ? "Facebook" : "Instagram"} Original`;

    document.getElementById("qualityDescription").textContent =
        `${first.type.toUpperCase()} • ${data.duration || "Original Quality"}`;

    // EXTRA DOWNLOADS
    const extra = document.getElementById("extraDownloads");
    extra.innerHTML = "";

    media.forEach((item, index) => {
        const div = document.createElement("div");
        div.className = "extra-download-item";

        const label = document.createElement("span");
        label.textContent =
            `${item.type === "video" ? "Video" : "Foto"} ${index + 1}`;

        const link = document.createElement("a");
        link.href = "#";
        link.innerHTML =
            '<i class="fas fa-download"></i> Download';

        link.addEventListener("click", async e => {
            e.preventDefault();
            await downloadFile(item.url, item.type, link);
        });

        div.append(label, link);
        extra.appendChild(div);
    });

    document.getElementById("saveBtn").innerHTML =
        '<i class="fas fa-download"></i> Download Media';

    result.style.display = "block";
    scrollResult();
}

// SET AUTHOR
function setAuthor(name, username, avatar, verified) {
    document.getElementById("nickname").textContent = name;
    document.getElementById("username").textContent = username;

    const avatarElement = document.getElementById("avatar");

    avatarElement.src = avatar || "https://placehold.co/100x100?text=User";

    avatarElement.onerror = () => {
        avatarElement.src = "https://placehold.co/100x100?text=User";
    };

    document.getElementById("verified").style.display =
        verified ? "grid" : "none";
}

// SCROLL RESULT
function scrollResult() {
    result.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

// DOWNLOAD FILE
async function downloadFile(url, type, button) {
    const original = button.innerHTML;

    button.disabled = true;
    button.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Menyiapkan...';

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Download tidak tersedia.");
        }

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = generateFileName(type);

        document.body.appendChild(a);
        a.click();
        a.remove();

        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

    } catch (err) {
        console.error(err);
        window.open(url, "_blank", "noopener,noreferrer");
    } finally {
        button.innerHTML = original;
        button.disabled = false;
    }
}

// SAVE MEDIA
async function saveMedia() {
    if (!currentMedia) return;

    const btn = document.getElementById("saveBtn");

    await downloadFile(
        currentMedia.url,
        currentMedia.type,
        btn
    );
}

// MUSIC PLAYLIST
const playlist = [
    {
        title: "Firasat - Marcell",
        artist: "Marcell",
        src: "music1.mp3",
        cover: "cover.jpg"
    },
    {
        title: "Anomali - rumahsakit",
        artist: "rumahsakit",
        src: "music2.mp3",
        cover: "cover.jpg"
    },
    {
        title: "Last Night On Earth - Green Day",
        artist: "Green Day",
        src: "music3.mp3",
        cover: "cover.jpg"
    }
];

let currentSong = 0;

const audio = document.getElementById("musicAudio");
const panel = document.getElementById("musicPanel");
const toggle = document.getElementById("musicToggle");
const toggleIcon = document.getElementById("musicToggleIcon");
const playSmall = document.getElementById("musicPlaySmall");
const seek = document.getElementById("musicSeek");

// LOAD MUSIC
function loadSong(index) {
    currentSong = (index + playlist.length) % playlist.length;

    const song = playlist[currentSong];

    audio.src = song.src;

    document.getElementById("musicTitle").textContent = song.title;
    document.getElementById("musicArtist").textContent = song.artist;
    document.getElementById("musicCover").src = song.cover;

    seek.value = 0;
}

// UPDATE PLAYER
function updateMusicUI() {
    const playing = !audio.paused;

    toggleIcon.className = playing
        ? "fas fa-pause"
        : "fas fa-play";

    playSmall.innerHTML = playing
        ? '<i class="fas fa-pause"></i>'
        : '<i class="fas fa-play"></i>';
}

// PLAY PAUSE
async function toggleMusic() {
    if (audio.paused) {
        if (!audio.src) loadSong(currentSong);

        try {
            await audio.play();
            panel.classList.add("active");
        } catch (error) {
            console.error(error);
        }
    } else {
        audio.pause();
    }

    updateMusicUI();
}

// NEXT SONG
async function nextSong() {
    loadSong(currentSong + 1);

    try {
        await audio.play();
        panel.classList.add("active");
    } catch (error) {
        console.error(error);
    }

    updateMusicUI();
}

// PREVIOUS SONG
async function prevSong() {
    loadSong(currentSong - 1);

    try {
        await audio.play();
        panel.classList.add("active");
    } catch (error) {
        console.error(error);
    }

    updateMusicUI();
}

// BUTTON EVENTS
toggle.addEventListener("click", toggleMusic);
playSmall.addEventListener("click", toggleMusic);

document.getElementById("musicNext")
    .addEventListener("click", nextSong);

document.getElementById("musicPrev")
    .addEventListener("click", prevSong);

// AUTO NEXT
audio.addEventListener("ended", nextSong);

// PLAY EVENT
audio.addEventListener("play", () => {
    panel.classList.add("active");
    updateMusicUI();
});

// PAUSE EVENT
audio.addEventListener("pause", updateMusicUI);

// PROGRESS
audio.addEventListener("timeupdate", () => {
    if (!audio.duration) return;

    seek.value = (audio.currentTime / audio.duration) * 100;

    document.getElementById("musicCurrent").textContent =
        formatMusicTime(audio.currentTime);
});

// DURATION
audio.addEventListener("loadedmetadata", () => {
    document.getElementById("musicDuration").textContent =
        formatMusicTime(audio.duration);
});

// SEEK
seek.addEventListener("input", () => {
    if (audio.duration) {
        audio.currentTime = (seek.value / 100) * audio.duration;
    }
});

// TIME FORMAT
function formatMusicTime(time) {
    if (!Number.isFinite(time)) return "0:00";

    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);

    return `${min}:${String(sec).padStart(2, "0")}`;
}


// INITIALIZE
loadSong(0);

// CLOSE MUSIC PANEL
document.getElementById("musicClose").addEventListener("click", () => {
    panel.classList.remove("active");
});

// ENTER KEY
input.addEventListener("keydown", e => {
    if (e.key === "Enter") {
        downloadMedia();
    }
});