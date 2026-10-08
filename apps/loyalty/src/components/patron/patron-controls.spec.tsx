import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PatronButton, PatronCheckbox, PatronField, PatronInput } from './patron-controls';

afterEach(cleanup);

describe('PatronField', () => {
  it('links its label and hint to the rendered control', () => {
    render(
      <PatronField label="Birthday" hint="Used for birthday rewards.">
        {(field) => <PatronInput {...field} defaultValue="2000-01-01" />}
      </PatronField>,
    );

    const input = screen.getByLabelText('Birthday');
    expect(input).toBeTruthy();
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent).toBe('Used for birthday rewards.');
  });
});

describe('PatronButton', () => {
  it('blocks clicks while loading', () => {
    const onClick = vi.fn();
    render(
      <PatronButton loading onClick={onClick}>
        Redeem
      </PatronButton>,
    );

    const button = screen.getByRole('button', { name: /redeem/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    button.click();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('defaults to type="button" so it never submits a form by accident', () => {
    render(<PatronButton>Send code</PatronButton>);
    expect(screen.getByRole('button', { name: /send code/i }).getAttribute('type')).toBe('button');
  });
});

describe('PatronCheckbox', () => {
  it('reports the next checked state', () => {
    const onCheckedChange = vi.fn();
    render(
      <PatronCheckbox checked={false} onCheckedChange={onCheckedChange}>
        I agree to the terms
      </PatronCheckbox>,
    );

    screen.getByLabelText(/i agree to the terms/i).click();
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});
