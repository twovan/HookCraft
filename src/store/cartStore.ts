'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  template_id: string;
  name: string;
  price: number; // 单位：分
  cover_url: string | null;
  genre: string;
  added_at: string; // ISO 时间戳
}

export interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => { success: boolean; message?: string };
  removeItem: (templateId: string) => void;
  clearCart: () => void;
  getTotal: () => number;
  getCount: () => number;
  hasItem: (templateId: string) => boolean;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item: CartItem) => {
        const { items } = get();
        if (items.some((i) => i.template_id === item.template_id)) {
          return { success: false, message: '该模板已在购物车中' };
        }
        set({ items: [...items, item] });
        return { success: true, message: '已加入购物车' };
      },

      removeItem: (templateId: string) => {
        set({ items: get().items.filter((i) => i.template_id !== templateId) });
      },

      clearCart: () => {
        set({ items: [] });
      },

      getTotal: () => {
        return get().items.reduce((sum, item) => sum + item.price, 0);
      },

      getCount: () => {
        return get().items.length;
      },

      hasItem: (templateId: string) => {
        return get().items.some((i) => i.template_id === templateId);
      },
    }),
    {
      name: 'hookcraft-cart',
    }
  )
);
