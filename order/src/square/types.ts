import type { Tr } from '../config/i18n-menu';

/** ゲスト画面に渡すメニュー1品（Squareの商品バリエーション単位） */
export interface MenuItem {
  id: string; // variation id
  itemId: string;
  name: string; // 日本語（Squareの登録名）
  names: Tr;
  desc: string;
  descs: Tr;
  price: number;
  category: string;
  tracked: boolean;
  stock: number | null; // 追跡していない商品は null
  soldOut: boolean;
  /** スタッフ画面で一時停止中（soldOut にも含めている） */
  paused: boolean;
  images: string[];
  imageIds: string[];
}

export interface Menu {
  fetchedAt: number;
  items: MenuItem[];
  categories: { name: string; names: Tr; order: number; cutoff?: string }[];
}
