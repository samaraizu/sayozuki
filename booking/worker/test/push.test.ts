import { describe, expect, it } from 'vitest';
import { isPushEndpoint, summarizeNotes } from '../src/push';

describe('通知の文', () => {
  it('取り込みGASの通知メールの1行目をまとめる', () => {
    expect(summarizeNotes([])).toBeNull();
    expect(summarizeNotes(undefined)).toBeNull();
    expect(summarizeNotes(['新しい予約：Airbnb 月山 11/12〜11/14 2名\n  https://mail.google.com/x'])).toEqual({
      title: '小夜月 予約',
      body: '新しい予約：Airbnb 月山 11/12〜11/14 2名',
    });
    expect(summarizeNotes(['[重複] 301 11/20', '', '[定員超え] 302 11/21\n詳細'])).toEqual({
      title: '小夜月 予約（2件）',
      body: '[重複] 301 11/20\n[定員超え] 302 11/21',
    });
  });
});

describe('通知先', () => {
  it('ブラウザのプッシュ配信元だけ受け付ける', () => {
    expect(isPushEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
    expect(isPushEndpoint('https://web.push.apple.com/QGx')).toBe(true);
    expect(isPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x')).toBe(true);
    expect(isPushEndpoint('https://evil.example.com/googleapis.com')).toBe(false);
    expect(isPushEndpoint('http://fcm.googleapis.com/x')).toBe(false);
    expect(isPushEndpoint('not a url')).toBe(false);
  });
});
