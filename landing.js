/* Public clubhouse presence and directory. Room membership comes from host beacons. */
const GAME_META = {
    bate: { name: 'BateCards', url: 'https://batecards.batorgames.site' },
    dice: { name: 'DiceDare', url: 'https://dicedare.batorgames.site' },
    flesh: { name: 'Fleshlight Battle', url: 'https://fleshlightbattle.batorgames.site' },
    wheel: { name: 'Dare Wheel', url: 'https://darewheel.batorgames.site' },
    lounge: { name: 'Gooner Lounge', url: 'https://lounge.batorgames.site' }
};
let hub = null, hubRoster = [], publicRooms = [], connected = false;
const $ = id => document.getElementById(id);
const roomUrl = room => `${GAME_META[room.prefix].url}#join=${encodeURIComponent(room.code)}`;
const roomFull = room => room.maxPlayers && room.players >= room.maxPlayers;
function textEl(tag, className, text) {
    const el = document.createElement(tag); el.className = className; el.textContent = text; return el;
}
function publicPeople(roster, rooms) {
    const people = new Map();
    const hostHubIds = new Set(rooms.map(r => r.hubPeerId).filter(Boolean));
    roster.forEach(p => { if (!hostHubIds.has(p.id)) people.set(p.id, { ...p }); });
    rooms.forEach(room => {
        const members = Array.isArray(room.members) ? room.members : [];
        members.forEach(p => { if (p && typeof p.id === 'string' && typeof p.name === 'string') people.set(p.id, { id:p.id, name:p.name, room }); });
    });
    return [...people.values()];
}
function renderPeople() {
    const people = publicPeople(hubRoster, publicRooms);
    $('onlineCount').textContent = connected ? people.length : '—';
    $('onlineNames').replaceChildren();
    if (!people.length) $('onlineNames').append(textEl('p', 'muted', connected ? 'The clubhouse is quiet. Make yourself at home.' : 'Checking who’s around…'));
    people.forEach(p => {
        const row = textEl('div', 'online-person', '');
        row.append(textEl('span', 'avatar', p.name.trim().slice(0, 2).toUpperCase() || '?'));
        const info = textEl('div', 'person-info', '');
        info.append(textEl('span', 'person-name', p.name));
        info.append(textEl('span', 'person-location', p.room ? GAME_META[p.room.prefix].name : 'In the clubhouse'));
        row.append(info);
        if (p.room && !roomFull(p.room)) {
            const link = textEl('a', 'person-join', 'Join ↗'); link.href = roomUrl(p.room);
            link.setAttribute('aria-label', `Join ${p.name} in ${GAME_META[p.room.prefix].name}`); row.append(link);
        }
        $('onlineNames').append(row);
    });
}
function renderRooms(rooms) {
    publicRooms = (rooms || []).filter(r => GAME_META[r.prefix] && /^[a-z0-9]{6}$/i.test(r.code) && r.players > 0 && !r.locked);
    $('roomCount').textContent = publicRooms.length ? `(${publicRooms.length})` : '';
    $('liveRooms').querySelectorAll('.live-room').forEach(el => el.remove());
    $('liveEmpty').hidden = publicRooms.length > 0;
    if (!publicRooms.length) {
        $('emptyTitle').textContent = connected ? 'First one in? Set the mood.' : 'Finding your people…';
        $('emptyMessage').textContent = connected ? 'No public rooms yet. Open a game and host a room with no password. Your crew can join you here.' : 'The room directory is connecting. You can open a game while we look.';
    }
    publicRooms.forEach(room => {
        const meta = GAME_META[room.prefix], full = roomFull(room);
        const card = textEl(full ? 'div' : 'a', 'live-room' + (full ? ' full' : ''), '');
        if (!full) { card.href = roomUrl(room); card.setAttribute('aria-label', `Join ${room.hostName || meta.name}’s room`); }
        const icon = document.createElement('img'); icon.className = 'live-room-icon'; icon.src = `assets/${room.prefix}.svg`; icon.alt = '';
        const body = textEl('span', 'live-room-body', '');
        body.append(textEl('span', 'live-room-name', room.title || meta.name));
        body.append(textEl('span', 'live-room-count', `${room.hostName ? `Hosted by ${room.hostName} · ` : ''}${room.players}${room.maxPlayers ? '/' + room.maxPlayers : ''} online`));
        const names = (Array.isArray(room.members) ? room.members : []).filter(p => p && typeof p.name === 'string').map(p => p.name);
        if (names.length) body.append(textEl('span', 'live-room-members', names.join(' · ')));
        card.append(icon, body, textEl('span', 'live-room-join', full ? 'Room full' : 'Join room ↗'));
        $('liveRooms').append(card);
    });
    renderPeople();
}
function setConnection(status) {
    connected = status === 'connected';
    $('hubStatus').textContent = connected ? '● Clubhouse live' : '↻ Reconnecting…';
    $('hubStatus').classList.toggle('connected', connected);
    if (!connected) { hubRoster = []; renderRooms([]); }
}
function hubName() {
    let name = (localStorage.getItem('batorHubName') || '').trim();
    if (!name) { name = 'Guest ' + Math.floor(Math.random() * 900 + 100); localStorage.setItem('batorHubName', name); }
    return name;
}
async function connectToHub() {
    const connection = new P2PRoom({ prefix:'hub', requireMedia:false }); hub = connection;
    connection.onHubRoster = roster => { if (hub !== connection) return; setConnection('connected'); hubRoster = roster; renderPeople(); };
    connection.onDirectory = rooms => { if (hub === connection) renderRooms(rooms); };
    connection.onHubStatus = status => { if (hub === connection) setConnection(status); };
    connection.onError = err => { if (hub !== connection) return; console.warn('[hub]',err.message); setConnection('reconnecting'); };
    try { await connection.connectHub(hubName()); }
    catch (err) { if (hub !== connection) return; connection.onError(err); connection._scheduleHubReconnect(hubName()); }
}
document.addEventListener('DOMContentLoaded', () => {
    $('hubNameInput').value = hubName();
    $('hubNameForm').addEventListener('submit', event => {
        event.preventDefault(); const name = $('hubNameInput').value.trim();
        if (!name) { $('nameStatus').textContent = 'Enter a nickname first.'; $('hubNameInput').focus(); return; }
        localStorage.setItem('batorHubName', name); $('nameStatus').textContent = 'Saved. Updating your clubhouse name…';
        const previous = hub; hub = null; if (previous) previous.destroy(); setConnection('reconnecting'); connectToHub();
    });
    connectToHub();
});
