# Kennedy 100: Letters and Numbers with Banana Monkey

A 5-minute speaking game for young kids. Banana Monkey shows a big letter, a little letter or a number, the child says it out loud, and the iPad listens and checks it.

## How a round works

- **Two games** on the start screen: **Kennedy 100** (50 cards, 5 minutes) and **Kenny 25** (25 cards, 2½ minutes: 8 big, 8 little, 9 numbers).
- **50 cards** picked fresh each round from all 71: big letters A–Z, little letters a–z and numbers 1–19 (16 big, 16 little, 18 numbers). The same letter never shows twice in a row.
- **5 minutes** on the clock. When time's up the child can keep going; anything answered after the bell gets a clock mark and doesn't count toward the score.
- **Letter names**, not letter sounds: "bee" for B. Same-sounding words count too ("see" for C, "you" for U, "zed" for Z). Big and little letters sound the same, so the card's case is shown but only the letter name is checked.
- **3 tries per card**, shown as three bananas. After 3 wrong tries the card counts as missed and the game moves on.
- **Skip** sends a card to the end of the line. Skipping it again when it comes back counts it as missed.
- **Results** show the score out of 50, the cards to practise (with what the iPad heard) and all 50 cards. Scores are saved on the iPad under **My Scores**.
- **Banana Monkey** comes in three looks (green bandana, banana, pink headphones) and a different one shows up each time the app opens, each with its own opening trick.

## How the listening works

Speech recognition runs **inside the page, offline**, using [Vosk](https://alphacephei.com/vosk/) compiled to WebAssembly ([vosk-browser](https://github.com/ccoreilly/vosk-browser)). The recognizer only listens for the game's answers (letter names and the numbers 1–19), which keeps it fast and accurate. Audio never leaves the iPad.

- The speech model is about 40 MB and downloads the first time the app opens. After that it's stored on the iPad and the game works with no Wi‑Fi.
- The iPad asks for microphone permission when the first round starts.
- If the microphone is blocked or the model can't load, a grown-up can play with **✓ Right / ✗ Not yet** buttons instead.
- The clock pauses whenever the app is in the background, and an unfinished round can be resumed from the start screen.

## Files

| File | What it is |
|---|---|
| `index.html`, `style.css`, `game.js` | The game |
| `speech.js` | Microphone, speech model and the list of accepted words |
| `monkey.js` | Banana Monkey drawings |
| `vendor/vosk.js`, `model/` | Offline speech engine and model (see `vendor/README.md`) |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline support and Home Screen app |
| `tools/make-icons.py` | Rebuilds the icons and launch images from `monkey.js` |

Bump `VERSION` in `sw.js` on every release so iPads pick up new files.

## Run it locally

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000. Microphone access needs `localhost` or HTTPS.

## Publish

GitHub Pages: repo **Settings → Pages → Source: Deploy from a branch → `main` / root**. The site appears at `https://chadillac6.github.io/Kennedy100/`.

Fonts: Baloo 2 and Andika (SIL Open Font License, see `fonts/`).
