/**
 * Squareのカタログは日本語1本で管理し、他言語はここで持つ。
 * キー = Squareに登録した日本語の「商品名」「カテゴリ名」そのもの。
 * 商品を増やしたら、ここに同じ日本語名で4言語の訳を足す（未登録の言語は日本語で表示される）。
 */
export type Lang = 'ja' | 'en' | 'zht' | 'zhs' | 'ko';
export type Tr = Partial<Record<Lang, string>>;

export interface CategoryConf {
  names: Tr;
  order: number;
  /** この時刻（日本時間）を過ぎたら当日の注文を締め切る */
  cutoff?: string;
}

export const CATEGORIES: Record<string, CategoryConf> = {
  夕食: { order: 1, cutoff: '18:00', names: { en: 'Dinner', zht: '晚餐', zhs: '晚餐', ko: '저녁' } },
  夜食: { order: 2, names: { en: 'Late night', zht: '宵夜', zhs: '夜宵', ko: '야식' } },
  飲み物: { order: 3, names: { en: 'Drinks', zht: '飲品', zhs: '饮品', ko: '음료' } },
  翌朝: { order: 4, names: { en: 'Morning', zht: '隔日早晨', zhs: '次日早晨', ko: '다음날 아침' } }
};

export const ITEMS: Record<string, { name: Tr; desc?: Tr }> = {
  山形牛すき焼き: {
    name: { en: 'Yamagata beef sukiyaki', zht: '山形牛壽喜燒', zhs: '山形牛寿喜烧', ko: '야마가타규 스키야키' },
    desc: { en: 'For 2', zht: '2人份', zhs: '2人份', ko: '2인분' }
  },
  お造り盛り合わせ: {
    name: { en: 'Assorted sashimi', zht: '生魚片拼盤', zhs: '生鱼片拼盘', ko: '모둠 회' },
    desc: { en: 'For 2', zht: '2人份', zhs: '2人份', ko: '2인분' }
  },
  塩むすび: {
    name: { en: 'Salt rice balls', zht: '鹽味飯糰', zhs: '盐味饭团', ko: '소금 주먹밥' },
    desc: { en: '2 pcs with pickles', zht: '2個・附醬菜', zhs: '2个・附酱菜', ko: '2개・절임 반찬 포함' }
  },
  玉子サンドウィッチ: {
    name: { en: 'Egg sandwich', zht: '雞蛋三明治', zhs: '鸡蛋三明治', ko: '달걀 샌드위치' },
    desc: { en: '4 pieces', zht: '4片', zhs: '4片', ko: '4조각' }
  },
  カップラーメン: {
    name: { en: 'Cup noodles', zht: '杯麵', zhs: '杯面', ko: '컵라면' },
    desc: { en: 'Hot water included', zht: '附熱水', zhs: '附热水', ko: '뜨거운 물 제공' }
  },
  '地酒 一合': {
    name: { en: 'Local sake (180 ml)', zht: '在地清酒 一合', zhs: '本地清酒 一合', ko: '지역 사케 1홉' },
    desc: { en: 'Chilled or warm', zht: '冷飲／溫飲', zhs: '冷饮／温饮', ko: '차갑게 / 따뜻하게' }
  },
  '瓶ビール 中瓶': {
    name: { en: 'Bottled beer (500 ml)', zht: '瓶裝啤酒（中瓶）', zhs: '瓶装啤酒（中瓶）', ko: '병맥주(중병)' },
    desc: { en: '2 glasses', zht: '附2個杯子', zhs: '附2个杯子', ko: '잔 2개' }
  },
  ラ・フランスジュース: {
    name: { en: 'La France pear juice', zht: '洋梨果汁（La France）', zhs: '洋梨果汁（La France）', ko: '라프랑스 배 주스' },
    desc: { en: 'From Yamagata', zht: '山形產', zhs: '山形产', ko: '야마가타산' }
  },
  天然水: { name: { en: 'Mineral water', zht: '天然水', zhs: '天然水', ko: '생수' } },
  緑茶: { name: { en: 'Green tea (bottle)', zht: '綠茶（瓶裝）', zhs: '绿茶（瓶装）', ko: '녹차(병)' } },
  翌朝のコーヒー: {
    name: { en: 'Morning coffee', zht: '隔日早晨咖啡', zhs: '次日早晨咖啡', ko: '다음날 아침 커피' },
    desc: { en: 'At your door when you wake', zht: '於起床時間送到門前', zhs: '于起床时间送到门前', ko: '기상 시간에 문 앞으로' }
  },
  レイトチェックアウト: {
    name: { en: 'Late check-out', zht: '延遲退房', zhs: '延迟退房', ko: '레이트 체크아웃' },
    desc: { en: 'Until 12 noon', zht: '延長至中午12點', zhs: '延长至中午12点', ko: '낮 12시까지 연장' }
  }
};

export const BATH_TAX_LABEL = '入湯税';
