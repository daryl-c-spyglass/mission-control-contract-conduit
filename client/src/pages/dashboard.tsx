import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionCard } from "@/components/transaction-card";
import { TransactionDetails } from "@/components/transaction-details";
import { TransactionToolbar } from "@/components/transactions/transaction-toolbar";
import { TransactionListView } from "@/components/transactions/transaction-list-view";
import { TransactionTableView } from "@/components/transactions/transaction-table-view";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useTransactionFilters } from "@/lib/transaction-filters";
import type { Transaction, Coordinator, Activity } from "@shared/schema";

interface DashboardProps {
  createDialogOpen: boolean;
  setCreateDialogOpen: (open: boolean) => void;
  transactionId?: string | null;
  urlTab?: string | null;
  urlFlyer?: boolean;
}

export default function Dashboard({ createDialogOpen, setCreateDialogOpen, transactionId: propTransactionId, urlTab, urlFlyer }: DashboardProps) {
  const [, setLocation] = useLocation();
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(() => {
    if (propTransactionId) return propTransactionId;
    const flyerTxn = localStorage.getItem('flyerGeneratorOpen');
    return flyerTxn || null;
  });
  const [initialTab, setInitialTab] = useState<string>(() => {
    if (urlTab) return urlTab;
    if (localStorage.getItem('flyerGeneratorOpen')) return 'marketing';
    return 'overview';
  });
  const [initialFlyer, setInitialFlyer] = useState<boolean>(() => {
    return urlFlyer || !!localStorage.getItem('flyerGeneratorOpen');
  });
  
  const [addMlsDialogOpen, setAddMlsDialogOpen] = useState(false);
  const [addMlsTransactionId, setAddMlsTransactionId] = useState<string | null>(null);
  const [mlsNumberInput, setMlsNumberInput] = useState("");
  const { toast } = useToast();
  
  const addMlsMutation = useMutation({
    mutationFn: async ({ transactionId, mlsNumber }: { transactionId: string; mlsNumber: string }) => {
      const res = await apiRequest("PATCH", `/api/transactions/${transactionId}/add-mls`, { mlsNumber });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({
        title: "MLS Number Added",
        description: "The listing has been converted to an active MLS listing and data synced.",
      });
      setAddMlsDialogOpen(false);
      setMlsNumberInput("");
      setAddMlsTransactionId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add MLS number",
        variant: "destructive",
      });
    },
  });
  
  useEffect(() => {
    if (propTransactionId) {
      setSelectedTransactionId(propTransactionId);
    }
    if (urlTab) {
      setInitialTab(urlTab);
    }
    if (urlFlyer) {
      setInitialFlyer(true);
    }
  }, [propTransactionId, urlTab, urlFlyer]);

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const { data: coordinators = [] } = useQuery<Coordinator[]>({
    queryKey: ["/api/coordinators"],
  });

  const { data: selectedTransaction, isLoading: selectedLoading, error: selectedError } = useQuery<Transaction>({
    queryKey: ["/api/transactions", selectedTransactionId] as const,
    queryFn: async ({ queryKey }) => {
      const id = queryKey[1];
      if (!id) throw new Error("No transaction ID provided");
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

  const {
    transactions: filteredTransactions,
    totalCount,
    filteredCount,
    viewMode,
    setViewMode,
    sort,
    setSort,
    filters,
    setFilters,
    resetFilters,
    activeFilterCount,
  } = useTransactionFilters(transactions);

  const handleTransactionClick = (id: string) => {
    setSelectedTransactionId(id);
  };

  if (selectedTransactionId && selectedTransaction) {
    return (
      <TransactionDetails
        transaction={selectedTransaction}
        coordinators={coordinators}
        activities={activities}
        onBack={() => {
          setSelectedTransactionId(null);
          setInitialTab("overview");
          setInitialFlyer(false);
          setLocation("/");
        }}
        initialTab={initialTab}
        initialFlyer={initialFlyer}
      />
    );
  }

  const renderTransactionView = () => {
    if (transactionsLoading) {
      return (
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
      );
    }

    if (filteredTransactions.length === 0) {
      const hasFilters = activeFilterCount > 0 || filters.search;
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <Building2 className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No transactions found</h3>
          <p className="text-muted-foreground max-w-sm mb-6">
            {hasFilters
              ? "Try adjusting your search or filter criteria."
              : "Get started by creating your first transaction."}
          </p>
          {hasFilters ? (
            <Button onClick={resetFilters} variant="outline" data-testid="button-clear-filters-empty">
              Clear Filters
            </Button>
          ) : (
            <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-first">
              Create Transaction
            </Button>
          )}
        </div>
      );
    }

    switch (viewMode) {
      case "list":
        return (
          <TransactionListView
            transactions={filteredTransactions}
            coordinators={coordinators}
            onTransactionClick={handleTransactionClick}
          />
        );
      case "table":
        return (
          <TransactionTableView
            transactions={filteredTransactions}
            coordinators={coordinators}
            onTransactionClick={handleTransactionClick}
            sort={sort}
            onSortChange={setSort}
          />
        );
      case "grid":
      default:
        return (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredTransactions.map((transaction) => (
              <TransactionCard
                key={transaction.id}
                transaction={transaction}
                coordinators={coordinators}
                onClick={() => handleTransactionClick(transaction.id)}
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
                onAddMLSClick={() => {
                  setAddMlsTransactionId(transaction.id);
                  setAddMlsDialogOpen(true);
                }}
              />
            ))}
          </div>
        );
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-2 sm:gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Transactions</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Manage your active real estate transactions
          </p>
        </div>
      </div>

      <TransactionToolbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        sort={sort}
        onSortChange={setSort}
        filters={filters}
        onFiltersChange={setFilters}
        onResetFilters={resetFilters}
        activeFilterCount={activeFilterCount}
        totalCount={totalCount}
        filteredCount={filteredCount}
        coordinators={coordinators}
      />

      {renderTransactionView()}
      
      <Dialog open={addMlsDialogOpen} onOpenChange={setAddMlsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add MLS Number</DialogTitle>
            <DialogDescription>
              Convert this off-market listing to an active MLS listing by adding the MLS number.
              The system will automatically sync property data from the MLS.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="mlsNumber">MLS Number</Label>
              <Input
                id="mlsNumber"
                placeholder="Enter MLS number (e.g., ACT-1234567)"
                value={mlsNumberInput}
                onChange={(e) => setMlsNumberInput(e.target.value)}
                data-testid="input-add-mls-number"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddMlsDialogOpen(false);
                setMlsNumberInput("");
                setAddMlsTransactionId(null);
              }}
              data-testid="button-cancel-add-mls"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (addMlsTransactionId && mlsNumberInput.trim()) {
                  addMlsMutation.mutate({
                    transactionId: addMlsTransactionId,
                    mlsNumber: mlsNumberInput.trim(),
                  });
                }
              }}
              disabled={!mlsNumberInput.trim() || addMlsMutation.isPending}
              data-testid="button-confirm-add-mls"
            >
              {addMlsMutation.isPending ? "Adding..." : "Add MLS Number"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
