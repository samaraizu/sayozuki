// 画面の文言（5言語）。商品名・カテゴリ名の訳はサーバー側 src/config/i18n-menu.ts で持つ
export const LANGS = [
  { id: 'ja', code: 'ja', label: '日本語', short: '日本語', font: '' },
  { id: 'en', code: 'en', label: 'English', short: 'EN', font: '' },
  { id: 'zht', code: 'zh-Hant', label: '繁體中文', short: '繁中', font: 'Noto+Sans+TC' },
  { id: 'zhs', code: 'zh-Hans', label: '简体中文', short: '简中', font: 'Noto+Sans+SC' },
  { id: 'ko', code: 'ko', label: '한국어', short: '한국어', font: 'Noto+Sans+KR' }
];

// Wi-Fiなど館内で変わる情報はここを書き換える
export const STAY_INFO = { wifiSsid: '[SSID]', wifiPass: '[PASSWORD]' };

export const ABOUT = [
  { slug: 'faq', name: { ja: '宿泊のよくあるご質問', en: 'FAQ for guests', zht: '住宿常見問題', zhs: '住宿常见问题', ko: '숙박 자주 묻는 질문' }, sub: { ja: '食事・アメニティ・お支払い', en: 'Meals, amenities, payment', zht: '餐飲・備品・付款', zhs: '餐饮・备品・付款', ko: '식사・어메니티・결제' } },
  { slug: 'facility', name: { ja: '館内のご案内', en: 'Inside the ryokan', zht: '館內介紹', zhs: '馆内介绍', ko: '관내 안내' }, sub: { ja: '浴場の時間・館内図', en: 'Bath hours, floor map', zht: '浴場時間・館內圖', zhs: '浴场时间・馆内图', ko: '목욕탕 이용 시간・관내도' } },
  { slug: 'onsen', name: { ja: '温泉の入り方', en: 'How to enjoy the onsen', zht: '溫泉泡湯須知', zhs: '温泉泡汤须知', ko: '온천 이용 방법' }, sub: { ja: '泉質・マナー', en: 'Spring water and etiquette', zht: '泉質・禮儀', zhs: '泉质・礼仪', ko: '천질・매너' } },
  { slug: 'area', name: { ja: '周辺のご案内', en: 'Around Kaminoyama', zht: '周邊導覽', zhs: '周边导览', ko: '주변 안내' }, sub: { ja: 'かみのやま温泉・蔵王', en: 'Kaminoyama Onsen, Zao', zht: '上山溫泉・藏王', zhs: '上山温泉・藏王', ko: '가미노야마 온천・자오' } },
  { slug: 'checkout', name: { ja: 'チェックアウトのご案内', en: 'Check-out', zht: '退房說明', zhs: '退房说明', ko: '체크아웃 안내' }, sub: { ja: '時間・お会計・鍵の返却', en: 'Time, payment, key return', zht: '時間・結帳・歸還鑰匙', zhs: '时间・结账・归还钥匙', ko: '시간・결제・열쇠 반납' } }
];

export const REQUESTS = [
  { kind: 'greentea', name: { ja: '日本茶セット', en: 'Japanese tea set', zht: '日本茶組', zhs: '日本茶组', ko: '일본차 세트' }, sub: { ja: 'お湯と茶葉をお持ちします', en: 'Hot water and tea leaves', zht: '提供熱水與茶葉', zhs: '提供热水与茶叶', ko: '뜨거운 물과 찻잎을 가져다 드립니다' } },
  { kind: 'yutanpo', name: { ja: '湯たんぽ', en: 'Hot-water bottle', zht: '熱水袋', zhs: '热水袋', ko: '보온 물주머니' }, sub: { ja: '冷える夜に', en: 'For chilly nights', zht: '寒夜保暖', zhs: '寒夜保暖', ko: '추운 밤에' } },
  { kind: 'ice', name: { ja: '氷セット', en: 'Ice set', zht: '冰塊組', zhs: '冰块组', ko: '얼음 세트' }, sub: { ja: 'アイスペールとトング', en: 'Ice bucket and tongs', zht: '冰桶與冰夾', zhs: '冰桶与冰夹', ko: '얼음통과 집게' } },
  { kind: 'towel', name: { ja: '追加のタオル', en: 'Extra towels', zht: '加送毛巾', zhs: '加送毛巾', ko: '추가 수건' }, sub: { ja: 'バスタオル2枚', en: '2 bath towels', zht: '浴巾2條', zhs: '浴巾2条', ko: '목욕 수건 2장' } },
  { kind: 'charger', name: { ja: '充電器の貸出', en: 'Phone charger', zht: '充電器出借', zhs: '充电器出借', ko: '충전기 대여' }, sub: { ja: 'USB-C / Lightning' } }
];

