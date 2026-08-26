# SPACE HEX — Prototype v0.1

Interaktywny przestrzenny prototyp przeglądarkowej strategicznej gry planszowej 3D.

Źródło prawdy dla implementacji. Zmiana zasad wymaga zgody (Maciej). Brak parametru → `TODO RULE CLARIFICATION`. Konflikt zasad → `RULE CONFLICT`.

UI i typografia: [`interface.md`](./interface.md) — MAP FIRST, UI SECOND.

---

## Proces developerski

1. Engine ≠ Three.js ≠ Vue. Three.js nigdy nie podejmuje decyzji o zasadach.
2. Plansza zawiera wyłącznie położone kafle. Zero niewidocznego grida, pustej mapy, konturów przyszłych sektorów.
3. RNG tylko seedowany. Zakaz `Math.random()` w logice gry.
4. Orientacja kafla żyje w `placedTile.rotation`, nie wyłącznie w `mesh.rotation.y`.
5. Testy obrotów (6 orientacji) są gate’em przed przesmykami i złożonymi krawędziami.
6. Brakujących liczb nie zgadujemy. Wyjątek: stałe oznaczone `TODO RULE CLARIFICATION` wyłącznie tam, gdzie bez nich prototyp nie jest grywalny (paliwo).
7. Grafika v0.1: bryły, linie, okręgi, symbole, proste kolory, tekst. Bez tekstur, modeli, shaderów dekoracyjnych, particle, AI-art.
8. Deployment: statyczny build, GitHub Pages. Bez backendu.

### Kolejność (etapy 1–16 specyfikacji)

| Faza | Etapy | Gate |
|------|--------|------|
| A Scaffold | 1 | `npm test` + `npm run build` |
| B Hex core | 4 | testy axial / sąsiadów |
| C Rotacje | 12, 14, 15, 37 | 6 rotacji zielone |
| D Scena | 2, 3, 18–20 | EVA-1 + Mewa, orbit/zoom/pan |
| E Eksploracja | 6–13, 16 | stos, preview, Q/E/Enter, położenie, ruch |
| F Tura / paliwo | 14, 31 | RUCH / EKSPLORACJA / POZOSTAŃ, 2 graczy |
| G Zdarzenia / walka | 15–16 | hooki; treść tylko po doprecyzowaniu |
| H Debug | 32–33 | overlay q,r / krawędzie 0–5 |

Etapy 5–6 (sąsiedzi programistycznie) realizowane testami, nie stanem startowym gry.

### Kryterium sukcesu v0.1

Nowa gra → EVA-1 + Mewa → tura → eksploracja → krawędź → losowanie → preview → 6 obrotów → zatwierdzenie → większa plansza → ruch Mewy → koniec tury → powtórka → nieregularna mapa.

---

## Ustalone parametry v0.1

- Geometria heksów: **flat-top**.
- Axial: `{ q, r }`. Klucz pola: `` `${q},${r}` ``.
- Kierunek 0 = wschód (`+q`), dalej co 60° CCW w układzie świata (zgodnie z `rotation.y = rotation * π/3` w Three.js, Y w górę).

### Skład kafli

| Kafel | Ilość | W talii eksploracji |
|-------|-------|---------------------|
| EVA-1 | 1 | Nie — start na `(0,0)` |
| Pustka | 5 | Tak |
| Planeta duża | 3 | Tak |
| Planeta średnia | 4 | Tak |
| Planeta mała | 5 | Tak |
| Asteroidy | 3 | Tak |
| Baza Cieni | 1 | Tak |
| Wrak: dryfujący tankowiec | 1 | Tak |
| Wrak: rozbity transportowiec | 1 | Tak |
| Czarna dziura | 1 | Tak |

Talia eksploracji: **24** kafle. Seedowane tasowanie przy `START_GAME`.

---

## TODO RULE CLARIFICATION

| ID | Temat |
|----|--------|
| T1 | `validateEdgeCompatibility` — na razie zawsze OK; brak wymogu dopasowania krawędzi |
| T3 | Dokładne koszty paliwa poza prowizorycznym `1` na ruch/eksplorację i startem `6` |
| T5 | Pełna walka (inicjacja, PCH vs kadłub, Cierń/Drzazga) |
| T6 | Zasady PCH (zdobywanie / wydawanie) |
| T7 | Efekty sektorów (planeta, asteroidy, baza, wraki, czarna dziura) |
| T8 | Pełna sekwencja faz poza ruchem → ewentualne położenie kafla → koniec tury |
| T11 | Koszt POZOSTAŃ (obecnie 0 paliwa) |
| T12 | Pojawianie się NPC (Cierń, Drzazga) |

---

## Zakazy v0.1

Nie implementować: Pelikan, kolonizacja, SOS, holowanie, multiplayer online, pełna ekonomia, synteza, pełne skanery, rozbudowane AI, finalne modele/tekstury/ilustracje, particle, zaawansowane audio.

Sondy (wyjątek, Maciej): 2 na statek, wystrzał zamiast ruchu na nieodkryty przyległy hex. Sonda ciągnie kafel z talii i kładzie go (statek zostaje). Marker: przezroczysty błękit + sonda + kręgi. Sonda znika, gdy statek wejdzie na hex.

