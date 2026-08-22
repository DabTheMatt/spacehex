# SPACE HEX — UI / UX IMPLEMENTATION GUIDELINES

Dokument zastępuje wcześniejsze wytyczne UI. Źródło prawdy dla ekranu Prototype v0.1.

> Interfejs nie powinien być rozrzucony po wszystkich krawędziach ekranu. Głównym centrum sterowania ma być jeden dolny COMMAND BAR.

## 1. Główna zasada

SPACE HEX jest przede wszystkim mapą. Pusta przestrzeń jest celowa.

Hierarchia: MAPA → OBIEKTY → AKTYWNY STATEK / HEX → COMMAND BAR → INFORMACJE GLOBALNE. Orientacyjnie 90% mapa, 10% UI.

Warstwy ekranu: **Global Status** (góra) → **Game Map** → **Command Bar** (dół).

## 2. Charakter

Terminal nawigacyjny / dokumentacja techniczna / stary system kartograficzny / instrument pokładowy. Nie klasyczny HUD sci-fi.

## 3. Zakazy

Brak neonów, cyjanu sci-fi, glow, bloom, gradientów, glassmorphism, dużych paneli i kart, wielu ramek, hologramów, rozbudowanych tooltipów na mapie, dużych ikon, bibliotek ikon, szczegółowych modeli jako markerów.

## 4. Global Status

Tylko dane rozgrywki, np. `SG-1 / CYCLE 02` i `DECK 21`. Bez FUEL / HULL / CARGO.

## 5. Command Bar

Lekki pasek na dole. Zawsze odpowiada: co jest zaznaczone, jaki jest stan, co mogę zrobić. Zmienia treść z kontekstem. Nie osobne okna.

Stan statku (poziomo na szerokim ekranie):

```text
MEWA / SG-1      HULL 03/03      FUEL 04      PCH 00
01 MOVE          02 EXPLORE      03 STAY                    09 END TURN
```

Zaznaczony kafel: ta sama belka pokazuje nazwę i typ. **Nie implementować fikcyjnych akcji** (SCAN, APPROACH, SALVAGE, DOCK) dopóki nie ma ich w silniku.

## 6. Tryby (jawne)

`IDLE` | `OBJECT_SELECTED` | `MOVE_TARGETING` | `EXPLORE_EDGE_SELECTION` | `EXPLORE_ROTATION`

- MOVE: `NAVIGATION / SELECT DESTINATION` · ESC CANCEL. Mapa pokazuje cele.
- EXPLORE: `EXPLORATION / SELECT EDGE` · ESC CANCEL.
- Obrót: `EXPLORATION / ORIENT SECTOR` · Q/E ROTATE · ENTER CONFIRM. Snap wyłącznie co 60°.

END TURN (`09`) jest w Command Bar, po prawej. Nie samotny napis na środku.

## 7. Mapa

Hexy identyczne; grafika dopasowuje się do hexa. UI na mapie: tylko selection, kierunek, zasięg, ghost eksploracji. Bez tabel HULL/FUEL obok statku.

Zaznaczenie hexa: cienki ochrowy obrys / ticki narożników, osobna warstwa, bez fillu.

Marker statku: prosty geometria, kolor gracza, ochra dla aktywnego.

## 8. Typografia i tokeny

IBM Plex Mono dla UI. Cormorant Garamond tylko dla wyjątkowych odkryć, nie dla nazwy statku.

```css
:root {
  --color-background: #0B0C0C;
  --color-primary: #D8D0BD;
  --color-muted: #77756E;
  --color-accent: #B58A4B;
  --font-ui: "IBM Plex Mono", monospace;
  --font-display: "Cormorant Garamond", serif;
  --font-micro: 9px;
  --font-xs: 10px;
  --font-sm: 11px;
  --font-md: 13px;
  --font-lg: 15px;
  --font-display-size: 24px;
  --transition-fast: 120ms;
  --transition-normal: 180ms;
  --transition-slow: 220ms;
  --line-width: 1px;
}
```

Nazwa statku: `MEWA / SG-1`, Medium, ~14px, tracking 0.10em. Uppercase dla akcji i parametrów. Tabular nums. Hover: accent lub kreska, bez glow i scale. Focus: cienki ochrowy outline. Disabled: muted, opacity 0.45.

## 9. Architektura komponentów

`GameHUD` → `GlobalStatus` + `CommandBar`. UI ekranowe niezależne od kamery.

Kryterium: screenshot wygląda jak samotna mapa, potem jak aplikacja.

> ONE MAP. ONE CONTEXT. ONE COMMAND BAR.
