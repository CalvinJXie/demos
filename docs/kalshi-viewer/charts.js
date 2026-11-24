"use strict";

const lib = LightweightCharts;
const quantity = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const dollars = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
const up = "#28c985";
const down = "#f15b64";
const candleStyle = { upColor: up, downColor: down, borderVisible: false, wickUpColor: up, wickDownColor: down };

function createPlot(element) {
    const chart = lib.createChart(element, {
        autoSize: true,
        layout: { background: { type: "solid", color: "#111720" }, textColor: "#8b98aa", fontFamily: "Inter, Segoe UI, sans-serif", fontSize: 10 },
        grid: { vertLines: { color: "#1e2734" }, horzLines: { color: "#1e2734" } },
        rightPriceScale: { borderColor: "#293243", minimumWidth: 76, scaleMargins: { top: 0.12, bottom: 0.12 } },
        timeScale: { timeVisible: true, secondsVisible: true, rightOffset: 2, borderColor: "#293243" },
        crosshair: { mode: 0, vertLine: { color: "#6f819b80", style: 2 }, horzLine: { color: "#6f819b60", style: 2 } },
        handleScroll: { vertTouchDrag: false }
    });
    return chart;
}

function tickBars(count, size) {
    const bars = [];
    const volumes = [];
    let volume = 0;
    for (let i = 0; i < count; i++) {
        const [offset, priceUnits, qtyUnits] = SESSION.trades[i];
        const price = priceUnits / 100;
        if (i % size === 0) {
            const second = Math.floor((SESSION.openMs + offset) / 1000);
            const time = Math.max(second, bars.length ? bars[bars.length - 1].time + 1 : second);
            bars.push({ time, open: price, high: price, low: price, close: price });
            volumes.push({ time, value: 0, color: up });
            volume = 0;
        }
        const bar = bars[bars.length - 1];
        bar.high = Math.max(bar.high, price);
        bar.low = Math.min(bar.low, price);
        bar.close = price;
        volume += qtyUnits;
        const hist = volumes[volumes.length - 1];
        hist.value = volume / 100;
        hist.color = price >= bar.open ? up : down;
    }
    return { bars, volumes };
}

function tickPanel(index, initialSize) {
    const panel = document.getElementById("tick-template").content.firstElementChild.cloneNode(true);
    document.getElementById("btc-card").before(panel);
    const el = panel.querySelector(".tick-chart");
    const chart = createPlot(el);
    const select = panel.querySelector("select");
    const header = panel.querySelector(".chart-clock");
    select.value = String(initialSize);
    select.setAttribute("aria-label", "Chart " + index + " ticks per candle");
    const price = chart.addSeries(lib.CandlestickSeries, {
        ...candleStyle, priceLineVisible: false, priceFormat: { type: "custom", minMove: 0.01, formatter: p => quantity.format(p) + "¢" }
    });
    const hist = chart.addSeries(lib.HistogramSeries, {
        priceScaleId: "contract-volume", priceFormat: { type: "volume" }, lastValueVisible: false, priceLineVisible: false
    }, 1);
    hist.priceScale().applyOptions({ autoScale: true, scaleMargins: { top: 0.06, bottom: 0 } });
    hist.getPane().setHeight(Math.round(el.clientHeight * 0.18));
    function resetPrice() {
        price.priceScale().applyOptions({ autoScale: false, scaleMargins: { top: 0, bottom: 0 } });
        price.priceScale().setVisibleRange({ from: 0, to: 100 });
    }
    resetPrice();
    el.addEventListener("dblclick", e => {
        if (e.clientX - el.getBoundingClientRect().left >= el.clientWidth - price.priceScale().width()) resetPrice();
    });
    let lastCount = -1, size = 0, marketTime = "", hoverText = "";
    chart.subscribeCrosshairMove(event => {
        const value = event.seriesData.get(price);
        const volume = event.seriesData.get(hist);
        hoverText = value && volume ? "O " + quantity.format(value.open) + " · H " + quantity.format(value.high) +
            " · L " + quantity.format(value.low) + " · C " + quantity.format(value.close) + "¢ · Vol " + quantity.format(volume.value) : "";
        header.textContent = hoverText || marketTime;
    });
    function render(count, remaining, refit = false) {
        marketTime = remaining;
        header.textContent = hoverText || marketTime;
        const nextSize = Number(select.value);
        if (count === lastCount && size === nextSize && !refit) return;
        const reset = refit || size !== nextSize || lastCount < 1 || count < lastCount;
        const values = tickBars(count, nextSize);
        if (reset) {
            price.setData(values.bars);
            hist.setData(values.volumes);
            if (count) chart.timeScale().fitContent();
        } else {
            for (let i = Math.floor(lastCount / nextSize); i < values.bars.length; i++) {
                price.update(values.bars[i]);
                hist.update(values.volumes[i]);
            }
        }
        lastCount = count;
        size = nextSize;
    }
    select.addEventListener("change", () => render(Math.max(0, lastCount), marketTime, true));
    return { render };
}

