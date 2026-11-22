import type { BotLevel, PieceKind, Seat } from '@asta/engine';
import type { ErrorCode, ShopKind } from '@asta/protocol';
import type { TutorialKey } from '../tutorial/steps';

export type Lang = 'en' | 'te';

/** One section of the "How to play" page. */
export interface RulesSection {
  title: string;
  body?: string;
  /** Show the shells-to-moves table after the body. */
  table?: boolean;
  note?: string;
  bullets?: string[];
}

/**
 * Every piece of text the app shows. Both languages implement this
 * interface, so a missing translation is a type error, not a blank label.
 */
export interface Strings {
  langName: string;
  appTitle: string;

  // Pieces, players, seats
  piece: Record<PieceKind, string>;
  colour: Record<Seat, string>;
  seat: Record<Seat, string>;
  you: string;
  computer: (n: number) => string;
  player: (n: number) => string;
  level: Record<'human' | BotLevel, string>;
  cpuTag: (level: BotLevel) => string;
  humanTag: string;
  team: (letter: string) => string;

  // Start screen
  continueTitle: string;
  homeCount: (n: number) => string;
  resumeSummary: (mode: string, turn: number, name: string) => string;
  teams: string;
  playersCount: (n: number) => string;
  continueGame: string;
  gameCard: string;
  individual: string;
  teams2v2: string;
  playersLabel: string;
  teamHint: (a: string, b: string, c: string, d: string) => string;
  playerNameA11y: (colour: string) => string;
  settings: string;
  replaceWarning: string;
  startNew: string;
  start: string;
  howToPlay: string;

  // Settings
  language: string;
  speedTitle: string;
  speedHint: string;
  speed: { slow: string; normal: string; fast: string };
  sound: string;
  soundHint: string;
  autoMove: string;
  autoMoveHint: string;
  markers: string;
  markersHint: string;
  done: string;
  closeSettings: string;

  // Game screen
  rules: string;
  gameOver: string;
  isPlaying: (name: string) => string;
  throwing: string;
  moving: string;
  keptThrowAgain: (kept: string) => string;
  throwPrompt: (name: string) => string;
  tapSquare: string;
  tapAgain: string;
  useOrKeep: (kept: string, many: boolean) => string;
  tapGlowing: string;
  countOpenHint: string;
  toUse: string;
  joinFours: string;
  keepThrow: (kept: string) => string;
  throwShells: string;
  won: (names: string) => string;
  winTeam: string;
  winSolo: string;
  playAgain: string;
  newSetup: string;
  undo: string;
  undoA11y: string;

  // What a throw allows
  open: (n: number) => string;
  noneOpenEight: string;
  allOpenEight: string;
  moveBy: (piece: string, n: number) => string;
  motherCantMove: string;
  childMayEnter: string;
  eightEntries: string;

  // Messages about what just happened
  startHint: string;
  welcomeBack: string;
  threw: (name: string, value: string) => string;
  throwKept: string;
  noMove: string;
  joined: string;
  pieceOf: (owner: string, piece: string, isYou: boolean) => string;
  captured: (label: string) => string;
  reachedHome: (label: string) => string;
  extraThrow: string;
  wonShort: (names: string) => string;

  // Accessibility labels
  pieceA11y: (colour: string, piece: string) => string;
  moveToA11y: (row: number, col: number) => string;
  shellsOpenA11y: (n: number) => string;
  shellsA11y: string;
  throwsToUseA11y: string;

  // Guided first game
  tutorial: Record<TutorialKey, string>;
  tutorialTitle: string;
  tutorialStepOf: (n: number, total: number) => string;
  tutorialNext: string;
  tutorialSkip: string;
  keepPlaying: string;
  backToStart: string;
  learnTitle: string;
  learnHint: string;
  learnButton: string;

  // Online
  playOnline: string;
  playOnlineHint: string;
  yourName: string;
  nameNeeded: string;
  createRoom: string;
  createRoomHint: string;
  create: string;
  joinRoom: string;
  joinRoomHint: string;
  join: string;
  connecting: string;
  reconnecting: string;
  roomCode: string;
  shareCode: string;
  shareMessage: (code: string) => string;
  openSeat: string;
  addComputer: string;
  removeComputer: string;
  hostBadge: string;
  youBadge: string;
  offline: string;
  awayTag: string;
  startNeedsSeats: string;
  waitingForHost: string;
  leaveRoom: string;
  leaveGame: string;
  leaveGameHint: string;
  rejoinTitle: string;
  rejoinHint: (code: string) => string;
  rejoin: string;
  /** Online: the prompt when it becomes this player's turn. */
  yourTurn: string;

  // Start screen tiles and menus
  modeOnline: string;
  modeOnlineSub: string;
  modeComputer: string;
  modeComputerSub: string;
  modePassPlay: string;
  modePassPlaySub: string;
  modeLearn: string;
  modeLearnSub: string;
  newBadge: string;
  close: string;
  back: string;
  difficulty: string;
  /** Small top-bar button to bring back a saved game after its popup was closed. */
  continuePill: string;

  // Profile
  profileTitle: string;
  profileA11y: (name: string) => string;
  guestAccount: string;
  guestHint: string;
  statsOnlineGames: string;
  statsWins: string;
  statsWinRate: string;
  save: string;
  saved: string;
  saveFailed: string;
  accountOffline: string;
  signInGoogle: string;
  googleUnavailable: string;
  signedInAs: (email: string | null) => string;
  signOut: string;
  signOutHint: string;
  signInUpgraded: string;
  signInExisting: string;
  signInFailed: string;
  deleteAccount: string;
  deleteTitle: string;
  deleteBody: string;
  deleteConfirm: string;
  cancel: string;
  deleted: string;
  deleteFailed: string;

  // Shop
  shop: string;
  shopKinds: Record<ShopKind, string>;
  shopItems: Record<string, { name: string; hint: string }>;
  shopFree: string;
  shopOwned: string;
  shopInUse: string;
  shopUse: string;
  shopBuyTitle: (name: string) => string;
  shopBuyBody: (price: string, left: string) => string;
  shopBuy: string;
  shopNeedMore: (n: string) => string;
  shopFailed: string;
  shopBought: (name: string) => string;

  // Coins
  coins: string;
  coinsA11y: (n: number) => string;
  dailyTitle: string;
  dailyStreak: (day: number) => string;
  dailyCollect: string;
  dailyNext: (amount: number) => string;
  howToEarn: string;
  earnDaily: (min: number, max: number) => string;
  earnWin: (base: number, perFriend: number) => string;
  earnPlayed: (n: number) => string;
  coinsNote: string;
  rewardEarned: (n: number) => string;
  onlineError: Record<ErrorCode | 'network', string>;

