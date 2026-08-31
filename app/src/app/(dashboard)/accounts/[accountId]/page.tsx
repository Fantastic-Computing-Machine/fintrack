import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AccountTransactions({
  params,
  searchParams,
}: {
  params: Promise<{ accountId: string }>;
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { accountId } = await params;
  const id = Number(accountId);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const { cursor } = await searchParams;
  const [accounts, page] = await Promise.all([
    api<Account[]>("/accounts"),
    api<TransactionPage>(
      `/transactions?${new URLSearchParams({ account_id: String(id), ...(cursor ? { cursor } : {}) })}`,
    ),
  ]);
  const account = accounts.find((candidate) => candidate.id === id);
  if (!account) notFound();
  const next = page.next_cursor
    ? `/accounts/${id}?cursor=${encodeURIComponent(page.next_cursor)}`
    : null;

  return (
    <div className="space-y-8 animate-rise">
      <div className="relative space-y-5 overflow-hidden rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
        <div aria-hidden className="spectrum-edge absolute inset-x-0 top-0 h-1" />
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4" />
          Overview
        </Link>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="font-mono text-xs uppercase tracking-[.18em] text-muted-foreground">
              {account.institution_name}
            </p>
          <h1 className="mt-2 break-words font-display text-4xl tracking-[-.045em] sm:text-5xl">
              {account.name}{" "}
              {account.mask && (
                <span className="text-muted-foreground">··{account.mask}</span>
              )}
            </h1>
            <div className="mt-3 flex items-center gap-2">
              <Badge variant="secondary" className="font-normal capitalize">
                {account.subtype?.replaceAll("_", " ") ?? account.type}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Account activity
              </span>
            </div>
          </div>
          <Link
            href={`/transactions?account_id=${id}`}
            className={buttonVariants({ variant: "outline" })}
          >
            Filters <ExternalLink className="size-4" />
          </Link>
        </div>
      </div>
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Available balance</p>
          <p className="mt-2 text-2xl font-semibold">
            {money(account.available_balance, account.currency)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Current balance</p>
          <p className="mt-2 text-2xl font-semibold">
            {money(account.current_balance, account.currency)}
          </p>
        </div>
      </section>
      <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[.18em] text-muted-foreground">
              Ledger
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Transactions
            </h2>
          </div>
          <span className="text-sm text-muted-foreground">Newest first</span>
        </div>
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.items.length ? (
                page.items.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {shortDate(transaction.date)}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">
                        {transaction.merchant_name ?? transaction.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {transaction.category?.replaceAll("_", " ") ??
                          transaction.description}
                      </p>
                    </TableCell>
                    <TableCell>
                      {transaction.pending ? (
                        <Badge variant="secondary">Pending</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Posted
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {money(transaction.amount, transaction.currency)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-36 text-center text-muted-foreground"
                  >
                    No transactions have been imported for this account.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {next && (
          <div className="mt-5 flex justify-end">
            <Link
              href={next}
              className={buttonVariants({ variant: "outline" })}
            >
              Next page
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
