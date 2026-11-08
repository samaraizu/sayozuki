// 商品の詳細ページ（/menu/<slug>）と、注文画面で商品をタップしたときのモーダルの中身。
// key = Squareに登録した日本語の商品名（src/config/i18n-menu.ts の ITEMS と同じ）。価格・在庫・Squareの写真はここに書かず、
// /api/public/menu（客室QRなしで読める）から引く。ここに書くのは、Squareの「説明」に収まらない読み物だけ。
//
// prep: true … 仕込みが要る品。Airbnb などの事前申込ページ（/meals）に並び、「チェックインの◯日前まで」の締め切りが付く
// photos … Squareに写真が無いときに使う写真のパス。空のあいだは shots（撮る予定のカット）を写真枠に出す
// 本文・内容・アレルゲンはモック用の仮の文章。料理長に確かめてから差し替える
// 文章は日本語と英語。繁体字・簡体字・韓国語は英語で出す（pickD）

export const DISH_CATS = {
  dinner: { ja: '夕食', en: 'Dinner' },
  breakfast: { ja: '朝食', en: 'Breakfast' },
  drink: { ja: 'お飲み物', en: 'Drinks' },
  sweet: { ja: 'お菓子', en: 'Sweets' }
};

export const ALLERGENS = {
  egg: { ja: '卵', en: 'Egg' },
  milk: { ja: '乳', en: 'Milk' },
  wheat: { ja: '小麦', en: 'Wheat' },
  shrimp: { ja: 'えび', en: 'Shrimp' },
  crab: { ja: 'かに', en: 'Crab' },
  soy: { ja: '大豆', en: 'Soy' },
  beef: { ja: '牛肉', en: 'Beef' },
  fish: { ja: '魚介', en: 'Fish' },
  sesame: { ja: 'ごま', en: 'Sesame' },
  alcohol: { ja: 'アルコール', en: 'Alcohol' }
};

