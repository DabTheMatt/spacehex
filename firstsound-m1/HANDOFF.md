# FIELD M1 — kopia robocza (nie merge’uj do spacehex)

To jest **snapshot Milestone 1** instrumentu FIELD. Gra SPACE HEX nie korzysta z tego katalogu.

Ten Cloud Agent nie może wypchnąć do `DabTheMatt/firstsound` (403). Kod trafił tutaj, żeby był na GitHubie.

## Docelowe repo

https://github.com/DabTheMatt/firstsound

## Jak wgrać do firstsound (krok po kroku)

1. Na swoim komputerze: `git clone https://github.com/DabTheMatt/firstsound.git && cd firstsound`
2. Skopiuj **zawartość** tego katalogu do korzenia `firstsound` (nie zostawiaj zagnieżdżenia `firstsound-m1/`).
3. `git checkout -b cursor/sample-instrument-m1`
4. `git add -A && git commit -m "Add FIELD sample instrument (Milestone 1)."`
5. `git push -u origin cursor/sample-instrument-m1`
6. Otwórz PR do `main`, zmerguj.
7. GitHub → firstsound → Settings → Pages → Source: **GitHub Actions**.
8. Live: https://dabthematt.github.io/firstsound/

Albo nowy Cloud Agent z repozytorium **firstsound** (nie spacehex) — niech skopiuje ten folder do korzenia firstsound i otworzy PR.

## Lokalnie

```bash
cd firstsound-m1   # albo korzeń firstsound po skopiowaniu
npm ci
npm test
npm run dev        # http://localhost:5199/
```