Nie wolno: generować mapy z góry, traktować planszy jako tablicy prostokątnej, proceduralnego infinite grida, automatycznie wybierać orientacji kafla, przenosić zasad do Three.js, uzależniać logiki od animacji.

---

## 1. Cel pierwszej wersji

Grywalny prototyp do weryfikacji: budowa planszy, eksploracja, losowanie i dokładanie kafli, obrót, ruch, paliwo, tury, podstawowe zdarzenia, podstawowa walka, ergonomia UI.

Wireframe 3D, nie demo graficzne.

## 2. Stack

Vue 3, TypeScript, Vite, Pinia, Three.js, Vitest, ESLint, Prettier. GitHub Pages. Aplikacja w 100% statyczna.

## 3. Fundamentalna zasada planszy

Nie istnieje gotowa mapa ani widoczna siatka heksów. Plansza powstaje w czasie gry. Poza odkrytymi kaflami przestrzeń jest pusta.

## 4–5. Model: TILE vs COORD

Wewnętrznie axial. `PlacedTile` ma `id`, `definitionId`, `coord`, `rotation` 0–5, `discoveredByPlayerId`, `discoveredRound`. `BoardState.tiles` tylko dla położonych kafli.

## 6–13. Eksploracja

Fizyczny stos. Gracz nie wybiera dowolnego miejsca — nowy kafel styka się z kafla, z którego startuje eksploracja.

Sekwencja: kafel A → EKSPLORUJ → wolna krawędź → zdjęcie wierzchu stosu → preview (uniesiony, inna przezroczystość, kontur) → obrót Q/E/R → ENTER zatwierdza → kafel opada → statek wchodzi → efekt sektora.

Nie pokazywać przyszłych heksów. Przy krawędzi: strzałka / kreska / punkt = MOŻLIWA EKSPLORACJA, nie istniejące pole. Zajęta krawędź = RUCH (wyraźnie inny marker).

Faza `TILE_PLACEMENT`: brak innych akcji; nie wolno zmienić współrzędnej docelowej.

## 14–16. Krawędzie i rotacja

`edges[6]`, `getRotatedEdge` bez mutacji definicji. Przed zatwierdzeniem `validateTilePlacement` sprawdza wszystkich sąsiadów. Compatibility: stub.

## 17–18. Mapa i kamera

Nieregularny kształt. `PerspectiveCamera`: orbit, zoom, pan, focus na statek / nowy kafel. Obrót kafla nie obraca kamery.

## 19–25. Styl

Surowy kosmiczny drzeworyt: czerń, grafit, złamana biel, kość słoniowa; akcenty: ciemna czerwień, zgaszony błękit, ochra. Hex: ciemne wypełnienie + jasny kontur + symbol (EVA, PLANETA, •••, ↯, □, +, etc.). Statki: Mewa △, Cierń ◆, Drzazga ▲ — nie zapisujemy heading w GameState. UI: cienkie linie, typografia, pusta przestrzeń, bez neonu i glassmorphism.

Warstwa renderera wymienna (`TileRenderer` / `ShipRenderer`).

## 26–30. Architektura

```
Vue UI → Game Controller / Store → Game Engine → GameState
                                              ↓
                                    Three.js Renderer (eventy)
```

Komendy: `DECLARE_MOVE`, `START_EXPLORATION`, `ROTATE_PENDING_TILE`, `CONFIRM_TILE_PLACEMENT`, `SKIP_MOVEMENT`, plus wejście w wybór kierunku.

`ExplorationState` i cały `GameState` serializowalne do JSON. Bez Mesh/Object3D.

## 31–33. HUD / debug / developer

RUCH / EKSPLORACJA / POZOSTAŃ → WYBIERZ KIERUNEK → WYL0SOWANO + obrót + zatwierdź.

Debug: q,r, tileId, rotation, krawędzie 0–5.

Dev panel: odkryj kafel, wymuś następny, obrót, paliwo, PCH, obrażenie, następna faza/gracz, reset, współrzędne, indeksy krawędzi.

## 34–37. Stan i testy obowiązkowe

`getNeighbor`, `getNeighbors`, `hexDistance`, `isTilePlaced`, `getPlacedTile`, `getEmptyNeighborCoords`, `getWorldPosition`, `rotateEdgeIndex`, `getRotatedEdges`, `validateTilePlacement`.

Kafelek testowy krawędzi: `OPEN, BLOCKED, ASTEROID, OPEN, GATE, BLOCKED` × 6 rotacji.

## 38. Zakres mechaniki v0.1

EVA-1, 2 graczy lokalnie (hotseat), Mewa, rundy/tury, paliwo, ruch, pozostanie, eksploracja, stos, 6 orientacji, PCH (licznik), puste sektory / planety / asteroidy / baza / wraki / czarna dziura (obecność na planszy), prosta walka (wejście na pole z wrogim statkiem).

## 42–45. Cursor

Nie zmienia zasad bez zgody. Nie uzupełnia brakujących parametrów milcząco. Eksploracja ≠ odkrycie zakrytego pola — to dociągnięcie fizycznego kafla.

Prototype v0.1 ma wyglądać jak interaktywny przestrzenny prototyp gry planszowej: czytelny, szybki, surowy, łatwy do debugowania.
