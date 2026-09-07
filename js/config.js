export const VERSION = 1;
export const SAVE_KEY = 'stallwala-save-v1';

export const INGREDIENTS = {
  tea:     { id: 'tea',     emoji: '🍃', color: 0x2f5d32, cost: 2,  start: 28 },
  milk:    { id: 'milk',    emoji: '🥛', color: 0xf3f0e6, cost: 3,  start: 22 },
  spice:   { id: 'spice',   emoji: '🌶️', color: 0xc2410c, cost: 2,  start: 36 },
  dough:   { id: 'dough',   emoji: '🫓', color: 0xe8c98a, cost: 3,  start: 18 },
  potato:  { id: 'potato',  emoji: '🥔', color: 0xc4a35a, cost: 2,  start: 24 },
  oil:     { id: 'oil',     emoji: '🛢️', color: 0xd4a017, cost: 2,  start: 30 },
  bread:   { id: 'bread',   emoji: '🍞', color: 0xd9b48f, cost: 3,  start: 16 },
  water:   { id: 'water',   emoji: '💧', color: 0x7dd3fc, cost: 1,  start: 80 },
  veggies: { id: 'veggies', emoji: '🥗', color: 0x4ade80, cost: 3,  start: 18 },
  sugar:   { id: 'sugar',   emoji: '🍬', color: 0xf8fafc, cost: 2,  start: 20 },
  batter:  { id: 'batter',  emoji: '🥣', color: 0xf5e6c8, cost: 3,  start: 14 },
  yogurt:  { id: 'yogurt',  emoji: '🫙', color: 0xfefce8, cost: 4,  start: 10 },
  rice:    { id: 'rice',    emoji: '🍚', color: 0xf1f5f9, cost: 4,  start: 8  },
  ice:     { id: 'ice',     emoji: '🧊', color: 0xbfdbfe, cost: 2,  start: 12 },
  meat:    { id: 'meat',    emoji: '🍗', color: 0xb45309, cost: 8,  start: 4  },
  flour:   { id: 'flour',   emoji: '🌾', color: 0xf5f0e6, cost: 2,  start: 14 },
};

