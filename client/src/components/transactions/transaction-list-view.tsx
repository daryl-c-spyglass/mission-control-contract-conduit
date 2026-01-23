import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Transaction, Coordinator } from "@shared/schema";
import { getStatusConfig } from "@/lib/utils/status-colors";

interface TransactionListViewProps {
  transactions: Transaction[];
  coordinators: Coordinator[];
  onTransactionClick: (id: string) => void;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function calculateDaysRemaining(transaction: Transaction): number | null {
  if (transaction.status === "closed") return null;
  
  const targetDate = transaction.isOffMarket && transaction.goLiveDate
    ? transaction.goLiveDate
    : transaction.closingDate;
    
  if (!targetDate) return null;
  
  const target = new Date(targetDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    coming_soon: "Coming Soon",
    active: "Active",
    in_contract: "In Contract",
    pending: "Pending",
    clear_to_close: "Clear to Close",
    closed: "Closed",
  };
  return labels[status] || status;
}

function DaysIndicator({ transaction }: { transaction: Transaction }) {
  const days = calculateDaysRemaining(transaction);
  
  if (days === null) return null;
  
  const isOverdue = days < 0;
  const label = transaction.isOffMarket && transaction.goLiveDate 
    ? "to live" 
    : "to close";
  
  return (
    <div className={`text-right ${isOverdue ? "text-destructive" : "text-foreground"}`}>
      <p className="text-lg font-bold">{Math.abs(days)}</p>
      <p className="text-xs text-muted-foreground">{isOverdue ? "overdue" : label}</p>
    </div>
  );
}

export function TransactionListView({ 
  transactions, 
  coordinators,
  onTransactionClick 
}: TransactionListViewProps) {
  const getCoordinatorsForTransaction = (transaction: Transaction) => {
    if (!transaction.coordinatorIds) return [];
    return coordinators.filter(c => transaction.coordinatorIds?.includes(c.id));
  };

  return (
    <div className="space-y-2">
      {transactions.map((transaction) => {
        const transactionCoordinators = getCoordinatorsForTransaction(transaction);
        const statusConfig = getStatusConfig(transaction.status);
        
        return (
          <div
            key={transaction.id}
            onClick={() => onTransactionClick(transaction.id)}
            className="bg-card rounded-lg border p-4 hover-elevate cursor-pointer
                     flex items-center justify-between gap-4"
            data-testid={`list-item-transaction-${transaction.id}`}
          >
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <Badge 
                variant="secondary" 
                className={`${statusConfig.badge} shrink-0`}
              >
                {getStatusLabel(transaction.status)}
              </Badge>
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground truncate">
                  {transaction.propertyAddress}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {transaction.mlsNumber ? `MLS# ${transaction.mlsNumber}` : "(Off Market)"}
                </p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-8 text-sm">
              <div>
                <p className="text-muted-foreground">Contract Date</p>
                <p className="font-medium">{formatDate(transaction.contractDate)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Closing Date</p>
                <p className="font-medium">{formatDate(transaction.closingDate)}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <DaysIndicator transaction={transaction} />
              
              {transactionCoordinators.length > 0 && (
                <div className="flex -space-x-2">
                  {transactionCoordinators.slice(0, 2).map((coord) => (
                    <Avatar
                      key={coord.id}
                      className="h-8 w-8 border-2 border-background"
                      title={coord.name}
                    >
                      <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                        {coord.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>
              )}
              
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
