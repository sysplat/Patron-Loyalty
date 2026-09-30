import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function PermissionGate({
  message,
  icon: Icon = AlertTriangle,
  className,
}: {
  message: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className={cn('flex items-start gap-3 p-5 text-sm')}>
        <Icon className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p className="text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}
