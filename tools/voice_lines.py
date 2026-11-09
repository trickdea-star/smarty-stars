"""List every sentence Smarty Stars can say, for recording with the natural-voice recorder.

    python tools/voice_lines.py          -> writes tools/voice_lines.txt

It reads the word lists, treats, toys and avatar items straight out of index.html, so new pictures,
words or items are picked up automatically. If you add a NEW KIND of spoken line to the app, add its
template here too (same wording), re-run this, re-record, and bump VOICE_BUILD in index.html.

Letters are written as {B} so the voice says the letter's name ("bee").
Each row is split into sentences; each sentence becomes one clip, so the app can mix and match them.
"""
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
APP = open(os.path.join(HERE, '..', 'index.html'), encoding='utf-8').read()
ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'


def block(name):
    """The source text of `const NAME = ...;`"""
    m = re.search(r'const ' + name + r' = (.*?)\n(?:const|function|/\*)', APP, re.S)
    if not m:
        raise SystemExit('Could not find ' + name + ' in index.html')
    return m.group(1)


def L(word):
    """{A}{B}... letter-name form isn't needed inside words; this makes a single letter say its name."""
    return '{' + word.upper() + '}'


def cents(n):
    return '%d %s' % (n, 'cent' if n == 1 else 'cents')


pics = re.findall(r"\['([^']+)','", block('PICS'))
words = re.findall(r"\['([a-z]+)','", block('WORDS'))
treats = re.findall(r"one:'([^']+)', many:'([^']+)'", block('TREATS'))
shop = re.findall(r"\['([^']+)','", block('SHOP'))
cheers = re.findall(r"'([^']+)'", block('CHEERS'))
items = [(n, int(c)) for n, c in re.findall(r"\{id:'[^']+',[^{}]*?name:'([^']+)'[^{}]*?cost:(\d+)", APP)]
paid = sorted({n for n, c in items if c > 0})
max_cost = max(c for n, c in items)

rows = []
add = rows.append

# ---- everywhere
for c in cheers:
    add(c)
add('Hi, superstar! Pick a game.')
add('Welcome, superstar! Pick a game to start earning stars.')
add('Sound on!')
for n in paid:
    add('Yay! You unlocked %s!' % n)
    add('Play the games to unlock %s!' % n)
for n in range(1, max_cost + 1):
    add('You need %d more %s.' % (n, 'star' if n == 1 else 'stars'))

# ---- Letter Monster
for ch in ABC:
    add('Feed me something that starts with %s!' % L(ch))
    add('Feed me something that ends with %s!' % L(ch))
for w in pics:
    letters = re.sub(r'[^a-z]', '', w)
    add('%s starts with %s!' % (w, L(letters[0])))
    add('%s ends with %s!' % (w, L(letters[-1])))
    add("That's %s." % w)
add('Try again!')

# ---- Counting Bakery
for one, many in treats:
    amt = lambda n: '%d %s' % (n, one if n == 1 else many)
    for n in range(1, 11):
        add('Can I have %s, please?' % amt(n))
        add('I asked for %s.' % amt(n))
    for n in range(1, 10):
        add('Can I have %s?' % amt(n))
        add('And %s, please!' % amt(n))
    for n in range(1, 21):
        add('%s.' % amt(n))
    add("Oops, I didn't order any %s. Tap one to take it back." % many)
for n in range(0, 21):
    add('You have %d.' % n)
add("Let's count again!")
add('Order served!')
add('Bonus question! How many treats did you serve in all?')
add('Not quite. Count all the treats on the plate!')
for a in range(1, 10):
    for b in range(1, 10):
        add('%d plus %d is %d!' % (a, b, a + b))

# ---- Word Builder
for w in words:
    add('Spell %s.' % w)
    add(', '.join(L(ch) for ch in w) + '.')
    add('%s!' % w)
for ch in ABC:
    add('%s.' % L(ch))
add('Not quite! Try again.')

