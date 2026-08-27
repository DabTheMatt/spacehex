# SPACE HEX

Przeglądarkowy prototyp 3D strategicznej gry planszowej. Specyfikacja: [`project.md`](./project.md). UI: [`interface.md`](./interface.md).

## Prototype v0.1.12

Wireframe: Vue 3 + TypeScript + Vite + Pinia + Three.js. Statyczny build pod GitHub Pages.

```bash
npm install
npm test
npm run dev
```

Dev serwer: **http://localhost:5188/** (port 5188, żeby nie zderzać się z inną grą na :5173).

Build:

```bash
npm run build
```

Live prototype: **https://dabthematt.github.io/spacehex/**

The workflow `.github/workflows/pages.yml` builds and deploys on every push to `main`. If the site 404s, enable Pages once: **Settings → Pages → Source: GitHub Actions**.

## Sterowanie

- Kamera: LPM przeciągnij mapę (punkt pod kursorem jedzie z myszą) · WASD · scroll zoom · PPM orbit
- Dev panel: `` ` ``
- Explore: **EXPLORE** → click an edge marker
- Rotate tile: **Q** / **E**, then **click the hex** to place
- New game: **NEW GAME**
