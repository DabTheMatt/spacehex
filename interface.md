# SPACE HEX — UI + Typography

Źródło prawdy dla interfejsu Prototype v0.1. Szczegóły implementacyjne: **MAP FIRST. UI SECOND.**

Interfejs zajmuje ok. 10% uwagi. 90% należy do mapy.

Pełna specyfikacja (paleta, typografia, layout, zakazy) jest w tym pliku i ma być stosowana zamiast ad hoc stylów w komponentach.

## Tokeny

```css
--color-background: #0B0C0C;
--color-primary: #D8D0BD;
--color-muted: #77756E;
--color-accent: #B58A4B;
--font-ui: "IBM Plex Mono", monospace;
--font-display: "Cormorant Garamond", serif;
```

Accent jest jedynym kolorem aktywnym UI. Nie neon, glow, gradient, glass, hologram, HUD sci-fi.

## Typografia

- UI, liczby, akcje: **IBM Plex Mono** (Regular / Medium / SemiBold), `font-variant-numeric: tabular-nums`
- Nazwy wyjątkowych miejsc (oszczędnie): **Cormorant Garamond**
- Skala: 11 / 13 / 14 / 18 / 26 px
- Nagłówki: uppercase, tracking 0.08–0.16em

## Layout

Mapa = prawie cały viewport. Brak dashboardu i dużych kart.

- Góra: lekki TopStatus (tekst, bez tła)
- Lewy dół: ContextPanel (zaznaczony obiekt)
- Prawy dół: ActionList (`01  MOVE`)
- Eksploracja: ExplorationControls tylko w fazie układania kafla

Przyciski = `numer + tekst`, hover: accent lub kreska, selected: accent. Bez dużych rectangle buttonów.

## Zaznaczenie hexa

Cienki ochrowy kontur / znaczniki narożników. Nie wypełniać kafla, nie zmieniać geometrii heksów.

## Statek na mapie

Prosty ochrowy znacznik nawigacyjny. Numer gracza **czarny**, leży na górnej płaszczyźnie kadłuba.

## Animacje

120 / 180 / 220 ms, mechaniczne. `prefers-reduced-motion: reduce`. Obrót kafla wyłącznie skokami 60°.
