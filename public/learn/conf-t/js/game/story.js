/* The story: every line of dialogue, the choices, and how the ending is worked out.
   DRAFT: written by Claude from Mustafa's brief (see docs/CONF-T-STORY.md). Rewrite freely.

   A scene is a list of steps:
     { n: "text" }                     narration
     { w: "Name", t: "text" }          someone speaks (text can be a function of the game state)
     { c: [ { t, do, then } ... ] }    a choice; `do` changes the state, `then` is what follows
     { do: fn }                        change the state
     { if: fn, then: [..], else: [..] }
     { shop: 1 }                       open the shop
     { go: "roomId" | "hub", at: [x, y] }
     { end: "key" }                    roll the ending
   {name} in any text is the player's name and {title} is Mister or Miss. */
(function(root){
"use strict";

var N = function(t){ return { n: t }; };
var W = function(who, t){ return { w: who, t: t }; };
var DO = function(fn){ return { do: fn }; };
var IF = function(cond, then, els){ return { if: cond, then: then, else: els || [] }; };
var CH = function(opts){ return { c: opts }; };

var STORY = root.STORY = { scenes: {}, npc: {}, items: {}, hints: {} };
var S = STORY.scenes;

/* ---------- small helpers the scenes use ---------- */
function trust(s, n){ s.mara = Math.max(-3, Math.min(6, s.mara + n)); }

/* ====================================================================================
   Opening cards: shown once, before the ferry, so the player knows where they are.
   `art` picks the picture behind the text; `words` shows the two words side by side.
   ==================================================================================== */
STORY.intro = [
  { art: "town", text: [
    "Karrow is a mining town. Under it runs the mine: miles of tunnels, cut long ago by people nobody remembers.",
    "The mine runs on machines. Doors, lifts, lamps. Stone that listens."
  ] },
  { art: "deep", text: [
    "The machines only understand the Old Tongue, a command language, and they obey it exactly. Not what you meant. What you said.",
    "An Operator is someone licensed to speak it. You write the words on your slate, and the machine does the rest."
  ] },
  { art: "words", text: [
    "You were the youngest Operator in Karrow.",
    "Three years ago, at the end of a double shift, you meant to tell the machines on Level Nine to seal the doors. You said sever."
  ], words: [["what you meant", "seal"], ["what you said", "sever"]] },
  { art: "deep", text: [
    "Sever cut the lifts and the flood doors. Seven people were below, and one of them was Dess, your best friend.",
    "You left on the first ferry. Nobody has been down there since."
  ] },
  { art: "ferry", text: [
    "Now the water is rising through the lower levels, and the command you gave is still running.",
    "Only the person who gave it can cancel it. So someone has come to find you."
  ] }
];

/* ====================================================================================
   Prologue
   ==================================================================================== */
S.prologue = [
  N("The ferryman won't tie up at Karrow anymore. He slows down near the dock and says you can jump."),
  N("You jump. Mostly."),
  W("Mara", "You're wet."),
  W("{name}", "The ferryman had opinions."),
  W("Mara", "Everyone has opinions about you. I've been collecting them. Come on."),
  W("{name}", "Mara. I didn't think you'd be the one who came."),
  W("Mara", "I didn't want to be. Let's keep that clear."),
  W("Mara", "The mine is filling. Level Nine has been running since that night, and nobody can make it stop. It only takes orders from whoever gave it."),
  W("{name}", "Me."),
  W("Mara", "You. Lucky you."),
  W("Mara", "The water's in the lower levels. Three days, maybe four, and it's in the cellars on Low Street. That's where my shop is, in case you were wondering how personal this is."),
  W("Mara", "Gate Seven. East side, past the board. It's the only way down that's still open."),
  W("{name}", "Seven's still there?"),
  W("Mara", "Seven is always still there. Don't make me walk you."),
  DO(function(s){ s.hub = "gate"; })
];

S.gate7_meet = [
  N("There's a door in the hillside with a face carved into it. There was always a face. You'd forgotten how much you disliked it."),
  W("Gate Seven", "Oh. It's you."),
  CH([
    { t: "Never met you.", do: function(s){ s.lied = true; trust(s, -1); }, then: [
      W("Gate Seven", "You called me sweetheart in front of the whole night shift. Twice."),
      W("{name}", "That sounds like a different person."),
      W("Gate Seven", "It was you. You had a cold, so it came out as sweethard.")
    ] },
    { t: "Hello, Seven.", then: [
      W("Gate Seven", "Hello. Your last sentence to me had no verb. I've been thinking about it for three years."),
      W("{name}", "I was tired."),
      W("Gate Seven", "Tired is a reason. It isn't a verb.")
    ] }
  ]),
  W("Gate Seven", "I'll let you in. Not because I forgive you. Because it's my job, and I'm very good at it."),
  W("Gate Seven", "Every machine down there answers to the Old Tongue. Say it exactly, or we do exactly what you said. That includes me. I'm very literal about doors."),
  W("Gate Seven", "My back half's been dark since the night it happened. Someone told it to sever. Could you see to it?"),
  W("{name}", "I'm not sure my hands remember."),
  W("Gate Seven", "Then you'll be slow and wrong, which is how everyone starts. Go on."),
  DO(function(s, G){ s.ep = 1; G.startEpisode(1); })
];

/* ====================================================================================
   Episode 1: the Upper Levels
   ==================================================================================== */
S.gate7_intro = [
  N("The room behind the gate is cold. A console sits in the middle of it, dark, and a lamp stands at the far end."),
  W("Gate Seven", "That's my back half. It has no address and it isn't awake. Fix both."),
  W("{name}", "You're not going to tell me how."),
  W("Gate Seven", "I'm a door. I tell people when to leave.")
];
S.gate7_solved = [
  N("The lamp at the end of the room flickers, then holds. Somewhere behind the wall, something clicks."),
  W("Gate Seven", "Oh. That's better. Don't read anything into it."),
  W("{name}", "I wasn't."),
  W("Gate Seven", "Good. Keep walking.")
];

S.strays_intro = [
  N("Something small and made of stone moves inside the wall. Then something else. They're all heading for the lamp."),
  W("{name}", "Strays. Machines that lost their orders. There used to be one a year."),
  W("Gate Seven", "There are more now. They come for the lamp and they ask for things. Give each one what it wants, exactly, before it gets there."),
  W("{name}", "And if I'm wrong?"),
  W("Gate Seven", "Then it gets the lamp, and you get to explain to the lamp.")
];
S.strays_done = [
  N("The last stray goes quiet. The lamp steadies."),
  W("{name}", "I forgot that part. Doing it with my hands again.")
];

S.corridor_intro = [
  N("The corridor is half flooded. At one end there's a lamp and a console. At the other end there's another lamp and another console."),
  W("{name}", "Two sides, and neither one's been told the other exists."),
  W("Gate Seven", "Each knows its own end very well. The middle bores them.")
];
S.corridor_solved = [
  N("Both lamps flicker, then burn together. The water in the corridor doesn't rise any higher."),
  W("Gate Seven", "Well. That's two doors that finally have something to say to each other.")
];

S.warden_intro = [
  N("The third gate is bigger than the others. It has a Warden, and the Warden is awake."),
  W("The Gatewarden", "NO OPERATOR'S WORD HOLDS HERE. THE LAST ONE SAID SEVER."),
  W("{name}", "I know."),
  W("The Gatewarden", "THEN YOU KNOW WHY I DO NOT LISTEN."),
  W("{name}", "I'm not asking you to listen. I'm asking you to let me fix the lamps."),
  W("The Gatewarden", "SHOW ME THEY ARE ONE.")
];
S.warden_puzzle = [
  W("The Gatewarden", "THEY ARE ONE."),
  W("The Gatewarden", "THE STRAYS WILL TEST YOU. I WILL WATCH.")
];
S.warden_done = [
  N("The last stray falls apart against the gate. The Warden doesn't move for a long time."),
  W("The Gatewarden", "YOUR WORDS WERE EXACT. THIS TIME."),
  W("{name}", "That's all I'm trying to do."),
  W("The Gatewarden", "I WILL NOT SAY YOU ARE FORGIVEN. I WILL SAY THE GATE IS OPEN.")
];

/* ====================================================================================
   Between the days
   ==================================================================================== */
S.night1 = [
  N("Mara's shop smells like lamp oil and wet wool. She hands you a bowl of something hot without looking at you."),
  W("Mara", "Eat. Then sleep. You look like you've been dug up."),
  W("{name}", "Thanks."),
  W("Mara", "Don't. It's soup, not forgiveness."),
  N("You eat in silence. Mara wipes the same part of the counter for a long time."),
  W("Mara", "What did you say? That night."),
  CH([
    { t: "Sever. I said sever.", do: function(s){ s.toldMara = true; trust(s, 2); }, then: [
      W("Mara", "Sever."),
      W("{name}", "I meant seal. I've gone over it every day. I meant seal."),
      W("Mara", "That's not the same thing, is it."),
      W("{name}", "No."),
      N("She nods, once. She doesn't say anything else, but she stops wiping the counter.")
    ] },
    { t: "I don't remember exactly.", do: function(s){ s.toldMara = false; }, then: [
      W("Mara", "You don't remember."),
      W("{name}", "It was a long shift."),
      W("Mara", "That's convenient."),
      N("She takes your bowl, though it isn't empty.")
    ] }
  ]),
  W("Mara", "There's a cot in the back. Level Four tomorrow. The lift line runs through there."),
  DO(function(s){ s.hub = "day2"; s.day = 2; })
];

S.day2_pell = [
  W("Pell", "{title} Calder! {name}! Can I call you {name}? I've read everything about the accident. Not in a weird way."),
  W("{name}", "That's the weirdest way anyone's said that."),
  W("Pell", "I want to be an Operator. I'm very good with doors. Gate Seven says I'm very good with doors."),
  W("{name}", "Gate Seven says nothing nice about anyone."),
  W("Pell", "That's how I know it's true.")
];
S.day2_alarm = [
  N("A boy runs across the square waving a slate."),
  W("Odo", "Pell's gone down Level Four. By himself. With a sandwich."),
  W("{name}", "Is the sandwich the plan?"),
  W("Odo", "He didn't seem to have a plan. I'd hurry.")
];

S.lift4_intro = [
  N("Rock has come down across the end of the tunnel. There's a voice behind it."),
  W("Pell", "Don't panic! I'm panicking, but you don't have to."),
  W("{name}", "Pell. Are you hurt?"),
  W("Pell", "Not yet! I told the lift to meet the winch and it won't. They're both just sitting there."),
  W("{name}", "Stay still. Whatever you do, don't touch anything."),
  W("Pell", "Okay. Is the sandwich touching?"),
  W("{name}", "Leave the sandwich.")
];
S.lift4_hit = [
  N("The ceiling shifts. A little more rock comes down."),
  W("Pell", "That was close! That was not close. That was actually on my foot.")
];
S.lift4_solved = {
  ok: [
    N("The lift groans, then rises smoothly. The rock settles. The gap in the wall widens enough for a boy to climb through."),
    W("Pell", "That was incredible. You barely missed anything."),
    W("{name}", "I missed a few."),
    W("Pell", "A few is barely.")
  ],
  hurt: [
    N("The lift rises, but not before a stone has caught Pell's leg. You get him out. He's pale and trying not to be."),
    W("Pell", "I'm fine. My leg isn't, but I am."),
    W("{name}", "I'm sorry. I should have been faster.")
  ],
  dead: [
    N("The lift starts, finally, and rises through a quiet that goes on too long."),
    N("There's nothing to say, so you don't say it. Pell does not answer. Pell does not answer for a long time."),
    W("{name}", "I said exactly what I meant. It was the wrong word. It was the wrong word again.")
  ]
};

S.office_intro = [
  N("The foreman's office is lined with shelves and smells of old paper. The desk is covered with ledgers. One of them is open.")
];
S.ledger = [
  N("It's the night book. The closing check has a line to itself, and the line is crossed out."),
  N("Beside it, in a hand you know: SKIPPED. Closing check can wait, it's been clean ten years. {name} can close up, I'm going home. H.G."),
  W("{name}", "Hobb."),
  N("You read it twice. The date is the night. The signature is his."),
  CH([
    { t: "Take it to the town.", do: function(s){ s.ledger = "shown"; trust(s, 1); }, then: [
      N("You tear the page out and fold it into your coat. It isn't the kind of thing that fits.")
    ] },
    { t: "Burn it.", do: function(s){ s.ledger = "burned"; }, then: [
      N("The lamp is right there. The page is thin. It takes about four seconds."),
      N("You stand there until the smoke goes away.")
    ] }
  ])
];

S.night2 = [
  N("The bell on the hall starts before you've sat down."),
  W("Odo", "Strays! They're coming up out of the lower levels, hundreds of them, and my best staffs are in a cart!"),
  W("{name}", "Where are they headed?"),
  W("Odo", "The town lamps and the evacuation line. Both. Obviously both."),
  IF(function(s){ return s.ledger === "shown"; }, [
    N("Garrick is on the hall steps. He looks at the folded page in your coat, then at you, and says nothing."),
    W("Garrick", "The guards stay on the hall tonight. I'm sure you understand.")
  ], [
    N("Garrick is on the hall steps, pale, giving orders in a steady voice."),
    W("Garrick", "Guards to the gate! {name}, you're an Operator. Go to the gate.")
  ]),
  DO(function(s, G){ s.ep = 3; G.startEpisode(3); })
];

S.nightgate_intro = [
  N("The strays are coming up the road in a long dark line. Behind you, the town lamps. In front of you, the people leaving Low Street with their children and their best chairs."),
  W("{name}", "I can't hold both for long. One of them gets the shield."),
  CH([
    { t: "Shield the town lamps.", do: function(s){ s.gate = "wards"; }, then: [
      N("If the lamps go dark, the strays walk right into town. You decide the lamps matter more.")
    ] },
    { t: "Shield the evacuation line.", do: function(s){ s.gate = "line"; }, then: [
      N("The lamps can burn out and be relit. People can't. You send the shield to the line.")
    ] }
  ])
];
S.nightgate_done = [
  N("The last stray breaks on the gate. The road is quiet. The bell stops, one swing at a time."),
  IF(function(s){ return s.evacLost; }, [
    N("Someone on the line didn't get out of the way in time. They're alive, but you hear them being carried."),
    W("Odo", "Nobody's dead. That counts. It's a low bar, but that counts.")
  ], [
    W("Odo", "Everyone's through. I counted. Twice.")
  ]),
  IF(function(s){ return s.wardsDark; }, [
    N("The town lamps are dark. Karrow is going to feel very large tonight.")
  ], []),
  DO(function(s){ s.hub = "day3"; s.day = 3; })
];

S.day3 = [
  N("You don't sleep. You sit on Mara's back step and watch the dawn come up gray."),
  W("Mara", "Today's the last day it matters."),
  W("{name}", "I know."),
  W("Mara", "I'm not coming with you."),
  W("{name}", "I wasn't going to ask you to."),
  W("Mara", "Good. Because I wanted to say I could, and then decide not to."),
  IF(function(s){ return s.mara >= 3; }, [
    W("Mara", "I'm still angry. I'll be angry when you come back. But I'd like you to come back."),
    W("{name}", "That's the nicest thing you've said to me."),
    W("Mara", "Don't get used to it.")
  ], [
    W("Mara", "Just do it properly. Properly. That's all I want from you.")
  ]),
  IF(function(s){ return s.pell === "dead"; }, [
    N("Mara's eyes go to the door Pell used to come through. She says nothing about it. Neither do you.")
  ], []),
  DO(function(s){ s.hub = "gate3"; })
];

/* ====================================================================================
   Level Nine
   ==================================================================================== */
S.nine_intro = [
  N("Level Nine is the deepest room in the mine. The water is at your knees, and rising."),
  N("There are four consoles, two lamps, and a long, quiet hum that has been going for three years."),
  W("{name}", "It's still running."),
  W("Gate Seven", "(through the wall, faint) It has been waiting for you to finish the sentence. Mind your grammar.")
];
S.nine_ward = [
  N("A small lamp sits in a niche by the wall, off to the side, behind the rubble. It's older than the rest. It's still faintly lit."),
  N("It crackles. A voice comes out of it."),
  W("Dess", "...{name}? If this is playing, someone's down here. Hi. Hi, I think it's you."),
  W("Dess", "Tell Mara the lamp oil's under the third shelf. She always checks the wrong one."),
  W("Dess", "And {name}. It's all right. It's a door. It's only ever a door. Say it properly and it'll do what you mean."),
  N("It crackles again. It stops."),
  W("{name}", "I meant seal, Dess. I meant seal.")
];
S.nine_final = [
  N("You write the last line down and press Enter. For a moment, nothing happens."),
  N("Then the hum, which has been in the walls for three years, drops half a note, and stops.")
];
S.nine_hit = [
  N("The water climbs another hand's breadth. The hum rises with it.")
];

/* ====================================================================================
   The practice lodge (optional). Old Tam keeps some old rooms on Low Street.
   ==================================================================================== */
S.p_trunk_intro = [
  N("Old Tam's lodge smells of boot polish and damp rope. The rooms run off a long corridor, and every one of them has something wrong with it on purpose."),
  N("In the first, two doors face each other across a cable, and neither moves."),
  W("Old Tam", "They're both very polite. Neither one will be the first to ask.")
];
S.p_trunk_solved = [
  W("Old Tam", "There. One of them asked. That's all it ever takes.")
];
S.p_vtp_intro = [
  N("One desk keeps the book of rooms. Another desk is supposed to copy it, and is copying nothing."),
  W("Old Tam", "Mind what you call things. It listens under the name you gave it, and not a letter off.")
];
S.p_vtp_solved = [
  W("Old Tam", "Now it copies. It'll copy anything, mind. Including mistakes. That's how I lost a whole winter.")
];
S.p_root_intro = [
  N("Three posts stand in a ring, joined by rope. One of them thinks it's in charge."),
  W("Old Tam", "A ring needs one post to take the weight. Right now it's the wrong one.")
];
S.p_root_solved = [
  W("Old Tam", "Keystone. Good. Sill took it badly, but Sill takes everything badly.")
];
S.p_guard_intro = [
  N("Four places where ordinary people plug in. Someone has already plugged in something that isn't a person."),
  W("Old Tam", "Don't ask what it is. Just make it stop.")
];
S.p_guard_solved = [
  W("Old Tam", "Caught. The port shut itself. Best kind of doorman, one that doesn't need asking.")
];
S.p_drill_intro = [
  W("Old Tam", "Last one. Don't think. Type.")
];
S.p_drill_done = [
  W("Old Tam", "Not bad. You've stopped moving your lips.")
];
S.lodge_leave = [
  W("Old Tam", "Come back when something needs breaking.")
];

/* ====================================================================================
   Endings. The state decides which one plays; see endingFor().
   ==================================================================================== */
S.end_redemption = [
  N("The hum stops. It's the quietest sound you've ever heard."),
  N("Level Nine drains slowly, then all at once. By morning there are seven names on the wall of the hall, and the seven people they belong to are above ground."),
  N("The town holds a hearing. You say what you said. The ledger says what it says. Garrick says very little."),
  W("Mara", "I still think you did it. I'm going to stop saying it, though."),
  W("{name}", "That's more than I asked for."),
  W("Mara", "I know. I'm working on being less generous."),
  N("You stay. They give you a slate, an actual one, with your name on it and no jokes about the spelling."),
  W("Gate Seven", "Welcome back. Your grammar is still terrible.")
];
S.end_quiet = [
  N("The hum stops. It's the quietest sound you've ever heard."),
  N("Level Nine drains slowly, then all at once. By morning the seven are above ground, and the town does what it can with that."),
  N("Nobody asks what the ledger said. You don't tell them. You keep the ash in a cup and, eventually, you wash the cup."),
  W("Mara", "You did it right this time."),
  W("{name}", "I did."),
  W("Mara", "I don't forgive you. I wanted to say it out loud so you'd stop waiting."),
  N("You stay anyway. The town tolerates you. Some of them nod. Garrick buys you a drink."),
  W("Gate Seven", "You look like someone who did something. I can't tell what. I'd say well done, but it's a lot of work to say.")
];
S.end_bittersweet = [
  N("The hum stops, late. You know it's late; you can feel how much of the level the water already took."),
  N("The seven come up, but so does the lower town, slowly, in pieces. People spend the winter in the hall."),
  W("Mara", "It's done."),
  W("{name}", "It's done. Not well."),
  W("Mara", "No. Not well."),
  N("She sits beside you on the step. It isn't forgiveness. It's two people who are too tired to be anywhere else."),
  W("Gate Seven", "I won't tell you it was fine. I'll tell you it was finished. That's a different word, and I'm very particular about it.")
];
S.end_heartbreak = [
  N("The order slips. It's a small slip, the kind that happens at the end of a long shift, and the water gets in under the door."),
  N("You hear footsteps on the stairs behind you. Quick ones."),
  W("Mara", "I said I wasn't coming. I lied. I didn't think you'd get it right."),
  W("{name}", "Mara, go back up. Please."),
  W("Mara", "She was my sister."),
  N("The water takes the lamp first. Then the stairs. You say a word, any word, the right word, but it's too late for the right word."),
  N("You come up alone."),
  W("Gate Seven", "...I don't have a joke. I'm sorry. I looked.")
];
S.end_exile = [
  N("The order slips. Then it slips again. The water gets under the door, and you stand in it, and you don't know what to say."),
  N("You run. It isn't a decision. Your legs just carry you up the stairs, through the gate, and past a Gate Seven who says nothing at all."),
  N("The lower town floods overnight. You hear about it from the ferryman, who still won't tie up, and who, this time, doesn't ask you to jump."),
  W("Ferryman", "Heard Karrow went under. Thought you'd want to hear it from somebody."),
  W("{name}", "Yes. Thank you."),
  W("Ferryman", "You look like you've been dug up."),
  N("It's what Mara said. You don't answer.")
];

/* ====================================================================================
   How the ending is chosen
   ==================================================================================== */
STORY.endingFor = function(s){
  var rating = s.finalRating;
  var pellDead = s.pell === "dead";
  var key;
  if(rating === "clean") key = s.ledger === "shown" && s.mara >= 3 && !pellDead ? "redemption" : "quiet";
  else if(rating === "rough") key = "bittersweet";
  else key = s.mara >= 3 ? "heartbreak" : "exile";
  if(rating === "clean" && s.ledger === "shown" && pellDead) key = "bittersweet";
  return key;
};

/* ====================================================================================
   People in town. What each says depends on how far along you are.
   ==================================================================================== */
STORY.npc.mara = function(s){
  if(s.hub === "gate") return [W("Mara", "Gate Seven's east, past the board. Don't make me walk you there.")];
  if(s.hub === "day2") return [W("Mara", "Pell's still not back from the shop run. If you see him, tell him he owes me a bucket.")];
  if(s.hub === "day3" || s.hub === "gate3") return [W("Mara", "Go on. I'll be here. Don't make a speech.")];
  return [W("Mara", "Soup's on the stove. Don't read into it.")];
};
STORY.npc.odo = function(s){
  return [W("Odo", "Staffs, tonics, regrets. I only sell the staffs and tonics."), { shop: 1 }];
};
STORY.npc.garrick = function(s){
  if(!s.metGarrick){
    return [
      DO(function(s){ s.metGarrick = true; }),
      W("Garrick", "{name} Calder. I was hoping that was you. You look terrible. Sit, sit."),
      W("{name}", "I'm fine standing."),
      W("Garrick", "We were all tired that night. That's really the whole story, you know. We were all so tired."),
      W("{name}", "Hobb. Did you hear me say it? The word."),
      W("Garrick", "I heard a lot of words. It's a mine. It's loud."),
      N("He smiles, as warm as anything. You realise he hasn't answered.")
    ];
  }
  if(s.ledger === "shown") return [W("Garrick", "I hope you know what you're doing, {name}.")];
  if(s.ledger === "burned") return [W("Garrick", "I always said you were a decent sort.")];
  return [W("Garrick", "Careful down there. I'd hate to lose another Operator.")];
};
STORY.npc.pell = function(s){
  if(s.hub === "day2") return STORY.scenes.day2_pell;
  if(s.hub === "day3" || s.hub === "gate3"){
    if(s.pell === "hurt") return [W("Pell", "I'm on a stool, so technically I'm still working. Good luck.")];
    if(s.pell === "dead") return [N("Pell's stool is still by the door. Nobody has moved it.")];
    return [W("Pell", "I made a list of everything I learned from you. It's three pages. Page two is mostly 'don't touch anything'.")];
  }
  return [W("Pell", "I'm going to be an Operator. I'm very good with doors. Gate Seven says I'm very good with doors.")];
};
STORY.npc.kid = function(){ return [W("Kid", "Are you the one who drowned the mine?"), W("{name}", "Only some of it."), W("Kid", "Cool.")]; };
STORY.npc.elder = function(s){
  if(!s.rooms.warden) return [W("Old Tam", "In my day, when we said seal, we meant seal."), W("{name}", "I'm aware."), W("Old Tam", "I'm saying it for the record.")];
  return [
    W("Old Tam", "You did all right down in the mine. I heard. Everyone heard. The walls talk."),
    IF(function(s){ return s.practiced; }, [
      W("Old Tam", "The lodge is open if you want another go.")
    ], [
      W("Old Tam", "I keep a lodge on Low Street with some old rooms nobody uses. Operators practice there. Mostly they break things.")
    ]),
    CH([
      { t: "Show me the rooms.", do: function(s, G){ s.practiced = true; G.startEpisode(5); } },
      { t: "Not now.", then: [W("Old Tam", "Suit yourself. They'll still be broken.")] }
    ])
  ];
};
STORY.npc.gate7 = function(s){
  if(s.hub === "gate") return STORY.scenes.gate7_meet;
  if(s.hub === "day2") return [W("Gate Seven", "Level Four. Pell's down there. Obviously."), DO(function(s, G){ s.ep = 2; G.startEpisode(2); })];
  if(s.hub === "gate3") return [W("Gate Seven", "Level Nine. This one's yours. Don't dawdle; I charge by the minute."), DO(function(s, G){ s.ep = 4; G.startEpisode(4); })];
  return [W("Gate Seven", "Not yet. Do you see anyone waiting? Go see them.")];
};
STORY.npc.board = function(s){
  var t = { gate: "Go to Gate Seven, east of the board.", day2: "Rest, then go to Gate Seven. Level Four.", day3: "Last day. Gate Seven. Level Nine.", gate3: "Gate Seven. Level Nine." }[s.hub] || "Nothing posted.";
  return [N("The board reads: " + t)];
};

/* Odo's shop. */
STORY.items = {
  tab: { name: "Tab Staff", price: 60, desc: "Finishes your words when you press Tab." },
  help: { name: "Question Staff", price: 45, desc: "Lets you ask for help with ?" },
  tonic: { name: "Tonic", price: 12, desc: "Heals you." }
};

})(typeof window !== "undefined" ? window : globalThis);
