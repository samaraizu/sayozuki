import type { Env } from '../env';
import { nowIso } from './time';
import { CHAT_LANGS, translate } from './translate';
import { HttpError, newId } from './util';

export interface MessageRow {
  id: string;
  room_id: string;
  sender: 'guest' | 'staff';
  body: string;
  lang: string;
  translated: string | null;
  translated_lang: string | null;
  closed: number;
  read_at: string | null;
  created_at: string;
}

export const MAX_LEN = 1000;

const clean = (s: unknown) =>
  String(s ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();

/** その部屋の、いまのお客様との会話（チェックアウトで閉じたものは出さない） */
export async function openMessages(env: Env, roomId: string) {
  const r = await env.DB.prepare('SELECT * FROM messages WHERE room_id = ? AND closed = 0 ORDER BY created_at LIMIT 300').bind(roomId).all<MessageRow>();
  return r.results ?? [];
}

/** お客様側に見せる形：スタッフの返事はお客様の言語に訳したものを主に、原文を添える */
export const forGuest = (m: MessageRow) => ({
  id: m.id,
  from: m.sender,
  text: m.sender === 'staff' && m.translated ? m.translated : m.body,
  original: m.sender === 'staff' && m.translated ? m.body : null,
  read: Boolean(m.read_at),
  at: m.created_at
});

/** スタッフ側に見せる形：お客様のメッセージは日本語訳を主に、原文を添える */
export const forStaff = (m: MessageRow) => ({
  id: m.id,
  from: m.sender,
  text: m.sender === 'guest' && m.translated ? m.translated : m.body,
  original: m.sender === 'guest' && m.translated ? m.body : null,
  lang: m.lang,
  read: Boolean(m.read_at),
  at: m.created_at
});

export async function guestSend(env: Env, room: { id: string; name: string }, input: { text?: unknown; lang?: unknown }) {
  const text = clean(input.text);
  const lang = CHAT_LANGS.includes(String(input.lang)) ? String(input.lang) : 'en';
  if (!text) throw new HttpError(400, 'empty');
  if (text.length > MAX_LEN) throw new HttpError(400, 'too_long');
  // いたずら対策：10分で20通まで
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM messages WHERE room_id = ? AND sender = 'guest' AND created_at >= ?")
    .bind(room.id, new Date(Date.now() - 10 * 60e3).toISOString())
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= 20) throw new HttpError(429, 'too_many');

  const ja = await translate(env, text, lang, 'ja');
  const id = newId('msg');
  await env.DB.prepare('INSERT INTO messages (id, room_id, sender, body, lang, translated, translated_lang, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, room.id, 'guest', text, lang, ja, ja ? 'ja' : null, nowIso())
    .run();
  // 通知に出す一文（スタッフ向けなので日本語訳を優先）
  return { id, notice: `💬 ${room.name}：${(ja ?? text).replace(/\s+/g, ' ').slice(0, 80)}` };
}

export async function staffSend(env: Env, roomId: string, input: { text?: unknown }) {
  const text = clean(input.text);
  if (!text) throw new HttpError(400, 'empty');
  if (text.length > MAX_LEN) throw new HttpError(400, 'too_long');
  // お客様の言語は、その会話で最後にお客様が書いた言語。まだ何も来ていなければ訳さない
  const last = await env.DB.prepare("SELECT lang FROM messages WHERE room_id = ? AND closed = 0 AND sender = 'guest' ORDER BY created_at DESC LIMIT 1")
    .bind(roomId)
    .first<{ lang: string }>();
  const to = last?.lang ?? 'ja';
  const tr = await translate(env, text, 'ja', to);
  const id = newId('msg');
  const now = nowIso();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO messages (id, room_id, sender, body, lang, translated, translated_lang, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(
      id,
      roomId,
      'staff',
      text,
      'ja',
      tr,
      tr ? to : null,
      now
    ),
    // 返事をした = それまでのお客様のメッセージは読んだ
    env.DB.prepare("UPDATE messages SET read_at = ? WHERE room_id = ? AND sender = 'guest' AND closed = 0 AND read_at IS NULL").bind(now, roomId)
  ]);
  return id;
}

/** チェックアウトで会話を閉じる（次のお客様に見えないように） */
export const closeChat = (env: Env, roomId: string) => env.DB.prepare('UPDATE messages SET closed = 1 WHERE room_id = ? AND closed = 0').bind(roomId);
