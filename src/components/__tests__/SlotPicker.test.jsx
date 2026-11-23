import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import SlotPicker from '../SlotPicker.jsx';

const remaining = (values) => {
  const arr = [];
  for (let h = 9; h < 17; h += 1) arr[h] = values[h] ?? 10;
  return arr;
};

const props = {
  caption: 'Free units per hour',
  dates: ['2026-11-24', '2026-11-25'],
  remainingByDate: { '2026-11-24': remaining({ 10: 3 }), '2026-11-25': remaining({ 9: 0 }) },
  quantity: 10,
};

describe('SlotPicker', () => {
  it('is a captioned table with hour row headers', () => {
    render(<SlotPicker {...props} />);
    expect(screen.getByRole('table', { name: 'Free units per hour' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: '09:00' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Tue 24 Nov' })).toBeInTheDocument();
  });

  it('labels every cell with date, hour range and free units, showing numbers not just colour', () => {
    render(<SlotPicker {...props} />);
    const cell = screen.getByRole('button', { name: 'Tue 24 Nov, 10:00 to 11:00, 3 of 10 free' });
    expect(cell).toHaveTextContent('3 free');
    expect(cell).toHaveAttribute('aria-pressed', 'false');
  });

  it('disables full cells and labels them "Full"', () => {
    render(<SlotPicker {...props} />);
    const full = screen.getByRole('button', { name: 'Wed 25 Nov, 09:00 to 10:00, 0 of 10 free' });
    expect(full).toBeDisabled();
    expect(full).toHaveTextContent('Full');
  });

  it('disables cells with fewer free units than needed', () => {
    render(<SlotPicker {...props} unitsNeeded={4} />);
    expect(
      screen.getByRole('button', { name: 'Tue 24 Nov, 10:00 to 11:00, 3 of 10 free' }),
    ).toBeDisabled();
  });

  it('marks the selection with aria-pressed and reports clicks', async () => {
    const user = userEvent.setup();
    const onCellClick = vi.fn();
    render(
      <SlotPicker
        {...props}
        selection={{ date: '2026-11-24', startHour: 11, endHour: 13 }}
        onCellClick={onCellClick}
      />,
    );
    const selected = screen.getByRole('button', { name: /Tue 24 Nov, 12:00 to 13:00/ });
    expect(selected).toHaveAttribute('aria-pressed', 'true');
    await user.click(selected);
    expect(onCellClick).toHaveBeenCalledWith('2026-11-24', 12);
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <SlotPicker {...props} selection={{ date: '2026-11-24', startHour: 9, endHour: 10 }} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
