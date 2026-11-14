# Mangayomi for Samsung TV

A Tizen web app (`.wgt`) of the anime side of [Mangayomi](https://github.com/kodjodevf/mangayomi). It follows the same screen names and order, and it runs the same JavaScript extensions (`DefaultExtension extends MProvider`).

Version 0.3.2 Built for a 2024 Samsung TV: Tizen 9, Chromium 120, 1920×1080, remote only.

The app opens on **Library**. **Browse** is Sources, Extensions, then Migrate. Choosing a source opens **Popular**, with **Latest**, **Search**, and **Filter** on that same screen.

## Run on a computer

From this folder:

```bash
python3 -m http.server 43123 --bind 127.0.0.1
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

Arrow keys move, Enter selects, Escape is Back. A packaged TV app is allowed to call other sites. A normal browser is not, so listings stay empty unless the browser is started with web security disabled. That flag is only for a local check. It is not part of the TV package, and it is not a bypass of Cloudflare, age checks, or paywalls.

## Install on the TV

The folder is a Tizen web project: `config.xml` is the TV profile (`tv-samsung`), `index.html` is the start file, and `unsafe-eval` is allowed because extensions are loaded with `new Function`.

```bash
tizen package -t wgt -- .
```

Sign the widget with your Samsung certificate and install it with `tizen install` or the device manager. Privileges: internet, unlimited storage, and Samsung AVPlay. HTML video plus the vendored hls.js player is the default. AVPlay is used for MP4 only when Player settings turn it on and `webapis.avplay` exists. HLS stays on hls.js so the top variant can be locked.

If a public certificate rejects the AVPlay privilege, remove that one line from `config.xml`. Playback still uses the video element and hls.js.

## Remote

| Key | Action |
| --- | --- |
| Arrows | Move. In a poster grid this moves by row and column. |
| Enter | Open, pause, or confirm. |
| Back / Escape | Close the keyboard, filters, or dialog, then leave the screen. |
| Left / Right in the player | Seek 10 seconds. |
| Up in the player | Quality list. The current item starts selected. |
| Down in the player | Next episode. |

Search and typed settings use an on-screen keyboard. Letter keys from a USB keyboard also type while it is open.

## What is saved

Extension source is stored in `localStorage` and IndexedDB. Library, history, updates, watch progress, and source settings are stored on the TV. Nothing is sent to a server of this app.

New episodes show under **Updates** after **Check for updates**. The first time a title is saved, the episodes already on the site are remembered, so they are not all listed as new.

## Playback

The player starts on the highest concrete quality. A label of Auto, or an adaptive master, is not chosen when any other stream exists. If an HLS file and a file of the same height are both offered, the HLS variant is used. For a master playlist, hls.js loads nothing until the highest level is selected (`currentLevel` set, auto level off).

## Grids on this TV

Poster and episode lists are a fixed cell size. Only the rows on screen, plus one row of overscan, are in the document. Those cells move with `translate3d`. Focus changes a class on the cell. Covers use `decoding="async"`, are drawn at 168×246 (episode thumbs 96×54), and are dropped when the cell is recycled. GIF, MP4, WebM, and other preview videos are not used in the grid. Cards do not use shadows, blur, or filters.

## Extensions

The default repository is:

`https://raw.githubusercontent.com/adam72881/mangayomi-anime-extensions/main/anime_index.json`

Change it under **More → Browse**.

Checked from this environment on 14 November 2026, against that index, in headless Chromium 1920×1080. AnimeWorld was exercised through the screens with the keyboard. The other extensions were installed through the same loader and called for popular, detail, and, where a title came back, a video list. Adult pictures and adult video files were not saved.

| Extension | Result | Why |
| --- | --- | --- |
| AnimeWorld 1.5.0 | Works | Popular (40), Latest, search, filters, detail (One Piece, 1180 episodes), and an MP4 that played at 1280×720. |
| HentaiWorld 2.8.0 | Works | Popular (20), detail, and one MP4 stream named HentaiWorld. The file was not opened. |
| PMVHaven 1.6.2 | Works | Popular (32). One title offered 360p, 480p, 720p, 1080p, Auto, and an original MP4. The player rank selects **1080p**, not Auto. |
| Stripchat 1.3.20 | Works for live lists | Popular (36) and a video list whose highest entry was the room’s 480p HLS, above 240p. The live stream was not opened. |
| Link universale 1.4.22 | Partial | Popular returned 30 titles for the extension’s default site. Playback depends on that site and was not opened. |
| HypnoTube 1.4.2 | Does not list | Popular came back empty. The extension needs a session cookie the TV cannot store or send. No age wall was bypassed. |
| Chaturbate 1.3.5 | Does not list | The extension reports a browser check. The app shows that and stops. |
| BongaCams 1.0.0 | Does not list | The site answers with Cloudflare. The app shows that and stops. |

## What this TV cannot do

There is no WebView. `Cookie`, `Referer`, and `User-Agent` are removed from extension requests because Chromium refuses them. If a site then shows a browser check, an age wall, a paywall, or a login cookie, the screen says so. This app does not bypass those checks, and it does not proxy or rewrite them.
