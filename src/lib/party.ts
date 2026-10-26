import type { Party } from "@/components/trade-form";

type Contact = { phone: string | null; bankName: string | null; bankAccount: string | null } | null | undefined;

/** Form values for the customer block from a stored name + customer record. */
export const toParty = (name: string | null, c: Contact): Party => ({
  name: name ?? "",
  phone: c?.phone ?? "",
  bankName: c?.bankName ?? "",
  bankAccount: c?.bankAccount ?? "",
});

export const emptyParty = (): Party => toParty(null, null);
