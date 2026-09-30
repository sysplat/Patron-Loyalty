'use client';

import { useEffect, useId, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  pendingLabel,
  pending,
  destructive,
  summary,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  pending: boolean;
  destructive?: boolean;
  summary?: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pending) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, pending]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        aria-label="Close dialog"
        disabled={pending}
        onClick={() => {
          if (!pending) onCancel();
        }}
      />
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="relative z-10 w-full max-w-md border shadow-xl"
      >
        <CardHeader className="space-y-3 pb-3">
          {destructive ? (
            <div className="bg-destructive/10 text-destructive flex h-11 w-11 items-center justify-center rounded-full">
              <AlertTriangle className="h-5 w-5" aria-hidden />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <CardTitle id={titleId} className="text-lg">
              {title}
            </CardTitle>
            <CardDescription id={descId} className="text-sm leading-relaxed">
              {description}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {summary}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={destructive ? 'destructive' : 'default'}
              onClick={onConfirm}
              disabled={pending}
              autoFocus
            >
              {pending ? pendingLabel : confirmLabel}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
