# Games

A minimal black-and-white puzzle app, built as a PWA so it installs to a phone's home screen and works offline.

## Games

**Carter, Stop Hiding My Shit!**: a remake of Meowdoku where you hunt frying pans instead of cats.
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
- **Random level:** Medium or Hard, with a random board, blocks, colours and obstacles.
- **Custom level:** pick the board size, difficulty, number of blocks, colours and obstacles.
- **Levels:** generated on the device by playing a solution backwards from an empty board, so every level is solvable. A solver grades each one:
  - **Easy:** blocks can go straight out.
  - **Medium:** at least one block must be moved out of the way first.
  - **Hard:** a single move out of the way isn't enough.

**Kelsey VS Carter**: a remake of Tower War.
Your towers (green) build up units over time. Drag from a tower to send half its units to another tower. Sweep across several of your towers on the way to send from all of them.

- **Combat:** units knock one off an enemy or neutral tower each and capture it when it runs out. Sending to your own tower reinforces it, and armies meeting head-on cancel out.
- **Tower levels:** towers level up as they grow, which makes them build units faster.
- **Map features (optional):**
  - **Walls** block sending.
  - **Factories** (square towers) build twice as fast but take double damage.
- **Rivals:** 1 to 3 computer opponents, which also fight each other.
  - **Easy:** slow and careless, and you start with extra units.
  - **Medium:** steady, and defends its towers.
  - **Hard:** reacts fast, gangs up on targets, and starts with extra units.
- **Maps:** generated on the device, with the starting area balanced between sides. Two computer players test-play each map, and lopsided maps are thrown away.

**Protect My Garlic!**: a remake of Geometry Tower.
Blocks march in from every side toward your garlic, and each one that reaches it costs hearts. Your weapons fire automatically; tap a block to make them all focus on it.

- **Shop:** between waves, coins from kills buy a shotgun, sniper or machine gun, plus damage and rate-of-fire upgrades for each weapon, or heal the garlic. Nothing carries over between levels, and you always start with a handgun.
- **Enemies:** scouts (fast), blocks, brutes (tough), splitters (break into scouts) and a boss on the last wave.
- **Difficulty:** sets enemy health, numbers and speed, how quickly they get stronger each wave, how many waves there are, and the garlic's hearts.
- **Random level:** Medium or Hard.
- **Custom level:** pick the difficulty, number of waves, and whether brutes, splitters and the boss appear.

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
