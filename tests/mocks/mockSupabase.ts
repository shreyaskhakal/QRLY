import type { Shop, Printer, Order, OrderFile, PrintJob } from "@/lib/types";

export function createMockSupabaseAdmin() {
  const shops: Shop[] = [
    {
      id: "b0000000-0000-0000-0000-000000000001",
      slug: "quickprint",
      name: "QuickPrint Express Kiosk",
      owner_id: "a0000000-0000-0000-0000-000000000001",
      bw_price_paise: 200,
      color_price_paise: 1000,
      q_draft_mult: 1.0,
      q_normal_mult: 1.0,
      q_high_mult: 1.5,
      max_file_mb: 25,
      order_expiry_minutes: 30,
      accepting_orders: true,
      agent_key_hash: "mock_agent_key_hash",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const printers: Printer[] = [
    {
      id: "c0000000-0000-0000-0000-000000000001",
      shop_id: "b0000000-0000-0000-0000-000000000001",
      system_name: "ShopPrinter_EPSON_L3250",
      supports_color: true,
      supports_duplex: true,
      status: "online",
      status_detail: "Ready",
      last_seen_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
  ];

  const orders: Order[] = [];
  const orderFiles: OrderFile[] = [];
  const printJobs: PrintJob[] = [];

  return {
    from: (table: string) => {
      let filteredData: any[] = [];
      if (table === "shops") filteredData = [...shops];
      else if (table === "printers") filteredData = [...printers];
      else if (table === "orders") filteredData = orders;
      else if (table === "order_files") filteredData = orderFiles;
      else if (table === "print_jobs") filteredData = printJobs;

      const builder: any = {
        select: () => builder,
        eq: (col: string, val: any) => {
          filteredData = filteredData.filter((item) => item[col] === val);
          return builder;
        },
        in: (col: string, vals: any[]) => {
          filteredData = filteredData.filter((item) => vals.includes(item[col]));
          return builder;
        },
        gte: (col: string, val: any) => {
          filteredData = filteredData.filter((item) => item[col] >= val);
          return builder;
        },
        lte: (col: string, val: any) => {
          filteredData = filteredData.filter((item) => item[col] <= val);
          return builder;
        },
        or: () => builder,
        order: () => builder,
        range: (from: number, to: number) => {
          filteredData = filteredData.slice(from, to + 1);
          return builder;
        },
        limit: (n: number) => {
          filteredData = filteredData.slice(0, n);
          return builder;
        },
        single: async () => {
          const item = filteredData[0];
          return { data: item || null, error: item ? null : new Error("Not found") };
        },
        maybeSingle: async () => {
          return { data: filteredData[0] || null, error: null };
        },
        upsert: (payload: any) => {
          return builder.insert(payload);
        },
        insert: (payload: any) => {
          const items = Array.isArray(payload) ? payload : [payload];
          const inserted = items.map((it) => {
            const row = {
              id: it.id || crypto.randomUUID(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              ...it,
            };
            if (table === "orders") orders.push(row);
            else if (table === "order_files") orderFiles.push(row);
            else if (table === "print_jobs") printJobs.push(row);
            return row;
          });

          return {
            select: () => ({
              single: async () => ({ data: inserted[0], error: null }),
            }),
            data: inserted,
            error: null,
          };
        },
        update: (updates: any) => {
          return {
            eq: (col: string, val: any) => {
              filteredData.forEach((item) => {
                if (item[col] === val) {
                  Object.assign(item, updates, { updated_at: new Date().toISOString() });
                }
              });
              return {
                select: () => ({
                  single: async () => ({ data: filteredData[0] || null, error: null }),
                }),
                in: () => ({ error: null }),
                data: filteredData,
                error: null,
              };
            },
            in: () => ({ error: null }),
          };
        },
        delete: () => ({
          eq: (_col: string, _val: any) => {
            // Delete matching
            return { error: null };
          },
        }),
      };

      // Add then() to builder so awaiting query builder returns { data, count, error }
      builder.then = (resolve: any) => {
        resolve({
          data: filteredData,
          count: filteredData.length,
          error: null,
        });
      };

      return builder;
    },
    rpc: async (fn: string) => {
      if (fn === "next_shop_token") {
        return { data: "A-001", error: null };
      }
      return { data: null, error: null };
    },
    storage: {
      from: () => ({
        createSignedUploadUrl: async (path: string) => ({
          data: { signedUrl: `https://mock.storage/upload/${path}`, path },
          error: null,
        }),
        createSignedUrl: async (path: string) => ({
          data: { signedUrl: `https://mock.storage/download/${path}` },
          error: null,
        }),
        remove: async () => ({ data: {}, error: null }),
      }),
    },
  };
}
