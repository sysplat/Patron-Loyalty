import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button, buttonVariants } from './button';

afterEach(cleanup);

describe('Button', () => {
  it('renders a native button with the default variant/size classes', () => {
    render(<Button>Save</Button>);
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.className).toContain('bg-primary');
    expect(btn.className).toContain('h-10');
  });

  it('applies the requested variant and size', () => {
    render(
      <Button variant="destructive" size="sm">
        Delete
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Delete' });
    expect(btn.className).toContain('bg-destructive');
    expect(btn.className).toContain('h-9');
  });

  it('merges caller className without dropping variant classes', () => {
    render(<Button className="custom-x">Go</Button>);
    const btn = screen.getByRole('button', { name: 'Go' });
    expect(btn.className).toContain('custom-x');
    expect(btn.className).toContain('bg-primary');
  });

  it('forwards click handlers and respects the disabled attribute', () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Disabled
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Disabled' });
    expect(btn).toHaveProperty('disabled', true);
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders as a child element when asChild is set (polymorphic Slot)', () => {
    render(
      <Button asChild>
        <a href="https://example.com/tenants">Tenants</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Tenants' });
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('https://example.com/tenants');
    expect(link.className).toContain('bg-primary');
  });

  it('exposes a class generator usable outside the component', () => {
    expect(buttonVariants({ variant: 'outline' })).toContain('border');
  });
});
