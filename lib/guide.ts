import { meals, onsen, stay } from "./site";

/**
 * 滞在中のお客様向けご案内（/guide）。客室オーダーの「ご案内」タブからリンクしている。
 * 時刻など運用で決まる値は lib/site.ts の stay から読み、決まっていないものは「準備中」と出す。
 * 客室オーダーは繁体字・簡体字を分けているが、HPの中国語は簡体字のみなのでどちらも /zh に寄せる。
 */
export const guideLocales = ["ja", "en", "zh", "ko"] as const;
export type GuideLocale = (typeof guideLocales)[number];
export const isGuideLocale = (s: string): s is GuideLocale => (guideLocales as readonly string[]).includes(s);

export const guideSlugs = ["faq", "facility", "onsen", "area", "checkout"] as const;
export type GuideSlug = (typeof guideSlugs)[number];
export const isGuideSlug = (s: string): s is GuideSlug => (guideSlugs as readonly string[]).includes(s);

export const guidePath = (l: GuideLocale, slug?: GuideSlug) => `${l === "ja" ? "" : `/${l}`}/guide${slug ? `/${slug}` : ""}`;

export type Block =
  | { type: "rows"; rows: { k: string; v: string; pending?: boolean }[] }
  | { type: "qa"; items: { q: string; a: string }[] }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "tags"; items: string[] }
  | { type: "spots"; items: { name: string; text: string }[] }
  | { type: "text"; text: string };

export type GuideSection = { heading: string; blocks: Block[] };
export type GuideDoc = { title: string; en: string; lead: string; sections: GuideSection[] };

type UI = {
  guide: string;
  pending: string;
  back: string;
  orderNote: string;
  contact: string;
  nav: Record<GuideSlug, string>;
};

export const guideUI: Record<GuideLocale, UI> = {
  ja: {
    guide: "滞在中のご案内",
    pending: "準備中",
    back: "ご案内の一覧へ",
    orderNote: "お食事・お飲み物・0円のリクエストは、客室に置いてあるQRコードからご注文いただけます。",
    contact: "お困りのことがあれば、フロントまでお気軽にお声がけください。",
    nav: { faq: "よくあるご質問", facility: "館内のご案内", onsen: "温泉の入り方", area: "周辺のご案内", checkout: "チェックアウト" },
  },
  en: {
    guide: "Guide for your stay",
    pending: "To be announced",
    back: "All guide pages",
    orderNote: "Food, drinks and free requests can be ordered from the QR code in your room.",
    contact: "If you need anything, please feel free to ask at the front desk.",
    nav: { faq: "FAQ", facility: "Inside the ryokan", onsen: "Enjoying the onsen", area: "Around Kaminoyama", checkout: "Check-out" },
  },
  zh: {
    guide: "住宿指南",
    pending: "准备中",
    back: "返回指南目录",
    orderNote: "餐食、饮品及免费服务，可扫描客房内的二维码点单。",
    contact: "如有任何需要，请随时联系前台。",
    nav: { faq: "常见问题", facility: "馆内介绍", onsen: "泡汤须知", area: "周边导览", checkout: "退房说明" },
  },
  ko: {
    guide: "숙박 안내",
    pending: "준비 중",
    back: "안내 목록으로",
    orderNote: "식사・음료・무료 요청은 객실에 비치된 QR 코드로 주문하실 수 있습니다.",
    contact: "필요한 것이 있으시면 언제든지 프런트에 말씀해 주세요.",
    nav: { faq: "자주 묻는 질문", facility: "관내 안내", onsen: "온천 이용 방법", area: "주변 안내", checkout: "체크아웃" },
  },
};

const yenOf = (l: GuideLocale, n: number) => (l === "ja" ? `${n.toLocaleString("ja-JP")}円` : `¥${n.toLocaleString("en-US")}`);
const range = (r: { from: string; to: string }) => `${r.from}〜${r.to}`;

/** 決まっていない値は「準備中」の行にする */
const row = (l: GuideLocale, k: string, v: string | null) =>
  v ? { k, v } : { k, v: guideUI[l].pending, pending: true };

