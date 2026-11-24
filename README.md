# Market projects

The portfolio homepage features the full screen recording of the Kalshi Tick Viewer. **Try the historical replay** opens a local, read-only version of the four-chart layout.

## Open locally

Open `docs/index.html` in a browser. Both pages work offline. The local preview uses Python with aiohttp (install it with `python -m pip install aiohttp` if needed). From the repository root run:

```powershell
python preview.py
```

Visit http://127.0.0.1:8847/. The static site is also suitable for a GitHub Pages branch with `/docs` as its source folder.

## Recording

`docs/media/live-viewer.mp4` is a full-length 1080p web encode of the original `kalshi_ui_demo.mp4`. The latter stays local and is ignored by Git. The poster comes from the same recording.

## Historical replay

The sample contains all 4,894 public trades in `KXBTC15M-26APR021215-15` from April 2, 2026, 16:00–16:15 UTC. It totals 195,986.91 contracts. Play, pause, restart, change speed, or scrub the timeline. The replay opens six minutes into the session at 12×. With reduced motion enabled it starts paused.

- **Tick charts.** The two charts open at 100 and 500 trades per candle. Each supports 10, 50, 100, 200, and 500. Both taker sides use YES prices. Histogram bars sum contract quantities, including the open candle. Tick times follow the live viewer’s monotonically increasing chart timestamp convention for bars opening in the same exchange second. Hover for candle OHLC and volume.
- **Bitcoin · BRTI.** The chart uses the local BRTI archive. The bundle contains one-minute OHLC before the session and one-second observations from open to close. The trailing 24-hour view includes the current minute only through the replay clock. Select 1-, 5-, 15-, 30-, or 60-minute candles. The archive entry for this market did not supply a strike.
- **YES minus NO closes.** Each of the last 24 known binary settlements contributes +1 or −1 from a baseline of zero. Results become visible only after both close and recorded determination. The market immediately preceding this one becomes eligible 13.429 seconds into the replay. The replay market's own determination occurred after replay end.
- **Ladder.** Bid and ask sizes are simulated. Every quoted level has 1,000 contracts on its side of the book. A YES taker sets the best ask and a NO taker sets the best bid on the simulated grid. The other side sits one valid tick away. The outermost level can produce a one-sided book. The grid uses 0.1¢ increments in the wings and 1¢ from 10¢ to 90¢. Other observed prices appear as volume-only rows. The volume column always uses recorded quantities at the exact YES price. The **A** control toggles auto-centering. Order columns are empty in this view-only replay.

Trade and settlement source: `KXBTC15M-PUBLIC-TRADE-HISTORY`, snapshot `legacy_pilot_20260101_20260214`. The trade bundle uses elapsed milliseconds, YES price in hundredths of a cent, size in hundredths of a contract, and taker side. Ties retain source ordering. Bitcoin source: `KALSHI-BRTI-1S-CANONICAL`. Each page uses local assets; no account connection is required.

Charts use TradingView Lightweight Charts™ 5.0.7. The distribution and Apache 2.0 license are under `docs/kalshi-viewer/vendor/`.