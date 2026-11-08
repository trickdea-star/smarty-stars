# Smarty Stars ⭐

Learning games for kids ages 4–8. **Play it here:** https://trickdea-star.github.io/smarty-stars/

- **Letter Monster**: feed the monster a picture that starts (or, for older kids, ends) with a letter.
- **Counting Bakery**: fill treat orders. Older kids get an addition bonus question.
- **Word Builder**: tap letter tiles to spell the picture.
- **Toy Store**: pay the exact price with coins.

Each kid gets a player (name and age). Ages 4–5 get easier levels, and ages 6–8 get harder ones.
Right answers earn stars, and stars unlock avatar characters, colors, outfits and extras.
Prompts are read out loud, so kids who can't read yet can still play.

The whole game is one file, `index.html` (plain HTML/CSS/JavaScript, with no build step).
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

An easier route: open Claude Code in this folder and describe the game you want.