export const RECIPES = {
  chai: {
    id: 'chai', emoji: '🍵', color: 0x6b3a2a, price: 18, cook: 2.2,
    ingredients: ['tea', 'milk', 'spice'], unlockDay: 1, shop: 0,
  },
  samosa: {
    id: 'samosa', emoji: '🥟', color: 0xd4a017, price: 22, cook: 2.8,
    ingredients: ['dough', 'potato', 'spice', 'oil'], unlockDay: 1, shop: 0,
  },
  pakora: {
    id: 'pakora', emoji: '🧆', color: 0xb45309, price: 20, cook: 2.4,
    ingredients: ['batter', 'veggies', 'spice', 'oil'], unlockDay: 2, shop: 80,
  },
  vadaPav: {
    id: 'vadaPav', emoji: '🍔', color: 0xca8a04, price: 32, cook: 3.2,
    ingredients: ['bread', 'potato', 'spice', 'oil'], unlockDay: 2, shop: 120,
  },
  paniPuri: {
    id: 'paniPuri', emoji: '⚪', color: 0xfde68a, price: 28, cook: 2.6,
    ingredients: ['flour', 'potato', 'spice', 'water'], unlockDay: 3, shop: 160,
  },
  jalebi: {
    id: 'jalebi', emoji: '🌀', color: 0xf59e0b, price: 26, cook: 3.0,
    ingredients: ['batter', 'sugar', 'oil'], unlockDay: 3, shop: 150,
  },
  pavBhaji: {
    id: 'pavBhaji', emoji: '🍛', color: 0xea580c, price: 48, cook: 4.0,
    ingredients: ['bread', 'veggies', 'potato', 'spice'], unlockDay: 4, shop: 220,
  },
  lassi: {
    id: 'lassi', emoji: '🥛', color: 0xfef9c3, price: 30, cook: 1.8,
    ingredients: ['yogurt', 'sugar', 'ice', 'milk'], unlockDay: 4, shop: 180,
  },
  dosa: {
    id: 'dosa', emoji: '🥞', color: 0xeab308, price: 42, cook: 3.6,
    ingredients: ['batter', 'potato', 'spice', 'oil'], unlockDay: 5, shop: 260,
  },
  corn: {
    id: 'corn', emoji: '🌽', color: 0xfacc15, price: 24, cook: 2.2,
    ingredients: ['veggies', 'spice', 'oil'], unlockDay: 5, shop: 140,
  },
  maggi: {
    id: 'maggi', emoji: '🍜', color: 0xf97316, price: 34, cook: 2.8,
    ingredients: ['flour', 'veggies', 'spice', 'water'], unlockDay: 6, shop: 200,
  },
  kulfi: {
    id: 'kulfi', emoji: '🍦', color: 0xfde68a, price: 36, cook: 2.0,
    ingredients: ['milk', 'sugar', 'ice'], unlockDay: 6, shop: 210,
  },
  momos: {
    id: 'momos', emoji: '🥟', color: 0xf5f5f4, price: 44, cook: 3.8,
    ingredients: ['dough', 'veggies', 'spice', 'oil'], unlockDay: 7, shop: 280,
  },
  roll: {
    id: 'roll', emoji: '🌯', color: 0xd97706, price: 52, cook: 3.5,
    ingredients: ['bread', 'veggies', 'spice', 'meat'], unlockDay: 7, shop: 320,
  },
  biryani: {
    id: 'biryani', emoji: '🍚', color: 0xc2410c, price: 78, cook: 5.2,
    ingredients: ['rice', 'meat', 'spice', 'oil'], unlockDay: 8, shop: 420,
  },
  falooda: {
    id: 'falooda', emoji: '🍨', color: 0xf9a8d4, price: 46, cook: 2.6,
    ingredients: ['milk', 'sugar', 'ice', 'yogurt'], unlockDay: 10, shop: 360,
  },
  thali: {
    id: 'thali', emoji: '🍽️', color: 0xfbbf24, price: 110, cook: 6.0,
    ingredients: ['rice', 'veggies', 'bread', 'spice', 'yogurt'], unlockDay: 12, shop: 650,
  },
};

export const UPGRADES = {
  burner: {
    id: 'burner', max: 3, costs: [220, 480, 900],
    start: 0,
  },
  cookSpeed: {
    id: 'cookSpeed', max: 5, costs: [150, 280, 450, 700, 1100],
    start: 0,
  },
  queue: {
    id: 'queue', max: 3, costs: [180, 360, 700],
    start: 0,
  },
  restock: {
    id: 'restock', max: 3, costs: [200, 400, 800],
    start: 0,
  },
  fridge: {
    id: 'fridge', max: 3, costs: [250, 500, 950],
    start: 0,
  },
  premium: {
    id: 'premium', max: 4, costs: [300, 550, 900, 1400],
    start: 0,
  },
  neon: {
    id: 'neon', max: 1, costs: [420],
    start: 0,
  },
  speaker: {
    id: 'speaker', max: 1, costs: [260],
    start: 0,
  },
  awning: {
    id: 'awning', max: 1, costs: [380],
    start: 0,
  },
  seating: {
    id: 'seating', max: 1, costs: [500],
    start: 0,
  },
  social: {
    id: 'social', max: 2, costs: [340, 720],
    start: 0,
  },
  generator: {
    id: 'generator', max: 1, costs: [300],
    start: 0,
  },
};

export const DECOR = {
  fairy:   { id: 'fairy',   cost: 160 },
  toran:   { id: 'toran',   cost: 140 },
  rangoli: { id: 'rangoli', cost: 120 },
  plants:  { id: 'plants',  cost: 110 },
  posters: { id: 'posters', cost: 90  },
  carpet:  { id: 'carpet',  cost: 130 },
  lantern: { id: 'lantern', cost: 180 },
  paint:   { id: 'paint',   cost: 240 },
  radio:   { id: 'radio',   cost: 150 },
};

