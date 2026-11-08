// /menu（一覧）と /menu/<slug>（1品の紹介）。客室QRなしで開ける公開ページ。Airbnb のゲストに食事を聞くメッセージにも載せる
import { DISHES, DISH_CATS, dishBySlug, pickD } from './dishes.js';
import { slidesOf, galleryHtml, dishBodyHtml, bindGallery } from './dish-view.js';
import { esc, yen, initialLang, setLang, pageHeader, loadPublicMenu, dishName } from './page-common.js';

const L = {
  title: { ja: 'お部屋でのお食事', en: 'In-room dining', zht: '客房用餐', zhs: '客房用餐' , ko: '객실 식사' },
  lead: {
    ja: '小夜月では、夕食・朝食・お飲み物・お菓子をお部屋までお届けします。夕食と朝食は仕込みが要るため、ご予約のときにお申し込みいただく事前予約制です。',
    en: 'We bring dinner, breakfast, drinks and sweets to your room. Dinner and breakfast are prepared to order, so they are booked together with your stay.'
  },
  ctaPrep: {
    ja: '夕食・朝食はご予約のときにお申し込みください。Airbnbでご予約の方には、宿からメッセージでお伺いします。仕込みの都合で、当日のお申し込みは承れません。',
    en: 'Please add dinner and breakfast when you book. If you booked on Airbnb, we will ask you by message. We cannot prepare meals requested on the day.'
  },
  ctaRoom: { ja: 'ご滞在中は、お部屋のQRコードからいつでもご注文いただけます。', en: 'During your stay, order any time from the QR code in your room.' },
  all: { ja: 'メニューをすべて見る', en: 'See the full menu' },
  notFound: { ja: 'このページは見つかりませんでした。', en: 'This page could not be found.' },
  foot: { ja: '価格は税込です。内容は仕入れによって変わることがあります。', en: 'Prices include tax. Contents may change with the season.' }
};
const l = (k) => pickD(L[k], S.lang);

const S = { lang: initialLang(), menu: null, idx: 0 };
const root = document.getElementById('pg');
const slug = decodeURIComponent(location.pathname.replace(/^\/menu\/?/, '').replace(/\/$/, ''));
const itemOf = (d) => S.menu && S.menu.find((i) => i.name === d.key);

function viewDish(d) {
  const item = itemOf(d);
  const slides = slidesOf(d, item);
  const name = dishName(d, item, S.lang);
  document.title = `${name} | 小夜月 Sayozuki`;
  const cta = d.prep
    ? `<div class="pg-cta"><p>${esc(l('ctaPrep'))}</p></div>`
    : `<div class="pg-cta"><p>${esc(l('ctaRoom'))}</p></div>`;
  return `<main class="pg-main">${galleryHtml(slides, Math.min(S.idx, slides.length - 1), S.lang)}
    ${dishBodyHtml(d, S.lang, { name, price: item ? item.price : null })}
    ${cta}
    <div class="pg-sec" style="margin-top:14px"><a class="btn-ghost" href="/menu?lang=${S.lang}">${esc(l('all'))}</a></div>
    <p class="pg-foot">${esc(l('foot'))}</p></main>`;
}

function viewIndex() {
  document.title = `${l('title')} | 小夜月 Sayozuki`;
  const sections = Object.entries(DISH_CATS)
    .map(([cat, label]) => {
      const ds = DISHES.filter((d) => d.cat === cat);
      if (!ds.length) return '';
      const cards = ds
        .map((d) => {
          const item = itemOf(d);
          const first = slidesOf(d, item)[0];
          const ph = first.src ? `<img src="${esc(first.src)}" alt="" loading="lazy">` : galleryHtml([first], 0, S.lang);
          return `<a class="mcard" href="/menu/${d.slug}?lang=${S.lang}"><span class="ph">${ph}</span>
            <span class="tx"><span class="t">${esc(dishName(d, item, S.lang))}</span><span class="s">${esc(pickD(d.kicker, S.lang))}</span>
            <span class="p">${item ? yen(item.price) : ''}${d.portion ? ` <span class="s">${esc(pickD(d.portion, S.lang))}</span>` : ''}</span></span></a>`;
        })
        .join('');
      const prep = ds.some((x) => x.prep) ? `<span class="dv-badge prep" style="margin-left:8px">${esc(pickD({ ja: '事前予約制', en: 'Pre-order' }, S.lang))}</span>` : '';
      return `<h2 class="cat-title" style="margin-top:22px">${esc(pickD(label, S.lang))}${prep}</h2>${cards}`;
    })
    .join('');
  return `<main class="pg-main">
    <section class="mh"><p class="en">IN-ROOM DINING</p><h1>${esc(l('title'))}</h1><p>${esc(l('lead'))}</p></section>
    <div class="pg-cta"><p>${esc(l('ctaPrep'))}</p></div>
    <div class="pg-sec">${sections}</div>
    <p class="pg-foot">${esc(l('foot'))}</p></main>`;
}

function render() {
  setLang(S.lang);
  const d = slug ? dishBySlug(slug) : null;
  const body = !slug ? viewIndex() : d ? viewDish(d) : `<main class="pg-main"><div class="center-msg">${esc(l('notFound'))}</div></main>`;
  root.innerHTML = pageHeader(S.lang) + body;
  bindGallery(root, () => S.idx, (i) => { S.idx = i; render(); });
}

root.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const { act, id } = el.dataset;
  if (act === 'lang') { S.lang = id; render(); }
  if (act === 'dv-prev') { S.idx = Math.max(0, S.idx - 1); render(); }
  if (act === 'dv-next') { S.idx += 1; render(); }
});

render();
loadPublicMenu().then((m) => { S.menu = m; render(); });
