# Conf T — story bible (working draft)

Written by Claude from Mustafa's brief: a hero's redemption, a dark tragedy that can end well
or break your heart depending on the player's choices and how accurate their commands are, with
slight comedy throughout, natural dialogue, and nothing to do with network engineering.
Not committed. Mustafa rewrites whatever he wants; the dialogue itself lives in
`public/learn/conf-t/js/game/story.js`.

## The idea in three lines

The Old Tongue is a spoken language that stone machines obey, and they obey it exactly. Say
the wrong word and they do what you said, not what you meant. Three years ago you said one wrong
word on a night shift, and seven people died. Now the order you gave is still running, and
only the person who gave it can cancel it.

(The terminal is the Old Tongue. In the story it is only ever called that. Nobody in this world
has heard of a network.)

## World

**Karrow** is a mining town built over **the mine**, a huge system of levels cut by people
nobody remembers. The mine is run by **machines**: stone constructs, doors with opinions,
lifts, town lamps. An **Operator** is someone licensed to speak to them. Operators carry a **slate**,
which is how you write the words the machines listen to. The rules of the Tongue are few and
strict:

- A machine does exactly what the words say. Not what you meant.
- What a speaker binds, only that speaker can unbind.
- A machine will not answer a word it does not know. It will still answer a word it knows wrongly.

## Cast

**You — Wren Calder** (the player can rename). Used to be the youngest Operator in Karrow. Funny
in a worn-out way. Has not said a word to a machine in three years and is not sure the hands
remember.

**Mara Orrell**, 19. Dess's younger sister. Runs the lamp-oil shop her family owned. Blunt,
quick, tired of being polite to people she does not respect. She is the one who finds you and
brings you back, because the order can only be cancelled by you, and she hates that.

**Hobb Garrick**, now Overseer of Karrow. Was your shift lead on the night it happened. Warm,
reasonable, remembers everyone's birthday. He told you to skip the closing check because he
wanted to go home. He has told the town it was your word alone, and has half-convinced himself.

**Pell**, 15. Apprentice Operator, talks nonstop, thinks you are legendary because of the
accident, which is a terrible thing to be famous for. He is the one you can lose.

**Odo Fenn**. Sells staffs, tonics and the things Operators actually need. Has opinions on his
own prices. Does not care about your past as long as you pay.

**Gate Seven**. A door. Very particular about grammar. Remembers you. Has been waiting three
years to tell you your last sentence was badly constructed.

**Dess Orrell**. Your best friend. Died in Level Nine. You hear her only in the last room, in
an old town lamp that recorded the night.

## The night (what you remember, and what you don't)

You were tired, on your second double. Garrick said the closing check could wait, it had been
clean for ten years. At the end of the shift you meant to say **seal** Level Nine and said
**sever** instead. The machine did exactly that: it severed the lift lines and the flood doors
to Level Nine. Dess and six others were below. You have never been able to remember whether
Garrick heard you say it.

## Structure

Three days while the water rises, played as episodes. Between them you return to Karrow to
sleep, shop, and talk to people. Each episode has puzzle rooms (no timer, long commands),
defense rooms (fast short commands), and a room with a story choice.

1. **Prologue — the ferry.** You arrive. Gate Seven recognises you before you say a word.
2. **Day One — the Upper Galleries.** Learn the Tongue again. The Gatewarden is the first real
   test: a machine that no longer believes any Operator's word.
3. **Day Two — Level Four.** Pell's lift is stuck with him inside. The foreman's office has
   the ledger from that night.
4. **Night Two — the Gate.** Strays come up out of the flooded levels. You defend Karrow.
5. **Day Three — Level Nine.** The last room. Dess's town lamp. The order to cancel.

## Choices that matter

| Where | Choice | What it changes |
|---|---|---|
| Prologue | Lie to Gate Seven about who you are, or don't | Mara's first impression of you. Gate Seven is unimpressed either way. |
| Day One | Tell Mara the truth about what you remember, or hold it back | **Trust with Mara** |
| Day Two, Level Four | Pell's rescue: every slip drops more rock. | **Pell lives, is hurt, or dies** |
| Day Two, the office | The ledger proves Garrick told you to skip the check. Show it, or burn it. | **Truth**: Garrick exposed, or the lie stays |
| Night Two | Defend the town lamps or the evacuation line first | Who is hurt at the Gate |
| Day Three | How cleanly you speak the last word | **The ending** |

The player's accuracy is tracked as **slips**: a command the Tongue rejects, or one that works
and does harm. Each room is rated Clean (0-1 slips), Rough (2-4) or Botched (5+).

## Endings

- **Redemption.** Final room Clean, the ledger shown, Mara's trust high. Nine is cancelled and
  the seven are brought up. The town holds a hearing. Mara forgives you without making it
  easy. You stay in Karrow as its Operator, publicly. *Gate Seven: "Welcome back. Your grammar is
  still terrible."*
- **Quiet Redemption.** Final room Clean, the ledger burned. The town is saved. Nobody knows
  the whole truth but you. You are tolerated, never forgiven, and you keep working anyway.
- **Bittersweet.** Final room Rough. Nine is cancelled late. It costs you something you can
  see: Pell's hands, or the lower town. Mara is there at the end. It is not a happy ending.
  It is an honest one.
- **Heartbreak.** Final room Botched with Mara's trust high. Mara follows you down because she
  does not believe you will get it right. You do not. She does not come back up.
- **Exile.** Final room Botched with Mara's trust low. You run again. The flood takes the lower
  town. You are on a ferry again, with a better memory of what you did.

If Pell died on Day Two, every ending that follows carries it. Redemption becomes Bittersweet.

## Tone rules for the dialogue

- People talk like people. Short lines. Interruptions. Nobody explains the plot to a person
  who already knows it.
- The comedy comes from characters being themselves (Gate Seven's grammar, Odo's prices,
  Pell's talking), never from jokes bolted on. One line is enough.
- No prophecies, chosen ones, or ancient evils. The villain is a tired man who wanted to go
  home. The tragedy is small and specific.
- No speeches about redemption. Wren is never told they are forgiven. They are shown.
- Say things plainly. "You killed her" is a sentence a person could actually say.
