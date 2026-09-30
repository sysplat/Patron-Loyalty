import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type GuideItem = {
  title: string;
  body: ReactNode;
};

export function GuideCard({
  open,
  title,
  description,
  items,
  columns = 2,
  footer,
  ordered = false,
  className,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  items: GuideItem[];
  columns?: 2 | 3 | 4;
  footer?: ReactNode;
  ordered?: boolean;
  className?: string;
}) {
  if (!open) return null;

  const gridClass =
    columns === 4
      ? 'sm:grid-cols-2 lg:grid-cols-4'
      : columns === 3
        ? 'sm:grid-cols-2 lg:grid-cols-3'
        : 'sm:grid-cols-2';

  const ListTag = ordered ? 'ol' : 'ul';

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className={cn(footer ? 'space-y-4' : undefined)}>
        <ListTag className={cn('text-muted-foreground grid gap-3 text-sm', gridClass)}>
          {items.map((item, index) => (
            <li key={item.title} className="space-y-1">
              <p className="text-foreground font-medium">
                {ordered && !/^\d+\.\s/.test(item.title)
                  ? `${index + 1}. ${item.title}`
                  : item.title}
              </p>
              <p className="text-xs leading-relaxed">{item.body}</p>
            </li>
          ))}
        </ListTag>
        {footer ? (
          <div className="border-border/70 text-muted-foreground border-t pt-3 text-xs leading-relaxed">
            {footer}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
