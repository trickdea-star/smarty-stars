# Smarty Stars ⭐

Learning games for kids ages 3–8. **Play it here:** https://trickdea-star.github.io/smarty-stars/

- **Letter Monster**: feed the monster a picture that starts (or, for older kids, ends) with a letter.
- **Counting Bakery**: fill treat orders. Older kids get an addition bonus question.
- **Word Builder**: tap letter tiles to spell the picture.
- **Toy Store**: pay the exact price with coins.
- **Zombie Splat** (arcade): goofy zombies walk toward your fort holding signs. Splat the one the voice asks for
  (letters and numbers for ages 4–5, adding, taking away and times tables for ages 6–8).
  Rounds get faster, runners show up in round 2 and a big boss in round 3, and 5 in a row earns a Goo Bomb.
  Two of the zombies (Creepy Crawler and Bone Hand) were drawn by the kids.
- **Hoop Shot** (arcade): the question is on the backboard, and three basketballs show answers. Drag or tap the
  right one to shoot. Ages 4–5 make 10 baskets; ages 6–8 play 60-second beat-the-buzzer rounds for a best score.
  Three in a row puts the ball on fire, and each basket is then worth 3 points.

**Pick what to practice.** Both arcade games open with a choice screen, and each kid's last choice is remembered:
- **Ages 3–5:** ABC, Colors, Numbers, or Mix.
- **Ages 6–8:** Adding, Taking away, Times, Dividing, or Mix.
  Then pick **All** numbers, or 1 or 2 numbers from 1–12 (plus 20 for adding and taking away) to practice that
  fact family. For example, 7 gives 7 × 1 … 7 × 12, 56 ÷ 7, 15 − 7 and 7 + 9.

Each kid gets a player (name and age). Ages 3–5 get easier levels, and ages 6–8 get harder ones.
Right answers earn stars, and stars unlock avatar characters, colors, outfits and extras.
Prompts are read out loud, so kids who can't read yet can still play.

