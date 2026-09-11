/* ============================================================
   Bator Games hub — presence counter + live room directory
   Rides the global "hub" presence room (p2p.js). No accounts,
   no server: whoever opens the hub first hosts the directory.
   ============================================================ */

const GAME_META = {
    bate:   { icon: "🃏", name: "BateCards",        url: "https://batecards.batorgames.site" },
    dice:   { icon: "🎲", name: "DiceDare",          url: "https://dicedare.batorgames.site" },
    flesh:  { icon: "🔥", name: "Fleshlight Battle", url: "https://fleshlightbattle.batorgames.site" },
    wheel:  { icon: "🎡", name: "Dare Wheel",        url: "https://darewheel.batorgames.site" },
    lounge: { icon: "🛋️", name: "Gooner Lounge",     url: "https://lounge.batorgames.site" }
};

let hub = null;

function renderOnlineNames(roster) {
    const wrap = document.getElementById("onlineNames");
    wrap.innerHTML = "";
    roster.forEach((p) => {
        const chip = document.createElement("span");
        chip.className = "online-chip";
        chip.textContent = p.name;
        wrap.appendChild(chip);
    });
}

function hubName() {
    return (localStorage.getItem("batorHubName") || "").trim() ||
        "Gooner " + Math.floor(Math.random() * 900 + 100);
}

async function connectToHub() {
    try {
        hub = new P2PRoom({ prefix: "hub", requireMedia: false });
        hub.onHubRoster = (roster) => {
            document.getElementById("onlineCount").textContent = roster.length;
            renderOnlineNames(roster);
        };
        hub.onDirectory = renderRooms;
        hub.onError = (err) => console.warn("[hub]", err.message);
        await hub.connectHub(hubName());
    } catch (err) {
        console.warn("[hub] presence unavailable:", err.message);
        document.getElementById("onlineCount").textContent = "?";
        document.getElementById("liveEmpty").textContent = "Presence is warming up — reload in a moment.";
    }
}

function renderRooms(rooms) {
    const wrap = document.getElementById("liveRooms");
    const visible = (rooms || []).filter((r) => GAME_META[r.prefix] && (r.players || 0) > 0);

    wrap.querySelectorAll(".live-room").forEach((el) => el.remove());

    if (!visible.length) {
        document.getElementById("liveEmpty").style.display = "";
        const count = document.getElementById("onlineCount").textContent;
        document.getElementById("liveEmpty").textContent =
            count === "—"
                ? "Connecting to the hub… (can take up to a minute on busy days)"
                : "No open rooms right now — start any game with no password and it appears here.";
        return;
    }

    document.getElementById("liveEmpty").style.display = "none";

    visible.forEach((room) => {
        const meta = GAME_META[room.prefix];
        const card = document.createElement("a");
        card.className = "live-room";
        card.href = `${meta.url}#join=${room.code}`;
        const count = room.maxPlayers
            ? `${room.players}/${room.maxPlayers} bros`
            : `${room.players} bro${room.players === 1 ? "" : "s"}`;
        card.innerHTML = `
            <span class="live-room-icon">${meta.icon}</span>
            <span class="live-room-body">
                <span class="live-room-name">${escapeHtml(room.title || meta.name)}</span>
                <span class="live-room-count">👥 ${count}${room.locked ? " · 🔒" : ""}</span>
            </span>
            <span class="live-room-join">${room.locked ? "Join 🔑" : "Join →"}</span>
        `;
        wrap.appendChild(card);
    });
}

function escapeHtml(str) {
    const el = document.createElement("span");
    el.textContent = str;
    return el.innerHTML;
}

document.addEventListener("DOMContentLoaded", () => {
    // Nickname (remembered on this device, shown in the online list)
    const saved = localStorage.getItem("batorHubName") || "";
    const input = document.getElementById("hubNameInput");
    if (saved) input.value = saved;

    document.getElementById("hubNameSave").addEventListener("click", () => {
        localStorage.setItem("batorHubName", input.value.trim());
        // reconnect so the new name shows up for everyone
        if (hub) {
            try { hub.destroy(); } catch (_) {}
            hub = null;
        }
        connectToHub();
    });

    connectToHub();
});
