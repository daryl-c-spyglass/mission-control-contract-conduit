import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Filter, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionCard } from "@/components/transaction-card";
import { TransactionDetails } from "@/components/transaction-details";
import { CreateTransactionDialog } from "@/components/create-transaction-dialog";
import type { Transaction, Coordinator, Activity } from "@shared/schema";

interface DashboardProps {
  createDialogOpen: boolean;
  setCreateDialogOpen: (open: boolean) => void;
}

export default function Dashboard({ createDialogOpen, setCreateDialogOpen }: DashboardProps) {
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const { data: coordinators = [] } = useQuery<Coordinator[]>({
    queryKey: ["/api/coordinators"],
  });

  const { data: activities = [] } = useQuery<Activity[]>({
    queryKey: ["/api/transactions", selectedTransaction?.id, "activities"],
    enabled: !!selectedTransaction,
  });

  const filteredTransactions = transactions.filter((t) => {
    const matchesSearch = t.propertyAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.mlsNumber?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" ||
      (statusFilter === "active" && !["closed", "cancelled"].includes(t.status)) ||
      (statusFilter === "closing_soon" && t.closingDate && (() => {
        const days = Math.ceil((new Date(t.closingDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return days <= 14 && days > 0 && !["closed", "cancelled"].includes(t.status);
      })()) ||
      t.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (selectedTransaction) {
    return (
      <TransactionDetails
        transaction={selectedTransaction}
        coordinators={coordinators}
        activities={activities}
        onBack={() => setSelectedTransaction(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Transactions</h1>
          <p className="text-muted-foreground">
            Manage your active real estate transactions
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by address or MLS#..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-transactions"
          />
        </div>

        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="all" data-testid="filter-all">All</TabsTrigger>
            <TabsTrigger value="active" data-testid="filter-active">Active</TabsTrigger>
            <TabsTrigger value="closing_soon" data-testid="filter-closing-soon">Closing Soon</TabsTrigger>
            <TabsTrigger value="closed" data-testid="filter-closed">Closed</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {transactionsLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
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
              onClick={() => setSelectedTransaction(transaction)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <Building2 className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No transactions found</h3>
          <p className="text-muted-foreground max-w-sm mb-6">
            {searchQuery || statusFilter !== "all"
              ? "Try adjusting your search or filter criteria."
              : "Get started by creating your first transaction."}
          </p>
          {!searchQuery && statusFilter === "all" && (
            <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-first">
              Create Transaction
            </Button>
          )}
        </div>
      )}

      <CreateTransactionDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}