The app is `index.html` (plain HTML/CSS/JavaScript, with no build step). Bigger arcade games live in
`games/` and use the free [Phaser](https://phaser.io) game engine, which downloads only when one opens.
Progress is saved in the browser on each device, so a phone and a laptop keep separate players.
Clearing the browser's site data erases progress.

## Updating the live site

1. Edit `index.html`.
2. Test it: double-click `index.html` to open it in your browser.
   (This test copy keeps its own players, separate from the live site.)
3. Publish it from PowerShell:

   ```bash
   cd C:\Users\DeatrickJohnson\Projects\smarty-stars
   git add -A
   git commit -m "Say what you changed"
   git push
   ```

   The live site updates within a few minutes. On a phone, refresh the page.

## Adding an avatar item

Find the lists near the top of the `<script>` in `index.html` and add one line:

| To add | List | Example |
|---|---|---|
| a color | `COLORS` | `{id:'teal', name:'Teal', v:'#2EC4B6', cost:10},` |
| an outfit | `OUTFITS` | `{id:'greentee', name:'Green shirt', cost:10, draw:(k,st) => shirt('#4CCB70', st)},` |
| a character | `CHARS` | `{id:'fox', kind:'Animals', name:'Fox', cost:30, head:'round', ears:'pointy', nose:'cat'},` |
| an extra | `ACCS` | copy an existing entry and change its drawing |

`cost` is the number of stars it takes to unlock (use 0 for free).
**Never change the `id` of an item that already exists**, because saved unlocks use it.
A new character can mix any parts the others already use (`head`, `ears`, `nose`, `horns`, `antenna`, `eyes`, and so on).

## The narrator voice

Everything the game says is a recorded clip in `voice/`, made with Kokoro, a free natural-sounding voice that runs
on this PC. `narrator.js` plays the clips. Anything that has no recording falls back to the device's own voice.

Every sentence is recorded once and the app strings them together. So when you add something that talks
(a new game, a new picture, word, toy or avatar item), re-record:

```bash
python tools/voice_lines.py
```

```bash
C:\Users\DeatrickJohnson\Projects\math-bridge-academy\.venv-tts\Scripts\python.exe C:\Users\DeatrickJohnson\.claude\skills\natural-voice\record.py --lines tools\voice_lines.txt --out voice
```

Then bump `VOICE_BUILD` in `index.html`. Only new lines get recorded.
New pictures, words, toys and items are picked up automatically. A brand-new *kind* of sentence needs its wording
added to `tools/voice_lines.py` first. Keep changing parts (numbers, names) in their own short sentence.

## Adding your own zombie drawings

1. Draw one zombie per sheet of white paper: whole body, facing forward, dark outline, colored in.
2. Take a photo straight down in good light and save it to the `drawings` folder.
   That folder stays on this computer and is never uploaded.
3. Cut it out:

   ```bash
   python tools/cutout_drawing.py drawings/IMG_1234.jpg assets/zombies/mr-stinky.png
   ```

4. Add a line to the `ZOMBIES` list at the top of `games/zombie-splat.js`:
   `{name:'Mr. Stinky', kind:'runner', art:'assets/zombies/mr-stinky.png'},`
   The kind is `walker` (normal), `runner` (fast) or `boss` (big, and takes 2 splats).

Testing tip: open the page with `?debug` at the end of the address to reach the game from the browser console as `ZS`.

## Adding a game

Each game is one block in `index.html` that starts with `/* ---------- GAME: ... */` and ends with `addGame({...})`.
Paste a new block just above `/* ---------- Actions`, and its home tile appears on its own.
Here is a complete small game you can copy and change:

```js
/* ---------- GAME: Shape Hunt ---------- */
function shNew(){
  const shapes = ['circle','square','triangle'];
  G = {game:'shape', answer: pick(shapes), shapes, done:false};
  G.prompt = `Find the ${G.answer}!`;
  showRound();                        // draws the screen and reads G.prompt out loud
}
function renderShape(){               // returns the HTML under the top bar
  const pics = {circle:'🔵', square:'🟥', triangle:'🔺'};
  return `
    <div class="prompt card"><div class="say">${G.prompt}</div>
      <button class="hear" data-act="hear" aria-label="Hear it again">🔊</button></div>
    <div class="msg" id="msg" aria-live="polite"></div>
    <div class="opts">${G.shapes.map(s => `<button class="opt card" data-act="shPick" data-s="${s}"><span class="emo">${pics[s]}</span></button>`).join('')}</div>`;
}
function shPick(d){                   // runs when a button with data-act="shPick" is tapped
  if (G.done) return;
  if (d.s === G.answer){ G.done = true; setMsg(cheer(), true); addStar(); nextRound(1500); }
  else { setMsg('Try again!'); say('Try again!'); }
}
addGame({
  id:'shape', name:'Shape Hunt', emoji:'🔺', blurb:'Find the shape', color:'var(--grape)',
  newRound: shNew, render: renderShape,
  actions: { shPick }
});
```

Useful helpers: `big()` is true for ages 6–8, and `P().age` is the exact age.
`addStar()` gives a star, `cheer()` says something nice, `nextRound(ms)` moves to the next question after a pause, and `pick`, `rint` and `shuffle` handle random choices.

A big arcade game goes in its own file in `games/` (see `games/hoop-shot.js`, the simpler of the two).
`games/arcade-kit.js` does the hard parts for every arcade game:
- loads Phaser safely, with three download sites, a plain-graphics fallback and an on-screen error
- sound effects
- drawing helpers
- the age-based questions

A game file builds a Phaser scene, calls `ArcadeKit.sceneReady()` at the end of `create()`, and registers itself:

```js
SmartyStars.addGame({ id:'hoop', name:'Hoop Shot', emoji:'...', blurb:'...', color:'#FF9F43',
  newRound: () => SmartyStars.startRound({game:'hoop', prompt:'Hoop Shot!'}),
  render: () => ArcadeKit.html('Loading...'),
  mount: main => ArcadeKit.start(main, makeScene, 'basketballs'),
  unmount: () => ArcadeKit.stop() });
```

Add a `<script src="games/your-game.js?v=1">` line at the bottom of `index.html`. Bump the `?v=` number whenever the
file changes, so phones fetch the new copy.

An easier route: open Claude Code in this folder and describe the game you want.
