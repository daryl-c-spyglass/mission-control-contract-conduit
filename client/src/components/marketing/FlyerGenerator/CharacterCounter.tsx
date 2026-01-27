import { cn } from '@/lib/utils';

interface CharacterCounterProps {
  current: number;
  max: number;
}

export function CharacterCounter({ current, max }: CharacterCounterProps) {
  const remaining = max - current;

  const getColor = () => {
    if (current > max) return 'text-red-500';
    if (remaining <= 15) return 'text-yellow-500';
    return 'text-muted-foreground';
  };

  const getMessage = () => {
    if (current > max) return `${current - max} over limit`;
    if (current === 0) return 'No description';
    return null;
  };

  return (
    <div className="flex items-center justify-between text-xs">
      <span className={cn('font-medium', getColor())}>
        {current}/{max} characters
      </span>
      {getMessage() && (
        <span className={cn('text-xs', current > max ? 'text-red-500' : 'text-yellow-500')}>
          {getMessage()}
        </span>
      )}
    </div>
  );
}
