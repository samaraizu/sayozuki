// 商品の詳細ページ（/menu/<slug>）と、注文画面で商品をタップしたときのモーダルの中身。
// ふだんはスタッフ画面の「メニュー」→ 商品の編集 →「詳細ページ」で入れる（D1、src/square/detail.ts）。
// ここに書いた分は、スタッフ画面でまだ詳細ページを保存していない商品の初期値（保存すると画面の内容が優先される）。
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
  soba: { ja: 'そば', en: 'Buckwheat' },
  peanut: { ja: '落花生', en: 'Peanut' },
  walnut: { ja: 'くるみ', en: 'Walnut' },
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
  }
];

export const dishBySlug = (slug) => DISHES.find((d) => d.slug === slug);
export const dishByKey = (name) => DISHES.find((d) => d.key === name);

const CAT_OF = { 夕食: 'dinner', 朝食: 'breakfast', 飲み物: 'drink', お菓子: 'sweet' };

/**
 * メニューの1品（/api/menu・/api/public/menu）の詳細ページ。スタッフ画面で入れた detail があればそれ、無ければ上の DISHES。
 * cat はその品のカテゴリ（{ name, names, preorder }）
 */
export function dishFor(item, cat) {
  if (!item) return undefined;
  const d = item.detail;
  if (!d || !d.slug) return dishByKey(item.name);
  const fixed = dishByKey(item.name);
  const c = d.contents || {};
  return {
    slug: d.slug,
    key: item.name,
    name: { ja: item.name, ...(item.names || {}) },
    cat: CAT_OF[item.category],
    catLabel: cat ? { ja: cat.name, ...(cat.names || {}) } : null,
    prep: Boolean(cat && cat.preorder),
    kicker: d.kicker,
    story: d.story,
    contents: (c.ja || []).map((ja, k) => ({ ja, en: (c.en || [])[k] || '' })),
    serve: d.serve,
    portion: d.portion,
    allergens: d.allergens || [],
    note: d.note,
    // 写真は Square の商品写真。無ければ同じ品の DISHES の写真
    photos: fixed ? fixed.photos || [] : []
  };
}

/** 料理の文章は日英だけ持つので、中国語・韓国語は英語で出す */
export const pickD = (obj, lang) => (obj ? obj[lang] || (lang !== 'ja' && obj.en) || obj.ja || '' : '');
