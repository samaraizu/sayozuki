// 商品の詳細ページ（/menu/<slug>）と、注文画面で商品をタップしたときのモーダルの中身。
// key = Squareに登録した日本語の商品名（src/config/i18n-menu.ts の ITEMS と同じ）。価格・在庫・Squareの写真はここに書かず、
// /api/public/menu（客室QRなしで読める）から引く。ここに書くのは、Squareの「説明」に収まらない読み物だけ。
//
// prep: true … 仕込みが要る事前予約制の品（夕食・朝食）。注文画面では注文できず、予約のとき（Airbnbは宿がメッセージで聞いて予約管理に入れる）に申し込む
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
  pork: { ja: '豚肉', en: 'Pork' },
  alcohol: { ja: 'アルコール', en: 'Alcohol' }
};

export const DISHES = [
  {
    slug: 'sukiyaki',
    key: '山形牛すき焼き',
    name: { ja: '山形牛すき焼き 〆の讃岐うどん付き', en: 'Yamagata beef sukiyaki with udon to finish' },
    cat: 'dinner',
    prep: true,
    kicker: { ja: '部屋で炊く山形牛の割下鍋。〆はうどんで', en: 'Yamagata beef simmered at your table, finished with udon' },
    story: {
      ja: '霜の細かい山形牛を、甘さを控えた割下でさっと煮ます。卓上の鍋はお部屋にお持ちし、溶き卵にくぐらせてどうぞ。肉と野菜の旨みが溶けた割下に、最後はコシの強い讃岐うどんを入れて〆にします。',
      en: 'Finely marbled Yamagata beef, briefly simmered in a lightly sweet warishita broth at your table — dip each slice in beaten egg. When the broth is rich with beef and vegetables, finish with firm Sanuki udon noodles.'
    },
    contents: [
      { ja: '山形牛（すき焼き用）', en: 'Yamagata beef, sliced for sukiyaki' },
      { ja: '焼き豆腐・白菜・春菊・長ねぎ・椎茸', en: 'Grilled tofu, napa cabbage, shungiku, leek, shiitake' },
      { ja: '卵（1人1個）', en: '1 egg per person' },
      { ja: '〆の讃岐うどん', en: 'Sanuki udon to finish' }
    ],
    serve: { ja: '18:00〜19:30 のお好きな時間', en: 'Any time 18:00–19:30' },
    portion: { ja: '2人前', en: 'Serves 2' },
    allergens: ['egg', 'wheat', 'soy', 'beef'],
    note: { ja: '仕入れの都合で、ご予約のときにお申し込みいただく事前予約制です。', en: 'Book together with your stay; not available on the day.' },
    photos: ['/images/menu/sukiyaki.jpg', '/images/menu/sukiyaki-udon.jpg']
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
    note: { ja: 'ご予約のときにお申し込みいただく事前予約制です。', en: 'Book together with your stay; not available on the day.' },
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
    slug: 'croissant',
    key: 'クロワッサンサンドの朝食',
    name: { ja: 'クロワッサンサンドの朝食', en: 'Croissant sandwich breakfast' },
    cat: 'breakfast',
    prep: true,
    kicker: { ja: 'バターの香るクロワッサンに、ハムとチーズ', en: 'Buttery croissant with ham and cheese' },
    story: {
      ja: 'さくっと軽いクロワッサンに、粗挽き胡椒のハム、チーズ、たっぷりのレタスをはさみました。朝風呂のあとに、お好きなお飲み物と一緒にお部屋で。',
      en: 'A light, flaky croissant filled with pepper-crusted ham, cheese and plenty of lettuce. Enjoy it in your room after a morning soak, with a drink of your choice.'
    },
    contents: [
      { ja: 'クロワッサンサンド（ハム・チーズ・レタス）', en: 'Croissant sandwich (ham, cheese, lettuce)' },
      { ja: 'コーヒー・紅茶・抹茶・日本茶から1杯（無料）', en: 'Coffee, black tea, matcha or Japanese green tea (free)' }
    ],
    serve: { ja: '7:30〜9:00 のご希望の時間に扉前へ', en: 'Left at your door at your chosen time, 7:30–9:00' },
    portion: { ja: '1人前・お飲み物付き', en: 'For 1, with a drink' },
    allergens: ['wheat', 'milk', 'egg', 'pork', 'soy'],
    note: { ja: 'お飲み物はセットで無料です。ご予約のときにお申し込みいただく事前予約制です。', en: 'The drink is included free. Book together with your stay; not available on the day.' },
    photos: ['/images/menu/breakfast-croissant.jpg']
  },
  {
    slug: 'onigiri',
    key: 'おにぎりと漬物の朝食',
    name: { ja: 'おにぎりと漬物の朝食', en: 'Rice ball breakfast with pickles' },
    cat: 'breakfast',
    prep: true,
    kicker: { ja: '菜めしのおにぎりと、ぽりぽりの漬物', en: 'Greens rice balls and crunchy pickles' },
    story: {
      ja: '刻んだ青菜を混ぜ込んだご飯を、ふんわり握ったおにぎり2つ。たくあんとしば漬けを添えました。温かいお茶と一緒に、軽く済ませたい朝に。',
      en: 'Two softly pressed rice balls mixed with chopped greens, served with takuan and shibazuke pickles. A light breakfast, best with a cup of hot tea.'
    },
    contents: [
      { ja: '菜めしのおにぎり 2個', en: '2 rice balls with greens' },
      { ja: 'たくあん・しば漬け', en: 'Takuan and shibazuke pickles' },
      { ja: 'コーヒー・紅茶・抹茶・日本茶から1杯（無料）', en: 'Coffee, black tea, matcha or Japanese green tea (free)' }
    ],
    serve: { ja: '7:30〜9:00 のご希望の時間に扉前へ', en: 'Left at your door at your chosen time, 7:30–9:00' },
    portion: { ja: '1人前・お飲み物付き', en: 'For 1, with a drink' },
    allergens: [],
    note: { ja: 'お飲み物はセットで無料です。ご予約のときにお申し込みいただく事前予約制です。', en: 'The drink is included free. Book together with your stay; not available on the day.' },
    photos: ['/images/menu/breakfast-onigiri.jpg']
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
