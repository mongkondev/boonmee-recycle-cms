import "server-only";
import { sql } from "drizzle-orm";
import { z } from "zod";
import type { db } from "@/db";

type Exec = Pick<typeof db, "execute">;

export const partySchema = z.object({
  name: z.string().trim().max(120).optional().transform((v) => v || null),
  phone: z.string().trim().max(40).optional().transform((v) => v || null),
  bankName: z.string().trim().max(60).optional().transform((v) => v || null),
  bankAccount: z.string().trim().max(40).optional().transform((v) => v || null),
});

export type PartyInput = z.input<typeof partySchema>;

/** Find-or-create the customer by name; contact fields typed on the form overwrite stored ones. */
export async function upsertCustomer(exec: Exec, p: z.output<typeof partySchema>): Promise<number | null> {
  if (!p.name) return null;
  const [row] = await exec.execute<{ id: number }>(sql`
    insert into customers (name, phone, bank_name, bank_account) values (${p.name}, ${p.phone}, ${p.bankName}, ${p.bankAccount})
    on conflict (name) do update set
      phone = coalesce(excluded.phone, customers.phone),
      bank_name = coalesce(excluded.bank_name, customers.bank_name),
      bank_account = coalesce(excluded.bank_account, customers.bank_account)
    returning id
  `);
  return row.id;
}
