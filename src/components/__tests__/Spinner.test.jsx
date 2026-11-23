import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import Spinner from '../Spinner.jsx';

describe('Spinner', () => {
  it('announces its label through role="status"', async () => {
    const { container } = render(<Spinner label="Loading bookings" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading bookings');
    expect(await axe(container)).toHaveNoViolations();
  });
});
