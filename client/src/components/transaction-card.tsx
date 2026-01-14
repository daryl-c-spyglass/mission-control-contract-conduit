import { Calendar, Hash, Mail, MessageSquare, Users, FileSpreadsheet, Image as ImageIcon, FileText } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Transaction, Coordinator, MLSData } from "@shared/schema";
import { getStatusBadgeStyle, getStatusLabel, getDaysRemainingStyle } from "@/lib/utils/status-colors";

interface TransactionCardProps {
  transaction: Transaction;
  coordinators: Coordinator[];
  onClick: () => void;
  onMarketingClick?: () => void;
  onMLSClick?: () => void;
  onDocsClick?: () => void;
}

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

export function TransactionCard({ transaction, coordinators, onClick, onMarketingClick, onMLSClick, onDocsClick }: TransactionCardProps) {
  // Use MLS status as source of truth, fallback to transaction status
  const mlsData = transaction.mlsData as MLSData | null;
  const displayStatus = mlsData?.status || transaction.status;
  const statusLabel = getStatusLabel(displayStatus);
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
        <Badge className={getStatusBadgeStyle(displayStatus)} data-testid={`badge-status-${transaction.id}`}>
          {statusLabel}
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

        {daysRemaining !== null && !displayStatus.toLowerCase().includes('closed') && !displayStatus.toLowerCase().includes('sold') && !displayStatus.toLowerCase().includes('cancel') && (
          <div className={`text-sm ${getDaysRemainingStyle(daysRemaining)}`}>
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

        <div className="flex items-center gap-2 pt-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
          {onMLSClick && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={onMLSClick}
              data-testid={`button-mls-${transaction.id}`}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              MLS Data
            </Button>
          )}
          {onMarketingClick && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={onMarketingClick}
              data-testid={`button-marketing-${transaction.id}`}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              Marketing
            </Button>
          )}
          {onDocsClick && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={onDocsClick}
              data-testid={`button-docs-${transaction.id}`}
            >
              <FileText className="h-3.5 w-3.5" />
              Docs
            </Button>
          )}
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
        </div>
      </CardContent>
    </Card>
  );
}
