const TIKTOK_API = "https://tikwm.com/api/";
const INSTAGRAM_API = "https://api.nexray.eu.cc/downloader/v2/instagram";

let currentMedia = null;
let currentPlatform = "tiktok";

const input = document.getElementById("videoUrl");
const loading = document.getElementById("loading");
const result = document.getElementById("result");
const errorBox = document.getElementById("error");
const downloadBtn = document.getElementById("downloadBtn");

const preview = document.getElementById("preview");
const imagePreview = document.getElementById("imagePreview");

// RANDOM FILENAME
function generateFileName(type) {
    const random = crypto.randomUUID().replace(/-/g, "");
    const timestamp = Date.now();
    const extension = type === "video" ? "mp4" : "jpg";

    return `ReTikWM-${timestamp}-${random}.${extension}`;
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

        input.placeholder = currentPlatform === "tiktok"
            ? "https://www.tiktok.com/..."
            : "https://www.instagram.com/reel/...";

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
    preview.load();

    imagePreview.removeAttribute("src");
    currentMedia = null;

    document.getElementById("extraDownloads").innerHTML = "";
}

// MAIN DOWNLOAD
async function downloadMedia() {
    const url = input.value.trim();

    resetResult();

    if (!url) {
        showError("Masukkan link terlebih dahulu!");
        return;
    }

    if (currentPlatform === "tiktok" && !/tiktok\.com/i.test(url)) {
        showError("Link yang dimasukkan bukan link TikTok!");
        return;
    }

    if (currentPlatform === "instagram" && !/instagram\.com/i.test(url)) {
        showError("Link yang dimasukkan bukan link Instagram!");
        return;
    }

    loading.style.display = "block";
    downloadBtn.disabled = true;

    try {
        if (currentPlatform === "tiktok") {
            await downloadTikTok(url);
        } else {
            await downloadInstagram(url);
        }
    } catch (err) {
        showError(err.message || "Terjadi kesalahan.");
        console.error(err);
    } finally {
        loading.style.display = "none";
        downloadBtn.disabled = false;
    }
}

// TIKTOK API + PHOTO SLIDESHOW
async function downloadTikTok(url) {
    const params = new URLSearchParams({
        url: url,
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
        throw new Error(json.msg || "Gagal mengambil media TikTok.");
    }

    const data = json.data;

    // PHOTO SLIDESHOW
    if (Array.isArray(data.images) && data.images.length > 0) {
        const photos = data.images;

        currentMedia = {
            platform: "tiktok",
            type: "image",
            url: photos[0],
            title: data.title || "TikTok Photos",
            media: photos
        };

        preview.pause();
        preview.removeAttribute("src");
        preview.load();
        preview.style.display = "none";

        imagePreview.style.display = "block";
        imagePreview.src = photos[0];

        setAuthor(
            data.author?.nickname || "TikTok User",
            "@" + (data.author?.unique_id || "unknown"),
            data.author?.avatar || "",
            data.author?.verified
        );

        document.getElementById("caption").textContent =
            data.title || "TikTok Photo Slideshow";

        document.getElementById("views").textContent =
            formatNumber(data.play_count);

        document.getElementById("likes").textContent =
            formatNumber(data.digg_count);

        document.getElementById("comments").textContent =
            formatNumber(data.comment_count);

        document.getElementById("qualityTitle").textContent =
            `${photos.length} Foto Tersedia`;

        document.getElementById("qualityDescription").textContent =
            "TikTok Photo Slideshow • Original Quality";

        const extra = document.getElementById("extraDownloads");
        extra.innerHTML = "";

        photos.forEach((photo, index) => {
            const div = document.createElement("div");
            div.className = "extra-download-item";

            const label = document.createElement("span");
            label.textContent = `Foto ${index + 1}`;

            const link = document.createElement("a");
            link.href = "#";
            link.innerHTML = '<i class="fas fa-download"></i> Download';

            link.addEventListener("click", async e => {
                e.preventDefault();
                await downloadFile(photo, "image", link);
            });

            div.append(label, link);
            extra.appendChild(div);
        });

        document.getElementById("saveBtn").innerHTML =
            '<i class="fas fa-download"></i> Download Foto Pertama';

        result.style.display = "block";
        scrollResult();
        return;
    }

    // VIDEO
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

    const first = media[0];

    currentMedia = {
        platform: "instagram",
        type: first.type,
        url: first.url,
        title: data.title || "Instagram Media",
        media: media
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

    const author = data.author || {};

    setAuthor(
        author.fullname || author.username || "Instagram User",
        "@" + (author.username || "unknown"),
        first.thumbnail || "",
        author.verified
    );

    document.getElementById("caption").textContent =
        data.title || "Tidak ada caption.";

    document.getElementById("views").textContent = "-";

    document.getElementById("likes").textContent =
        formatNumber(data.stats?.likes);

    document.getElementById("comments").textContent =
        formatNumber(data.stats?.comments);

    document.getElementById("qualityTitle").textContent =
        media.length > 1
            ? `${media.length} Media Tersedia`
            : "Instagram Original";

    document.getElementById("qualityDescription").textContent =
        `${first.type.toUpperCase()} • ${data.duration || "Original Quality"}`;

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
        link.innerHTML = '<i class="fas fa-download"></i> Download';

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

    avatarElement.src = avatar || "";

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

        setTimeout(() => {
            URL.revokeObjectURL(blobUrl);
        }, 10000);

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

// ENTER KEY
input.addEventListener("keydown", e => {
    if (e.key === "Enter") {
        downloadMedia();
    }
});