export const STAFF = {
  cook:     { id: 'cook',     hire: 400, wage: 60, max: 1 },
  server:   { id: 'server',   hire: 360, wage: 50, max: 1 },
  cleaner:  { id: 'cleaner',  hire: 220, wage: 30, max: 1 },
  marketer: { id: 'marketer', hire: 480, wage: 70, max: 1 },
};

export const ACHIEVEMENTS = {
  firstServe:  { id: 'firstServe' },
  tenServes:   { id: 'tenServes' },
  hundred:     { id: 'hundred' },
  rich:        { id: 'rich' },
  combo5:      { id: 'combo5' },
  combo10:     { id: 'combo10' },
  upgrade:     { id: 'upgrade' },
  hired:       { id: 'hired' },
  rainProfit:  { id: 'rainProfit' },
  week:        { id: 'week' },
  month:       { id: 'month' },
  cookbook:    { id: 'cookbook' },
  critic:      { id: 'critic' },
  tycoon:      { id: 'tycoon' },
  perfectDay:  { id: 'perfectDay' },
  festival:    { id: 'festival' },
};

export const CUSTOMER_NAMES = [
  'Aarav', 'Priya', 'Rohan', 'Ananya', 'Vikram', 'Meera', 'Kabir', 'Isha',
  'Arjun', 'Diya', 'Raju', 'Fatima', 'Imran', 'Sneha', 'Dev', 'Aisha',
  'Karan', 'Nisha', 'Amit', 'Pooja', 'Rahul', 'Kavya', 'Sameer', 'Riya',
  'Chintu', 'Lata', 'Iqbal', 'Sana', 'Gopal', 'Neha', 'Farhan', 'Tara',
];

export const CUSTOMER_TYPES = {
  regular:  { patience: 32, pay: 1, tip: 1, speed: 1, weight: 54 },
  kid:      { patience: 22, pay: 0.85, tip: 0.6, speed: 1.15, weight: 10 },
  auntie:   { patience: 44, pay: 1.05, tip: 1.3, speed: 0.75, weight: 12 },
  office:   { patience: 18, pay: 1.25, tip: 1.1, speed: 1.35, weight: 12 },
  tourist:  { patience: 36, pay: 1.4, tip: 1.8, speed: 0.9, weight: 7 },
  critic:   { patience: 24, pay: 2.2, tip: 2.5, speed: 1.0, weight: 3 },
  star:     { patience: 28, pay: 1.6, tip: 2.2, speed: 1.1, weight: 2 },
};

let lang = 'en';
export function getLang() { return lang; }
export function setLang(next) { lang = next === 'hi' ? 'hi' : 'en'; }

