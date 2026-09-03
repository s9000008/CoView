/**
 * CoView 前端環境設定檔
 * 支援依不同環境 (Local 開發 / Production 正式發布) 讀取 VITE_DEFAULT_SERVER_URL
 */
export const DEFAULT_SERVER_URL: string =
  (import.meta.env.VITE_DEFAULT_SERVER_URL as string) || 'https://coview.fly.dev';

export const ENV_NAME: string =
  (import.meta.env.VITE_ENV_NAME as string) || (DEFAULT_SERVER_URL.includes('localhost') || DEFAULT_SERVER_URL.includes('127.0.0.1') ? 'local' : 'production');

export const IS_LOCAL_DEV: boolean = ENV_NAME === 'local';

export const SERVER_LABEL: string = IS_LOCAL_DEV
  ? `本地預設主機 (${DEFAULT_SERVER_URL})`
  : `官方雲端主機 (${DEFAULT_SERVER_URL})`;
