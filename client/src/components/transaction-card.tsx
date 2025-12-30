import { Calendar, ExternalLink, Hash, Mail, MessageSquare, Users, Image } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Transaction, Coordinator } from "@shared/schema";

interface TransactionCardProps {
  transaction: Transaction;
  coordinators: Coordinator[];
  onClick: () => void;
  onMarketingClick?: () => void;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  in_contract: { label: "In Contract", variant: "default" },
  pending_inspection: { label: "Pending Inspection", variant: "secondary" },
  clear_to_close: { label: "Clear to Close", variant: "outline" },
  closed: { label: "Closed", variant: "secondary" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

function getDaysRemaining(closingDate: string | null): number | null {
  if (!closingDate) return null;
  const closing = new Date(closingDate);
  const today = new Date();
  const diff = closing.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function TransactionCard({ transaction, coordinators, onClick, onMarketingClick }: TransactionCardProps) {
  const status = statusConfig[transaction.status] || statusConfig.in_contract;
  const daysRemaining = getDaysRemaining(transaction.closingDate);
  
  const transactionCoordinators = coordinators.filter(
    (c) => transaction.coordinatorIds?.includes(c.id)
  );

  return (
    <Card
      className="hover-elevate cursor-pointer transition-all"
      onClick={onClick}
      data-testid={`card-transaction-${transaction.id}`}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-lg leading-tight truncate" data-testid={`text-address-${transaction.id}`}>
            {transaction.propertyAddress}
          </h3>
          {transaction.mlsNumber && (
            <div className="flex items-center gap-1.5 mt-1 text-muted-foreground">
              <Hash className="h-3 w-3" />
              <span className="font-mono text-sm" data-testid={`text-mls-${transaction.id}`}>
                {transaction.mlsNumber}
              </span>
            </div>
          )}
        </div>
        <Badge variant={status.variant} data-testid={`badge-status-${transaction.id}`}>
          {status.label}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Contract Date</p>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span data-testid={`text-contract-date-${transaction.id}`}>
                {formatDate(transaction.contractDate)}
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Closing Date</p>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span data-testid={`text-closing-date-${transaction.id}`}>
                {formatDate(transaction.closingDate)}
              </span>
            </div>
          </div>
        </div>

        {daysRemaining !== null && transaction.status !== "closed" && transaction.status !== "cancelled" && (
          <div className={`text-sm font-medium ${daysRemaining < 7 ? "text-destructive" : daysRemaining < 14 ? "text-yellow-600 dark:text-yellow-500" : "text-muted-foreground"}`}>
            {daysRemaining > 0 ? `${daysRemaining} days remaining` : daysRemaining === 0 ? "Closing today" : `${Math.abs(daysRemaining)} days overdue`}
          </div>
        )}

        {transactionCoordinators.length > 0 && (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div className="flex -space-x-2">
              {transactionCoordinators.slice(0, 3).map((coord) => (
                <Avatar key={coord.id} className="h-7 w-7 border-2 border-card">
                  <AvatarFallback className="text-xs">
                    {coord.name.split(" ").map((n) => n[0]).join("").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
              {transactionCoordinators.length > 3 && (
                <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-muted text-xs font-medium">
                  +{transactionCoordinators.length - 3}
                </div>
              )}
            </div>
            <span className="text-sm text-muted-foreground ml-1">
              {transactionCoordinators.map((c) => c.name.split(" ")[0]).slice(0, 2).join(", ")}
              {transactionCoordinators.length > 2 && ` +${transactionCoordinators.length - 2}`}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
          {transaction.slackChannelId && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => window.open(`https://slack.com/app_redirect?channel=${transaction.slackChannelId}`, '_blank')}
              data-testid={`button-slack-${transaction.id}`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Slack
            </Button>
          )}
          {transaction.gmailFilterId && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              data-testid={`button-emails-${transaction.id}`}
            >
              <Mail className="h-3.5 w-3.5" />
              Emails
            </Button>
          )}
          {transaction.mlsData ? (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              data-testid={`button-mls-${transaction.id}`}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              MLS Sheet
            </Button>
          ) : null}
          {onMarketingClick && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={onMarketingClick}
              data-testid={`button-marketing-${transaction.id}`}
            >
              <Image className="h-3.5 w-3.5" />
              Marketing
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