const BENEFITS: Record<Exclude<GuideLocale, "ja">, Record<string, string>> = {
  en: {
    神経痛: "Neuralgia", 筋肉痛: "Muscle pain", 関節痛: "Joint pain", 五十肩: "Frozen shoulder", 冷え性: "Poor circulation",
    打ち身: "Bruises", くじき: "Sprains", 切り傷: "Cuts", やけど: "Burns", 皮膚病: "Skin conditions", 痔: "Hemorrhoids",
    動脈硬化: "Arteriosclerosis", 婦人病: "Women's ailments", 消化器病: "Digestive ailments",
  },
  zh: {
    神経痛: "神经痛", 筋肉痛: "肌肉痛", 関節痛: "关节痛", 五十肩: "五十肩", 冷え性: "手脚冰冷", 打ち身: "跌打损伤",
    くじき: "扭伤", 切り傷: "割伤", やけど: "烫伤", 皮膚病: "皮肤病", 痔: "痔疮", 動脈硬化: "动脉硬化", 婦人病: "妇科病", 消化器病: "消化系统疾病",
  },
  ko: {
    神経痛: "신경통", 筋肉痛: "근육통", 関節痛: "관절통", 五十肩: "오십견", 冷え性: "수족냉증", 打ち身: "타박상",
    くじき: "삠", 切り傷: "베인 상처", やけど: "화상", 皮膚病: "피부병", 痔: "치질", 動脈硬化: "동맥경화", 婦人病: "부인병", 消化器病: "소화기 질환",
  },
};
const benefits = (l: GuideLocale) => onsen.benefits.map((b) => (l === "ja" ? b : (BENEFITS[l][b] ?? b)));

