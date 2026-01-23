import { Calendar, Hash, Mail, MessageSquare, Users, FileSpreadsheet, Image as ImageIcon, FileText, Plus, Link2, Clock, CheckCircle, AlertTriangle } from "lucide-react";
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
import { getStatusBadgeStyle, getStatusLabel } from "@/lib/utils/status-colors";
import { format, differenceInDays, isPast, isToday } from "date-fns";

interface TransactionCardProps {
  transaction: Transaction;
  coordinators: Coordinator[];
  onClick: () => void;
  onMarketingClick?: () => void;
  onMLSClick?: () => void;
  onDocsClick?: () => void;
  onAddMLSClick?: () => void;
}

function formatDisplayDate(dateString: string | null | undefined): string | null {
  if (!dateString) return null;
  try {
    return format(new Date(dateString), "MMM d, yyyy");
  } catch {
    return null;
  }
}

function calculateDaysDifference(targetDate: string | null | undefined): number | null {
  if (!targetDate) return null;
  try {
    const target = new Date(targetDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    return differenceInDays(target, today);
  } catch {
    return null;
  }
}

function isDatePast(date: string | null | undefined): boolean {
  if (!date) return false;
  try {
    const target = new Date(date);
    target.setHours(23, 59, 59, 999);
    return isPast(target);
  } catch {
    return false;
  }
}

function isDateToday(date: string | null | undefined): boolean {
  if (!date) return false;
  try {
    return isToday(new Date(date));
  } catch {
    return false;
  }
}

function OffMarketDateBox({ goLiveDate }: { goLiveDate: string | null }) {
  const days = calculateDaysDifference(goLiveDate);
  const formattedDate = formatDisplayDate(goLiveDate);
  const isPastDate = isDatePast(goLiveDate);
  const isTodayDate = days === 0;

  const getTooltipMessage = () => {
    if (isPastDate) return "Days since expected go-live date";
    if (isTodayDate) return "Listing goes live on MLS today";
    return "Days until listing goes live on MLS";
  };

  return (
    <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/50 rounded-lg p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] sm:text-xs text-purple-600 dark:text-purple-400 uppercase tracking-wide font-medium flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Going Live
          </p>
          {formattedDate ? (
            <p className="text-sm sm:text-base text-purple-900 dark:text-purple-100 font-semibold mt-1">{formattedDate}</p>
          ) : (
            <p className="text-xs sm:text-sm text-purple-400 dark:text-purple-500 mt-1">Not set</p>
          )}
        </div>
        {days !== null && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-right cursor-help">
                  {isPastDate ? (
                    <>
                      <p className="text-xl sm:text-2xl font-bold text-purple-400 dark:text-purple-500">{Math.abs(days)}</p>
                      <p className="text-[10px] sm:text-xs text-purple-400 dark:text-purple-500">{Math.abs(days) === 1 ? 'day ago' : 'days ago'}</p>
                    </>
                  ) : isTodayDate ? (
                    <div className="bg-purple-500 text-white px-3 py-1.5 rounded-lg">
                      <p className="text-xs sm:text-sm font-bold">Today!</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xl sm:text-2xl font-bold text-purple-600 dark:text-purple-300">{days}</p>
                      <p className="text-[10px] sm:text-xs text-purple-500 dark:text-purple-400">{days === 1 ? 'day' : 'days'}</p>
                    </>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <p className="text-xs">{getTooltipMessage()}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}

function ActiveListingDateBox({ listDate, daysOnMarket }: { listDate: string | null; daysOnMarket?: number | null }) {
  const computedDays = listDate ? Math.abs(calculateDaysDifference(listDate) || 0) : null;
  const displayDays = daysOnMarket ?? computedDays;
  const formattedDate = formatDisplayDate(listDate);

  return (
    <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800/50 rounded-lg p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] sm:text-xs text-green-600 dark:text-green-400 uppercase tracking-wide font-medium flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Days on Market
          </p>
          {formattedDate ? (
            <p className="text-sm sm:text-base text-green-900 dark:text-green-100 font-semibold mt-1">Listed {formattedDate}</p>
          ) : (
            <p className="text-xs sm:text-sm text-green-400 dark:text-green-500 mt-1">List date not set</p>
          )}
        </div>
        {displayDays !== null && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-right cursor-help">
                  <p className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-300">{displayDays}</p>
                  <p className="text-[10px] sm:text-xs text-green-500 dark:text-green-400">{displayDays === 1 ? 'day' : 'days'}</p>
                </div>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <p className="text-xs">Days on market since listing</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}

function InContractDateBox({ 
  contractDate, 
  closingDate 
}: { 
  contractDate: string | null; 
  closingDate: string | null;
}) {
  const daysToClose = calculateDaysDifference(closingDate);
  const isOverdue = daysToClose !== null && daysToClose < 0;
  const isClosingToday = isDateToday(closingDate);

  const getTooltipMessage = () => {
    if (isClosingToday) return "Closing is scheduled for today";
    if (isOverdue) return "Days past expected closing date";
    return "Days until expected closing";
  };

  return (
    <div className="bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800/50 rounded-lg p-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] sm:text-xs text-orange-600 dark:text-orange-400 uppercase tracking-wide font-medium">Contract Date</p>
          <p className="text-xs sm:text-sm text-orange-900 dark:text-orange-100 font-semibold mt-1">
            {formatDisplayDate(contractDate) || "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] sm:text-xs text-orange-600 dark:text-orange-400 uppercase tracking-wide font-medium">Closing Date</p>
          <p className="text-xs sm:text-sm text-orange-900 dark:text-orange-100 font-semibold mt-1">
            {formatDisplayDate(closingDate) || "—"}
          </p>
        </div>
      </div>
      {closingDate && (
        <div className="mt-2 pt-2 border-t border-orange-200 dark:border-orange-800/50 flex items-center justify-between">
          <span className="text-[10px] sm:text-xs text-orange-600 dark:text-orange-400 font-medium">Time to Close</span>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={`text-xs sm:text-sm font-bold cursor-help ${isOverdue ? "text-red-600 dark:text-red-400" : "text-orange-700 dark:text-orange-300"}`}>
                  {isClosingToday 
                    ? "Closing Today!" 
                    : isOverdue 
                      ? `${Math.abs(daysToClose!)} ${Math.abs(daysToClose!) === 1 ? 'day' : 'days'} overdue`
                      : `${daysToClose} ${daysToClose === 1 ? 'day' : 'days'} remaining`
                  }
                </span>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <p className="text-xs">{getTooltipMessage()}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}

function PendingDateBox({ 
  contractDate, 
  closingDate 
}: { 
  contractDate: string | null; 
  closingDate: string | null;
}) {
  const daysToClose = calculateDaysDifference(closingDate);
  const isOverdue = daysToClose !== null && daysToClose < 0;
  const isClosingToday = isDateToday(closingDate);

  const boxBg = isOverdue ? "bg-red-50 dark:bg-red-950/40" : "bg-yellow-50 dark:bg-yellow-950/40";
  const boxBorder = isOverdue ? "border-red-200 dark:border-red-800/50" : "border-yellow-200 dark:border-yellow-800/50";
  const textColor = isOverdue ? "text-red-600 dark:text-red-400" : "text-yellow-600 dark:text-yellow-400";
  const textColorDark = isOverdue ? "text-red-900 dark:text-red-100" : "text-yellow-900 dark:text-yellow-100";
  const borderColor = isOverdue ? "border-red-200 dark:border-red-800/50" : "border-yellow-200 dark:border-yellow-800/50";

  const getTooltipMessage = () => {
    if (isClosingToday) return "Closing is scheduled for today";
    if (isOverdue) return "Days past expected closing date - action may be required";
    return "Days until expected closing";
  };

  return (
    <div className={`${boxBg} border ${boxBorder} rounded-lg p-3`}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className={`text-[10px] sm:text-xs ${textColor} uppercase tracking-wide font-medium`}>Contract Date</p>
          <p className={`text-xs sm:text-sm ${textColorDark} font-semibold mt-1`}>
            {formatDisplayDate(contractDate) || "—"}
          </p>
        </div>
        <div>
          <p className={`text-[10px] sm:text-xs ${textColor} uppercase tracking-wide font-medium`}>Closing Date</p>
          <p className={`text-xs sm:text-sm ${textColorDark} font-semibold mt-1`}>
            {formatDisplayDate(closingDate) || "—"}
          </p>
        </div>
      </div>
      {closingDate && (
        <div className={`mt-2 pt-2 border-t ${borderColor} flex items-center justify-between`}>
          {isOverdue ? (
            <>
              <span className="text-[10px] sm:text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Overdue
              </span>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs sm:text-sm text-red-700 dark:text-red-300 font-bold cursor-help">
                      {Math.abs(daysToClose!)} {Math.abs(daysToClose!) === 1 ? 'day' : 'days'} overdue
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs">
                    <p className="text-xs">{getTooltipMessage()}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          ) : isClosingToday ? (
            <>
              <span className={`text-[10px] sm:text-xs ${textColor} font-medium`}>Status</span>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs sm:text-sm text-yellow-700 dark:text-yellow-300 font-bold cursor-help">Closing Today!</span>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs">
                    <p className="text-xs">{getTooltipMessage()}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          ) : (
            <>
              <span className={`text-[10px] sm:text-xs ${textColor} font-medium`}>Time to Close</span>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs sm:text-sm text-yellow-700 dark:text-yellow-300 font-bold cursor-help">
                      {daysToClose} {daysToClose === 1 ? 'day' : 'days'} remaining
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs">
                    <p className="text-xs">{getTooltipMessage()}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ClosingSoonDateBox({ 
  contractDate, 
  closingDate 
}: { 
  contractDate: string | null; 
  closingDate: string | null;
}) {
  const daysToClose = calculateDaysDifference(closingDate);
  const isClosingToday = isDateToday(closingDate);
  const isOverdue = daysToClose !== null && daysToClose < 0;

  const getTooltipMessage = () => {
    if (isClosingToday) return "Closing is scheduled for today";
    if (isOverdue) return "Days past expected closing date";
    return "Days until closing";
  };

  return (
    <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-lg p-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wide font-medium">Contract Date</p>
          <p className="text-xs sm:text-sm text-amber-900 dark:text-amber-100 font-semibold mt-1">
            {formatDisplayDate(contractDate) || "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wide font-medium">Closing Date</p>
          <p className="text-xs sm:text-sm text-amber-900 dark:text-amber-100 font-semibold mt-1">
            {formatDisplayDate(closingDate) || "—"}
          </p>
        </div>
      </div>
      {closingDate && (
        <div className="mt-2 pt-2 border-t border-amber-200 dark:border-amber-800/50 flex items-center justify-between">
          {isClosingToday ? (
            <>
              <span className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Closing Today!
              </span>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs sm:text-sm text-amber-700 dark:text-amber-300 font-bold cursor-help">Today</span>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs">
                    <p className="text-xs">{getTooltipMessage()}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          ) : isOverdue ? (
            <>
              <span className="text-[10px] sm:text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Overdue
              </span>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs sm:text-sm text-red-700 dark:text-red-300 font-bold cursor-help">
                      {Math.abs(daysToClose!)} {Math.abs(daysToClose!) === 1 ? 'day' : 'days'} overdue
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs">
                    <p className="text-xs">{getTooltipMessage()}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          ) : (
            <>
              <span className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Closing Soon
              </span>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs sm:text-sm text-amber-700 dark:text-amber-300 font-bold cursor-help">
                      {daysToClose} {daysToClose === 1 ? 'day' : 'days'} remaining
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs">
                    <p className="text-xs">{getTooltipMessage()}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ClosedDateBox({ 
  contractDate, 
  closedDate 
}: { 
  contractDate: string | null; 
  closedDate: string | null;
}) {
  const daysSinceClosed = closedDate ? Math.abs(calculateDaysDifference(closedDate) || 0) : null;

  return (
    <div className="bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">Contract Date</p>
          <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 font-semibold mt-1">
            {formatDisplayDate(contractDate) || "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">Closed On</p>
          <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 font-semibold mt-1">
            {formatDisplayDate(closedDate) || "—"}
          </p>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium flex items-center gap-1">
          <CheckCircle className="w-3.5 h-3.5" />
          Completed
        </span>
        {daysSinceClosed !== null && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium cursor-help">
                  {daysSinceClosed} {daysSinceClosed === 1 ? 'day' : 'days'} ago
                </span>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <p className="text-xs">Days since transaction closed</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}

function DefaultDateBox({ 
  contractDate, 
  closingDate 
}: { 
  contractDate: string | null; 
  closingDate: string | null;
}) {
  const daysToClose = calculateDaysDifference(closingDate);
  const isOverdue = daysToClose !== null && daysToClose < 0;
  const isClosingToday = isDateToday(closingDate);

  return (
    <div className="bg-muted/50 border border-border rounded-lg p-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide font-medium">Contract Date</p>
          <p className="text-xs sm:text-sm text-foreground font-semibold mt-1">
            {formatDisplayDate(contractDate) || "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide font-medium">Closing Date</p>
          <p className="text-xs sm:text-sm text-foreground font-semibold mt-1">
            {formatDisplayDate(closingDate) || "—"}
          </p>
        </div>
      </div>
      {closingDate && daysToClose !== null && (
        <div className="mt-2 pt-2 border-t border-border flex items-center justify-between">
          <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">Time to Close</span>
          {isClosingToday ? (
            <span className="text-xs sm:text-sm text-foreground font-bold">Closing Today!</span>
          ) : isOverdue ? (
            <span className="text-xs sm:text-sm text-red-600 dark:text-red-400 font-bold">{Math.abs(daysToClose)} days overdue</span>
          ) : (
            <span className="text-xs sm:text-sm text-foreground font-bold">
              {daysToClose} {daysToClose === 1 ? 'day' : 'days'} remaining
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function TransactionCard({ transaction, coordinators, onClick, onMarketingClick, onMLSClick, onDocsClick, onAddMLSClick }: TransactionCardProps) {
  const isOffMarket = transaction.isOffMarket && !transaction.mlsNumber;
  
  const isConnectedToMLS = !!(
    transaction.mlsNumber && 
    transaction.mlsNumber.length > 0 && 
    !transaction.isOffMarket
  );
  
  const mlsData = transaction.mlsData as MLSData | null;
  const displayStatus = isOffMarket ? 'off_market' : (mlsData?.status || transaction.status);
  const statusLabel = getStatusLabel(displayStatus);
  
  const lastSynced = transaction.mlsLastSyncedAt;
  const lastSyncedText = lastSynced 
    ? `${Math.floor((Date.now() - new Date(lastSynced).getTime()) / (1000 * 60 * 60 * 24))} days ago`
    : 'Not yet synced';
  
  const transactionCoordinators = coordinators.filter(
    (c) => transaction.coordinatorIds?.includes(c.id)
  );

  const renderDateBox = () => {
    const statusLower = displayStatus.toLowerCase().replace(/\s+/g, '');
    
    if (isOffMarket || statusLower.includes('offmarket') || statusLower === 'off_market') {
      return <OffMarketDateBox goLiveDate={transaction.goLiveDate} />;
    }
    
    if (statusLower.includes('comingsoon')) {
      return <OffMarketDateBox goLiveDate={transaction.goLiveDate} />;
    }
    
    if (statusLower.includes('active') || statusLower === 'forsale') {
      const listDate = mlsData?.listDate || null;
      const daysOnMarket = mlsData?.daysOnMarket;
      return <ActiveListingDateBox listDate={listDate} daysOnMarket={daysOnMarket} />;
    }
    
    if (statusLower.includes('closed') || statusLower.includes('sold')) {
      const closedDate = mlsData?.soldDate || null;
      return <ClosedDateBox contractDate={transaction.contractDate} closedDate={closedDate} />;
    }
    
    if (statusLower.includes('cleartoclose')) {
      return <ClosingSoonDateBox contractDate={transaction.contractDate} closingDate={transaction.closingDate} />;
    }
    
    if (statusLower.includes('pending')) {
      return <PendingDateBox contractDate={transaction.contractDate} closingDate={transaction.closingDate} />;
    }
    
    if (statusLower.includes('contract')) {
      return <InContractDateBox contractDate={transaction.contractDate} closingDate={transaction.closingDate} />;
    }
    
    return <DefaultDateBox contractDate={transaction.contractDate} closingDate={transaction.closingDate} />;
  };

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
        {renderDateBox()}

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
            className="gap-1 sm:gap-1.5 text-[11px] sm:text-xs text-purple-600 dark:text-purple-400 mt-2"
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