  // How to play
  rulesTitle: string;
  tableHead: [string, string, string, string];
  rulesSections: RulesSection[];
}

const en: Strings = {
  langName: 'English',
  appTitle: 'Asta Chemma',

  piece: { mother: 'Mother', child: 'Child' },
  colour: { 0: 'Yellow', 1: 'Red', 2: 'Blue', 3: 'Green' },
  seat: { 0: 'Bottom', 1: 'Right', 2: 'Top', 3: 'Left' },
  you: 'You',
  computer: (n) => `Computer ${n}`,
  player: (n) => `Player ${n}`,
  level: { human: 'Human', easy: 'Easy', medium: 'Medium', hard: 'Hard' },
  cpuTag: (level) => `CPU ${en.level[level].toLowerCase()}`,
  humanTag: 'Human',
  team: (letter) => `Team ${letter}`,

  continueTitle: 'Continue your game',
  homeCount: (n) => `${n}/3 home`,
  resumeSummary: (mode, turn, name) => `${mode} · turn ${turn} · ${name} to play`,
  teams: 'Teams',
  playersCount: (n) => `${n} players`,
  continueGame: 'Continue game',
  gameCard: 'Game',
  individual: 'Individual',
  teams2v2: 'Teams (2 v 2)',
  playersLabel: 'Players',
  teamHint: (a, b, c, d) =>
    `Opposite players are partners: ${a} & ${b} against ${c} & ${d}. A team wins when both partners have all pieces home.`,
  playerNameA11y: (colour) => `${colour} player name`,
  settings: 'Settings',
  replaceWarning: 'Starting a new game replaces your saved game.',
  startNew: 'Start a new game',
  start: 'Start game',
  howToPlay: 'How to play',

  language: 'Language',
  speedTitle: 'Game speed',
  speedHint: 'How fast shells roll, pieces walk and the computer plays.',
  speed: { slow: 'Slow', normal: 'Normal', fast: 'Fast' },
  sound: 'Sound',
  soundHint: 'Shells, steps, captures and celebrations.',
  autoMove: 'Auto-move',
  autoMoveHint: 'Move for you when a throw allows only one choice.',
  markers: 'Shape markers',
  markersHint: 'Adds a shape to each player’s pieces (▲ ■ ✚ ◆), so players can be told apart without relying on colour.',
  done: 'Done',
  closeSettings: 'Close settings',

  rules: 'Rules',
  gameOver: 'Game over',
  isPlaying: (name) => `${name} is playing…`,
  throwing: 'Throwing…',
  moving: 'Moving…',
  keptThrowAgain: (kept) => `Your ${kept} kept – throw again`,
  throwPrompt: (name) => `${name}, throw the shells`,
  tapSquare: 'Tap a highlighted square to move',
  tapAgain: 'Tap the piece again or its square to move',
  useOrKeep: (kept, many) => `Use the ${kept} now, or keep ${many ? 'them' : 'it'} and throw again`,
  tapGlowing: 'Tap a glowing piece',
  countOpenHint: 'Five cowries: count the open ones',
  toUse: 'To use:',
  joinFours: 'Join 4 + 4 · Release Mother',
  keepThrow: (kept) => `Keep ${kept} · Throw again`,
  throwShells: 'Throw shells',
  won: (names) => `${names} won!`,
  winTeam: 'Both partners brought all their pieces home.',
  winSolo: 'All three pieces are home.',
  playAgain: 'Play again',
  newSetup: 'New game setup',
  undo: 'Undo',
  undoA11y: 'Undo your last move',

  open: (n) => `${n} open`,
  noneOpenEight: 'None open = 8',
  allOpenEight: '5 open = 8',
  moveBy: (piece, n) => `${piece} ${n}`,
  motherCantMove: "Mother can't move",
  childMayEnter: 'Child may enter',
  eightEntries: 'Child enters +4 · Mother enters',

  startHint: 'Throw the shells to begin',
  welcomeBack: 'Welcome back',
  threw: (name, value) => `${name} threw ${value}`,
  throwKept: 'Throw kept',
  noMove: 'No piece can move',
  joined: '4 + 4 joined: Mother released',
  pieceOf: (owner, piece, isYou) => (isYou ? `your ${piece}` : `${owner}'s ${piece}`),
  captured: (label) => `Captured ${label}!`,
  reachedHome: (label) => `${label.charAt(0).toUpperCase()}${label.slice(1)} reached home`,
  extraThrow: 'Extra throw',
  wonShort: (names) => `${names} won!`,

  pieceA11y: (colour, piece) => `${colour} ${piece}`,
  moveToA11y: (row, col) => `Move to row ${row}, column ${col}`,
  shellsOpenA11y: (n) => `${n} shells open`,
  shellsA11y: 'Cowrie shells',
  throwsToUseA11y: 'Throws to use',

  tutorial: {
    welcome: 'Welcome! This short guided game shows how Asta Chemma works as you play. You are yellow, at the bottom.',
    pieces: 'Your three pieces wait in your yellow starting area: one Mother (the marble with the white ring) and two Children.',
    route:
      'Pieces come in on the X in the middle of your side, go round the outer ring following the arrows, then round the inner ring, and finish on the lotus in the centre.',
    throwFirst: 'Tap “Throw shells”. You count how many of the five cowries land open.',
    enterChild: '4 open! On a 4, a Child can come onto the board. Tap a glowing Child, then tap it again to bring it in.',
    throwAgain: 'A 4 always earns another throw. Throw again.',
    keep: 'Another 4. You don’t have to use it now – tap “Keep 4 · Throw again”.',
    join: '4 + 4! Two kept 4s can join into an 8, but only to release the Mother. Tap “Join 4 + 4”.',
    throwThree: 'Your Mother is out! The 4 still earns you another throw. Throw.',
    moveChild: '3 open: your Child moves 3. The Mother can’t move on a 1 or a 3. Tap the glowing Child twice.',
    computer: 'A 1, 2 or 3 ends your turn. Watch the computer play…',
    throwEight: 'The computer’s Child has stopped near yours. Throw!',
    capture: 'All five open counts as 8! Your Child can move 8 and land on their Child – that captures it. Tap your glowing Child twice.',
    safe: 'Captured! Their Child goes back to start. Only a Child captures a Child, and only a Mother a Mother. Nobody can be captured on an X, and two pieces never share a plain square.',
    finish:
      'That’s the game: bring all three pieces to the lotus, with the exact count, before anyone else. Keep playing this game, or go back and start your own.',
  },
  tutorialTitle: 'Guided game',
  tutorialStepOf: (n, total) => `${n} / ${total}`,
  tutorialNext: 'Next',
  tutorialSkip: 'Skip',
  keepPlaying: 'Keep playing',
  backToStart: 'Back to start',
  learnTitle: 'New to Asta Chemma?',
  learnHint: 'Play a short guided game that teaches the rules as you go.',
  learnButton: 'Play the guided game',

  playOnline: 'Play online',
  playOnlineHint: 'Play with friends on their own phones, using a room code.',
  yourName: 'Your name',
  nameNeeded: 'Enter your name first.',
  createRoom: 'Create a room',
  createRoomHint: 'You get a code to share with friends.',
  create: 'Create room',
  joinRoom: 'Join a room',
  joinRoomHint: 'Enter the 4-character code a friend shared.',
  join: 'Join',
  connecting: 'Connecting…',
  reconnecting: 'Connection lost – reconnecting…',
  roomCode: 'Room code',
  shareCode: 'Share code',
  shareMessage: (code) => `Join my Asta Chemma game! Open the app, tap “Play online”, and enter the room code ${code}`,
  openSeat: 'Waiting for a player…',
  addComputer: 'Add computer',
  removeComputer: 'Remove',
  hostBadge: 'Host',
  youBadge: 'You',
  offline: 'offline',
  awayTag: 'away · computer playing',
  startNeedsSeats: 'Fill every seat with a friend or the computer to start.',
  waitingForHost: 'Waiting for the host to start…',
  leaveRoom: 'Leave room',
  leaveGame: 'Leave game',
  leaveGameHint: 'The computer will take your seat for the others.',
  rejoinTitle: 'Your online game',
  rejoinHint: (code) => `Room ${code}`,
  rejoin: 'Rejoin',
  yourTurn: 'Your turn – throw the shells',
  modeOnline: 'Play Online',
  modeOnlineSub: 'Friends anywhere',
  modeComputer: 'vs Computer',
  modeComputerSub: 'Easy, medium or hard',
  modePassPlay: 'Pass & Play',
  modePassPlaySub: 'Friends on this phone',
  modeLearn: 'Learn',
  modeLearnSub: 'A guided first game',
  newBadge: 'NEW',
  close: 'Close',
  back: 'Back',
  difficulty: 'Difficulty',
  continuePill: 'Continue',
  profileTitle: 'Profile',
  profileA11y: (name) => `Your profile: ${name}`,
  guestAccount: 'Guest account',
  guestHint: 'Sign in to keep your coins and stats if you change or lose your phone.',
  statsOnlineGames: 'Online games',
  statsWins: 'Wins',
  statsWinRate: 'Win rate',
  save: 'Save',
  saved: 'Saved',
  saveFailed: 'Couldn’t save – check your internet connection.',
  accountOffline: 'Can’t reach the server – showing your last known stats.',
  signInGoogle: 'Sign in with Google',
  googleUnavailable: 'Google sign-in works in the installed app.',
  signedInAs: (email) => (email ? `Signed in with Google · ${email}` : 'Signed in with Google'),
  signOut: 'Sign out',
  signOutHint: 'Signing out starts a new guest account on this phone. Sign in again any time to get your account back.',
  signInUpgraded: 'You’re signed in – your coins and stats are now kept with your Google account.',
  signInExisting: 'Welcome back! Your account is loaded.',
  signInFailed: 'Couldn’t sign in with Google. Please try again.',
  deleteAccount: 'Delete account',
  deleteTitle: 'Delete your account?',
  deleteBody:
    'This permanently deletes your account, name, coins and online stats, and unlinks Google. It can’t be undone. Games saved on this phone stay.',
  deleteConfirm: 'Delete my account',
  cancel: 'Cancel',
  deleted: 'Your account was deleted. You’re now playing as a new guest.',
  deleteFailed: 'Couldn’t delete the account – check your internet connection and try again.',
  shop: 'Shop',
  shopKinds: { board: 'Boards', marbles: 'Marbles', shells: 'Cowries' },
  shopItems: {
    'board.classic': { name: 'Classic', hint: 'Wood and green tiles' },
    'board.night': { name: 'Night', hint: 'Slate and silver' },
    'board.festive': { name: 'Festive', hint: 'Red lacquer and rangoli' },
    'marbles.glass': { name: 'Glass', hint: 'Clear and bright' },
    'marbles.pearl': { name: 'Pearl', hint: 'Soft and lustrous' },
    'marbles.metal': { name: 'Metal', hint: 'Polished shine' },
    'shells.natural': { name: 'Natural', hint: 'As found on the shore' },
    'shells.golden': { name: 'Golden', hint: 'Gilded cowries' },
    'shells.painted': { name: 'Painted', hint: 'Festive dots' },
  },
  shopFree: 'Free',
  shopOwned: 'Owned',
  shopInUse: 'In use',
  shopUse: 'Use',
  shopBuyTitle: (name) => `Buy ${name}?`,
  shopBuyBody: (price, left) => `It costs ${price} coins. You’ll have ${left} left. It’s yours to keep.`,
  shopBuy: 'Buy',
  shopNeedMore: (n) => `${n} more coins needed`,
  shopFailed: 'Couldn’t reach the shop – check your internet connection.',
  shopBought: (name) => `${name} is yours!`,
  coins: 'Coins',
  coinsA11y: (n) => `${n.toLocaleString('en-IN')} coins`,
  dailyTitle: 'Daily bonus',
  dailyStreak: (day) => (day <= 1 ? 'Day 1 – come back tomorrow for more' : `Day ${day} in a row!`),
  dailyCollect: 'Collect',
  dailyNext: (amount) => `Come back tomorrow for ${amount}`,
  howToEarn: 'How to earn coins',
  earnDaily: (min, max) => `Daily bonus: ${min}–${max} (grows each day in a row)`,
  earnWin: (base, perFriend) => `Win online: ${base}, plus ${perFriend} for each friend you beat`,
  earnPlayed: (n) => `Finish an online game: ${n}`,
  coinsNote: 'Coins are just for fun – they can’t be bought, sold or exchanged for money.',
  rewardEarned: (n) => `+${n} coins`,
  onlineError: {
    'bad-message': 'Something went wrong. Please try again.',
    version: 'Please update the app to play online.',
    'no-room': 'No room with that code. Check it and try again.',
    'room-full': 'That room is full.',
    'already-started': 'That game has already started.',
    'not-in-room': 'You are no longer in that room.',
    'not-host': 'Only the host can do that.',
    'not-ready': 'Fill every seat first.',
    'not-your-turn': 'It’s not your turn.',
    illegal: 'That isn’t allowed right now.',
    'bad-token': 'Couldn’t rejoin – that game may have ended.',
    network: 'Couldn’t reach the game server. Check your internet connection.',
  },

  rulesTitle: 'How to play',
  tableHead: ['Open', 'Score', 'Child', 'Mother'],
  rulesSections: [
    {
      title: 'Goal',
      body: 'Bring all three of your pieces – one Mother and two Children – to the centre square. The first player to do so wins. In team mode, opposite players are partners and win when both have all pieces home.',
    },
    {
      title: 'Throwing the shells',
      body: 'Throw five cowries and count how many land open.',
      table: true,
      note: 'All five open or none open both count as 8. The Mother cannot move on 1 or 3.',
    },
    {
      title: 'Entering the board',
      bullets: [
        'A Child enters on a 4 (onto your X square), or on an 8 and then moves 4 more steps.',
        'The Mother enters only on an 8, onto your X square, with no extra steps.',
        'You choose which waiting piece enters.',
      ],
    },
    {
      title: 'Keeping a 4 or 8 (4 + 4 = 8)',
      bullets: [
        'When you throw a 4 or an 8 you may use it straight away, or keep it and throw again.',
        'Then use the kept throw and the new one separately, in any order – for example move a Child out of the way first, then the Mother.',
        'If you kept a 4 and throw another 4, you may join them into one 8 – only to release your Mother. Only two 4s join; nothing else combines.',
        'A kept throw that still cannot be used when your throws run out is lost.',
      ],
    },
    {
      title: 'The route',
      bullets: [
        'Start on the X in the middle of your side.',
        'Go counter-clockwise round the outer ring, then clockwise round the inner ring, then into the centre.',
        'It is 24 steps from your X to home, and you need the exact count to finish.',
      ],
    },
    {
      title: 'Turns',
      bullets: [
        'A 4 or an 8 gives you another throw.',
        'Bringing a piece home also gives you another throw.',
        'If no piece can move, the turn is simply lost.',
      ],
    },
    {
      title: 'Capturing and safe squares',
      bullets: [
        'Captures are like for like: only a Child captures a Child, and only a Mother captures a Mother.',
        'Land on an opponent piece of the same kind to send it back to its starting area. Every such piece on that square goes back.',
        'No two pieces ever share a plain square – not even your own. You can land there only by capturing what is there.',
        'So you cannot land on your own piece, your partner’s, or an opponent of the other kind on a plain square.',
        'X squares and home can hold any number of pieces, yours and opponents’, and nobody can be captured there.',
        'A captured piece re-enters by the normal rules: a Child on a 4 or 8, the Mother only on an 8.',
      ],
    },
    {
      title: 'Teams',
      bullets: ['Once you have all your pieces home, you use your throws to move your partner’s pieces.'],
    },
    {
      title: 'Playing in the app',
      bullets: [
        'Tap a glowing piece to see where it will land, then tap it again (or the highlighted square) to move.',
        'After a 4 or 8, use “Keep · Throw again” to hold it; “Join 4 + 4” appears when you can release the Mother.',
        'The Mother is the marble with the white ring.',
      ],
    },
  ],
};

