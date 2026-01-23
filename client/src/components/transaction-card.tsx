import { Calendar, Hash, Mail, MessageSquare, Users, FileSpreadsheet, Image as ImageIcon, FileText, Plus, Link2, Clock } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Transaction, Coordinator, MLSData } from "@shared/schema";
import { getStatusBadgeStyle, getStatusLabel, getDaysRemainingStyle } from "@/lib/utils/status-colors";
import { formatDistanceToNow } from "date-fns";

interface TransactionCardProps {
  transaction: Transaction;
  coordinators: Coordinator[];
  onClick: () => void;
  onMarketingClick?: () => void;
  onMLSClick?: () => void;
  onDocsClick?: () => void;
  onAddMLSClick?: () => void;
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

export function TransactionCard({ transaction, coordinators, onClick, onMarketingClick, onMLSClick, onDocsClick, onAddMLSClick }: TransactionCardProps) {
  // Determine if this is an off-market listing
  const isOffMarket = transaction.isOffMarket && !transaction.mlsNumber;
  
  // Determine if connected to Repliers MLS (has MLS number and not off-market)
  const isConnectedToMLS = !!(
    transaction.mlsNumber && 
    transaction.mlsNumber.length > 0 && 
    !transaction.isOffMarket
  );
  
  // Use MLS status as source of truth, fallback to transaction status, or off-market status
  const mlsData = transaction.mlsData as MLSData | null;
  const displayStatus = isOffMarket ? 'off_market' : (mlsData?.status || transaction.status);
  const statusLabel = getStatusLabel(displayStatus);
  const daysRemaining = getDaysRemaining(transaction.closingDate);
  
  // Format last synced time for tooltip
  const lastSynced = transaction.mlsLastSyncedAt;
  const lastSyncedText = lastSynced 
    ? formatDistanceToNow(new Date(lastSynced), { addSuffix: true })
    : 'Not yet synced';
  
  const transactionCoordinators = coordinators.filter(
    (c) => transaction.coordinatorIds?.includes(c.id)
  );

  return (
    <Card
      className="hover-elevate cursor-pointer transition-all"
      onClick={onClick}
      data-testid={`card-transaction-${transaction.id}`}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2 sm:gap-4 pb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-base sm:text-lg leading-tight truncate" data-testid={`text-address-${transaction.id}`}>
            {transaction.propertyAddress}
          </h3>
          {transaction.mlsNumber ? (
            <div className="flex items-center gap-1.5 mt-1 text-muted-foreground">
              <Hash className="h-3 w-3 flex-shrink-0" />
              <span className="font-mono text-xs sm:text-sm truncate" data-testid={`text-mls-${transaction.id}`}>
                {transaction.mlsNumber}
              </span>
            </div>
          ) : isOffMarket ? (
            <span className="text-xs sm:text-sm text-muted-foreground" data-testid={`text-off-market-${transaction.id}`}>
              (Off Market)
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
          <Badge className={`${getStatusBadgeStyle(displayStatus)} text-[10px] sm:text-xs`} data-testid={`badge-status-${transaction.id}`}>
            {statusLabel}
          </Badge>
          
          {isConnectedToMLS && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help" data-testid={`mls-link-${transaction.id}`}>
                    <Link2 className="w-4 h-4 text-green-500" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="end" className="max-w-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-green-500" />
                      <span className="font-medium text-green-600 dark:text-green-400">Connected to Repliers MLS</span>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <p>MLS#: {transaction.mlsNumber}</p>
                      <p>Last synced: {lastSyncedText}</p>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 sm:space-y-4">
        {/* Conditional dates section: Off-market shows Date Going Live, others show Contract/Closing */}
        {isOffMarket ? (
          <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950/40 dark:to-purple-900/30 border border-purple-200 dark:border-purple-800/50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              {/* Left side: Label and Date */}
              <div>
                <p className="text-[10px] sm:text-xs text-purple-600 dark:text-purple-400 uppercase tracking-wide font-medium flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Going Live
                </p>
                {transaction.goLiveDate ? (
                  <p className="text-sm sm:text-base text-purple-900 dark:text-purple-100 font-semibold mt-1" data-testid={`text-go-live-date-${transaction.id}`}>
                    {formatDate(transaction.goLiveDate)}
                  </p>
                ) : (
                  <p className="text-xs sm:text-sm text-purple-400 dark:text-purple-500 mt-1" data-testid={`text-go-live-date-${transaction.id}`}>
                    Not set
                  </p>
                )}
              </div>
              
              {/* Right side: Countdown */}
              {transaction.goLiveDate && (() => {
                const goLive = new Date(transaction.goLiveDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                goLive.setHours(0, 0, 0, 0);
                const daysUntil = Math.ceil((goLive.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                
                if (daysUntil === 0) {
                  return (
                    <div className="bg-purple-500 text-white px-3 py-1.5 rounded-lg text-center">
                      <p className="text-sm font-bold">Today!</p>
                    </div>
                  );
                } else if (daysUntil < 0) {
                  return (
                    <div className="text-right text-purple-400 dark:text-purple-500">
                      <p className="text-xl sm:text-2xl font-bold">{Math.abs(daysUntil)}</p>
                      <p className="text-[10px] sm:text-xs">{Math.abs(daysUntil) === 1 ? 'day ago' : 'days ago'}</p>
                    </div>
                  );
                } else {
                  return (
                    <div className={`text-right ${daysUntil <= 7 ? 'text-purple-600 dark:text-purple-300' : 'text-purple-500 dark:text-purple-400'}`}>
                      <p className="text-xl sm:text-2xl font-bold">{daysUntil}</p>
                      <p className="text-[10px] sm:text-xs">{daysUntil === 1 ? 'day' : 'days'}</p>
                    </div>
                  );
                }
              })()}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm">
            <div>
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide mb-1">Contract Date</p>
              <div className="flex items-center gap-1 sm:gap-1.5">
                <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground flex-shrink-0" />
                <span data-testid={`text-contract-date-${transaction.id}`}>
                  {formatDate(transaction.contractDate)}
                </span>
              </div>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide mb-1">Closing Date</p>
              <div className="flex items-center gap-1 sm:gap-1.5">
                <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground flex-shrink-0" />
                <span data-testid={`text-closing-date-${transaction.id}`}>
                  {formatDate(transaction.closingDate)}
                </span>
              </div>
            </div>
          </div>
        )}

        {daysRemaining !== null && !displayStatus.toLowerCase().includes('closed') && !displayStatus.toLowerCase().includes('sold') && !displayStatus.toLowerCase().includes('cancel') && (
          <div className={`text-xs sm:text-sm ${getDaysRemainingStyle(daysRemaining)}`}>
            {daysRemaining > 0 ? `${daysRemaining} days remaining` : daysRemaining === 0 ? "Closing today" : `${Math.abs(daysRemaining)} days overdue`}
          </div>
        )}

        {transactionCoordinators.length > 0 && (
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
            <div className="flex -space-x-2">
              {transactionCoordinators.slice(0, 3).map((coord) => (
                <Avatar key={coord.id} className="h-6 w-6 sm:h-7 sm:w-7 border-2 border-card">
                  <AvatarFallback className="text-[10px] sm:text-xs">
                    {coord.name.split(" ").map((n) => n[0]).join("").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
              {transactionCoordinators.length > 3 && (
                <div className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] sm:text-xs font-medium">
                  +{transactionCoordinators.length - 3}
                </div>
              )}
            </div>
            <span className="text-xs sm:text-sm text-muted-foreground ml-1 truncate">
              {transactionCoordinators.map((c) => c.name.split(" ")[0]).slice(0, 2).join(", ")}
              {transactionCoordinators.length > 2 && ` +${transactionCoordinators.length - 2}`}
            </span>
          </div>
        )}

        <div className="flex items-center gap-1 sm:gap-2 pt-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
          {onMLSClick && !isOffMarket && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1 sm:gap-1.5 text-[11px] sm:text-xs px-2 sm:px-3"
              onClick={onMLSClick}
              data-testid={`button-mls-${transaction.id}`}
            >
              <FileSpreadsheet className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
              <span className="hidden xs:inline">MLS</span>
              <span className="xs:hidden">MLS</span>
            </Button>
          )}
          {onMarketingClick && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1 sm:gap-1.5 text-[11px] sm:text-xs px-2 sm:px-3"
              onClick={onMarketingClick}
              data-testid={`button-marketing-${transaction.id}`}
            >
              <ImageIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
              <span className="hidden sm:inline">Marketing</span>
              <span className="sm:hidden">Mkt</span>
            </Button>
          )}
          {onDocsClick && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1 sm:gap-1.5 text-[11px] sm:text-xs px-2 sm:px-3"
              onClick={onDocsClick}
              data-testid={`button-docs-${transaction.id}`}
            >
              <FileText className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
              Docs
            </Button>
          )}
          {transaction.slackChannelId && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1 sm:gap-1.5 text-[11px] sm:text-xs px-2 sm:px-3"
              onClick={() => window.open(`https://slack.com/app_redirect?channel=${transaction.slackChannelId}`, '_blank')}
              data-testid={`button-slack-${transaction.id}`}
            >
              <MessageSquare className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
              <span className="hidden sm:inline">Slack</span>
            </Button>
          )}
          {transaction.gmailFilterId && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1 sm:gap-1.5 text-[11px] sm:text-xs px-2 sm:px-3"
              data-testid={`button-emails-${transaction.id}`}
            >
              <Mail className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
              <span className="hidden sm:inline">Emails</span>
            </Button>
          )}
        </div>
        
        {isOffMarket && onAddMLSClick && (
          <Button
            size="sm"
            variant="ghost"
            className="gap-1 sm:gap-1.5 text-[11px] sm:text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/30 mt-2"
            onClick={(e) => {
              e.stopPropagation();
              onAddMLSClick();
            }}
            data-testid={`button-add-mls-${transaction.id}`}
          >
            <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
            Add MLS Number
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
