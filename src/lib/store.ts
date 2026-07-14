import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { SalesRow, CollectionRow } from "./parser";
import { buildCustomers, type Customer, type Meta } from "./customer-model";
import seedRaw from "@/data/seed.json";

type Seed = {
  sales: SalesRow[];
  collections: CollectionRow[];
  meta: Meta;
};

const seed = seedRaw as Seed;

type State = {
  sales: SalesRow[];
  collections: CollectionRow[];
  meta: Meta;
  manualLinks: Record<string, string>;
  hasCustomData: boolean;
  replaceYear: (kind: "sales" | "collections", year: number, rows: SalesRow[] | CollectionRow[]) => void;
  setManualLink: (nameKey: string, code: string) => void;
  clearManualLink: (nameKey: string) => void;
  resetToSeed: () => void;
  clearAll: () => void;
};

export const useDataStore = create<State>()(
  persist(
    (set) => ({
      sales: seed.sales,
      collections: seed.collections,
      meta: seed.meta,
      manualLinks: {},
      hasCustomData: false,
      replaceYear: (kind, year, rows) =>
        set((state) => {
          if (kind === "sales") {
            const filtered = state.sales.filter((r) => r.year !== year);
            return { sales: [...filtered, ...(rows as SalesRow[])], hasCustomData: true };
          }
          const filtered = state.collections.filter((r) => r.year !== year);
          return { collections: [...filtered, ...(rows as CollectionRow[])], hasCustomData: true };
        }),
      setManualLink: (nameKey, code) =>
        set((state) => ({ manualLinks: { ...state.manualLinks, [nameKey]: code } })),
      clearManualLink: (nameKey) =>
        set((state) => {
          const next = { ...state.manualLinks };
          delete next[nameKey];
          return { manualLinks: next };
        }),
      resetToSeed: () =>
        set({ sales: seed.sales, collections: seed.collections, meta: seed.meta, hasCustomData: false }),
      clearAll: () => set({ sales: [], collections: [], meta: seed.meta, manualLinks: {}, hasCustomData: true }),
    }),
    {
      name: "scip-dataset-v1",
      storage: createJSONStorage(() => (typeof window !== "undefined" ? localStorage : ({} as Storage))),
      partialize: (s) => ({
        sales: s.sales,
        collections: s.collections,
        meta: s.meta,
        manualLinks: s.manualLinks,
        hasCustomData: s.hasCustomData,
      }),
    },
  ),
);

/** Derived: compute the full customer model from current store. */
export function useCustomers(): Customer[] {
  const sales = useDataStore((s) => s.sales);
  const collections = useDataStore((s) => s.collections);
  const meta = useDataStore((s) => s.meta);
  const manualLinks = useDataStore((s) => s.manualLinks);
  return buildCustomers(sales, collections, meta, manualLinks);
}