export const DISHES = [
  {
    slug: 'sukiyaki',
    key: '山形牛すき焼き',
    name: { ja: '山形牛すき焼き', en: 'Yamagata beef sukiyaki' },
    cat: 'dinner',
    prep: true,
    kicker: { ja: '部屋で炊く、山形牛の割下鍋', en: 'Yamagata beef, simmered at your table' },
    story: {
      ja: '霜の細かい山形牛の肩ロースを、甘さを控えた割下でさっと煮ます。卓上コンロと鍋をお部屋にお持ちし、最初の一枚だけ係が仕上げます。〆は山形のつや姫に溶き卵をからめて。',
      en: 'Finely marbled Yamagata beef shoulder, briefly simmered in a lightly sweet warishita broth. We bring the burner and pot to your room and cook the first slice for you. Finish with Tsuyahime rice and the leftover egg.'
    },
    contents: [
      { ja: '山形牛 肩ロース 300g', en: 'Yamagata beef shoulder loin, 300 g' },
      { ja: '焼き豆腐・春菊・長ねぎ・しらたき・椎茸', en: 'Grilled tofu, shungiku, leek, shirataki, shiitake' },
      { ja: '平飼い卵 2個', en: '2 free-range eggs' },
      { ja: 'つや姫ご飯・香の物', en: 'Tsuyahime rice and pickles' }
    ],
    serve: { ja: '18:00〜19:30 のお好きな時間', en: 'Any time 18:00–19:30' },
    portion: { ja: '2人前', en: 'Serves 2' },
    allergens: ['egg', 'wheat', 'soy', 'beef'],
    note: { ja: '仕入れの都合で、チェックインの3日前までのご予約制です。', en: 'Reservation required at least 3 days before check-in.' },
    shots: [
      { ja: '鍋と肉の皿を真上から', en: 'Pot and beef, overhead' },
      { ja: '霜降りの肉のアップ', en: 'Close-up of the marbling' },
      { ja: '割下で煮えた一枚と卵', en: 'A cooked slice dipped in egg' },
      { ja: 'お部屋で炊いている様子', en: 'Cooking in the room' }
    ],
    photos: []
  },
  {
    slug: 'imoni-zen',
    key: '芋煮と山形の夕膳',
    name: { ja: '芋煮と山形の夕膳', en: 'Imoni dinner set' },
    cat: 'dinner',
    prep: true,
    kicker: { ja: '山形の秋の鍋を、ひとり膳で', en: "Yamagata's autumn stew, as a dinner set" },
    story: {
      ja: '里芋と牛肉を醤油仕立てで煮る、内陸山形の芋煮。そこに玉こんにゃく、刻み野菜の「だし」、季節の焼き物を添えた一人ずつのお膳です。お酒にも合わせやすい、軽めの夕食をお探しの方に。',
      en: 'Imoni — taro and beef simmered in soy broth, the way inland Yamagata makes it — served with tama-konnyaku, the chopped-vegetable relish called dashi, and a seasonal grilled dish. A lighter dinner that pairs well with sake.'
    },
    contents: [
      { ja: '芋煮（里芋・牛肉・こんにゃく・ねぎ）', en: 'Imoni (taro, beef, konnyaku, leek)' },
      { ja: '玉こんにゃく', en: 'Tama-konnyaku' },
      { ja: '山形のだし・冷奴', en: 'Yamagata dashi relish over chilled tofu' },
      { ja: '季節の焼き物', en: 'Seasonal grilled dish' },
      { ja: 'つや姫ご飯・香の物', en: 'Tsuyahime rice and pickles' }
    ],
    serve: { ja: '18:00〜19:30 のお好きな時間', en: 'Any time 18:00–19:30' },
    portion: { ja: '1人前', en: 'For 1' },
    allergens: ['wheat', 'soy', 'beef', 'fish'],
    note: { ja: 'チェックインの3日前までのご予約制です。', en: 'Reservation required at least 3 days before check-in.' },
    shots: [
      { ja: 'お膳の全景（真上から）', en: 'Full tray, overhead' },
      { ja: '芋煮の椀のアップ', en: 'Close-up of the imoni bowl' },
      { ja: 'だしと冷奴', en: 'Dashi relish and tofu' }
    ],
    photos: []
  },
  {
    slug: 'sashimi',
    key: 'お造り盛り合わせ',
    name: { ja: 'お造り盛り合わせ', en: 'Assorted sashimi' },
    cat: 'dinner',
    prep: true,
    kicker: { ja: '庄内浜から届く、その日の魚', en: "The day's catch from the Shonai coast" },
    story: {
      ja: '日本海の庄内浜で揚がった魚を中心に、その日いちばん良いものを5種盛り合わせます。すき焼きや夕膳の一品足しにも。',
      en: "Five kinds of the best fish of the day, mostly landed on Yamagata's Shonai coast on the Sea of Japan. Good on its own or alongside the sukiyaki or dinner set."
    },
    contents: [
      { ja: '本日の魚 5種', en: "5 kinds of today's fish" },
      { ja: '本わさび・つま', en: 'Fresh wasabi and garnish' }
    ],
    serve: { ja: '夕食と同じ時間にお持ちします', en: 'Served with dinner' },
    portion: { ja: '2人前', en: 'Serves 2' },
    allergens: ['fish', 'soy'],
    note: { ja: '魚の種類は入荷によって変わります。', en: 'The selection changes with the catch.' },
    shots: [
      { ja: '器ごと斜め45度から', en: 'The platter at 45°' },
      { ja: '魚の切り口のアップ', en: 'Close-up of the cuts' }
    ],
    photos: []
  },
  {
    slug: 'asa-gozen',
    key: '朝ごはん御膳',
    name: { ja: '朝ごはん御膳', en: 'Japanese breakfast set' },
    cat: 'breakfast',
    prep: true,
    kicker: { ja: '湯上がりに、炊きたてのつや姫', en: 'Fresh-cooked Tsuyahime rice after a morning soak' },
    story: {
      ja: '朝風呂のあとに、土鍋で炊いたつや姫と、庄内麩の味噌汁、焼き魚、玉子焼き、山形の漬物。ご希望の時間に、お部屋の扉前までお持ちします。',
      en: 'After your morning bath: clay-pot Tsuyahime rice, miso soup with Shonai wheat gluten, grilled fish, rolled omelette and Yamagata pickles. Delivered to your door at the time you choose.'
    },
    contents: [
      { ja: '土鍋炊きのつや姫', en: 'Clay-pot Tsuyahime rice' },
      { ja: '庄内麩の味噌汁', en: 'Miso soup with Shonai fu' },
      { ja: '焼き魚（日替わり）', en: 'Grilled fish of the day' },
      { ja: '玉子焼き・小鉢2品', en: 'Rolled omelette and 2 small sides' },
      { ja: '山形の漬物', en: 'Yamagata pickles' }
    ],
    serve: { ja: '7:30〜9:00 の15分刻みでお選びください', en: 'Choose a 15-minute slot, 7:30–9:00' },
    portion: { ja: '1人前', en: 'For 1' },
    allergens: ['egg', 'wheat', 'soy', 'fish'],
    note: { ja: 'チェックインの3日前までのご予約制です。', en: 'Reservation required at least 3 days before check-in.' },
    shots: [
      { ja: 'お膳の全景（窓の光で）', en: 'Full tray in window light' },
      { ja: '土鍋を開けた瞬間', en: 'Opening the clay pot' },
      { ja: '扉前に置いた様子', en: 'Left at the door' }
    ],
    photos: []
  },
  {
    slug: 'okayu',
    key: '朝がゆと小鉢',
    name: { ja: '朝がゆと小鉢', en: 'Rice porridge breakfast' },
    cat: 'breakfast',
    prep: true,
    kicker: { ja: '飲んだ翌朝の、やさしい一杯', en: 'A gentle bowl for the morning after' },
    story: {
      ja: 'つや姫を時間をかけて炊いたおかゆに、梅干し、だし、温泉卵。前の晩に地酒を楽しんだ方や、軽く済ませたい朝に。',
      en: 'Slow-cooked Tsuyahime rice porridge with umeboshi, dashi relish and an onsen egg. For the morning after a night of local sake, or when you want something light.'
    },
    contents: [
      { ja: 'つや姫のおかゆ', en: 'Tsuyahime rice porridge' },
      { ja: '温泉卵', en: 'Onsen egg' },
      { ja: '梅干し・だし・佃煮', en: 'Umeboshi, dashi relish, tsukudani' }
    ],
    serve: { ja: '7:30〜9:00 の15分刻みでお選びください', en: 'Choose a 15-minute slot, 7:30–9:00' },
    portion: { ja: '1人前', en: 'For 1' },
    allergens: ['egg', 'soy'],
    note: { ja: 'チェックインの3日前までのご予約制です。', en: 'Reservation required at least 3 days before check-in.' },
    shots: [
      { ja: '湯気の立つ椀', en: 'Steaming bowl' },
      { ja: '小鉢と並べて真上から', en: 'With the sides, overhead' }
    ],
    photos: []
  },
  {
    slug: 'jizake',
    key: '地酒 一合',
    name: { ja: '地酒 一合', en: 'Local sake (180 ml)' },
    cat: 'drink',
    kicker: { ja: '山形の蔵の酒を、冷かぬる燗で', en: 'Yamagata sake, chilled or warm' },
    story: {
      ja: '山形は全国でも吟醸酒づくりの盛んな県。その季節にいちばん美味しい県内の一本を、一合ずつお持ちします。冷・ぬる燗はご注文のときにお申し付けください。',
      en: 'Yamagata is one of Japan’s great ginjo-sake prefectures. We pour whichever local bottle is drinking best this season, by the 180 ml carafe. Tell us chilled or warm when you order.'
    },
    contents: [
      { ja: '山形県産の日本酒 一合（180ml）', en: 'Yamagata sake, 180 ml' },
      { ja: '酒器・お通し', en: 'Sake ware and a small snack' }
    ],
    serve: { ja: 'ご注文から約15分', en: 'About 15 minutes after ordering' },
    portion: { ja: '一合', en: '180 ml' },
    allergens: ['alcohol'],
    note: { ja: '20歳未満の方とお車を運転される方にはお出しできません。', en: 'Not served to anyone under 20 or driving.' },
    shots: [
      { ja: '徳利と猪口', en: 'Carafe and cup' },
      { ja: 'ラベルの見えるボトル', en: 'The bottle with label' }
    ],
    photos: []
  },
  {
    slug: 'la-france-juice',
    key: 'ラ・フランスジュース',
    name: { ja: 'ラ・フランスジュース', en: 'La France pear juice' },
    cat: 'drink',
    kicker: { ja: '山形の洋梨を、そのまま搾って', en: 'Yamagata pear, simply pressed' },
    story: {
      ja: '山形は西洋梨ラ・フランスの一大産地。とろりと濃い果汁は、湯上がりに冷やして。お子さまにも。',
      en: 'Yamagata grows most of Japan’s La France pears. The juice is thick and fragrant — best ice-cold after a bath, and good for kids too.'
    },
    contents: [{ ja: 'ラ・フランス果汁100%（200ml）', en: '100% La France pear juice, 200 ml' }],
    serve: { ja: 'ご注文から約15分', en: 'About 15 minutes after ordering' },
    portion: { ja: '1本', en: '1 bottle' },
    allergens: [],
    shots: [{ ja: 'グラスに注いだ様子', en: 'Poured into a glass' }],
    photos: []
  },
  {
    slug: 'beni-hoshigaki',
    key: '紅干し柿',
    name: { ja: '紅干し柿', en: 'Beni-hoshigaki (dried persimmon)' },
    cat: 'sweet',
    kicker: { ja: '上山の冬の軒先から', en: 'From the winter eaves of Kaminoyama' },
    story: {
      ja: '上山の秋は、家々の軒先に柿のすだれが下がる季節。蔵王おろしの冷たい風で干し上げた紅干し柿は、羊羹のようにやわらかく、お茶にもお酒にも合います。',
      en: 'In late autumn, curtains of persimmons hang from the eaves all over Kaminoyama. Dried in the cold wind off Mount Zao, beni-hoshigaki turn soft and dense, almost like yokan — lovely with tea or sake.'
    },
    contents: [{ ja: '紅干し柿 2個・煎茶のティーバッグ', en: '2 dried persimmons and sencha tea bags' }],
    serve: { ja: 'ご注文から約15分', en: 'About 15 minutes after ordering' },
    portion: { ja: '2個', en: '2 pieces' },
    allergens: [],
    note: { ja: '11月〜2月の限定です。', en: 'Available November to February.' },
    shots: [
      { ja: '割った断面', en: 'Cut open' },
      { ja: 'お茶と並べて', en: 'With a cup of tea' }
    ],
    photos: []
  },
  {
    slug: 'noshiume',
    key: 'のし梅',
    name: { ja: 'のし梅', en: 'Noshiume (plum confection)' },
    cat: 'sweet',
    kicker: { ja: '竹皮で包んだ、山形の梅のお菓子', en: "Yamagata's plum confection, wrapped in bamboo" },
    story: {
      ja: '完熟梅を寒天で薄くのばし、竹の皮にはさんだ山形の古いお菓子。甘酸っぱく、湯上がりの口がさっぱりします。',
      en: 'An old Yamagata sweet: ripe plum set thin with agar and pressed between sheets of bamboo bark. Sweet-sour and refreshing after a hot bath.'
    },
    contents: [{ ja: 'のし梅 2枚', en: '2 sheets of noshiume' }],
    serve: { ja: 'ご注文から約15分', en: 'About 15 minutes after ordering' },
    portion: { ja: '2枚', en: '2 sheets' },
    allergens: [],
    shots: [{ ja: '竹皮を開いたところ', en: 'Unwrapped from the bamboo bark' }],
    photos: []
  }
];

export const dishBySlug = (slug) => DISHES.find((d) => d.slug === slug);
export const dishByKey = (name) => DISHES.find((d) => d.key === name);

/** 料理の文章は日英だけ持つので、中国語・韓国語は英語で出す */
export const pickD = (obj, lang) => (obj ? obj[lang] || (lang !== 'ja' && obj.en) || obj.ja || '' : '');
