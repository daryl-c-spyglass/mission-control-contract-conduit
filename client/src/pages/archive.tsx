import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Archive as ArchiveIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionCard } from "@/components/transaction-card";
import { TransactionDetails } from "@/components/transaction-details";
import type { Transaction, Coordinator, Activity } from "@shared/schema";

export default function Archive() {
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [initialTab, setInitialTab] = useState<string>("overview");

  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const { data: coordinators = [] } = useQuery<Coordinator[]>({
    queryKey: ["/api/coordinators"],
  });

  // Fetch the full transaction details when selected (this triggers CMA coordinate enrichment)
  // staleTime: 0 ensures fresh data is fetched, not from cache
  // queryFn uses context.queryKey to avoid stale closure issues
  const { data: selectedTransaction } = useQuery<Transaction>({
    queryKey: ["/api/transactions", selectedTransactionId] as const,
    queryFn: async ({ queryKey }) => {
      const id = queryKey[1];
      if (!id) throw new Error("No transaction ID provided");
      console.log("[DEBUG] Archive: Fetching individual transaction:", id);
      const res = await fetch(`/api/transactions/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
    enabled: !!selectedTransactionId,
    staleTime: 0,
  });

  const { data: activities = [] } = useQuery<Activity[]>({
    queryKey: ["/api/transactions", selectedTransactionId, "activities"],
    enabled: !!selectedTransactionId,
  });

  const archivedTransactions = transactions.filter(
    (t) => t.isArchived === true
  );

  const filteredTransactions = archivedTransactions.filter((t) => {
    return t.propertyAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.mlsNumber?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (selectedTransactionId && selectedTransaction) {
    return (
      <TransactionDetails
        transaction={selectedTransaction}
        coordinators={coordinators}
        activities={activities}
        onBack={() => {
          setSelectedTransactionId(null);
          setInitialTab("overview");
        }}
        initialTab={initialTab}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Archive</h1>
        <p className="text-muted-foreground">
          View archived transactions
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search archived transactions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
          data-testid="input-search-archive"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-md border p-4 space-y-4">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredTransactions.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTransactions.map((transaction) => (
            <TransactionCard
              key={transaction.id}
              transaction={transaction}
              coordinators={coordinators}
              onClick={() => setSelectedTransactionId(transaction.id)}
              onMarketingClick={() => {
                setInitialTab("marketing");
                setSelectedTransactionId(transaction.id);
              }}
              onMLSClick={() => {
                setInitialTab("mls");
                setSelectedTransactionId(transaction.id);
              }}
              onDocsClick={() => {
                setInitialTab("docs");
                setSelectedTransactionId(transaction.id);
              }}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <ArchiveIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No archived transactions</h3>
          <p className="text-muted-foreground max-w-sm">
            {searchQuery
              ? "No archived transactions match your search."
              : "Closed and cancelled transactions will appear here."}
          </p>
        </div>
      )}
    </div>
  );
}