export function guideDoc(l: GuideLocale, slug: GuideSlug): GuideDoc {
  const o = stay.roomOrder;
  const bath = stay.bathHours ? range(stay.bathHours) : null;
  const bf = yenOf(l, meals.breakfast);
  const dn = yenOf(l, meals.dinner);

  const docs: Record<GuideLocale, Record<GuideSlug, GuideDoc>> = {
    ja: {
      faq: {
        title: "宿泊のよくあるご質問",
        en: "FAQ",
        lead: "お食事、お支払い、館内での過ごし方について。",
        sections: [
          {
            heading: "お食事",
            blocks: [
              {
                type: "qa",
                items: [
                  { q: "食事は付いていますか？", a: `素泊まりが基本です。朝食（お一人様 ${bf}）・夕食（お一人様 ${dn}）は、ご予約時に追加いただけます。` },
                  { q: "夜食や飲み物は頼めますか？", a: `客室のQRコードから、${o.open}〜${o.lastOrder}（ラストオーダー）までご注文いただけます。夕食のメニューは ${o.dinnerCutoff} までです。お部屋の扉の前にお届けします。` },
                  { q: "お湯やお茶はもらえますか？", a: "日本茶セット（お湯と茶葉）を無料でお持ちします。客室のQRコードの「リクエスト」からどうぞ。" },
                ],
              },
            ],
          },
          {
            heading: "お支払い",
            blocks: [
              {
                type: "qa",
                items: [
                  { q: "お部屋で注文したものはいつ払いますか？", a: "お部屋付けにして、チェックアウトのときにまとめてお支払いいただきます。ご自身のスマートフォンでのお支払い（クレジットカードなど）か、フロントでの現金でお受けします。" },
                  { q: "領収書はもらえますか？", a: "お支払いのあと、客室のQRコードの「お会計」から宛名入りの領収書を表示できます。" },
                  { q: "入湯税はかかりますか？", a: "温泉地のため、入湯税をフロントでいただきます。人数をおうかがいしますので、チェックアウトの際にお申し付けください。" },
                ],
              },
            ],
          },
          {
            heading: "館内で",
            blocks: [
              {
                type: "qa",
                items: [
                  { q: "Wi-Fiは使えますか？", a: "全室でお使いいただけます。ネットワーク名とパスワードは、客室のQRコードの「ご案内」に載せています。" },
                  { q: "タオルや湯たんぽを追加できますか？", a: "追加のタオル、湯たんぽ、氷セット、充電器（USB-C／Lightning）を無料でお持ちします。客室のQRコードの「リクエスト」からどうぞ。" },
                  { q: "そっとしておいてほしいときは？", a: "客室のQRコードの「リクエスト」で「朝まで起こさないで」をオンにすると、清掃やお声がけを控えます。" },
                  { q: "夜はどんな雰囲気ですか？", a: "団体のお客様はお受けしていない、静かな宿です。夜は皆さまが心地よく過ごせるよう、お静かにお過ごしください。" },
                ],
              },
            ],
          },
        ],
      },
      facility: {
        title: "館内のご案内",
        en: "Facilities",
        lead: "浴場の時間と、館内でお使いいただけるもの。",
        sections: [
          {
            heading: "時間",
            blocks: [
              {
                type: "rows",
                rows: [
                  row(l, "大浴場", bath),
                  row(l, "チェックイン", stay.checkIn),
                  row(l, "チェックアウト", stay.checkOut),
                  { k: "客室からのご注文", v: `${o.open}〜${o.lastOrder}（ラストオーダー）` },
                ],
              },
            ],
          },
          {
            heading: "設備",
            blocks: [
              {
                type: "rows",
                rows: [{ k: "Wi-Fi", v: "全室でご利用いただけます" }, { k: "温泉", v: "大浴場（かみのやま温泉）" }, row(l, "駐車場", stay.parking)],
              },
            ],
          },
          {
            heading: "無料でお持ちするもの",
            blocks: [
              { type: "list", items: ["日本茶セット（お湯と茶葉）", "湯たんぽ", "氷セット（アイスペールとトング）", "追加のタオル（バスタオル2枚）", "充電器の貸出（USB-C／Lightning）"] },
              { type: "text", text: "客室のQRコードの「リクエスト」からお申し付けください。お部屋の前にお置きします。" },
            ],
          },
          { heading: "館内図", blocks: [{ type: "text", text: "準備中です。浴場の場所などはフロントでご案内します。" }] },
        ],
      },
      onsen: {
        title: "温泉の入り方",
        en: "Onsen",
        lead: "かみのやま温泉の湯を、気持ちよくお楽しみいただくために。",
        sections: [
          {
            heading: "お湯について",
            blocks: [
              { type: "rows", rows: [{ k: "泉質", v: stay.onsenFull }, { k: "源泉", v: stay.onsenSources.join("・") }, row(l, "入浴できる時間", bath)] },
              { type: "text", text: "肌に薄い膜が残るような、湯冷めしにくいお湯です。" },
            ],
          },
          { heading: "効能", blocks: [{ type: "tags", items: benefits(l) }] },
          {
            heading: "入り方",
            blocks: [
              {
                type: "list",
                ordered: true,
                items: [
                  "脱衣所で服を脱ぎ、小さなタオルだけを持って浴室へ。",
                  "湯船に入る前に、かけ湯や洗い場で体を流します。",
                  "タオルは湯船に入れず、頭の上か湯船の外に。長い髪はまとめてください。",
                  "上がるときは体を軽く拭いてから脱衣所へ。",
                ],
              },
            ],
          },
          {
            heading: "お気をつけいただきたいこと",
            blocks: [
              {
                type: "list",
                items: ["お酒を飲んだ直後や、食事のすぐ後の入浴は控えてください。", "入浴の前後には水分をとってください。", "高温泉です。長湯をせず、のぼせないよう休みながらお入りください。", "体調がすぐれないときは無理をなさらないでください。"],
              },
            ],
          },
        ],
      },
      area: {
        title: "周辺のご案内",
        en: "Around Kaminoyama",
        lead: "昼は外で過ごし、夜は宿へ戻る。そんな使い方におすすめの場所です。",
        sections: [
          {
            heading: "かみのやま温泉",
            blocks: [
              {
                type: "spots",
                items: [
                  { name: "かみのやま温泉駅", text: "東京から山形新幹線で乗り換えなし。宿から歩ける距離です。" },
                  { name: "上山城", text: "城下町のシンボル。天守閣は郷土資料館になっています。" },
                  { name: "武家屋敷", text: "茅葺き屋根の武家屋敷が並ぶ通り。城下町の散歩に。" },
                  { name: "斎藤茂吉記念館", text: "上山出身の歌人・斎藤茂吉の記念館。" },
                ],
              },
            ],
          },
          {
            heading: "蔵王",
            blocks: [
              {
                type: "spots",
                items: [
                  { name: "蔵王温泉", text: "車で40分ほど。日中は蔵王で過ごし、夜はこちらに戻る過ごし方もできます。" },
                  { name: "樹氷（冬）", text: "冬の蔵王ならではの景色。ロープウェイで見に行けます。" },
                  { name: "御釜", text: "蔵王連峰の火口湖。季節や天候で通行できる時期が変わります。" },
                ],
              },
            ],
          },
          { heading: "", blocks: [{ type: "text", text: "道順や営業時間は変わることがあります。お出かけ前にフロントでもご案内します。" }] },
        ],
      },
      checkout: {
        title: "チェックアウトのご案内",
        en: "Check-out",
        lead: "お発ちの日の流れです。",
        sections: [
          { heading: "時間", blocks: [{ type: "rows", rows: [row(l, "チェックアウト", stay.checkOut)] }] },
          {
            heading: "お発ちの流れ",
            blocks: [
              {
                type: "list",
                ordered: true,
                items: [
                  "お部屋で注文したものがある場合は、フロントで精算をお伝えください。",
                  "客室のQRコードの「お会計」にお支払いボタンが出ます。ご自身のスマートフォンでお支払いいただけます（現金はフロントで）。",
                  "入湯税は人数をおうかがいして、フロントでいただきます。",
                  "お部屋の鍵をお渡ししている場合は、フロントにお返しください。",
                ],
              },
            ],
          },
          { heading: "領収書", blocks: [{ type: "text", text: "お支払いのあと、客室のQRコードの「お会計」から宛名入りの領収書を表示できます。" }] },
          { heading: "", blocks: [{ type: "text", text: "お忘れ物のないよう、お部屋と浴場をご確認ください。またのお越しをお待ちしております。" }] },
        ],
      },
    },

    en: {
      faq: {
        title: "FAQ for guests",
        en: "FAQ",
        lead: "Meals, payment, and how to spend your time here.",
        sections: [
          {
            heading: "Meals",
            blocks: [
              {
                type: "qa",
                items: [
                  { q: "Are meals included?", a: `Stays are room-only by default. Breakfast (${bf} per person) and dinner (${dn} per person) can be added when you book.` },
                  { q: "Can I order snacks or drinks?", a: `Yes — scan the QR code in your room to order from ${o.open} until ${o.lastOrder} (last order). Dinner items are available until ${o.dinnerCutoff}. We leave orders outside your door.` },
                  { q: "Can I get hot water or tea?", a: "We bring a Japanese tea set (hot water and tea leaves) free of charge. Use “Requests” on the in-room QR code." },
                ],
              },
            ],
          },
          {
            heading: "Payment",
            blocks: [
              {
                type: "qa",
                items: [
                  { q: "When do I pay for in-room orders?", a: "Orders are charged to your room and settled at check-out — on your own phone (credit card, etc.) or in cash at the front desk." },
                  { q: "Can I get a receipt?", a: "After paying, open “Bill” on the in-room QR code to show a receipt with your name." },
                  { q: "Is there a bathing tax?", a: "As a hot spring area, a bathing tax is collected at the front desk. We will ask the number of guests at check-out." },
                ],
              },
            ],
          },
          {
            heading: "During your stay",
            blocks: [
              {
                type: "qa",
                items: [
                  { q: "Is there Wi-Fi?", a: "Yes, in every room. The network name and password are shown under “About” on the in-room QR code." },
                  { q: "Can I get extra towels or a hot water bottle?", a: "We bring extra towels, a hot water bottle (yutanpo), an ice set and phone chargers (USB-C / Lightning) for free. Use “Requests” on the in-room QR code." },
                  { q: "What if I don't want to be disturbed?", a: "Turn on “Do not disturb until morning” under “Requests” and we will skip cleaning and knocking." },
                  { q: "What is it like at night?", a: "We do not take group bookings, and the ryokan is quiet. Please keep noise down at night so everyone can rest." },
                ],
              },
            ],
          },
        ],
      },
      facility: {
        title: "Inside the ryokan",
        en: "Facilities",
        lead: "Bath hours and what you can use during your stay.",
        sections: [
          {
            heading: "Hours",
            blocks: [
              {
                type: "rows",
                rows: [row(l, "Public bath", bath), row(l, "Check-in", stay.checkIn), row(l, "Check-out", stay.checkOut), { k: "In-room ordering", v: `${o.open}–${o.lastOrder} (last order)` }],
              },
            ],
          },
          { heading: "Facilities", blocks: [{ type: "rows", rows: [{ k: "Wi-Fi", v: "Available in all rooms" }, { k: "Hot spring", v: "Public bath (Kaminoyama Onsen)" }, row(l, "Parking", stay.parking)] }] },
          {
            heading: "Free on request",
            blocks: [
              { type: "list", items: ["Japanese tea set (hot water and tea leaves)", "Hot water bottle (yutanpo)", "Ice set (ice bucket and tongs)", "Extra towels (2 bath towels)", "Phone charger (USB-C / Lightning)"] },
              { type: "text", text: "Use “Requests” on the in-room QR code. We leave them outside your door." },
            ],
          },
          { heading: "Floor map", blocks: [{ type: "text", text: "Coming soon. Please ask at the front desk for directions to the bath." }] },
        ],
      },
      onsen: {
        title: "How to enjoy the onsen",
        en: "Onsen",
        lead: "A few tips for enjoying the waters of Kaminoyama Onsen.",
        sections: [
          {
            heading: "The water",
            blocks: [
              { type: "rows", rows: [{ k: "Type", v: "Sodium-calcium chloride-sulfate spring (hypotonic, weakly alkaline, high temperature)" }, { k: "Source", v: "Hayama No. 1 and No. 2 springs" }, row(l, "Bath hours", bath)] },
              { type: "text", text: "It leaves a light film on the skin and keeps you warm long after bathing." },
            ],
          },
          { heading: "Said to help with", blocks: [{ type: "tags", items: benefits(l) }] },
          {
            heading: "How to bathe",
            blocks: [
              {
                type: "list",
                ordered: true,
                items: ["Undress in the changing room and take only a small towel into the bath.", "Rinse your body before getting into the bath.", "Keep the towel out of the water — on your head or by the side. Tie up long hair.", "Wipe yourself lightly before going back to the changing room."],
              },
            ],
          },
          {
            heading: "Please note",
            blocks: [
              {
                type: "list",
                items: ["Avoid bathing right after drinking alcohol or a large meal.", "Drink water before and after bathing.", "The water is hot. Take breaks and don't stay in too long.", "Please don't bathe if you feel unwell."],
              },
            ],
          },
        ],
      },
      area: {
        title: "Around Kaminoyama",
        en: "Around Kaminoyama",
        lead: "Spend the day out and come back for a quiet night.",
        sections: [
          {
            heading: "Kaminoyama Onsen",
            blocks: [
              {
                type: "spots",
                items: [
                  { name: "Kaminoyama-Onsen Station", text: "Direct from Tokyo on the Yamagata Shinkansen. Within walking distance of the ryokan." },
                  { name: "Kaminoyama Castle", text: "The symbol of the castle town. The keep houses a local history museum." },
                  { name: "Samurai residences", text: "A street of thatched-roof samurai houses — a nice walk through the old town." },
                  { name: "Saito Mokichi Memorial Museum", text: "A museum for the tanka poet Saito Mokichi, born in Kaminoyama." },
                ],
              },
            ],
          },
          {
            heading: "Zao",
            blocks: [
              {
                type: "spots",
                items: [
                  { name: "Zao Onsen", text: "About 40 minutes by car. Spend the day in Zao and come back here for the night." },
                  { name: "Snow monsters (winter)", text: "Frost-covered trees unique to Zao in winter, reached by ropeway." },
                  { name: "Okama crater lake", text: "A crater lake in the Zao mountains. Road access depends on the season and weather." },
                ],
              },
            ],
          },
          { heading: "", blocks: [{ type: "text", text: "Routes and opening hours may change. Feel free to ask at the front desk before heading out." }] },
        ],
      },
      checkout: {
        title: "Check-out",
        en: "Check-out",
        lead: "What to do on the day you leave.",
        sections: [
          { heading: "Time", blocks: [{ type: "rows", rows: [row(l, "Check-out", stay.checkOut)] }] },
          {
            heading: "Before you leave",
            blocks: [
              {
                type: "list",
                ordered: true,
                items: [
                  "If you ordered anything to your room, let the front desk know you would like to settle.",
                  "A pay button appears under “Bill” on the in-room QR code. Pay on your own phone (or in cash at the front desk).",
                  "The bathing tax is collected at the front desk based on the number of guests.",
                  "If you were given a room key, please return it to the front desk.",
                ],
              },
            ],
          },
          { heading: "Receipt", blocks: [{ type: "text", text: "After paying, open “Bill” on the in-room QR code to show a receipt with your name." }] },
          { heading: "", blocks: [{ type: "text", text: "Please check your room and the bath for anything left behind. We hope to see you again." }] },
        ],
      },
    },

    zh: {
      faq: {
        title: "住宿常见问题",
        en: "FAQ",
        lead: "关于餐食、付款以及馆内的度过方式。",
        sections: [
          {
            heading: "餐食",
            blocks: [
              {
                type: "qa",
                items: [
                  { q: "是否含餐？", a: `基本为不含餐住宿。早餐（每位 ${bf}）、晚餐（每位 ${dn}）可在预订时加购。` },
                  { q: "可以点夜宵或饮品吗？", a: `可以。扫描客房内的二维码，${o.open}〜${o.lastOrder}（最后点单）均可点单。晚餐菜单供应至 ${o.dinnerCutoff}。我们会放在房门前。` },
                  { q: "可以要热水或茶吗？", a: "我们免费送上日本茶套装（热水和茶叶）。请通过客房二维码的“需求”提出。" },
                ],
              },
            ],
          },
          {
            heading: "付款",
            blocks: [
              {
                type: "qa",
                items: [
                  { q: "客房点的餐什么时候付款？", a: "记入房账，退房时统一结算。可用自己的手机付款（信用卡等），或在前台支付现金。" },
                  { q: "可以开收据吗？", a: "付款后，在客房二维码的“账单”中可显示带抬头的收据。" },
                  { q: "需要支付入汤税吗？", a: "本地为温泉区，入汤税在前台收取。退房时我们会询问入住人数。" },
                ],
              },
            ],
          },
          {
            heading: "馆内",
            blocks: [
              {
                type: "qa",
                items: [
                  { q: "有Wi-Fi吗？", a: "所有客房均可使用。网络名称和密码请见客房二维码的“服务指南”。" },
                  { q: "可以加毛巾或热水袋吗？", a: "我们免费送上加送毛巾、热水袋、冰块套装和充电器（USB-C／Lightning）。请通过客房二维码的“需求”提出。" },
                  { q: "不想被打扰时怎么办？", a: "在“需求”中开启“早上前请勿打扰”，我们将不进行打扫和敲门。" },
                  { q: "夜晚的氛围如何？", a: "本馆不接待团体客人，是一家安静的旅馆。夜间请保持安静，让大家都能好好休息。" },
                ],
              },
            ],
          },
        ],
      },
      facility: {
        title: "馆内介绍",
        en: "Facilities",
        lead: "浴场时间与馆内可使用的物品。",
        sections: [
          { heading: "时间", blocks: [{ type: "rows", rows: [row(l, "大浴场", bath), row(l, "入住", stay.checkIn), row(l, "退房", stay.checkOut), { k: "客房点餐", v: `${o.open}〜${o.lastOrder}（最后点单）` }] }] },
          { heading: "设施", blocks: [{ type: "rows", rows: [{ k: "Wi-Fi", v: "所有客房均可使用" }, { k: "温泉", v: "大浴场（上山温泉）" }, row(l, "停车场", stay.parking)] }] },
          {
            heading: "免费提供",
            blocks: [
              { type: "list", items: ["日本茶套装（热水和茶叶）", "热水袋", "冰块套装（冰桶和夹子）", "加送毛巾（浴巾2条）", "充电器出借（USB-C／Lightning）"] },
              { type: "text", text: "请通过客房二维码的“需求”提出，我们会放在房门前。" },
            ],
          },
          { heading: "馆内图", blocks: [{ type: "text", text: "准备中。浴场位置等请向前台咨询。" }] },
        ],
      },
      onsen: {
        title: "泡汤须知",
        en: "Onsen",
        lead: "舒适享受上山温泉的小提示。",
        sections: [
          {
            heading: "关于温泉",
            blocks: [
              { type: "rows", rows: [{ k: "泉质", v: "钠・钙－氯化物・硫酸盐温泉（低张性弱碱性高温泉）" }, { k: "源泉", v: "叶山地区1号源泉・2号源泉" }, row(l, "入浴时间", bath)] },
              { type: "text", text: "泡完后肌肤如覆一层薄膜，不易着凉。" },
            ],
          },
          { heading: "功效", blocks: [{ type: "tags", items: benefits(l) }] },
          {
            heading: "泡汤方法",
            blocks: [{ type: "list", ordered: true, items: ["在更衣室脱衣，只带一条小毛巾进入浴室。", "入池前先冲洗身体。", "毛巾请勿放入池中，可放在头上或池外。长发请扎起。", "出浴时先轻轻擦干身体再回更衣室。"] }],
          },
          { heading: "注意事项", blocks: [{ type: "list", items: ["饮酒后或饭后请勿立即入浴。", "入浴前后请补充水分。", "本温泉水温较高，请勿久泡，注意适当休息。", "身体不适时请勿勉强。"] }] },
        ],
      },
      area: {
        title: "周边导览",
        en: "Around Kaminoyama",
        lead: "白天外出游玩，晚上回到旅馆。推荐以下地点。",
        sections: [
          {
            heading: "上山温泉",
            blocks: [
              {
                type: "spots",
                items: [
                  { name: "上山温泉站", text: "从东京乘山形新干线直达，无需换乘。步行可达旅馆。" },
                  { name: "上山城", text: "城下町的象征，天守阁内为乡土资料馆。" },
                  { name: "武家屋敷", text: "茅草屋顶的武士宅邸街，适合在城下町散步。" },
                  { name: "斋藤茂吉纪念馆", text: "纪念上山出身的歌人斋藤茂吉。" },
                ],
              },
            ],
          },
          {
            heading: "藏王",
            blocks: [
              {
                type: "spots",
                items: [
                  { name: "藏王温泉", text: "开车约40分钟。白天在藏王游玩，晚上回到这里。" },
                  { name: "树冰（冬季）", text: "冬季藏王特有的景色，可乘缆车前往观赏。" },
                  { name: "御釜", text: "藏王连峰的火山口湖。可通行时间随季节和天气而变。" },
                ],
              },
            ],
          },
          { heading: "", blocks: [{ type: "text", text: "路线和营业时间可能变动，出发前也可向前台咨询。" }] },
        ],
      },
      checkout: {
        title: "退房说明",
        en: "Check-out",
        lead: "离店当天的流程。",
        sections: [
          { heading: "时间", blocks: [{ type: "rows", rows: [row(l, "退房", stay.checkOut)] }] },
          {
            heading: "离店流程",
            blocks: [
              {
                type: "list",
                ordered: true,
                items: ["如有客房点餐，请告知前台需要结算。", "客房二维码的“账单”中会出现付款按钮，可用自己的手机付款（现金请在前台支付）。", "入汤税将根据人数在前台收取。", "如领取了房间钥匙，请交还前台。"],
              },
            ],
          },
          { heading: "收据", blocks: [{ type: "text", text: "付款后，在客房二维码的“账单”中可显示带抬头的收据。" }] },
          { heading: "", blocks: [{ type: "text", text: "请确认客房和浴场没有遗留物品。期待您再次光临。" }] },
        ],
      },
    },

    ko: {
      faq: {
        title: "숙박 자주 묻는 질문",
        en: "FAQ",
        lead: "식사, 결제, 관내에서 지내는 방법에 대해 안내합니다.",
        sections: [
          {
            heading: "식사",
            blocks: [
              {
                type: "qa",
                items: [
                  { q: "식사가 포함되어 있나요?", a: `기본은 숙박만 하는 요금입니다. 조식(1인 ${bf})・석식(1인 ${dn})은 예약 시 추가하실 수 있습니다.` },
                  { q: "야식이나 음료를 주문할 수 있나요?", a: `객실의 QR 코드로 ${o.open}〜${o.lastOrder}(라스트 오더)까지 주문하실 수 있습니다. 저녁 메뉴는 ${o.dinnerCutoff}까지입니다. 객실 문 앞에 놓아 드립니다.` },
                  { q: "뜨거운 물이나 차를 받을 수 있나요?", a: "일본차 세트(뜨거운 물과 찻잎)를 무료로 가져다 드립니다. 객실 QR 코드의 '요청'에서 신청해 주세요." },
                ],
              },
            ],
          },
          {
            heading: "결제",
            blocks: [
              {
                type: "qa",
                items: [
                  { q: "객실에서 주문한 것은 언제 결제하나요?", a: "객실에 달아 두었다가 체크아웃 때 한꺼번에 결제합니다. 본인의 스마트폰으로 결제(신용카드 등)하시거나 프런트에서 현금으로 결제하실 수 있습니다." },
                  { q: "영수증을 받을 수 있나요?", a: "결제 후 객실 QR 코드의 '계산'에서 이름이 들어간 영수증을 표시할 수 있습니다." },
                  { q: "입탕세가 있나요?", a: "온천 지역이므로 입탕세를 프런트에서 받습니다. 체크아웃 때 인원을 여쭤보겠습니다." },
                ],
              },
            ],
          },
          {
            heading: "관내에서",
            blocks: [
              {
                type: "qa",
                items: [
                  { q: "Wi-Fi를 쓸 수 있나요?", a: "모든 객실에서 이용하실 수 있습니다. 네트워크 이름과 비밀번호는 객실 QR 코드의 '안내'에 있습니다." },
                  { q: "수건이나 탕파를 추가할 수 있나요?", a: "추가 수건, 탕파(유탄포), 얼음 세트, 충전기(USB-C／Lightning)를 무료로 가져다 드립니다. 객실 QR 코드의 '요청'에서 신청해 주세요." },
                  { q: "방해받고 싶지 않을 때는요?", a: "'요청'에서 '아침까지 방해하지 마세요'를 켜시면 청소와 노크를 하지 않습니다." },
                  { q: "밤에는 어떤 분위기인가요?", a: "단체 손님은 받지 않는 조용한 숙소입니다. 모두가 편히 쉴 수 있도록 밤에는 조용히 지내 주세요." },
                ],
              },
            ],
          },
        ],
      },
      facility: {
        title: "관내 안내",
        en: "Facilities",
        lead: "목욕탕 이용 시간과 관내에서 이용하실 수 있는 것.",
        sections: [
          { heading: "시간", blocks: [{ type: "rows", rows: [row(l, "대욕장", bath), row(l, "체크인", stay.checkIn), row(l, "체크아웃", stay.checkOut), { k: "객실 주문", v: `${o.open}〜${o.lastOrder} (라스트 오더)` }] }] },
          { heading: "시설", blocks: [{ type: "rows", rows: [{ k: "Wi-Fi", v: "모든 객실에서 이용 가능" }, { k: "온천", v: "대욕장 (가미노야마 온천)" }, row(l, "주차장", stay.parking)] }] },
          {
            heading: "무료로 가져다 드리는 것",
            blocks: [
              { type: "list", items: ["일본차 세트(뜨거운 물과 찻잎)", "탕파(유탄포)", "얼음 세트(아이스 버킷과 집게)", "추가 수건(목욕 수건 2장)", "충전기 대여(USB-C／Lightning)"] },
              { type: "text", text: "객실 QR 코드의 '요청'에서 신청해 주세요. 객실 문 앞에 놓아 드립니다." },
            ],
          },
          { heading: "관내도", blocks: [{ type: "text", text: "준비 중입니다. 목욕탕 위치 등은 프런트에서 안내해 드립니다." }] },
        ],
      },
      onsen: {
        title: "온천 이용 방법",
        en: "Onsen",
        lead: "가미노야마 온천을 기분 좋게 즐기시기 위해.",
        sections: [
          {
            heading: "온천수",
            blocks: [
              { type: "rows", rows: [{ k: "천질", v: "나트륨・칼슘-염화물・황산염 온천 (저장성 약알칼리성 고온천)" }, { k: "원천", v: "하야마 지구 1호・2호 원천" }, row(l, "입욕 시간", bath)] },
              { type: "text", text: "피부에 얇은 막이 남는 듯한, 쉽게 식지 않는 온천입니다." },
            ],
          },
          { heading: "효능", blocks: [{ type: "tags", items: benefits(l) }] },
          {
            heading: "입욕 방법",
            blocks: [{ type: "list", ordered: true, items: ["탈의실에서 옷을 벗고 작은 수건만 들고 욕실로 들어갑니다.", "탕에 들어가기 전에 몸을 씻어 냅니다.", "수건은 탕에 넣지 말고 머리 위나 탕 밖에 두세요. 긴 머리는 묶어 주세요.", "나올 때는 몸을 가볍게 닦고 탈의실로 갑니다."] }],
          },
          { heading: "주의 사항", blocks: [{ type: "list", items: ["음주 직후나 식사 직후의 입욕은 삼가 주세요.", "입욕 전후에는 수분을 섭취해 주세요.", "고온천입니다. 오래 있지 말고 쉬면서 입욕해 주세요.", "몸이 좋지 않을 때는 무리하지 마세요."] }] },
        ],
      },
      area: {
        title: "주변 안내",
        en: "Around Kaminoyama",
        lead: "낮에는 밖에서 보내고 밤에는 숙소로 돌아오는 여행에 추천하는 곳입니다.",
        sections: [
          {
            heading: "가미노야마 온천",
            blocks: [
              {
                type: "spots",
                items: [
                  { name: "가미노야마온센역", text: "도쿄에서 야마가타 신칸센으로 환승 없이 도착. 숙소까지 걸어갈 수 있는 거리입니다." },
                  { name: "가미노야마성", text: "성하 마을의 상징. 천수각은 향토 자료관입니다." },
                  { name: "무가 저택", text: "초가지붕 무가 저택이 늘어선 거리. 성하 마을 산책에 좋습니다." },
                  { name: "사이토 모키치 기념관", text: "가미노야마 출신 가인 사이토 모키치의 기념관." },
                ],
              },
            ],
          },
          {
            heading: "자오",
            blocks: [
              {
                type: "spots",
                items: [
                  { name: "자오 온천", text: "차로 약 40분. 낮에는 자오에서 보내고 밤에는 이곳으로 돌아오실 수 있습니다." },
                  { name: "수빙 (겨울)", text: "겨울 자오만의 풍경. 로프웨이로 보러 갈 수 있습니다." },
                  { name: "오카마", text: "자오 연봉의 화구호. 계절과 날씨에 따라 통행 가능 시기가 달라집니다." },
                ],
              },
            ],
          },
          { heading: "", blocks: [{ type: "text", text: "길과 영업시간은 바뀔 수 있습니다. 나가시기 전에 프런트에서도 안내해 드립니다." }] },
        ],
      },
      checkout: {
        title: "체크아웃 안내",
        en: "Check-out",
        lead: "출발하시는 날의 흐름입니다.",
        sections: [
          { heading: "시간", blocks: [{ type: "rows", rows: [row(l, "체크아웃", stay.checkOut)] }] },
          {
            heading: "출발 순서",
            blocks: [
              {
                type: "list",
                ordered: true,
                items: ["객실에서 주문한 것이 있으면 프런트에 정산을 말씀해 주세요.", "객실 QR 코드의 '계산'에 결제 버튼이 나타납니다. 본인의 스마트폰으로 결제하실 수 있습니다(현금은 프런트에서).", "입탕세는 인원을 여쭤본 뒤 프런트에서 받습니다.", "객실 열쇠를 받으셨다면 프런트에 반납해 주세요."],
              },
            ],
          },
          { heading: "영수증", blocks: [{ type: "text", text: "결제 후 객실 QR 코드의 '계산'에서 이름이 들어간 영수증을 표시할 수 있습니다." }] },
          { heading: "", blocks: [{ type: "text", text: "객실과 목욕탕에 두고 가신 물건이 없는지 확인해 주세요. 다시 찾아 주시기를 기다리겠습니다." }] },
        ],
      },
    },
  };
  return docs[l][slug];
}

