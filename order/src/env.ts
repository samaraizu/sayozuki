export interface Env {
  DB: D1Database;
  DESK: DurableObjectNamespace;
  ASSETS: Fetcher;

  SQUARE_ENV: 'sandbox' | 'production';
  SQUARE_LOCATION_ID: string;
  SQUARE_ACCESS_TOKEN?: string;
  SQUARE_WEBHOOK_SIGNATURE_KEY?: string;
  MOCK_SQUARE: string;

  STAFF_PIN?: string;
  NOTIFY_SLACK_WEBHOOK?: string;

  BATH_TAX_YEN: string;
  ORDER_OPEN: string;
  LAST_ORDER: string;
  PUBLIC_ORIGIN: string;
  GUIDE_BASE_URL: string;
  COMPANY_NAME: string;
  COMPANY_ADDRESS: string;
  COMPANY_TEL: string;
}

/** モックは明示的に MOCK_SQUARE=1 のときだけ（本番でSquare未設定のまま「支払ったことにする」が動かないように） */
export const isMock = (env: Env) => env.MOCK_SQUARE === '1';
