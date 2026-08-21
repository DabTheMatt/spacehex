# SPACE HEX

Przeglądarkowy prototyp 3D strategicznej gry planszowej. Specyfikacja: [`project.md`](./project.md).

## Prototype v0.1

Wireframe: Vue 3 + TypeScript + Vite + Pinia + Three.js. Statyczny build pod GitHub Pages.

```bash
npm install
npm test
npm run dev
```

Dev serwer: **http://localhost:5173/** (bez `/spacehex/` — ta ścieżka jest tylko w production build pod GitHub Pages).

Build:

```bash
npm run build
```

Po włączeniu GitHub Pages (Actions → workflow *Deploy GitHub Pages*) aplikacja będzie pod:

`https://dabthematt.github.io/spacehex/`

## Sterowanie

- Kamera: LPM orbit, scroll zoom, PPM pan
- Eksploracja: **EKSPLORACJA** → klik znacznika przy krawędzi
- Obrót kafla: **Q** / **E** (lub **R**), **Enter** zatwierdza