const STR = {
  en: {
    title: 'STALLWALA',
    subtitle: '3D Street Food Tycoon',
    play: 'Open Stall',
    continue: 'Continue',
    showcase: 'Inspect Stall',
    how: 'How to Play',
    settings: 'Settings',
    quitMenu: 'Main Menu',
    pause: 'Paused',
    resume: 'Back to Stall',
    shop: 'Bazaar Shop',
    closeShop: 'Close Shop',
    dayEnd: 'Stall Closed',
    nextDay: 'Open Tomorrow',
    cookbook: 'Cookbook',
    stats: 'Stats',
    money: 'Rupees',
    rep: 'Reputation',
    day: 'Day',
    combo: 'Combo',
    stock: 'Stock',
    orders: 'Orders',
    serve: 'Serve',
    restock: 'Restock All',
    closeEarly: 'Close Stall',
    camera: 'Camera',
    camReset: 'Reset Cam',
    lang: 'Language',
    sfx: 'Sound',
    music: 'Music',
    quality: 'Quality',
    qualityLow: 'Low',
    qualityMed: 'Medium',
    qualityHigh: 'High',
    on: 'On',
    off: 'Off',
    english: 'English',
    hindi: 'हिन्दी',
    recipes: 'Recipes',
    upgrades: 'Upgrades',
    decor: 'Decor',
    staff: 'Staff',
    achievements: 'Achievements',
    buy: 'Buy',
    owned: 'Owned',
    hired: 'Hired',
    maxed: 'Max',
    locked: 'Locked',
    wage: 'Wage / day',
    earned: 'Earned',
    served: 'Served',
    angry: 'Walked out',
    tips: 'Tips',
    wages: 'Wages',
    profit: 'Profit',
    weather: 'Weather',
    clear: 'Clear',
    rain: 'Rain',
    festive: 'Festival Night',
    tutorialTitle: 'Run the stall',
    tutorial: 'Customers walk up with an order. Cook that dish (click the recipe or press 1–9), then click the customer to serve. Keep them waiting too long and they leave. Earn rupees, upgrade the stall, unlock new food. Never ends — go as big as you want.',
    gotIt: 'Got it — let’s cook',
    loading: 'Firing up the stove…',
    ready: 'Ready',
    cooking: 'Cooking',
    needStock: 'Need ingredients',
    noBurner: 'All burners busy',
    servedOk: 'Served',
    perfect: 'Perfect!',
    angryLeave: 'Left angry',
    criticYes: 'Critic loved it!',
    criticNo: 'Critic slammed you',
    saved: 'Progress saved',
    newDay: 'New day',
    special: 'Special guest',
    photo: 'Photo mode',
    photoHint: 'Drag to orbit · scroll to zoom · Esc to leave',
    emptyQueue: 'Waiting for hungry people…',
    fullscreen: 'Fullscreen',
    resetSave: 'Reset Save',
    resetConfirm: 'Wipe all progress and start fresh?',
    yes: 'Yes',
    no: 'No',
    features: 'Features',
    hintCook: 'Cook',
    hintServe: 'Click a waiting customer to serve matching food',
    dayGoal: 'Rush until night, then shop and restock.',
    open: 'OPEN',
    closed: 'CLOSED',
    stockLow: 'Running low',
    auto: 'Auto',
    level: 'Lv',
    free: 'Free',
    rupee: '₹',
    patience: 'Patience',
    queueFull: 'Queue is full',
    showcaseTitle: 'Stall Model',
    back: 'Back',
    howBody: 'WASD / drag to look around. Click recipes to cook. Click customers to serve. Number keys 1–9 start recipes. Space serves the oldest matching order. Esc pauses. Buy burners, staff, and lights in the shop between days. Rain hurts business unless you upgrade the awning. Festival nights are packed.',
    keys: 'Shortcuts',
    weatherClear: 'Clear evening',
    weatherRain: 'Monsoon showers',
    weatherFestive: 'Festival night',
    staffCook: 'Cook',
    staffServer: 'Server',
    staffCleaner: 'Cleaner',
    staffMarketer: 'Marketer',
    upBurner: 'Extra burner',
    upCookSpeed: 'Faster cooking',
    upQueue: 'Longer queue',
    upRestock: 'Morning restock',
    upFridge: 'Bigger fridge',
    upPremium: 'Premium spices',
    upNeon: 'Neon sign',
    upSpeaker: 'Speakers',
    upAwning: 'Monsoon awning',
    upSeating: 'Seating deck',
    upSocial: 'Social buzz',
    upGenerator: 'Backup generator',
    dcFairy: 'Fairy lights',
    dcToran: 'Marigold toran',
    dcRangoli: 'Rangoli',
    dcPlants: 'Tulsi & ferns',
    dcPosters: 'Film posters',
    dcCarpet: 'Kilim runner',
    dcLantern: 'Brass lanterns',
    dcPaint: 'Fresh paint',
    dcRadio: 'Vintage radio',
    rec_chai: 'Masala Chai',
    rec_samosa: 'Samosa',
    rec_pakora: 'Pakora',
    rec_vadaPav: 'Vada Pav',
    rec_paniPuri: 'Pani Puri',
    rec_jalebi: 'Jalebi',
    rec_pavBhaji: 'Pav Bhaji',
    rec_lassi: 'Lassi',
    rec_dosa: 'Masala Dosa',
    rec_corn: 'Corn Chaat',
    rec_maggi: 'Masala Maggi',
    rec_kulfi: 'Malai Kulfi',
    rec_momos: 'Veg Momos',
    rec_roll: 'Kathi Roll',
    rec_biryani: 'Dum Biryani',
    rec_falooda: 'Royal Falooda',
    rec_thali: 'Grand Thali',
    ach_firstServe: 'First plate',
    ach_tenServes: 'Ten happy bellies',
    ach_hundred: 'Century of serves',
    ach_rich: 'Thousand rupees held',
    ach_combo5: 'Combo x5',
    ach_combo10: 'Combo x10',
    ach_upgrade: 'First upgrade',
    ach_hired: 'Hired help',
    ach_rainProfit: 'Profit in the rain',
    ach_week: 'One week open',
    ach_month: 'Month of service',
    ach_cookbook: 'Full cookbook',
    ach_critic: 'Critic’s blessing',
    ach_tycoon: 'Stall tycoon',
    ach_perfectDay: 'Perfect service day',
    ach_festival: 'Festival king',
    desc_burner: 'Cook more dishes at once.',
    desc_cookSpeed: 'Shave time off every recipe.',
    desc_queue: 'More people can wait at once.',
    desc_restock: 'Dawn delivery fills jars.',
    desc_fridge: 'Hold more of every ingredient.',
    desc_premium: 'Charge more for the same plate.',
    desc_neon: 'Night crowds find you from the street.',
    desc_speaker: 'Tunes raise tips and patience.',
    desc_awning: 'Rain becomes an advantage.',
    desc_seating: 'Folks linger and tip extra.',
    desc_social: 'Influencers drop by more often.',
    desc_generator: 'Lights never flicker. Reputation floor.',
    desc_cook: 'Starts cooking the front order.',
    desc_server: 'Hands ready food to matching guests.',
    desc_cleaner: 'Slow reputation drip all day.',
    desc_marketer: 'More footsteps toward your stall.',
    feat1: 'Hand-built 3D stall & night bazaar',
    feat2: '17 street-food recipes',
    feat3: 'Customers, patience, tips & combos',
    feat4: 'Day / night & weather',
    feat5: 'Upgrades, decor, staff',
    feat6: 'Hindi + English',
    feat7: 'Save anywhere, never game-over',
    feat8: 'Photo mode around the model',
  },
  hi: {
    title: 'स्टॉलवाला',
    subtitle: '3D स्ट्रीट फ़ूड टायकून',
    play: 'स्टॉल खोलें',
    continue: 'जारी रखें',
    showcase: 'स्टॉल देखें',
    how: 'कैसे खेलें',
    settings: 'सेटिंग्स',
    quitMenu: 'मुख्य मेनू',
    pause: 'रुका हुआ',
    resume: 'स्टॉल पर वापस',
    shop: 'बाज़ार दुकान',
    closeShop: 'दुकान बंद करें',
    dayEnd: 'स्टॉल बंद',
    nextDay: 'कल खोलें',
    cookbook: 'रेसिपी किताब',
    stats: 'आँकड़े',
    money: 'रुपये',
    rep: 'प्रतिष्ठा',
    day: 'दिन',
    combo: 'कॉम्बो',
    stock: 'स्टॉक',
    orders: 'ऑर्डर',
    serve: 'परोसें',
    restock: 'सब भरें',
    closeEarly: 'स्टॉल बंद करें',
    camera: 'कैमरा',
    camReset: 'कैमरा रीसेट',
    lang: 'भाषा',
    sfx: 'आवाज़',
    music: 'संगीत',
    quality: 'क्वालिटी',
    qualityLow: 'कम',
    qualityMed: 'मध्यम',
    qualityHigh: 'उच्च',
    on: 'चालू',
    off: 'बंद',
    english: 'English',
    hindi: 'हिन्दी',
    recipes: 'रेसिपी',
    upgrades: 'अपग्रेड',
    decor: 'सजावट',
    staff: 'स्टाफ़',
    achievements: 'उपलब्धियाँ',
    buy: 'खरीदें',
    owned: 'खरीदा',
    hired: 'भर्ती',
    maxed: 'अधिकतम',
    locked: 'बंद',
    wage: 'वेतन / दिन',
    earned: 'कमाई',
    served: 'परोसा',
    angry: 'नाराज़ गए',
    tips: 'टिप',
    wages: 'वेतन',
    profit: 'फ़ायदा',
    weather: 'मौसम',
    clear: 'साफ़',
    rain: 'बारिश',
    festive: 'त्योहार रात',
    tutorialTitle: 'स्टॉल चलाओ',
    tutorial: 'ग्राहक ऑर्डर लेकर आते हैं। पकवान पकाओ (रेसिपी या 1–9 दबाओ), फिर ग्राहक पर क्लिक करके परोस दो। देर हुई तो वे चले जाते हैं। रुपये कमाओ, स्टॉल सजाओ, नई डिश खोलो। खेल कभी खत्म नहीं होता।',
    gotIt: 'समझ गए — चलो पकाएँ',
    loading: 'चूल्हा जल रहा है…',
    ready: 'तैयार',
    cooking: 'पक रहा है',
    needStock: 'सामग्री कम है',
    noBurner: 'सभी चूल्हे व्यस्त',
    servedOk: 'परोस दिया',
    perfect: 'कमाल!',
    angryLeave: 'नाराज़ होकर गए',
    criticYes: 'क्रिटिक खुश!',
    criticNo: 'क्रिटिक नाराज़',
    saved: 'सेव हो गया',
    newDay: 'नया दिन',
    special: 'ख़ास मेहमान',
    photo: 'फ़ोटो मोड',
    photoHint: 'घुमाओ · ज़ूम · Esc से बाहर',
    emptyQueue: 'भूखे लोगों का इंतज़ार…',
    fullscreen: 'फ़ुलस्क्रीन',
    resetSave: 'सेव मिटाएँ',
    resetConfirm: 'सारी प्रगति मिटाकर नए सिरे से शुरू करें?',
    yes: 'हाँ',
    no: 'नहीं',
    features: 'फ़ीचर',
    hintCook: 'पकाएँ',
    hintServe: 'तैयार खाना परोसने के लिए ग्राहक पर क्लिक करें',
    dayGoal: 'रात तक व्यस्त रहो, फिर दुकान और स्टॉक।',
    open: 'खुला',
    closed: 'बंद',
    stockLow: 'स्टॉक कम',
    auto: 'ऑटो',
    level: 'स्तर',
    free: 'मुफ़्त',
    rupee: '₹',
    patience: 'धैर्य',
    queueFull: 'कतार भरी है',
    showcaseTitle: 'स्टॉल मॉडल',
    back: 'वापस',
    howBody: 'WASD / माउस से देखो। रेसिपी पर क्लिक करके पकाओ। ग्राहक पर क्लिक करके परोसें। 1–9 रेसिपी शुरू करते हैं। Space सबसे पुराना मैच परोसता है। Esc पॉज़। दिनों के बीच चूल्हा, स्टाफ़, लाइट्स खरीदें। बारिश में तंबू अपग्रेड काम आता है। त्योहार की रातें भरी होती हैं।',
    keys: 'शॉर्टकट',
    weatherClear: 'साफ़ शाम',
    weatherRain: 'मानसून',
    weatherFestive: 'त्योहार रात',
    staffCook: 'रसोइया',
    staffServer: 'सर्वर',
    staffCleaner: 'सफ़ाई',
    staffMarketer: 'मार्केटर',
    upBurner: 'अतिरिक्त चूल्हा',
    upCookSpeed: 'तेज़ पकाना',
    upQueue: 'लंबी कतार',
    upRestock: 'सुबह स्टॉक',
    upFridge: 'बड़ा फ़्रिज',
    upPremium: 'प्रीमियम मसाला',
    upNeon: 'नियॉन साइन',
    upSpeaker: 'स्पीकर',
    upAwning: 'मानसून तंबू',
    upSeating: 'बैठने की जगह',
    upSocial: 'सोशल चर्चा',
    upGenerator: 'जनरेटर',
    dcFairy: 'परी बत्तियाँ',
    dcToran: 'गेंदे का तोरण',
    dcRangoli: 'रंगोली',
    dcPlants: 'तुलसी और पौधे',
    dcPosters: 'फ़िल्मी पोस्टर',
    dcCarpet: 'गलीचा',
    dcLantern: 'पीतल लालटेन',
    dcPaint: 'नई पेंट',
    dcRadio: 'पुराना रेडियो',
    rec_chai: 'मसाला चाय',
    rec_samosa: 'समोसा',
    rec_pakora: 'पकोड़ा',
    rec_vadaPav: 'वड़ा पाव',
    rec_paniPuri: 'पानी पूरी',
    rec_jalebi: 'जलेबी',
    rec_pavBhaji: 'पाव भाजी',
    rec_lassi: 'लस्सी',
    rec_dosa: 'मसाला डोसा',
    rec_corn: 'कॉर्न चाट',
    rec_maggi: 'मसाला मैगी',
    rec_kulfi: 'मलाई कुल्फ़ी',
    rec_momos: 'वेज मोमो',
    rec_roll: 'कथी रोल',
    rec_biryani: 'दम बिरयानी',
    rec_falooda: 'रॉयल फ़लूदा',
    rec_thali: 'ग्रैंड थाली',
    ach_firstServe: 'पहली प्लेट',
    ach_tenServes: 'दस खुश ग्राहक',
    ach_hundred: 'सौ प्लेट',
    ach_rich: 'हज़ार रुपये',
    ach_combo5: 'कॉम्बो x5',
    ach_combo10: 'कॉम्बो x10',
    ach_upgrade: 'पहला अपग्रेड',
    ach_hired: 'स्टाफ़ भर्ती',
    ach_rainProfit: 'बारिश में मुनाफ़ा',
    ach_week: 'एक हफ़्ता',
    ach_month: 'एक महीना',
    ach_cookbook: 'पूरी किताब',
    ach_critic: 'क्रिटिक की दुआ',
    ach_tycoon: 'स्टॉल टायकून',
    ach_perfectDay: 'परफ़ेक्ट दिन',
    ach_festival: 'त्योहार राजा',
    desc_burner: 'एक साथ ज़्यादा पकवान।',
    desc_cookSpeed: 'हर रेसिपी तेज़।',
    desc_queue: 'ज़्यादा लोग इंतज़ार कर सकते हैं।',
    desc_restock: 'सुबह जार भर जाते हैं।',
    desc_fridge: 'हर सामग्री की ज़्यादा जगह।',
    desc_premium: 'उसी प्लेट की ज़्यादा कीमत।',
    desc_neon: 'रात की भीड़ दूर से देखे।',
    desc_speaker: 'गाने से टिप और धैर्य बढ़े।',
    desc_awning: 'बारिश फायदे में बदलती है।',
    desc_seating: 'लोग बैठकर ज़्यादा टिप देते हैं।',
    desc_social: 'इन्फ़्लुएंसर ज़्यादा आते हैं।',
    desc_generator: 'बत्ती कभी नहीं जाती।',
    desc_cook: 'आगे का ऑर्डर स्वयं पकाता है।',
    desc_server: 'तैयार खाना ग्राहक तक पहुँचाता है।',
    desc_cleaner: 'दिन भर प्रतिष्ठा धीरे बढ़ती है।',
    desc_marketer: 'ज़्यादा कदम आपके स्टॉल की ओर।',
    feat1: 'हाथ से बना 3D स्टॉल और बाज़ार',
    feat2: '17 स्ट्रीट फ़ूड रेसिपी',
    feat3: 'ग्राहक, धैर्य, टिप और कॉम्बो',
    feat4: 'दिन / रात और मौसम',
    feat5: 'अपग्रेड, सजावट, स्टाफ़',
    feat6: 'हिन्दी + अंग्रेज़ी',
    feat7: 'कहीं भी सेव, गेम ओवर नहीं',
    feat8: 'मॉडल के चारों ओर फ़ोटो मोड',
  },
};

