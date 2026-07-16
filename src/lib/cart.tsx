"use client";

/**
 * Persistent shopping cart: quantities live in localStorage; product details
 * are ALWAYS re-fetched and re-priced on the server — nothing here is trusted.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export interface CartLine {
  productId: string;
  qty: number;
}

const STORAGE_KEY = "hdml-cart-v1";
const MAX_LINES = 200;
const MAX_QTY = 100000;

function readStorage(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (l): l is CartLine =>
          typeof l === "object" &&
          l !== null &&
          typeof (l as CartLine).productId === "string" &&
          Number.isInteger((l as CartLine).qty) &&
          (l as CartLine).qty > 0,
      )
      .slice(0, MAX_LINES);
  } catch {
    return [];
  }
}

interface CartContextValue {
  lines: CartLine[];
  /** true after localStorage hydration (avoid SSR flicker). */
  ready: boolean;
  count: number;
  add: (productId: string, qty: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLines(readStorage());
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setLines(readStorage());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const persist = useCallback((next: CartLine[]) => {
    setLines(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // storage full/unavailable: cart still works for the session
    }
  }, []);

  const add = useCallback(
    (productId: string, qty: number) => {
      const safeQty = Math.min(Math.max(1, Math.floor(qty)), MAX_QTY);
      const existing = lines.find((l) => l.productId === productId);
      if (existing) {
        persist(
          lines.map((l) =>
            l.productId === productId
              ? { ...l, qty: Math.min(l.qty + safeQty, MAX_QTY) }
              : l,
          ),
        );
      } else if (lines.length < MAX_LINES) {
        persist([...lines, { productId, qty: safeQty }]);
      }
    },
    [lines, persist],
  );

  const setQty = useCallback(
    (productId: string, qty: number) => {
      if (qty < 1) {
        persist(lines.filter((l) => l.productId !== productId));
        return;
      }
      const safeQty = Math.min(Math.floor(qty), MAX_QTY);
      persist(lines.map((l) => (l.productId === productId ? { ...l, qty: safeQty } : l)));
    },
    [lines, persist],
  );

  const remove = useCallback(
    (productId: string) => persist(lines.filter((l) => l.productId !== productId)),
    [lines, persist],
  );

  const clear = useCallback(() => persist([]), [persist]);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      ready,
      count: lines.reduce((s, l) => s + l.qty, 0),
      add,
      setQty,
      remove,
      clear,
    }),
    [lines, ready, add, setQty, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
