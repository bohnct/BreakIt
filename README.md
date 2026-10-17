# Break It

A minimal black-and-white puzzle app, built as a PWA so it installs to a phone's home screen and works offline.

## The games

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
- **Levels:** every level is generated on the device and proven solvable.
  - **Easy:** blocks can go straight out.
  - **Medium:** you must move blocks out of the way once or twice. Medium levels are built by playing a solution backwards from an empty board.
  - **Hard:** a board packed about 80% full. A planning solver proves it can be finished and measures how far ahead you must think. Hard keeps the board with the most "knots": points where no single move frees anything, so you have to plan two to four moves ahead. Hard levels typically have three to six knots and need 10 to 20 moves aside. Obstacles are added afterwards and kept only if the level is still solvable.

**Folding Laundry**: mahjong solitaire (tile matching). Tiles show clothing (T-shirts, socks, underwear, trousers, dresses and caps) in six colours; a pair is the same item in the same colour.
Match pairs of identical free tiles to clear the board. A tile is free when nothing sits on top of it and its left or right side is open; blocked tiles look darker.

- **Deals:** built by lifting pairs of free tiles off a full layout, so every board can be cleared.
- **Difficulty:** Easy has two layers and every design is a single pair. Medium has three layers, and Hard stacks up to five; on both, each design appears four times, so matching the wrong two can bury tiles you need.
- **Board size:** Small (~36 tiles), Medium (~64) or Large (~96).
- **Stuck?** Undo, or shuffle the tiles that are left (the shuffle keeps the board clearable).

**Protect My Garlic!**: a remake of Geometry Tower.
Blocks march in from every side toward the nearest garlic, and each one that reaches a garlic costs hearts (all garlics share them). Every gun sits on its own garlic and fires automatically; tap a block to make them all focus on it. Blocks fade from bright to dim as they take damage, and only the big ones show a number.

- **Shop:** between waves, coins from kills buy a shotgun (short range), sniper (whole map) or machine gun (long range), each on a new garlic. Faint dashed rings on the map show each gun's range. Each gun also has damage and rate-of-fire upgrades (every fifth damage upgrade also lets its bullets pass through one more block), and you can heal.
- **Crowds:** waves are made of many slow, fairly weak blocks rather than a few fast tough ones, so the map stays busy. Each block drops half the coins it used to; the balance was tuned with a shopping bot to match the earlier win rates. Nothing carries over between levels, and you always start with one garlic and a handgun.
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

**Cleaning Up**: a remake of Loop Sort.
Trucks are parked around a closed track, each holding a mix of coloured cubes. Tap a truck to send its top cube (the one nearest the track) onto the track. The cube rides round and drops into the first truck it reaches that is empty, or has the same colour on top, and has room. It skips its own truck on the first lap. A truck filled with one colour drives away. Cubes visibly slide out of trucks onto the track and into the truck they land in. Sort every truck to win. Only a few cubes may be on the track at once, and cubes with nowhere to go keep using that space; if it's full of them you're stuck. The only button is Restart, and a count at the top (like 2/6) shows cubes on the track out of the most allowed.

- **Tracks:** every level's track is a new shape, traced around a random blob of cells, with plenty of corners.
- **Levels:** a solver proves each level can be sorted, playing within the track limit. The number of trucks and colours varies from level to level, and now and then you get a much bigger one. There are six colours, so past six truckloads a colour fills two trucks.
  - **Easy:** 3–6 truckloads, 1–2 empty trucks, up to 7 cubes on the track. Forgiving.
  - **Medium:** 4–7 truckloads, 0–1 empty trucks, 6 cubes on the track.
  - **Hard:** 5–8 truckloads, 0–1 empty trucks, 5 cubes on the track, and hidden cubes always on. Hard levels are chosen against a "sensible" test player who always prefers taps that land straight away. When roof colours are on, Hard looks for levels where that player gets stuck about 60% of the time, so the obvious move is often a trap.
- **Obstacles (optional):**
  - **Roof colours:** a truck with a coloured roof only takes that colour. They turn up occasionally, about half of random Hard levels.
  - **Ice:** iced trucks are stuck until enough trucks have been sorted.
  - **Hidden:** hidden trucks only show their top cube; once a cube has been seen it stays visible.

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

`tools/make-icons.ps1` regenerates the PNG icons from `icons/pan-source.png` (a black pan on white), inverting it to white on black.