const te: Strings = {
  langName: 'తెలుగు',
  appTitle: 'అష్ట చెమ్మ',

  piece: { mother: 'తల్లి', child: 'పిల్ల' },
  colour: { 0: 'పసుపు', 1: 'ఎరుపు', 2: 'నీలం', 3: 'ఆకుపచ్చ' },
  seat: { 0: 'కింద', 1: 'కుడి', 2: 'పైన', 3: 'ఎడమ' },
  you: 'మీరు',
  computer: (n) => `కంప్యూటర్ ${n}`,
  player: (n) => `ఆటగాడు ${n}`,
  level: { human: 'మనిషి', easy: 'సులభం', medium: 'మధ్యస్థం', hard: 'కష్టం' },
  cpuTag: (level) => `CPU · ${te.level[level]}`,
  humanTag: 'మనిషి',
  team: (letter) => `జట్టు ${letter}`,

  continueTitle: 'మీ ఆటను కొనసాగించండి',
  homeCount: (n) => `${n}/3 ఇంటికి`,
  resumeSummary: (mode, turn, name) => `${mode} · ${turn}వ వంతు · ${name} ఆడాలి`,
  teams: 'జట్లు',
  playersCount: (n) => `${n} ఆటగాళ్లు`,
  continueGame: 'ఆట కొనసాగించండి',
  gameCard: 'ఆట',
  individual: 'వ్యక్తిగతం',
  teams2v2: 'జట్లు (2 vs 2)',
  playersLabel: 'ఆటగాళ్లు',
  teamHint: (a, b, c, d) =>
    `ఎదురెదురుగా కూర్చున్నవారు భాగస్వాములు: ${a} & ${b}, ${c} & ${d} తో ఆడతారు. ఇద్దరి కాయలన్నీ ఇంటికి చేరితే ఆ జట్టు గెలుస్తుంది.`,
  playerNameA11y: (colour) => `${colour} ఆటగాడి పేరు`,
  settings: 'సెట్టింగ్‌లు',
  replaceWarning: 'కొత్త ఆట మొదలుపెడితే సేవ్ చేసిన ఆట పోతుంది.',
  startNew: 'కొత్త ఆట మొదలుపెట్టండి',
  start: 'ఆట మొదలుపెట్టండి',
  howToPlay: 'ఎలా ఆడాలి',

  language: 'భాష',
  speedTitle: 'ఆట వేగం',
  speedHint: 'గవ్వలు దొర్లే, కాయలు కదిలే, కంప్యూటర్ ఆడే వేగం.',
  speed: { slow: 'నెమ్మది', normal: 'మామూలు', fast: 'వేగం' },
  sound: 'శబ్దం',
  soundHint: 'గవ్వలు, అడుగులు, కొట్టడాలు, సంబరాలు.',
  autoMove: 'ఆటో కదలిక',
  autoMoveHint: 'ఒకే దారి ఉన్నప్పుడు కాయను మీ బదులు కదుపుతుంది.',
  markers: 'ఆకార గుర్తులు',
  markersHint: 'ప్రతి ఆటగాడి కాయలపై ఒక ఆకారం (▲ ■ ✚ ◆) చూపిస్తుంది – రంగులు గుర్తించడం కష్టమైనవారికి సహాయం.',
  done: 'సరే',
  closeSettings: 'సెట్టింగ్‌లు మూసివేయండి',

  rules: 'నియమాలు',
  gameOver: 'ఆట ముగిసింది',
  isPlaying: (name) => `${name} ఆడుతున్నారు…`,
  throwing: 'వేస్తున్నారు…',
  moving: 'కదులుతోంది…',
  keptThrowAgain: (kept) => `మీ ${kept} ఉంచారు – మళ్ళీ వేయండి`,
  throwPrompt: (name) => `${name}, గవ్వలు వేయండి`,
  tapSquare: 'కదపడానికి వెలుగుతున్న గడిని నొక్కండి',
  tapAgain: 'కదపడానికి కాయను మళ్ళీ, లేదా దాని గడిని నొక్కండి',
  useOrKeep: (kept) => `${kept} ఇప్పుడే వాడండి, లేదా ఉంచుకుని మళ్ళీ వేయండి`,
  tapGlowing: 'మెరుస్తున్న కాయను నొక్కండి',
  countOpenHint: 'ఐదు గవ్వలు: తెరుచుకున్నవి లెక్కించండి',
  toUse: 'వాడాల్సినవి:',
  joinFours: '4 + 4 కలపండి · తల్లిని దించండి',
  keepThrow: (kept) => `${kept} ఉంచండి · మళ్ళీ వేయండి`,
  throwShells: 'గవ్వలు వేయండి',
  won: (names) => `${names} గెలిచారు!`,
  winTeam: 'ఇద్దరు భాగస్వాముల కాయలన్నీ ఇంటికి చేరాయి.',
  winSolo: 'మూడు కాయలూ ఇంటికి చేరాయి.',
  playAgain: 'మళ్ళీ ఆడండి',
  newSetup: 'కొత్త ఆట ఏర్పాటు',
  undo: 'వెనక్కి',
  undoA11y: 'మీ చివరి కదలికను వెనక్కి తీసుకోండి',

  open: (n) => `${n} తెరుచుకున్నాయి`,
  noneOpenEight: 'ఒక్కటీ తెరవలేదు = 8',
  allOpenEight: 'ఐదూ తెరుచుకున్నాయి = 8',
  moveBy: (piece, n) => `${piece} ${n}`,
  motherCantMove: 'తల్లి కదలదు',
  childMayEnter: 'పిల్ల దిగవచ్చు',
  eightEntries: 'పిల్ల దిగి +4 · తల్లి దిగుతుంది',

  startHint: 'మొదలుపెట్టడానికి గవ్వలు వేయండి',
  welcomeBack: 'మళ్ళీ స్వాగతం',
  threw: (name, value) => `${name} ${value} వేశారు`,
  throwKept: 'వేటు ఉంచారు',
  noMove: 'ఏ కాయా కదలదు',
  joined: '4 + 4 కలిసింది: తల్లి దిగింది',
  pieceOf: (owner, piece, isYou) => (isYou ? `మీ ${piece}` : `${owner} ${piece}`),
  captured: (label) => `${label}ను కొట్టారు!`,
  reachedHome: (label) => `${label} ఇంటికి చేరింది`,
  extraThrow: 'మరో వేటు',
  wonShort: (names) => `${names} గెలిచారు!`,

  pieceA11y: (colour, piece) => `${colour} ${piece}`,
  moveToA11y: (row, col) => `${row}వ వరుస, ${col}వ నిలువు గడికి కదపండి`,
  shellsOpenA11y: (n) => `${n} గవ్వలు తెరుచుకున్నాయి`,
  shellsA11y: 'గవ్వలు',
  throwsToUseA11y: 'వాడాల్సిన వేట్లు',

  tutorial: {
    welcome: 'స్వాగతం! ఈ చిన్న గైడెడ్ ఆట, ఆడుతూనే అష్ట చెమ్మ ఎలా ఆడాలో చూపిస్తుంది. మీరు పసుపు రంగు, కింద వైపు.',
    pieces: 'మీ మూడు కాయలు పసుపు రంగు ప్రారంభ స్థానంలో ఉన్నాయి: ఒక తల్లి (తెల్లని ఉంగరం ఉన్న గోళీ), రెండు పిల్లలు.',
    route:
      'కాయలు మీ వైపు మధ్యలో ఉన్న X గడిలో దిగి, బాణాల దిశలో బయటి వరుస చుట్టూ, తర్వాత లోపలి వరుస చుట్టూ తిరిగి, మధ్యలోని పద్మం దగ్గర ఇంటికి చేరతాయి.',
    throwFirst: '“గవ్వలు వేయండి” నొక్కండి. ఐదు గవ్వల్లో ఎన్ని తెరుచుకుని పడ్డాయో లెక్కిస్తారు.',
    enterChild: '4 తెరుచుకున్నాయి! 4 పడితే పిల్ల బోర్డు మీదకు దిగవచ్చు. మెరుస్తున్న పిల్లను నొక్కి, మళ్ళీ నొక్కండి.',
    throwAgain: '4 పడితే ఎప్పుడూ మరో వేటు వస్తుంది. మళ్ళీ వేయండి.',
    keep: 'మళ్ళీ 4. దాన్ని ఇప్పుడే వాడనవసరం లేదు – “4 ఉంచండి · మళ్ళీ వేయండి” నొక్కండి.',
    join: '4 + 4! ఉంచుకున్న రెండు 4లను కలిపి 8 చేయవచ్చు – తల్లిని దించడానికి మాత్రమే. “4 + 4 కలపండి” నొక్కండి.',
    throwThree: 'తల్లి దిగింది! ఆ 4 వల్ల మీకు ఇంకో వేటు ఉంది. వేయండి.',
    moveChild: '3 తెరుచుకున్నాయి: మీ పిల్ల 3 అడుగులు కదులుతుంది. 1 లేదా 3 పడితే తల్లి కదలదు. మెరుస్తున్న పిల్లను రెండుసార్లు నొక్కండి.',
    computer: '1, 2 లేదా 3 పడితే మీ వంతు ముగుస్తుంది. కంప్యూటర్ ఆడటం చూడండి…',
    throwEight: 'కంప్యూటర్ పిల్ల మీ పిల్లకు దగ్గరలో ఆగింది. వేయండి!',
    capture: 'ఐదూ తెరుచుకుంటే 8! మీ పిల్ల 8 అడుగులు కదిలి వారి పిల్ల మీద దిగుతుంది – దాన్ని కొడుతుంది. మెరుస్తున్న పిల్లను రెండుసార్లు నొక్కండి.',
    safe: 'కొట్టారు! వారి పిల్ల మొదటికి వెళ్ళింది. పిల్ల పిల్లను, తల్లి తల్లిని మాత్రమే కొట్టగలవు. X గడిలో ఎవరినీ కొట్టలేరు, సాధారణ గడిలో రెండు కాయలు ఎప్పుడూ కలిసి ఉండవు.',
    finish:
      'ఇదే ఆట: మీ మూడు కాయలనూ సరిగ్గా సరిపడే సంఖ్యతో అందరికంటే ముందు పద్మం దగ్గరకు చేర్చండి. ఈ ఆటను కొనసాగించండి, లేదా వెనక్కి వెళ్ళి మీ సొంత ఆట మొదలుపెట్టండి.',
  },
  tutorialTitle: 'గైడెడ్ ఆట',
  tutorialStepOf: (n, total) => `${n} / ${total}`,
  tutorialNext: 'తర్వాత',
  tutorialSkip: 'వదిలేయండి',
  keepPlaying: 'ఆట కొనసాగించండి',
  backToStart: 'మొదటి పేజీకి',
  learnTitle: 'అష్ట చెమ్మ కొత్తా?',
  learnHint: 'ఆడుతూనే నియమాలు నేర్పే చిన్న గైడెడ్ ఆట ఆడండి.',
  learnButton: 'గైడెడ్ ఆట ఆడండి',

  playOnline: 'ఆన్‌లైన్‌లో ఆడండి',
  playOnlineHint: 'గది కోడ్‌తో స్నేహితులు వారి ఫోన్లలోనే మీతో ఆడవచ్చు.',
  yourName: 'మీ పేరు',
  nameNeeded: 'ముందు మీ పేరు ఇవ్వండి.',
  createRoom: 'గది సృష్టించండి',
  createRoomHint: 'స్నేహితులకు పంపడానికి ఒక కోడ్ వస్తుంది.',
  create: 'గది సృష్టించండి',
  joinRoom: 'గదిలో చేరండి',
  joinRoomHint: 'స్నేహితుడు పంపిన 4 అక్షరాల కోడ్ ఇవ్వండి.',
  join: 'చేరండి',
  connecting: 'కనెక్ట్ అవుతోంది…',
  reconnecting: 'కనెక్షన్ పోయింది – మళ్ళీ కలుపుతోంది…',
  roomCode: 'గది కోడ్',
  shareCode: 'కోడ్ పంపండి',
  shareMessage: (code) => `నా అష్ట చెమ్మ ఆటలో చేరండి! యాప్ తెరిచి, “ఆన్‌లైన్‌లో ఆడండి” నొక్కి, ఈ గది కోడ్ ఇవ్వండి: ${code}`,
  openSeat: 'ఆటగాడి కోసం ఎదురుచూస్తోంది…',
  addComputer: 'కంప్యూటర్ చేర్చండి',
  removeComputer: 'తీసేయండి',
  hostBadge: 'హోస్ట్',
  youBadge: 'మీరు',
  offline: 'ఆఫ్‌లైన్',
  awayTag: 'దూరంగా · కంప్యూటర్ ఆడుతోంది',
  startNeedsSeats: 'ప్రతి స్థానాన్ని స్నేహితుడితో లేదా కంప్యూటర్‌తో నింపితే ఆట మొదలుపెట్టవచ్చు.',
  waitingForHost: 'హోస్ట్ ఆట మొదలుపెట్టే వరకు ఎదురుచూడండి…',
  leaveRoom: 'గది నుండి వెళ్ళండి',
  leaveGame: 'ఆట నుండి వెళ్ళండి',
  leaveGameHint: 'మిగతావారి కోసం మీ స్థానంలో కంప్యూటర్ ఆడుతుంది.',
  rejoinTitle: 'మీ ఆన్‌లైన్ ఆట',
  rejoinHint: (code) => `గది ${code}`,
  rejoin: 'మళ్ళీ చేరండి',
  yourTurn: 'మీ వంతు – గవ్వలు వేయండి',
  modeOnline: 'ఆన్‌లైన్ ఆట',
  modeOnlineSub: 'దూరపు స్నేహితులతో',
  modeComputer: 'కంప్యూటర్‌తో',
  modeComputerSub: 'సులువు, మధ్యస్థం, కష్టం',
  modePassPlay: 'ఒకే ఫోన్‌లో',
  modePassPlaySub: 'స్నేహితులతో కలిసి',
  modeLearn: 'నేర్చుకోండి',
  modeLearnSub: 'గైడెడ్ మొదటి ఆట',
  newBadge: 'కొత్త',
  close: 'మూసివేయి',
  back: 'వెనక్కి',
  difficulty: 'కష్టం స్థాయి',
  continuePill: 'కొనసాగించు',
  profileTitle: 'ప్రొఫైల్',
  profileA11y: (name) => `మీ ప్రొఫైల్: ${name}`,
  guestAccount: 'అతిథి ఖాతా',
  guestHint: 'ఫోన్ మార్చినా, పోయినా మీ నాణేలు, వివరాలు ఉండేలా సైన్ ఇన్ చేయండి.',
  statsOnlineGames: 'ఆన్‌లైన్ ఆటలు',
  statsWins: 'గెలుపులు',
  statsWinRate: 'గెలుపు శాతం',
  save: 'సేవ్ చేయండి',
  saved: 'సేవ్ అయింది',
  saveFailed: 'సేవ్ కాలేదు – ఇంటర్నెట్ కనెక్షన్ చూడండి.',
  accountOffline: 'సర్వర్ అందుబాటులో లేదు – చివరిగా తెలిసిన వివరాలు చూపిస్తున్నాం.',
  signInGoogle: 'Google తో సైన్ ఇన్ చేయండి',
  googleUnavailable: 'Google సైన్ ఇన్ ఇన్‌స్టాల్ చేసిన యాప్‌లో పనిచేస్తుంది.',
  signedInAs: (email) => (email ? `Google తో సైన్ ఇన్ అయ్యారు · ${email}` : 'Google తో సైన్ ఇన్ అయ్యారు'),
  signOut: 'సైన్ అవుట్',
  signOutHint: 'సైన్ అవుట్ చేస్తే ఈ ఫోన్‌లో కొత్త అతిథి ఖాతా మొదలవుతుంది. మళ్ళీ సైన్ ఇన్ చేస్తే మీ ఖాతా తిరిగి వస్తుంది.',
  signInUpgraded: 'సైన్ ఇన్ అయ్యారు – మీ నాణేలు, వివరాలు ఇప్పుడు మీ Google ఖాతాతో ఉంటాయి.',
  signInExisting: 'మళ్ళీ స్వాగతం! మీ ఖాతా వచ్చేసింది.',
  signInFailed: 'Google తో సైన్ ఇన్ కాలేదు. మళ్ళీ ప్రయత్నించండి.',
  deleteAccount: 'ఖాతాను తొలగించండి',
  deleteTitle: 'మీ ఖాతాను తొలగించాలా?',
  deleteBody:
    'ఇది మీ ఖాతా, పేరు, నాణేలు, ఆన్‌లైన్ వివరాలను శాశ్వతంగా తొలగిస్తుంది, Google లింక్ కూడా తీసేస్తుంది. దీన్ని వెనక్కి తీసుకోలేరు. ఈ ఫోన్‌లో సేవ్ అయిన ఆటలు ఉంటాయి.',
  deleteConfirm: 'నా ఖాతాను తొలగించు',
  cancel: 'రద్దు',
  deleted: 'మీ ఖాతా తొలగించబడింది. ఇప్పుడు మీరు కొత్త అతిథిగా ఆడుతున్నారు.',
  deleteFailed: 'ఖాతా తొలగించలేకపోయాం – ఇంటర్నెట్ కనెక్షన్ చూసి మళ్ళీ ప్రయత్నించండి.',
  shop: 'దుకాణం',
  shopKinds: { board: 'బోర్డులు', marbles: 'గోళీలు', shells: 'గవ్వలు' },
  shopItems: {
    'board.classic': { name: 'సాంప్రదాయ', hint: 'చెక్క, ఆకుపచ్చ పెంకులు' },
    'board.night': { name: 'రాత్రి', hint: 'నల్లరాయి, వెండి' },
    'board.festive': { name: 'పండుగ', hint: 'ఎరుపు లక్క, ముగ్గు' },
    'marbles.glass': { name: 'గాజు', hint: 'స్వచ్ఛమైన మెరుపు' },
    'marbles.pearl': { name: 'ముత్యం', hint: 'మెత్తని మెరుపు' },
    'marbles.metal': { name: 'లోహం', hint: 'మెరుగుపెట్టిన మెరుపు' },
    'shells.natural': { name: 'సహజ', hint: 'సముద్ర తీరంలో దొరికినట్లు' },
    'shells.golden': { name: 'బంగారు', hint: 'బంగారు పూత గవ్వలు' },
    'shells.painted': { name: 'రంగుల', hint: 'పండుగ చుక్కలు' },
  },
  shopFree: 'ఉచితం',
  shopOwned: 'మీదే',
  shopInUse: 'వాడుతున్నారు',
  shopUse: 'వాడండి',
  shopBuyTitle: (name) => `${name} కొనాలా?`,
  shopBuyBody: (price, left) => `దీని ధర ${price} నాణేలు. మీకు ${left} మిగులుతాయి. ఇది ఎప్పటికీ మీదే.`,
  shopBuy: 'కొనండి',
  shopNeedMore: (n) => `ఇంకా ${n} నాణేలు కావాలి`,
  shopFailed: 'దుకాణం అందుబాటులో లేదు – ఇంటర్నెట్ కనెక్షన్ చూడండి.',
  shopBought: (name) => `${name} ఇప్పుడు మీదే!`,
  coins: 'నాణేలు',
  coinsA11y: (n) => `${n.toLocaleString('en-IN')} నాణేలు`,
  dailyTitle: 'రోజువారీ బోనస్',
  dailyStreak: (day) => (day <= 1 ? 'మొదటి రోజు – రేపు మళ్ళీ రండి, ఇంకా ఎక్కువ' : `వరుసగా ${day}వ రోజు!`),
  dailyCollect: 'తీసుకోండి',
  dailyNext: (amount) => `రేపు మళ్ళీ రండి – ${amount} నాణేలు`,
  howToEarn: 'నాణేలు ఎలా సంపాదించాలి',
  earnDaily: (min, max) => `రోజువారీ బోనస్: ${min}–${max} (వరుస రోజులకు పెరుగుతుంది)`,
  earnWin: (base, perFriend) => `ఆన్‌లైన్ గెలుపు: ${base}, ఓడించిన ప్రతి స్నేహితునికి ఇంకా ${perFriend}`,
  earnPlayed: (n) => `ఆన్‌లైన్ ఆట పూర్తి చేస్తే: ${n}`,
  coinsNote: 'నాణేలు సరదా కోసమే – వాటిని కొనలేరు, అమ్మలేరు, డబ్బుగా మార్చలేరు.',
  rewardEarned: (n) => `+${n} నాణేలు`,
  onlineError: {
    'bad-message': 'ఏదో తప్పు జరిగింది. మళ్ళీ ప్రయత్నించండి.',
    version: 'ఆన్‌లైన్‌లో ఆడటానికి యాప్‌ను అప్‌డేట్ చేయండి.',
    'no-room': 'ఆ కోడ్‌తో గది లేదు. కోడ్ చూసి మళ్ళీ ప్రయత్నించండి.',
    'room-full': 'ఆ గది నిండిపోయింది.',
    'already-started': 'ఆ ఆట ఇప్పటికే మొదలైంది.',
    'not-in-room': 'మీరు ఇప్పుడు ఆ గదిలో లేరు.',
    'not-host': 'హోస్ట్ మాత్రమే అది చేయగలరు.',
    'not-ready': 'ముందు అన్ని స్థానాలను నింపండి.',
    'not-your-turn': 'ఇది మీ వంతు కాదు.',
    illegal: 'ఇప్పుడు అది కుదరదు.',
    'bad-token': 'మళ్ళీ చేరలేకపోయారు – ఆ ఆట ముగిసి ఉండవచ్చు.',
    network: 'గేమ్ సర్వర్‌ను చేరలేకపోయింది. ఇంటర్నెట్ కనెక్షన్ చూడండి.',
  },

  rulesTitle: 'ఎలా ఆడాలి',
  tableHead: ['తెరిచినవి', 'విలువ', 'పిల్ల', 'తల్లి'],
  rulesSections: [
    {
      title: 'లక్ష్యం',
      body: 'మీ మూడు కాయలనూ – ఒక తల్లి, రెండు పిల్లలు – మధ్య గడికి (ఇంటికి) చేర్చండి. ముందుగా చేర్చినవారు గెలుస్తారు. జట్టు ఆటలో ఎదురెదురుగా కూర్చున్నవారు భాగస్వాములు; ఇద్దరి కాయలన్నీ ఇంటికి చేరితే జట్టు గెలుస్తుంది.',
    },
    {
      title: 'గవ్వలు వేయడం',
      body: 'ఐదు గవ్వలు వేసి, ఎన్ని తెరుచుకుని పడ్డాయో లెక్కించండి.',
      table: true,
      note: 'ఐదూ తెరుచుకున్నా, ఒక్కటీ తెరవకపోయినా 8 అవుతుంది. 1 లేదా 3 పడితే తల్లి కదలదు.',
    },
    {
      title: 'బోర్డు మీదకు దిగడం',
      bullets: [
        'పిల్ల 4 పడితే మీ X గడిలోకి దిగుతుంది; 8 పడితే దిగి ఇంకా 4 అడుగులు వెళ్తుంది.',
        'తల్లి 8 పడినప్పుడు మాత్రమే మీ X గడిలోకి దిగుతుంది, అదనపు అడుగులు ఉండవు.',
        'బయట ఉన్న కాయల్లో ఏది దిగాలో మీరే ఎంచుకోవచ్చు.',
      ],
    },
    {
      title: '4 లేదా 8 ఉంచుకోవడం (4 + 4 = 8)',
      bullets: [
        '4 లేదా 8 పడితే వెంటనే వాడవచ్చు, లేదా ఉంచుకుని మళ్ళీ వేయవచ్చు.',
        'తర్వాత ఉంచుకున్న వేటునూ, కొత్త వేటునూ ఏ క్రమంలోనైనా విడివిడిగా వాడండి – ఉదాహరణకు ముందు పిల్లను దారి నుంచి తప్పించి, తర్వాత తల్లిని కదపండి.',
        'ఉంచుకున్న 4 తర్వాత మళ్ళీ 4 పడితే, రెండింటినీ కలిపి 8 గా వాడవచ్చు – తల్లిని దించడానికి మాత్రమే. రెండు 4లు మాత్రమే కలుస్తాయి; ఇంకేవీ కలవవు.',
        'వేట్లు ముగిసేసరికి వాడలేని ఉంచుకున్న వేటు వృథా అవుతుంది.',
      ],
    },
    {
      title: 'దారి',
      bullets: [
        'మీ వైపు మధ్యలో ఉన్న X గడి నుంచి మొదలుపెట్టండి.',
        'బయటి వరుసలో అపసవ్య దిశలో (counter-clockwise), తర్వాత లోపలి వరుసలో సవ్య దిశలో (clockwise) తిరిగి, మధ్యకు చేరండి.',
        'మీ X నుంచి ఇంటికి 24 అడుగులు; ఇంటికి చేరడానికి సరిగ్గా సరిపడే సంఖ్య పడాలి.',
      ],
    },
    {
      title: 'వంతులు',
      bullets: [
        '4 లేదా 8 పడితే మరో వేటు వస్తుంది.',
        'కాయను ఇంటికి చేర్చినా మరో వేటు వస్తుంది.',
        'ఏ కాయా కదలలేకపోతే ఆ వంతు పోతుంది.',
      ],
    },
    {
      title: 'కొట్టడం, సురక్షిత గడులు',
      bullets: [
        'ఒకే రకం కాయలనే కొట్టగలరు: పిల్ల పిల్లను, తల్లి తల్లిని మాత్రమే.',
        'ఎదుటివారి అదే రకం కాయ ఉన్న గడిలో దిగితే, ఆ కాయ మొదటికి వెళ్తుంది. ఆ గడిలో అలాంటి కాయలన్నీ వెనక్కి వెళ్తాయి.',
        'సాధారణ గడిలో రెండు కాయలు ఎప్పుడూ కలిసి ఉండవు – మీ సొంత కాయలు కూడా. అక్కడ ఉన్నదాన్ని కొట్టగలిగితేనే దిగవచ్చు.',
        'అంటే సాధారణ గడిలో మీ కాయ, మీ భాగస్వామి కాయ, లేదా ఎదుటివారి వేరే రకం కాయ ఉంటే అక్కడ దిగలేరు.',
        'X గడుల్లో, ఇంట్లో ఎన్ని కాయలైనా ఉండవచ్చు; అక్కడ ఎవరినీ కొట్టలేరు.',
        'కొట్టబడిన కాయ మామూలు నియమాలతోనే మళ్ళీ దిగుతుంది: పిల్ల 4 లేదా 8 కి, తల్లి 8 కి మాత్రమే.',
      ],
    },
    {
      title: 'జట్లు',
      bullets: ['మీ కాయలన్నీ ఇంటికి చేరాక, మీ వేట్లతో మీ భాగస్వామి కాయలను కదుపుతారు.'],
    },
    {
      title: 'యాప్‌లో ఆడడం',
      bullets: [
        'మెరుస్తున్న కాయను నొక్కితే అది ఎక్కడ దిగుతుందో కనిపిస్తుంది; మళ్ళీ నొక్కితే (లేదా వెలుగుతున్న గడిని నొక్కితే) కదులుతుంది.',
        '4 లేదా 8 పడ్డాక “ఉంచండి · మళ్ళీ వేయండి” తో దాన్ని ఉంచుకోవచ్చు; తల్లిని దించగలిగినప్పుడు “4 + 4 కలపండి” కనిపిస్తుంది.',
        'తెల్లని ఉంగరం ఉన్న గోళీ తల్లి.',
      ],
    },
  ],
};

export const STRINGS: Record<Lang, Strings> = { en, te };

/** Whether a player name is the default "You", in either language (for "your Child"). */
export function isDefaultYou(name: string): boolean {
  return name === en.you || name === te.you;
}

/**
 * A player's name in the current language. Default names ("You",
 * "Computer 2", a colour) follow the language even mid-game; names the
 * player typed are shown exactly as typed.
 */
export function displayName(t: Strings, name: string, seat: Seat): string {
  for (const lang of [en, te]) {
    if (name === lang.you) return t.you;
    if (name === lang.colour[seat]) return t.colour[seat];
    for (let n = 0; n <= 3; n++) if (name === lang.computer(n)) return t.computer(n);
  }
  return name;
}

/** The same game with players' default names in the current language, for display only. */
export function withDisplayNames<G extends { players: { name: string; seat: Seat }[] }>(t: Strings, game: G): G {
  return { ...game, players: game.players.map((p) => ({ ...p, name: displayName(t, p.name, p.seat) })) };
}
