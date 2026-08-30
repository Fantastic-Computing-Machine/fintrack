import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { TransactionFilters } from "@/components/transactions/transaction-filters";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { money, shortDate } from "@/lib/api";
import { api } from "@/lib/api-server";
import type { Account, TransactionPage } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Transactions({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const key of [
    "account_id",
    "start",
    "end",
    "status",
    "search",
    "cursor",
    "limit",
  ])
    if (params[key]) query.set(key, params[key]!);
  const [page, accounts] = await Promise.all([
    api<TransactionPage>(`/transactions?${query}`),
    api<Account[]>("/accounts"),
  ]);
  const selectedAccount = accounts.find(
    (account) => account.id === Number(params.account_id),
  );
  const history = params.history?.split(",").filter(Boolean) ?? [];
  const currentCursor = params.cursor;
  const next = new URLSearchParams(query);
  if (page.next_cursor) {
    next.set("cursor", page.next_cursor);
    const nextHistory = [...history, currentCursor].filter(Boolean);
    if (nextHistory.length) next.set("history", nextHistory.join(","));
  }
  const previous = new URLSearchParams(query);
  previous.delete("cursor");
  if (history.length) {
    previous.set("cursor", history.at(-1)!);
    if (history.length > 1)
      previous.set("history", history.slice(0, -1).join(","));
  }
  return (
    <div className="space-y-8 animate-rise">
      <div className="flex flex-col justify-between gap-5 border-b pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-xs uppercase tracking-[.18em] text-muted-foreground">
            Ledger
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-.035em] sm:text-4xl">
            {selectedAccount ? selectedAccount.name : "Transactions"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {selectedAccount
              ? `${selectedAccount.institution_name} · ${selectedAccount.mask ? `··${selectedAccount.mask} · ` : ""}transaction history`
              : "Posted and pending activity across your connected accounts."}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-sm text-muted-foreground">
            Showing {page.items.length} of {page.total} matching entries
          </p>
          {selectedAccount && (
            <>
              <p className="mt-1 text-xs text-muted-foreground">
                Current balance
              </p>
              <p className="font-mono font-semibold">
                {money(
                  selectedAccount.current_balance,
                  selectedAccount.currency,
                )}
              </p>
            </>
          )}
        </div>
      </div>
      <TransactionFilters accounts={accounts} />
      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Transaction</TableHead>
              <TableHead>Account</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {page.items.length ? (
              page.items.map((t) => {
                const debit = Number(t.amount) > 0;
                return (
                  <TableRow key={t.id} className="hover:bg-muted/35">
                    <TableCell className="whitespace-nowrap align-top text-muted-foreground">
                      {shortDate(t.date)}
                      {t.authorized_date && t.authorized_date !== t.date && (
                        <p className="mt-1 text-xs">
                          Auth. {shortDate(t.authorized_date)}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">
                        {t.merchant_name ?? t.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.category?.replaceAll("_", " ") ?? t.description}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/accounts/${t.account_id}`}
                        className="rounded-sm outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <p>{t.account_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.institution_name}
                        </p>
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {debit ? money(t.amount, t.currency) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium text-primary">
                      {debit
                        ? "—"
                        : money(String(Math.abs(Number(t.amount))), t.currency)}
                    </TableCell>
                    <TableCell>
                      {t.pending ? (
                        <Badge variant="secondary">Pending</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Posted
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-36 text-center text-muted-foreground"
                >
                  No transactions match these filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {(currentCursor || page.next_cursor) && (
        <div className="flex justify-between gap-3">
          {currentCursor ? (
            <Link
              className={buttonVariants({ variant: "outline" })}
              href={`/transactions?${previous}`}
            >
              Previous page
            </Link>
          ) : (
            <span />
          )}
          {page.next_cursor && (
            <Link
              className={buttonVariants({ variant: "outline" })}
              href={`/transactions?${next}`}
            >
              Next page
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
