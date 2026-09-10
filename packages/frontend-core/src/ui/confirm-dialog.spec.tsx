import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './confirm-dialog';

afterEach(cleanup);

function setup(overrides?: Partial<Parameters<typeof ConfirmDialog>[0]>) {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title="Suspend tenant"
      description="This blocks tenant access until reactivated."
      onConfirm={onConfirm}
      {...overrides}
    />,
  );
  return { onConfirm, onOpenChange };
}

describe('ConfirmDialog', () => {
  it('renders title and description when open', () => {
    setup();
    expect(screen.getByText('Suspend tenant')).toBeTruthy();
    expect(screen.getByText('This blocks tenant access until reactivated.')).toBeTruthy();
  });

  it('does not render content when closed', () => {
    setup({ open: false });
    expect(screen.queryByText('Suspend tenant')).toBeNull();
  });

  it('confirm fires onConfirm and then closes the dialog', () => {
    const { onConfirm, onOpenChange } = setup({ confirmText: 'Suspend' });
    fireEvent.click(screen.getByRole('button', { name: 'Suspend' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('cancel closes the dialog without confirming', () => {
    const { onConfirm, onOpenChange } = setup({ cancelText: 'Keep active' });
    fireEvent.click(screen.getByRole('button', { name: 'Keep active' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('uses destructive styling for the confirm action when requested', () => {
    setup({ variant: 'destructive', confirmText: 'Delete' });
    const confirm = screen.getByRole('button', { name: 'Delete' });
    expect(confirm.className).toContain('bg-red-600');
  });

  it('defaults the confirm/cancel labels', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
  });
});
