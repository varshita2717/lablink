import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import StatusBadge from '../StatusBadge.jsx';
import AccessBadge from '../AccessBadge.jsx';
import HazardBadge from '../HazardBadge.jsx';

describe('StatusBadge', () => {
  it.each([
    ['pending', 'Pending'],
    ['approved', 'Approved'],
    ['rejected', 'Rejected'],
    ['conflict_lost', 'Not allocated'],
    ['changes_requested', 'Changes requested'],
    ['cancelled', 'Cancelled'],
    ['proposed', 'Proposed'],
  ])('shows text for %s, not just colour', (status, text) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('accepts a custom label', () => {
    render(<StatusBadge status="quiet" label="Quiet this week" />);
    expect(screen.getByText('Quiet this week')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <p>
        <StatusBadge status="pending" /> <StatusBadge status="busy" label="Busy this week" />
      </p>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('AccessBadge and HazardBadge', () => {
  it('label access levels in text', () => {
    render(<AccessBadge accessLevel="approval" />);
    expect(screen.getByText('Needs approval')).toBeInTheDocument();
  });

  it('shows hazard text with a decorative icon, and nothing for none', () => {
    const { container, rerender } = render(<HazardBadge hazardLevel="high" />);
    expect(screen.getByText('High hazard')).toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent('⚠');
    rerender(<HazardBadge hazardLevel="none" />);
    expect(container).toBeEmptyDOMElement();
  });
});
