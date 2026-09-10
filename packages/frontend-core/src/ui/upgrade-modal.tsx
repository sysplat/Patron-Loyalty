'use client';

import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  feature: string;
  limit: number;
  current: number;
}

const FEATURE_LABELS: Record<string, { title: string; description: string }> = {
  branches: {
    title: 'Branch Limit Reached',
    description: 'Your plan allows a limited number of branches. Upgrade to add more locations.',
  },
  queues: {
    title: 'Queue Limit Reached',
    description:
      'Your plan allows a limited number of queues per branch. Upgrade to create more queues.',
  },
  ticketsPerMonth: {
    title: 'Monthly Ticket Limit Reached',
    description: 'Your plan has a monthly ticket limit. Upgrade to serve more customers.',
  },
  users: {
    title: 'User Limit Reached',
    description: 'Your plan allows a limited number of team members. Upgrade to invite more users.',
  },
};

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './dialog';

export function UpgradeModal({ open, onClose, feature, limit, current }: UpgradeModalProps) {
  const info = FEATURE_LABELS[feature] ?? {
    title: 'Plan Limit Reached',
    description: 'You have reached the limit for your current plan. Upgrade to continue.',
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="overflow-hidden sm:max-w-md">
        <div className="from-primary absolute inset-x-0 top-0 h-1 bg-gradient-to-r via-blue-500 to-indigo-500" />

        <DialogHeader className="pt-4">
          <div className="bg-primary/10 text-primary mb-4 flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm">
            <Sparkles className="h-6 w-6" />
          </div>
          <DialogTitle className="text-xl">{info.title}</DialogTitle>
          <DialogDescription>{info.description}</DialogDescription>
        </DialogHeader>

        <div className="bg-muted/30 rounded-2xl border px-4 py-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Current usage</span>
            <span className="font-semibold">
              {current} / {limit === -1 ? '∞' : limit}
            </span>
          </div>
          {limit > 0 && (
            <div className="bg-background mt-3 h-2 rounded-full">
              <div
                className="from-primary h-2 rounded-full bg-gradient-to-r to-indigo-500"
                style={{ width: `${Math.min((current / limit) * 100, 100)}%` }}
              />
            </div>
          )}
        </div>

        <div className="grid gap-3 pt-2 sm:grid-cols-2">
          <Link
            href="/dashboard/settings?tab=billing"
            className="bg-primary text-primary-foreground shadow-primary/20 hover:bg-primary/90 inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold shadow-lg transition-all hover:scale-[1.02]"
            onClick={onClose}
          >
            View Plans <ArrowRight className="h-4 w-4" />
          </Link>
          <button
            onClick={onClose}
            className="bg-background hover:bg-muted rounded-xl border py-2.5 text-sm font-semibold transition-colors"
          >
            Continue
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