export function t(key) {
  const table = STR[lang] || STR.en;
  return table[key] || STR.en[key] || key;
}

export function recipeName(id) {
  return t('rec_' + id);
}

export function defaultState() {
  const stock = {};
  for (const id of Object.keys(INGREDIENTS)) stock[id] = INGREDIENTS[id].start;
  const upgrades = {};
  for (const id of Object.keys(UPGRADES)) upgrades[id] = UPGRADES[id].start;
  const decor = {};
  for (const id of Object.keys(DECOR)) decor[id] = false;
  const staff = {};
  for (const id of Object.keys(STAFF)) staff[id] = 0;
  return {
    version: VERSION,
    lang: 'en',
    money: 420,
    reputation: 58,
    day: 1,
    combo: 0,
    maxCombo: 0,
    recipesUnlocked: ['chai', 'samosa'],
    stock,
    upgrades,
    decor,
    staff,
    achievements: {},
    stats: {
      served: 0,
      angry: 0,
      earned: 0,
      tips: 0,
      spent: 0,
      perfect: 0,
      bestDay: 0,
      criticsWon: 0,
    },
    settings: {
      sfx: true,
      music: true,
      quality: 'med',
    },
    seenTutorial: false,
  };
}

export function stockCap(state, ingredientId) {
  const base = Math.max(12, INGREDIENTS[ingredientId].start * 2);
  return base + state.upgrades.fridge * 16;
}

