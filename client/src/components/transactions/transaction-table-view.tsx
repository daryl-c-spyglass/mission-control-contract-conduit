import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Transaction, Coordinator } from "@shared/schema";
import type { SortOption, SortField } from "@/lib/transaction-filters";
import { SORT_OPTIONS } from "@/lib/transaction-filters";
import { getStatusConfig } from "@/lib/utils/status-colors";

interface TransactionTableViewProps {
  transactions: Transaction[];
  coordinators: Coordinator[];
  onTransactionClick: (id: string) => void;
  sort: SortOption;
  onSortChange: (sort: SortOption) => void;
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

interface SortableHeaderProps {
  field: SortField;
  label: string;
  sort: SortOption;
  onSortChange: (sort: SortOption) => void;
}

function SortableHeader({ field, label, sort, onSortChange }: SortableHeaderProps) {
  const isActive = sort.field === field;
  
  const handleClick = () => {
    const newDirection = isActive && sort.direction === "asc" ? "desc" : "asc";
    const matchingOption = SORT_OPTIONS.find(
      opt => opt.field === field && opt.direction === newDirection
    );
    
    if (matchingOption) {
      onSortChange(matchingOption);
    } else {
      const anyFieldOption = SORT_OPTIONS.find(opt => opt.field === field);
      if (anyFieldOption) {
        onSortChange(anyFieldOption);
      }
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      className="font-medium"
      data-testid={`sort-header-${field}`}
    >
      {label}
      {isActive ? (
        sort.direction === "asc" ? (
          <ArrowUp className="ml-1 h-3 w-3" />
        ) : (
          <ArrowDown className="ml-1 h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
      )}
    </Button>
  );
}

export function TransactionTableView({ 
  transactions, 
  coordinators,
  onTransactionClick,
  sort,
  onSortChange,
}: TransactionTableViewProps) {
  const getCoordinatorsForTransaction = (transaction: Transaction) => {
    if (!transaction.coordinatorIds) return [];
    return coordinators.filter(c => transaction.coordinatorIds?.includes(c.id));
  };

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[300px]">
              <SortableHeader 
                field="address" 
                label="Address" 
                sort={sort} 
                onSortChange={onSortChange} 
              />
            </TableHead>
            <TableHead>
              <SortableHeader 
                field="status" 
                label="Status" 
                sort={sort} 
                onSortChange={onSortChange} 
              />
            </TableHead>
            <TableHead>MLS #</TableHead>
            <TableHead>
              <SortableHeader 
                field="closingDate" 
                label="Closing Date" 
                sort={sort} 
                onSortChange={onSortChange} 
              />
            </TableHead>
            <TableHead className="text-right">
              <SortableHeader 
                field="daysRemaining" 
                label="Days" 
                sort={sort} 
                onSortChange={onSortChange} 
              />
            </TableHead>
            <TableHead>Coordinators</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((transaction) => {
            const transactionCoordinators = getCoordinatorsForTransaction(transaction);
            const statusConfig = getStatusConfig(transaction.status);
            const days = calculateDaysRemaining(transaction);
            const isOverdue = days !== null && days < 0;
            
            return (
              <TableRow 
                key={transaction.id}
                onClick={() => onTransactionClick(transaction.id)}
                className="cursor-pointer"
                data-testid={`table-row-transaction-${transaction.id}`}
              >
                <TableCell className="font-medium">
                  {transaction.propertyAddress}
                </TableCell>
                <TableCell>
                  <Badge 
                    variant="secondary" 
                    className={statusConfig.badge}
                  >
                    {getStatusLabel(transaction.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {transaction.mlsNumber || "—"}
                </TableCell>
                <TableCell>
                  {formatDate(transaction.closingDate)}
                </TableCell>
                <TableCell className={`text-right font-medium ${isOverdue ? "text-destructive" : ""}`}>
                  {days !== null ? (
                    <>
                      {Math.abs(days)} {isOverdue ? "overdue" : "days"}
                    </>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  {transactionCoordinators.length > 0 ? (
                    <div className="flex -space-x-2">
                      {transactionCoordinators.slice(0, 3).map((coord) => (
                        <Avatar
                          key={coord.id}
                          className="h-7 w-7 border-2 border-background"
                          title={coord.name}
                        >
                          <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                            {coord.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
