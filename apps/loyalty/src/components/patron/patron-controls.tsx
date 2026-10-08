'use client';

import type { ButtonHTMLAttributes, CSSProperties, InputHTMLAttributes, ReactNode } from 'react';
import { forwardRef, useId } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950';

export type PatronButtonVariant = 'primary' | 'secondary' | 'ghost';
export type PatronButtonSize = 'sm' | 'md';

function patronButtonClass(
  variant: PatronButtonVariant,
  size: PatronButtonSize,
  className?: string,
) {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-[filter,background-color,opacity] disabled:cursor-not-allowed disabled:opacity-45',
    size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm',
    variant === 'primary' && 'text-white hover:brightness-110',
    variant === 'secondary' && 'border border-white/15 bg-white/10 text-white hover:bg-white/20',
    variant === 'ghost' && 'text-white/70 hover:bg-white/10 hover:text-white',
    FOCUS_RING,
    className,
  );
}

function patronButtonStyle(variant: PatronButtonVariant, style?: CSSProperties) {
  return variant === 'primary' ? { backgroundColor: 'var(--patron-primary)', ...style } : style;
}

export const PatronButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: PatronButtonVariant;
    size?: PatronButtonSize;
    loading?: boolean;
  }
>(function PatronButton(
  { variant = 'primary', size = 'md', loading = false, className, children, style, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={props.type ?? 'button'}
      className={patronButtonClass(variant, size, className)}
      style={patronButtonStyle(variant, style)}
      {...props}
      disabled={props.disabled || loading}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
});

export function PatronLinkButton({
  href,
  variant = 'primary',
  size = 'md',
  className,
  children,
}: {
  href: string;
  variant?: PatronButtonVariant;
  size?: PatronButtonSize;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={patronButtonClass(variant, size, className)}
      style={patronButtonStyle(variant)}
    >
      {children}
    </Link>
  );
}

export const PatronInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function PatronInput({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35',
          FOCUS_RING,
          className,
        )}
        {...props}
      />
    );
  },
);

export function PatronField({
  label,
  hint,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  className?: string;
  children: (props: { id: string; 'aria-describedby'?: string }) => ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-xs font-medium text-white/65">
        {label}
      </label>
      {children({ id, 'aria-describedby': hintId })}
      {hint ? (
        <p id={hintId} className="text-[11px] leading-relaxed text-white/45">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function PatronCheckbox({
  checked,
  onCheckedChange,
  children,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
        className={cn('mt-0.5 h-4 w-4 shrink-0 rounded border-white/30 bg-white/10', FOCUS_RING)}
      />
      <span className="text-white/80">{children}</span>
    </label>
  );
}

export function PatronInlineLink({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('rounded underline underline-offset-2', FOCUS_RING)}
      style={{ color: 'var(--patron-primary)' }}
    >
      {children}
    </button>
  );
}
