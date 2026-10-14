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
- **Random level:** random board, blocks, colours and obstacles, with a level timer.
- **Custom level:** pick the board size, number of blocks, colours, obstacles and whether there's a level timer.
- **Levels:** generated on the device and always solvable. Every block is placed so it can still leave with all earlier blocks in place, and a solver checks each level.

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