const T = {
  room: { ja: '{r}号室', en: 'Room {r}', zht: '{r}號房', zhs: '{r}号房', ko: '{r}호' },
  lastOrder: { ja: 'ラストオーダー {t}', en: 'Last order {t}', zht: '最後點餐 {t}', zhs: '最后点餐 {t}', ko: '라스트 오더 {t}' },
  orderingClosed: { ja: '本日のご注文は終了しました', en: 'Ordering has closed for today', zht: '今日點餐已結束', zhs: '今日点餐已结束', ko: '오늘 주문은 마감되었습니다' },
  deliveryNote: { ja: 'お届けは扉前・ノックなし', en: 'Left at your door, no knock', zht: '放置門前・不敲門', zhs: '放在门前・不敲门', ko: '문 앞 배달・노크 없음' },
  all: { ja: 'すべて', en: 'All', zht: '全部', zhs: '全部', ko: '전체' },
  soldOut: { ja: '売り切れ', en: 'Sold out', zht: '已售完', zhs: '已售罄', ko: '품절' },
  closedCat: { ja: '本日の受付終了', en: 'Closed for today', zht: '今日已截止', zhs: '今日已截止', ko: '오늘 접수 마감' },
  left: { ja: '残り{n}', en: '{n} left', zht: '剩{n}份', zhs: '剩{n}份', ko: '{n}개 남음' },
  add: { ja: '{n}を追加', en: 'Add {n}', zht: '加入{n}', zhs: '加入{n}', ko: '{n} 추가' },
  dec: { ja: '減らす', en: 'Decrease', zht: '減少', zhs: '减少', ko: '줄이기' },
  inc: { ja: '増やす', en: 'Increase', zht: '增加', zhs: '增加', ko: '늘리기' },
  photos: { ja: '{n}の写真を見る', en: 'View photos: {n}', zht: '查看照片：{n}', zhs: '查看照片：{n}', ko: '{n} 사진 보기' },
  photoSoon: { ja: '写真準備中', en: 'Photo coming soon', zht: '照片準備中', zhs: '照片准备中', ko: '사진 준비 중' },
  addToOrder: { ja: '注文に追加・{p}', en: 'Add to order · {p}', zht: '加入點餐・{p}', zhs: '加入点餐・{p}', ko: '주문에 추가・{p}' },
  addMore: { ja: 'もう1つ追加（{q}点）', en: 'Add one more ({q})', zht: '再加一份（{q}份）', zhs: '再加一份（{q}份）', ko: '하나 더 추가({q}개)' },
  added: { ja: '追加済み（{q}点）', en: 'Added ({q})', zht: '已加入（{q}份）', zhs: '已加入（{q}份）', ko: '추가됨({q}개)' },
  prevPhoto: { ja: '前の写真', en: 'Previous photo', zht: '上一張', zhs: '上一张', ko: '이전 사진' },
  nextPhoto: { ja: '次の写真', en: 'Next photo', zht: '下一張', zhs: '下一张', ko: '다음 사진' },
  reqTitle: { ja: 'リクエスト', en: 'Requests', zht: '客房需求', zhs: '客房需求', ko: '요청' },
  reqLead: { ja: '無料でお持ちします。お部屋の前に置いて、届いたらお知らせします。', en: 'Free of charge. We’ll leave it at your door and let you know.', zht: '免費提供。放在房門前，送達後會通知您。', zhs: '免费提供。放在房门前，送达后会通知您。', ko: '무료로 가져다 드립니다. 문 앞에 두고 도착하면 알려 드립니다.' },
  dndTitle: { ja: '朝まで起こさないで', en: 'Do not disturb until morning', zht: '早上前請勿打擾', zhs: '早上前请勿打扰', ko: '아침까지 방해하지 마세요' },
  dndSub: { ja: '清掃・お声がけを控えます', en: 'No cleaning or knocking', zht: '不進行打掃與敲門', zhs: '不进行打扫与敲门', ko: '청소・방문을 자제합니다' },
  reqDo: { ja: 'お願いする', en: 'Request', zht: '申請', zhs: '申请', ko: '요청하기' },
  reqDone: { ja: '依頼済み', en: 'Requested', zht: '已申請', zhs: '已申请', ko: '요청 완료' },
  billTitle: { ja: 'お会計', en: 'Bill', zht: '帳單', zhs: '账单', ko: '계산' },
  billLead: { ja: 'ご注文はお部屋付けです。チェックアウト時にまとめてお支払いください。', en: 'Orders are charged to your room. Please settle everything at check-out.', zht: '點餐費用記入房帳，請於退房時一併結帳。', zhs: '点餐费用记入房账，请于退房时一并结账。', ko: '주문은 객실에 달아 드립니다. 체크아웃 시 한꺼번에 결제해 주세요.' },
  noOrders: { ja: 'まだご注文はありません', en: 'No orders yet', zht: '尚無點餐紀錄', zhs: '尚无点餐记录', ko: '아직 주문이 없습니다' },
  delivered: { ja: 'お届け済み', en: 'Delivered', zht: '已送達', zhs: '已送达', ko: '배달 완료' },
  preparing: { ja: '準備中', en: 'Preparing', zht: '準備中', zhs: '准备中', ko: '준비 중' },
  canceled: { ja: '取消', en: 'Canceled', zht: '已取消', zhs: '已取消', ko: '취소됨' },
  bathTax: { ja: '入湯税', en: 'Bathing tax', zht: '入湯稅', zhs: '入汤税', ko: '입탕세' },
  bathTaxSub: { ja: '{g}名 × {n}泊・自動加算', en: '{g} guests × {n} nights · added automatically', zht: '{g}位 × {n}晚・自動加計', zhs: '{g}位 × {n}晚・自动加计', ko: '{g}명 × {n}박・자동 추가' },
  total: { ja: '合計（税込）', en: 'Total (tax incl.)', zht: '合計（含稅）', zhs: '合计（含税）', ko: '합계(세금 포함)' },
  payNow: { ja: 'お支払いへ進む', en: 'Pay now', zht: '前往付款', zhs: '前往付款', ko: '결제하기' },
  payLead: { ja: 'お会計の準備ができました。このスマホでお支払いいただけます。', en: 'Your bill is ready. You can pay on this phone.', zht: '帳單已準備好，可直接用這支手機付款。', zhs: '账单已准备好，可直接用这部手机付款。', ko: '계산 준비가 되었습니다. 이 휴대폰으로 결제하실 수 있습니다.' },
  paid: { ja: 'お支払い済みです。ありがとうございました。', en: 'Paid. Thank you for staying with us.', zht: '已完成付款，感謝您的光臨。', zhs: '已完成付款，感谢您的光临。', ko: '결제가 완료되었습니다. 감사합니다.' },
  receipt: { ja: '宛名入り領収書を発行する', en: 'Issue a receipt in your name', zht: '開立抬頭收據', zhs: '开具抬头收据', ko: '성함이 들어간 영수증 발행' },
  checkCart: { ja: '注文内容を確認', en: 'Review order', zht: '確認點餐內容', zhs: '确认点餐内容', ko: '주문 내용 확인' },
  navMenu: { ja: 'メニュー', en: 'Menu', zht: '菜單', zhs: '菜单', ko: '메뉴' },
  navRequest: { ja: 'リクエスト', en: 'Requests', zht: '需求', zhs: '需求', ko: '요청' },
  navBill: { ja: 'お会計', en: 'Bill', zht: '帳單', zhs: '账单', ko: '계산' },
  navAbout: { ja: 'ご案内', en: 'About', zht: '服務指南', zhs: '服务指南', ko: '안내' },
  aboutTitle: { ja: 'ご案内', en: 'About your stay', zht: '住宿指南', zhs: '住宿指南', ko: '숙박 안내' },
  aboutLead: { ja: 'ご滞在中に役立つ情報をまとめています。', en: 'Everything you need during your stay.', zht: '彙整住宿期間的實用資訊。', zhs: '汇总住宿期间的实用信息。', ko: '머무시는 동안 필요한 정보를 모았습니다.' },
  wifiPass: { ja: 'パスワード', en: 'Password', zht: '密碼', zhs: '密码', ko: '비밀번호' },
  opensSite: { ja: '公式サイトで開きます', en: 'Opens on our website', zht: '將於官方網站開啟', zhs: '将在官方网站打开', ko: '공식 사이트에서 열립니다' },
  sheetTitle: { ja: 'ご注文内容', en: 'Your order', zht: '點餐內容', zhs: '点餐内容', ko: '주문 내용' },
  deliveryLabel: { ja: 'お届け方法', en: 'Delivery', zht: '送達方式', zhs: '送达方式', ko: '전달 방법' },
  door: { ja: '扉前に置く（ノックなし）', en: 'Leave at door (no knock)', zht: '放門前（不敲門）', zhs: '放门前（不敲门）', ko: '문 앞에 두기(노크 없음)' },
  hand: { ja: '手渡し', en: 'Hand to me', zht: '親手交付', zhs: '亲手交付', ko: '직접 전달' },
  roomCharge: { ja: 'お部屋付け', en: 'Charged to room', zht: '記入房帳', zhs: '记入房账', ko: '객실 청구' },
  placeOrder: { ja: '注文する', en: 'Place order', zht: '下單', zhs: '下单', ko: '주문하기' },
  sending: { ja: '送信中…', en: 'Sending…', zht: '傳送中…', zhs: '发送中…', ko: '전송 중…' },
  doneTitle: { ja: '承りました', en: 'Order received', zht: '已收到您的點餐', zhs: '已收到您的点餐', ko: '주문을 받았습니다' },
  doneDoor: { ja: '扉の前にそっとお置きします。', en: 'We’ll quietly leave it at your door.', zht: '我們會輕輕放在您的房門前。', zhs: '我们会轻轻放在您的房门前。', ko: '문 앞에 조용히 두고 가겠습니다.' },
  doneHand: { ja: 'お部屋までお持ちします。', en: 'We’ll bring it to your room.', zht: '我們會送到您的房間。', zhs: '我们会送到您的房间。', ko: '객실까지 가져다 드리겠습니다.' },
  doneNotify: { ja: '届いたらこの画面でお知らせします。', en: 'This screen will let you know when it arrives.', zht: '送達後會在此畫面通知您。', zhs: '送达后会在此页面通知您。', ko: '도착하면 이 화면에서 알려 드립니다.' },
  arrived: { ja: 'ご注文の品をお届けしました', en: 'Your order has been delivered', zht: '您點的餐點已送達', zhs: '您点的餐品已送达', ko: '주문하신 상품이 도착했습니다' },
  back: { ja: 'メニューに戻る', en: 'Back to menu', zht: '返回菜單', zhs: '返回菜单', ko: '메뉴로 돌아가기' },
  close: { ja: '閉じる', en: 'Close', zht: '關閉', zhs: '关闭', ko: '닫기' },
  langTitle: { ja: '言語', en: 'Language', zht: '語言', zhs: '语言', ko: '언어' },
  noToken: { ja: 'お部屋のQRコードをもう一度読み取ってください。', en: 'Please scan the QR code in your room again.', zht: '請再次掃描客房內的QR碼。', zhs: '请再次扫描客房内的二维码。', ko: '객실의 QR 코드를 다시 스캔해 주세요.' },
  stayEnded: { ja: 'ご滞在は終了しています。ご利用ありがとうございました。', en: 'Your stay has ended. Thank you for staying with us.', zht: '您的住宿已結束，感謝您的光臨。', zhs: '您的住宿已结束，感谢您的光临。', ko: '숙박이 종료되었습니다. 이용해 주셔서 감사합니다.' },
  errSoldOut: { ja: '{n}は売り切れになりました', en: '{n} just sold out', zht: '{n}已售完', zhs: '{n}已售罄', ko: '{n} 품절되었습니다' },
  errCatClosed: { ja: '{n}は本日の受付を終了しました', en: '{n} is closed for today', zht: '{n}今日已截止', zhs: '{n}今日已截止', ko: '{n} 오늘 접수가 마감되었습니다' },
  errPending: { ja: 'お会計の準備中のため、追加のご注文はフロントへお申し付けください', en: 'Your bill is being prepared. Please contact the front desk for more orders.', zht: '帳單準備中，如需加點請洽櫃台。', zhs: '账单准备中，如需加点请联系前台。', ko: '계산 준비 중이므로 추가 주문은 프런트에 문의해 주세요.' },
  errNetwork: { ja: '通信できませんでした。もう一度お試しください', en: 'Connection failed. Please try again.', zht: '連線失敗，請再試一次。', zhs: '连接失败，请重试。', ko: '연결에 실패했습니다. 다시 시도해 주세요.' },
  thanksPaid: { ja: 'お支払いを受け付けました', en: 'Payment received', zht: '已收到付款', zhs: '已收到付款', ko: '결제가 접수되었습니다' }
};

export function makeT(lang) {
  return (key, vars = {}) => {
    const e = T[key];
    let s = (e && (e[lang] || e.ja)) || key;
    for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  };
}

export const pick = (obj, lang, fallback) => (obj && (obj[lang] || obj.ja)) || fallback || '';
