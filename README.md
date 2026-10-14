# Games

A minimal black-and-white puzzle app, built as a PWA so it installs to a phone's home screen and works offline.

## Games

**Carter, Stop Hiding My Stuff!**: a remake of Meowdoku where you hunt frying pans instead of cats.
Place one pan in every row, every column and every colour region. Pans never touch, not even diagonally.
Tap a square once for ✕, twice for a pan. Drag to mark ✕ on many squares.

- **Random level:** random size (5×5 to 9×9) and difficulty.
- **Custom level:** pick the grid size (5×5 to 10×10) and difficulty.
- **Stats:** levels played, plus average, fastest and slowest times, overall and by size and difficulty.
- **Puzzles:** generated on the device, always with exactly one solution, and graded by the deductions they need.

**Kelsey Blocked Me In Again!**: a remake of Color Block Jam.
Drag coloured blocks around a walled board to the door of their colour. A block leaves when it touches a matching door that is at least as wide as the block.

- **Obstacles (optional):**
  - **Arrow blocks** only slide one way.
  - **Iced blocks** wait until a number of other blocks have left.
  - **Layered blocks** peel to an inner colour at their first door.
  - **Walls** are fixed squares on the board.
- **Random level:** Medium (6×8 to 7×9 boards, mostly full) or Hard (8×8 to 9×11 boards, packed full), with random colours and obstacles.
- **Custom level:** pick the difficulty, board size (5×5 up to 9×11), number of blocks, colours and obstacles. Picking a difficulty suggests a matching board.
- **Levels:** generated on the device by playing a solution backwards from an empty board, so every level is solvable. A solver that plays like a person counts how many times you must move a block out of the way:
  - **Easy:** never.
  - **Medium:** once or twice.
  - **Hard:** three or more times, usually five to seven on the big boards.

**Kelsey VS Carter**: a remake of Tower War.
Your towers (green) build up units over time. Drag from a tower to send half its units to another tower. Sweep across several of your towers on the way to send from all of them.

- **Combat:** units knock one off a neutral tower each, but owned towers defend better (0.85 per attacker). A tower is captured when it runs out. Sending to your own tower reinforces it, and armies meeting head-on cancel out.
- **Balance:** everyone starts with 10 units. Towers hold at most 60 and growth is fairly flat, so more towers beats bigger towers. Difficulty only changes how well rivals play.
- **Tower levels:** towers level up as they grow, which makes them build units faster.
- **Map features (optional):**
  - **Walls** block sending.
  - **Factories** (square towers) build twice as fast but take double damage.
- **Rivals:** 1 to 3 computer opponents, which also fight each other.
  - **Easy:** slow and careless.
  - **Medium:** teams up its towers and defends.
  - **Hard:** reacts fast, waits for a clear advantage, and never leaves a tower open to a counter-attack.
- **Maps:** generated on the device, with the starting area balanced between sides. Two computer players test-play each map, and lopsided maps are thrown away.

**Protect My Garlic!**: a remake of Geometry Tower.
Blocks march in from every side toward the nearest garlic, and each one that reaches a garlic costs hearts (all garlics share them). Every gun sits on its own garlic and fires automatically; tap a block to make them all focus on it. Blocks fade from bright to dim as they take damage, and only the big ones show a number.

- **Shop:** between waves, coins from kills buy a shotgun (very short range), sniper (whole map) or machine gun (long range), each on a new garlic. Each gun also has damage and rate-of-fire upgrades, and you can heal. Nothing carries over between levels, and you always start with one garlic and a handgun.
- **Enemies:** scouts (fast), blocks, brutes (tough), splitters (break into scouts) and a boss on the last wave.
- **Difficulty:** sets enemy health, numbers and speed, how quickly they get stronger each wave, the garlic's hearts, and the number of waves (Easy 15, Medium 20, Hard 25; custom levels allow 10 to 40).
- **Random level:** Medium or Hard.
- **Custom level:** pick the difficulty, number of waves, and whether brutes, splitters and the boss appear.

**Babas Game**: Klondike solitaire.
Tap the deck to turn cards over. Tap a card to send it to the best place, or drag it. Undo is included, and the game finishes itself once every card is face up. Cards use two palette colours to match red and black suits: hearts and diamonds are red, spades and clubs blue.

- **Random deal:** draw 1 or 3 with unlimited passes, always winnable. A solver checks each deal first.
- **Custom deal:** pick draw 1 or 3, unlimited, 3 or 1 passes through the deck, and always-winnable or any deal.

**Gedos Game**: Hola, with only sevens wild.
Play 1 v 1 against Gedo, or 2 v 2 with Gedo as your partner against Kelsey and Carter. Players sit around the table, each played card lands in the middle in front of whoever played it, and the cards each player wins pile up face down beside them. Only a card of the led rank, or a seven, takes a trick over. After each round the leader takes the trick or fights on. Aces and tens score 10, the last trick of each hand scores 10, and taking every trick (a Hola) scores 170.

- **Custom game:** pick 1 v 1 or 2 v 2, a target of 150, 300 or 500, and a difficulty.
- **Difficulty:** Easy players are careless, Medium players fight for points and feed their partner, and Hard players also remember every card played.

Each game's menu opens with a small preview of the game.

An unfinished game saves itself whenever you leave it: the back arrow, switching apps, or closing the app. That game's page then shows a Continue button. Starting a new game replaces the saved one.

No game has a countdown timer. Each one shows how long you've been playing, which feeds your stats.

**Settings**
- **Theme:** Night (black with white accents) or Day (the reverse).
- **Play-time limit (optional):** when it runs out you are sent back to the main menu. The game in progress is saved, and a Continue button appears on that game's page.

## Run locally

No build step. Any static server works. On Windows with no Node or Python:

```
powershell -ExecutionPolicy Bypass -File tools/serve.ps1
```

Then open http://localhost:8000.

## Deploy to GitHub Pages

1. Create a repo on GitHub, then push this folder:
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
2. On GitHub, go to **Settings → Pages**. Set **Source** to *Deploy from a branch*, choose `main` and `/ (root)`, then save.
3. Open `https://<you>.github.io/<repo>/` on your phone.
   - **iPhone (Safari):** tap Share, then **Add to Home Screen**.
   - **Android (Chrome):** open the menu and choose **Install app**.

## Adding a game

1. Create `games/<id>/index.js` that exports `mount(el, parts, query)`. It can return `{ unmount }`.
2. Register it in `js/games.js`.
3. Add its files to `FILES` in `sw.js` so it works offline.
4. Call `playtimer.start()` while the game is being played, so the play-time limit counts it.

`tools/make-icons.ps1` regenerates the PNG icons.
