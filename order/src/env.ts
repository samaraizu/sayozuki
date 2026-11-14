export interface Env {
  DB: D1Database;
  DESK: DurableObjectNamespace;
  ASSETS: Fetcher;
  /** 予約管理の OrderApi（いまお客様がいる部屋）。ローカルでは無いことがあるので任意 */
  BOOKING?: { occupied(): Promise<{ night: string; rooms: string[] }> };
  /** 翻訳（Workers AI）。ローカルでは無いことがあるので任意 */
  AI?: Ai;

  SQUARE_ENV: 'sandbox' | 'production';
  SQUARE_LOCATION_ID: string;
  SQUARE_ACCESS_TOKEN?: string;
  SQUARE_WEBHOOK_SIGNATURE_KEY?: string;
  MOCK_SQUARE: string;

  STAFF_PIN?: string;
  NOTIFY_SLACK_WEBHOOK?: string;

  ORDER_OPEN: string;
  LAST_ORDER: string;
  BATH_TAX_YEN?: string;
  PUBLIC_ORIGIN: string;
  GUIDE_BASE_URL: string;
  COMPANY_NAME: string;
  COMPANY_ADDRESS: string;
  COMPANY_TEL: string;
  /** 館内Wi-Fi。公開リポジトリに書かないよう Secret で登録する（未登録なら画面に「準備中」） */
  WIFI_SSID?: string;
  WIFI_PASSWORD?: string;
}

/** モックは明示的に MOCK_SQUARE=1 のときだけ（本番でSquare未設定のまま「支払ったことにする」が動かないように） */
export const isMock = (env: Env) => env.MOCK_SQUARE === '1';
