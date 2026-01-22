import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Archive as ArchiveIcon, Trash2, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionCard } from "@/components/transaction-card";
import { TransactionDetails } from "@/components/transaction-details";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Transaction, Coordinator, Activity } from "@shared/schema";

export default function Archive() {
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [initialTab, setInitialTab] = useState<string>("overview");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  // Delete all archived transactions mutation
  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", "/api/transactions/archived/delete-all");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      setShowDeleteDialog(false);
      setConfirmText("");
      toast({
        title: "Archived transactions deleted",
        description: data.message || `Successfully deleted ${data.deleted} archived transactions.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete archived transactions. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteAll = () => {
    if (confirmText === "DELETE") {
      deleteAllMutation.mutate();
    }
  };

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

  const archivedCount = archivedTransactions.length;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Archive</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            View and manage your archived transactions
          </p>
        </div>

        {/* Delete All Button - Only show when there are archived transactions */}
        {archivedCount > 0 && (
          <AlertDialog open={showDeleteDialog} onOpenChange={(open) => {
            setShowDeleteDialog(open);
            if (!open) setConfirmText("");
          }}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" data-testid="button-delete-all-archived">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete All
              </Button>
            </AlertDialogTrigger>
            
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  Delete All Archived Transactions?
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3">
                    <p>
                      This will permanently delete all <strong>{archivedCount}</strong> archived 
                      transaction{archivedCount !== 1 ? "s" : ""}.
                    </p>
                    <p className="text-red-600 dark:text-red-400 font-medium">
                      This action cannot be undone. All transaction data, documents, 
                      and associated files will be permanently removed.
                    </p>
                    <div className="pt-2">
                      <label className="text-sm font-medium text-foreground">
                        Type "DELETE" to confirm:
                      </label>
                      <Input
                        className="mt-2"
                        placeholder="DELETE"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        autoComplete="off"
                        data-testid="input-confirm-delete"
                      />
                    </div>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setConfirmText("")} data-testid="button-cancel-delete">
                  Cancel
                </AlertDialogCancel>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAll}
                  disabled={confirmText !== "DELETE" || deleteAllMutation.isPending}
                  data-testid="button-confirm-delete-all"
                >
                  {deleteAllMutation.isPending ? (
                    <>Deleting...</>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete All
                    </>
                  )}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="relative max-w-full sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search archived transactions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 text-sm"
          data-testid="input-search-archive"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-md border p-3 sm:p-4 space-y-3 sm:space-y-4">
              <Skeleton className="h-5 sm:h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <div className="flex gap-2">
                <Skeleton className="h-7 sm:h-8 w-16 sm:w-20" />
                <Skeleton className="h-7 sm:h-8 w-16 sm:w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredTransactions.length > 0 ? (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
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