// The archive contributes completed minutes preceding market open. Within the
// session only seconds up to the current replay clock can change an OHLC bar.
function bitcoinBarsAt(now, interval) {
    const oldest = Math.floor(now / 60) * 60 - 86400 + 60;
    const width = interval * 60;
    const result = new Map();
    function merge(t, o, h, l, c) {
        if (t < oldest || t > now) return;
        const time = Math.floor(t / width) * width;
        const bar = result.get(time);
        if (!bar) result.set(time, { time, open: o/100, high: h/100, low: l/100, close: c/100 });
        else {
            bar.high = Math.max(bar.high, h/100);
            bar.low = Math.min(bar.low, l/100);
            bar.close = c/100;
        }
    }
    for (const row of REFERENCE.minutes) merge(...row);
    for (const [t, p] of REFERENCE.seconds) {
        if (t > now) break;
        merge(t, p, p, p, p);
    }
    const bars = [];
    for (let time = Math.floor(oldest/width)*width; time <= now; time += width) {
        bars.push(result.get(time) || { time });
    }
    return bars;
}

function referencePanels() {
    const chart = createPlot(document.getElementById("bitcoin"));
    const btc = chart.addSeries(lib.CandlestickSeries, {
        ...candleStyle, priceFormat: { type: "custom", minMove: 0.01, formatter: v => dollars.format(v) }
    });
    const interval = document.getElementById("interval");
    const history = createPlot(document.getElementById("settlements"));
    const net = history.addSeries(lib.LineSeries, {
        color: "#80bbff", lineType: lib.LineType.WithSteps, lineWidth: 2,
        priceFormat: { type: "price", precision: 0, minMove: 1 }
    });
    let previousSecond = null, previousWidth = null, previousLast = null;
    function render(ms, refit = false) {
        const now = Math.floor(ms/1000);
        const width = Number(interval.value);
        if (refit || now !== previousSecond || width !== previousWidth) {
            const bars = bitcoinBarsAt(now, width);
            if (refit || width !== previousWidth || previousSecond === null || now < previousSecond ||
                    Math.floor(now/60) !== Math.floor(previousSecond/60)) {
                btc.setData(bars);
                if (refit || width !== previousWidth || previousSecond === null) chart.timeScale().fitContent();
            } else {
                btc.update(bars[bars.length - 1]);
            }
            previousWidth = width;
            previousSecond = now;
        }
        const known = REFERENCE.settlements.filter(row => row[1] <= ms).slice(-24);
        const last = known.length ? known[known.length - 1][0] : null;
        if (last === previousLast && !refit) return;
        let value = 0, yes = 0;
        const points = [];
        if (known.length) points.push({ time: known[0][0]/1000 - 1, value: 0 });
        for (const [closed, , sign] of known) {
            value += sign;
            if (sign === 1) yes++;
            points.push({ time: closed/1000, value });
        }
        net.setData(points);
        history.timeScale().fitContent();
        document.getElementById("settlement-counts").textContent = "Last " + known.length + " · " + yes + " YES / " + (known.length - yes) + " NO";
        previousLast = last;
    }
    return { render };
}