export function cookTime(state, recipe) {
  const speed = 1 + state.upgrades.cookSpeed * 0.12;
  return Math.max(0.7, recipe.cook / speed);
}

export function sellPrice(state, recipe) {
  const prem = 1 + state.upgrades.premium * 0.12;
  return Math.round(recipe.price * prem);
}

export function maxQueue(state) {
  return 3 + state.upgrades.queue;
}

export function maxBurners(state) {
  return 1 + state.upgrades.burner;
}

export function spawnMult(state, hour, weather) {
  let m = 0.55 + state.day * 0.035 + (state.reputation / 100) * 0.55;
  if (hour >= 7 && hour < 10) m *= 1.25;
  else if (hour >= 12 && hour < 14) m *= 1.35;
  else if (hour >= 17 && hour < 21) m *= 1.55;
  else if (hour >= 21 && hour < 23) m *= 1.15;
  else m *= 0.7;
  if (weather === 'rain') m *= state.upgrades.awning ? 1.12 : 0.68;
  if (weather === 'festive') m *= 1.55;
  if (state.upgrades.neon && hour >= 18) m *= 1.18;
  if (state.staff.marketer) m *= 1.16;
  if (state.upgrades.social) m *= 1 + state.upgrades.social * 0.08;
  return m;
}

export function pickCustomerType(state, rng) {
  const types = { ...CUSTOMER_TYPES };
  if (state.day < 3) {
    types.critic.weight = 0;
    types.star.weight = 0;
  }
  if (state.upgrades.social) types.star.weight += 4 * state.upgrades.social;
  const keys = Object.keys(types);
  let total = 0;
  for (const k of keys) total += types[k].weight;
  let r = rng() * total;
  for (const k of keys) {
    r -= types[k].weight;
    if (r <= 0) return k;
  }
  return 'regular';
}

export function allRecipeIds() {
  return Object.keys(RECIPES);
}

export function isRecipeUnlocked(state, id) {
  return state.recipesUnlocked.includes(id);
}

export function maybeUnlockByDay(state) {
  const added = [];
  for (const rec of Object.values(RECIPES)) {
    if (rec.unlockDay <= state.day && !state.recipesUnlocked.includes(rec.id) && rec.shop === 0) {
      state.recipesUnlocked.push(rec.id);
      added.push(rec.id);
    }
    if (rec.unlockDay <= state.day && rec.shop === 0 && !state.recipesUnlocked.includes(rec.id)) {
      state.recipesUnlocked.push(rec.id);
      added.push(rec.id);
    }
  }
  return added;
}
