import { DurableObject } from 'cloudflare:workers';
import type { Env } from './env';
import { isMock } from './env';
import { CATEGORIES } from './config/i18n-menu';
import { HttpError, newId } from './lib/util';
import { hhmmToMin, jstParts, nowIso, withinWindow } from './lib/time';
import { fetchSquareMenu } from './square/menu';
import { mockMenu } from './square/mock';
import type { Menu } from './square/types';

const MENU_TTL_MS = 60_000;

export interface PlaceOrderInput {
  roomId: string;
  lines: { id: string; qty: number }[];
  delivery: 'door' | 'hand';
}

/**
 * 旅館全体で1つだけ動く「注文の受付窓口」。
 * - メニューのキャッシュを持つ（Webhookで即破棄）
 * - 注文を1件ずつ直列に処理するので、残り1食に同時注文が来ても二重に通らない
 */
export class OrderDesk extends DurableObject<Env> {
  private menu: Menu | null = null;

  async getMenu(force = false): Promise<Menu> {
    if (!force && this.menu && Date.now() - this.menu.fetchedAt < MENU_TTL_MS) return this.menu;
    this.menu = isMock(this.env) ? mockMenu() : await fetchSquareMenu(this.env);
    return this.menu;
  }

  purgeMenu() {
    this.menu = null;
  }

  /** 未精算の滞在で押さえ済みの数量（在庫追跡している商品のみ） */
  private async pending(): Promise<Map<string, number>> {
    const r = await this.env.DB.prepare(
      `SELECT l.variation_id AS id, SUM(l.qty) AS qty
         FROM order_lines l
         JOIN orders o ON o.id = l.order_id
         LEFT JOIN settlements st ON st.id = o.settlement_id
        WHERE l.tracked = 1 AND o.status != 'canceled' AND (o.settlement_id IS NULL OR st.status = 'pending')
        GROUP BY l.variation_id`
    ).all<{ id: string; qty: number }>();
    return new Map((r.results ?? []).map((x) => [x.id, Number(x.qty)]));
  }

  /** ゲスト画面用：残り数と締め切りを反映したメニュー */
  async guestMenu() {
    const menu = await this.getMenu();
    const pend = await this.pending();
    const now = jstParts().minutes;
    const open = withinWindow(this.env.ORDER_OPEN, this.env.LAST_ORDER);
    return {
      open,
      lastOrder: this.env.LAST_ORDER,
      categories: menu.categories.map((c) => ({ ...c, closed: !open || (c.cutoff ? now >= hhmmToMin(c.cutoff) : false) })),
      items: menu.items.map((i) => {
        const left = i.tracked ? Math.max(0, (i.stock ?? 0) - (pend.get(i.id) ?? 0)) : null;
        return {
          id: i.id,
          name: i.name,
          names: i.names,
          desc: i.desc,
          descs: i.descs,
          price: i.price,
          category: i.category,
          images: i.images,
          left,
          soldOut: i.soldOut || left === 0
        };
      })
    };
  }

  /** RPC越しに例外の中身が落ちないよう、結果はオブジェクトで返す */
  async placeOrder(input: PlaceOrderInput): Promise<
    { ok: true; id: string; total: number; room: string; lines: { name: string; qty: number }[] } | { ok: false; status: number; code: string; detail?: string }
  > {
    let out: any;
    await this.ctx.blockConcurrencyWhile(async () => {
      try {
        out = { ok: true, ...(await this.placeOrderLocked(input)) };
      } catch (e) {
        if (e instanceof HttpError) out = { ok: false, status: e.status, code: e.code, detail: e.message !== e.code ? e.message : undefined };
        else {
          console.error(e);
          out = { ok: false, status: 500, code: 'internal' };
        }
      }
    });
    return out;
  }

  private async placeOrderLocked({ roomId, lines, delivery }: PlaceOrderInput) {
    const room = await this.env.DB.prepare('SELECT id, name FROM rooms WHERE id = ?').bind(roomId).first<{ id: string; name: string }>();
    if (!room) throw new HttpError(404, 'room_not_found');
    if (!withinWindow(this.env.ORDER_OPEN, this.env.LAST_ORDER)) throw new HttpError(409, 'ordering_closed');

    const merged = new Map<string, number>();
    for (const l of lines) {
      const q = Math.floor(Number(l.qty));
      if (!l.id || !Number.isFinite(q) || q < 1 || q > 20) throw new HttpError(400, 'bad_line');
      merged.set(l.id, (merged.get(l.id) ?? 0) + q);
    }
    if (!merged.size) throw new HttpError(400, 'empty_order');

    const menu = await this.getMenu();
    const pend = await this.pending();
    const now = jstParts().minutes;
    const orderId = newId('ord');
    const createdAt = nowIso();
    let total = 0;
    const rows: { id: string; name: string; price: number; qty: number; tracked: boolean }[] = [];

    for (const [id, qty] of merged) {
      const item = menu.items.find((i) => i.id === id);
      if (!item) throw new HttpError(409, 'item_unavailable');
      const cutoff = CATEGORIES[item.category]?.cutoff;
      if (cutoff && now >= hhmmToMin(cutoff)) throw new HttpError(409, 'category_closed', item.name);
      if (item.soldOut) throw new HttpError(409, 'sold_out', item.name);
      if (item.tracked) {
        const left = (item.stock ?? 0) - (pend.get(id) ?? 0);
        if (left < qty) throw new HttpError(409, 'sold_out', item.name);
      }
      total += item.price * qty;
      rows.push({ id, name: item.name, price: item.price, qty, tracked: item.tracked });
    }

    const stmts = [
      this.env.DB.prepare('INSERT INTO orders (id, room_id, delivery, status, total, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(
        orderId,
        roomId,
        delivery === 'hand' ? 'hand' : 'door',
        'new',
        total,
        createdAt
      ),
      ...rows.map((r) =>
        this.env.DB.prepare('INSERT INTO order_lines (order_id, variation_id, name, unit_price, qty, tracked) VALUES (?, ?, ?, ?, ?, ?)').bind(
          orderId,
          r.id,
          r.name,
          r.price,
          r.qty,
          r.tracked ? 1 : 0
        )
      )
    ];
    await this.env.DB.batch(stmts);
    return { id: orderId, total, room: room.name, lines: rows.map((r) => ({ name: r.name, qty: r.qty })) };
  }
}
