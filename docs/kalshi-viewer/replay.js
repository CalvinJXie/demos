"use strict";

const byId = id => document.getElementById(id);
const { trades, openMs, durationMs } = SESSION;
const charts = [tickPanel(1, 100), tickPanel(2, 500)];
const reference = referencePanels();
const grid = [];
for (let p = 10; p <= 9990; p += p < 1000 || p >= 9000 ? 10 : 100) grid.push(p);

function timeText(ms) {
    const sec = Math.floor(ms / 1000);
    return String(Math.floor(sec / 60)).padStart(2, "0") + ":" + String(sec % 60).padStart(2, "0");
}
function through(offset) {
    let low = 0, high = trades.length;
    while (low < high) {
        const mid = (low + high) >>> 1;
        if (trades[mid][0] <= offset) low = mid + 1;
        else high = mid;
    }
    return low;
}

function simulatedQuotes(price, yesTaker) {
    // A YES aggressor lifts the ask; a NO aggressor hits the YES bid.
    // Preserve a one-sided book at the first or last permitted price.
    const askIndex = grid.findIndex(p => yesTaker ? p >= price : p > price);
    return {
        bid: askIndex < 0 ? grid[grid.length - 1] : grid[askIndex - 1],
        ask: askIndex < 0 ? undefined : grid[askIndex]
    };
}

const ladder = byId("ladder");
const levels = new Map();
const orderable = new Set(grid);
function createLevel(p) {
    const row = document.createElement("div");
    row.className = "paper-ladder-row";
    row.dataset.price = p;
    function cell(className) {
        const span = document.createElement("span");
        span.className = className;
        row.append(span);
        return span;
    }
    cell("paper-own-cell");
    const bid = cell("paper-book-cell paper-bid-cell");
    cell("paper-price-cell").textContent = quantity.format(p / 100) + "¢";
    const ask = cell("paper-book-cell paper-ask-cell");
    cell("paper-own-cell");
    const volume = cell("ladder-volume");
    const level = { row, bid, ask, volume };
    levels.set(p, level);
    return row;
}

let centered = true;
let lastCenter = null;
function centerOn(price) {
    const row = levels.get(price)?.row;
    if (!row) return;
    const bounds = ladder.getBoundingClientRect();
    ladder.scrollTop += row.getBoundingClientRect().top - bounds.top - (ladder.clientHeight - row.offsetHeight)/2;
    lastCenter = price;
}

function paintBook(count, volumes) {
    const last = trades[count - 1];
    if (!count) {
        ladder.replaceChildren();
        levels.clear();
        lastCenter = null;
        const label = document.createElement("div");
        label.className = "book-empty";
        label.textContent = "Waiting for the first trade";
        ladder.append(label);
        return;
    }
    const price = last[1];
    const { bid, ask } = simulatedQuotes(price, last[3]);
    // Only add off-grid volume rows once the corresponding print has occurred.
    const prices = [...new Set([...grid, ...volumes.keys()])].sort((a, b) => b-a);
    if (prices.length !== levels.size || prices.some(p => !levels.has(p))) {
        levels.clear();
        ladder.replaceChildren(...prices.map(createLevel));
        lastCenter = null;
    }
    const max = Math.max(1, ...volumes.values());
    for (const [p, level] of levels) {
        const quote = orderable.has(p);
        const bidText = quote && p <= bid ? "1,000" : "";
        const askText = quote && p >= ask ? "1,000" : "";
        if (level.bid.textContent !== bidText) level.bid.textContent = bidText;
        if (level.ask.textContent !== askText) level.ask.textContent = askText;
        level.row.classList.toggle("best-bid", p === bid);
        level.row.classList.toggle("best-ask", p === ask);
        level.row.classList.toggle("last-print", p === price);
        const traded = volumes.get(p) || 0;
        const volume = traded ? quantity.format(traded / 100) : "";
        if (level.volume.textContent !== volume) level.volume.textContent = volume;
        if (traded || level.volume.style.length) level.volume.style.setProperty("--fill", (100 * traded / max) + "%");
    }
    if (centered && lastCenter !== price) centerOn(price);
}

function paintTape(count) {
    const body = byId("tape");
    body.replaceChildren();
    for (const [ms, price, units, yes] of trades.slice(Math.max(0, count - 7), count).reverse()) {
        const row = body.insertRow();
        row.insertCell().textContent = clock.format(openMs + ms);
        const side = row.insertCell();
        side.className = yes ? "yes" : "no";
        side.textContent = yes ? "YES" : "NO";
        row.insertCell().textContent = quantity.format(price / 100) + "¢";
        row.insertCell().textContent = quantity.format(units / 100);
    }
}

let position = Math.min(360000, durationMs);
let playing = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let speed = Number(byId("speed").value);
let anchor = performance.now();
let previousCount = -1;
const volumeByPrice = new Map();
let total = 0;

function render(refit = false) {
    const count = through(position);
    const remaining = timeText(Math.ceil((durationMs - position)/1000)*1000) + " remaining";
    byId("remaining").textContent = remaining;
    byId("elapsed").textContent = timeText(position);
    byId("market-utc").textContent = clock.format(openMs + position);
    byId("seek").value = position / 1000;
    byId("seek").setAttribute("aria-valuetext", timeText(position) + " elapsed");
    byId("play").textContent = playing ? "Pause" : position === durationMs ? "Replay" : "Play";
    byId("replay-status").textContent = playing ? "Replaying market" : position === durationMs ? "Market closed" : "Replay paused";
    for (const chart of charts) chart.render(count, remaining, refit);
    reference.render(openMs + position, refit);
    if (count === previousCount && !refit) return;
    if (count < previousCount) {
        volumeByPrice.clear();
        previousCount = 0;
        total = 0;
    }
    for (let i = Math.max(0, previousCount); i < count; i++) {
        const [, price, size] = trades[i];
        total += size;
        volumeByPrice.set(price, (volumeByPrice.get(price) || 0) + size);
    }
    previousCount = count;
    byId("trade-count").textContent = quantity.format(count);
    byId("contracts").textContent = quantity.format(total / 100);
    byId("last-price").textContent = count ? "Last YES trade · " + quantity.format(trades[count - 1][1]/100) + "¢" : "Waiting for first trade";
    paintBook(count, volumeByPrice);
    paintTape(count);
}

function advance() {
    const now = performance.now();
    if (playing) {
        position = Math.min(durationMs, position + (now - anchor) * speed);
        if (position === durationMs) playing = false;
    }
    anchor = now;
}
for (const element of document.querySelectorAll(".ticker")) element.textContent = SESSION.ticker;
byId("seek").max = durationMs / 1000;
byId("play").addEventListener("click", () => {
    advance();
    if (position === durationMs) position = 0;
    playing = !playing;
    render();
});
byId("restart").addEventListener("click", () => {
    position = 0;
    anchor = performance.now();
    render(true);
});
byId("seek").addEventListener("input", event => {
    position = Number(event.target.value) * 1000;
    anchor = performance.now();
    if (position === durationMs) playing = false;
    render(true);
});
byId("speed").addEventListener("change", event => {
    advance();
    speed = Number(event.target.value);
    render();
});
byId("interval").addEventListener("change", () => reference.render(openMs + position, true));
byId("center").addEventListener("click", event => {
    centered = !centered;
    event.currentTarget.classList.toggle("active", centered);
    event.currentTarget.setAttribute("aria-pressed", String(centered));
    if (centered && previousCount > 0) centerOn(trades[previousCount - 1][1]);
});
render(true);
window.setInterval(() => {
    if (playing) { advance(); render(); }
}, 100);