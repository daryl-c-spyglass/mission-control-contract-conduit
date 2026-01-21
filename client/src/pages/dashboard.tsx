import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Search, Filter, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionCard } from "@/components/transaction-card";
import { TransactionDetails } from "@/components/transaction-details";
import { CreateTransactionDialog } from "@/components/create-transaction-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Transaction, Coordinator, Activity } from "@shared/schema";

interface DashboardProps {
  createDialogOpen: boolean;
  setCreateDialogOpen: (open: boolean) => void;
  transactionId?: string | null;
  urlTab?: string | null;
}

export default function Dashboard({ createDialogOpen, setCreateDialogOpen, transactionId: propTransactionId, urlTab }: DashboardProps) {
  const [, setLocation] = useLocation();
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(propTransactionId || null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [initialTab, setInitialTab] = useState<string>(urlTab || "overview");
  
  // Add MLS Number modal state
  const [addMlsDialogOpen, setAddMlsDialogOpen] = useState(false);
  const [addMlsTransactionId, setAddMlsTransactionId] = useState<string | null>(null);
  const [mlsNumberInput, setMlsNumberInput] = useState("");
  const { toast } = useToast();
  
  // Add MLS mutation
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
  
  // Sync with URL-provided transaction ID and tab
  useEffect(() => {
    if (propTransactionId) {
      setSelectedTransactionId(propTransactionId);
    }
    if (urlTab) {
      setInitialTab(urlTab);
    }
  }, [propTransactionId, urlTab]);

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const { data: coordinators = [] } = useQuery<Coordinator[]>({
    queryKey: ["/api/coordinators"],
  });

  // Fetch the full transaction details when selected (this triggers CMA coordinate enrichment)
  // staleTime: 0 ensures fresh data is fetched, not from cache
  // queryFn uses context.queryKey to avoid stale closure issues
  const { data: selectedTransaction, isLoading: selectedLoading, error: selectedError } = useQuery<Transaction>({
    queryKey: ["/api/transactions", selectedTransactionId] as const,
    queryFn: async ({ queryKey }) => {
      const id = queryKey[1];
      if (!id) throw new Error("No transaction ID provided");
      console.log("[DEBUG] Fetching individual transaction:", id);
      const res = await fetch(`/api/transactions/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
    enabled: !!selectedTransactionId,
    staleTime: 0,
  });
  
  // Debug log for individual transaction query
  console.log("[DEBUG] Individual transaction query - id:", selectedTransactionId, "loading:", selectedLoading, "error:", selectedError, "data:", !!selectedTransaction);

  const { data: activities = [] } = useQuery<Activity[]>({
    queryKey: ["/api/transactions", selectedTransactionId, "activities"],
    enabled: !!selectedTransactionId,
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

  if (selectedTransactionId && selectedTransaction) {
    return (
      <TransactionDetails
        transaction={selectedTransaction}
        coordinators={coordinators}
        activities={activities}
        onBack={() => {
          setSelectedTransactionId(null);
          setInitialTab("overview");
          // Navigate back to main dashboard list (without transaction URL)
          setLocation("/");
        }}
        initialTab={initialTab}
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
              onAddMLSClick={() => {
                setAddMlsTransactionId(transaction.id);
                setAddMlsDialogOpen(true);
              }}
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
      
      {/* Add MLS Number Dialog for off-market listings */}
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