# ---- Toy Store
for item in shop:
    add('Ooh, %s %s!' % ('an' if item[0] in 'aeiou' else 'a', item))
for n in range(1, 100):
    add('It costs %s.' % cents(n))
    add("That's exactly %s!" % cents(n))
    add('You need %s more.' % cents(n))
for n in range(0, 99):
    add('You gave %s.' % cents(n))
for v in (1, 5, 10, 25):
    add(cents(v) + '.')
add('Tap the coins to pay.')
add("That's too much! Take some coins back.")

# ---- Zombie Splat (games/zombie-splat.js)
add('Zombie Splat!')
add('Round 1! Zombies are coming. Splat the zombie I ask for!')
for n in range(1, 41):
    add('Round %d! Here they come!' % n)
for line in ('Round clear! Awesome!', 'You did it! Round clear!', 'Zombies splatted! Round clear!',
             "Oh no! The zombies broke in! Let's try that round again.",
             'Splat!', 'Nice shot!', 'Gooey!', 'Got it!', 'Yes!', 'Five in a row! Goo bomb ready!',
             'Goo bomb! Splat splat splat!'):
    add(line)
for ch in ABC:
    add('Splat the letter %s!' % L(ch))
    add("That's %s." % L(ch))
for n in range(1, 21):
    add('Splat number %d!' % n)

# ---- Practice questions shared by the arcade games (games/arcade-kit.js question(), keep in step with it):
# a practice number n (1-12, and 20 for + and -) with a partner k = 1..12, in both orders.
COLOR_NAMES = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'brown', 'black', 'white']
for n in list(range(1, 13)) + [20]:
    for k in range(1, 13):
        add('What is %d plus %d?' % (n, k)); add('What is %d plus %d?' % (k, n))
        add('What is %d minus %d?' % (n + k, n)); add('What is %d minus %d?' % (n + k, k))
        if n <= 12:
            add('What is %d times %d?' % (n, k)); add('What is %d times %d?' % (k, n))
            add('What is %d divided by %d?' % (n * k, n))
for n in range(0, 151):                     # wrong answers: "That's 56."
    add("That's %d." % n)
for c in COLOR_NAMES:
    add('Splat the color %s!' % c)
    add('Shoot the color %s!' % c)
    add("That's %s." % c)
# the "pick what to practice" screen
add('What do you want to practice?')
for line in ('Adding!', 'Taking away!', 'Times!', 'Dividing!', 'Mix it up!', 'Letters!', 'Colors!', 'Numbers!',
             'All the numbers!'):
    add(line)
for w in ('ones', 'twos', 'threes', 'fours', 'fives', 'sixes', 'sevens', 'eights', 'nines', 'tens', 'elevens',
          'twelves', 'twenties'):
    add('The %s!' % w)

# ---- Hoop Shot (games/hoop-shot.js); math questions and "That's N." are shared with Zombie Splat
add('Hoop Shot!')
add('Ready? You have 60 seconds. Go!')
add('Make 10 baskets! Ready? Go!')
for line in ('Swish!', 'Nothing but net!', 'Score!', 'Great shot!', "You're on fire!",
             'You did it! 10 baskets!', 'New best score!'):
    add(line)
for ch in ABC:
    add('Shoot the letter %s!' % L(ch))
for n in range(1, 21):
    add('Shoot number %d!' % n)
for n in range(0, 201):
    add("Time's up! You scored %d points!" % n)

seen, out = set(), []
for r in rows:
    if r not in seen:
        seen.add(r)
        out.append(r)
dst = os.path.join(HERE, 'voice_lines.txt')
with open(dst, 'w', encoding='utf-8', newline='\n') as f:
    f.write('# Made by tools/voice_lines.py - do not edit by hand\n' + '\n'.join(out) + '\n')
print('%d lines -> %s (%d pictures, %d words, %d treats, %d toys, %d unlockable items)'
      % (len(out), dst, len(pics), len(words), len(treats), len(shop), len(paid)))
