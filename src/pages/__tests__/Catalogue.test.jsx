import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import Catalogue from '../Catalogue.jsx';
import { Route, renderRoutes } from '../../testUtils.jsx';
import { loadActiveEquipment } from '../../lib/inventory.js';

vi.mock('../../lib/firebase.js', () => ({ db: {}, auth: {} }));
vi.mock('../../lib/booking.js', () => ({ loadAvailability: vi.fn().mockResolvedValue({}) }));
vi.mock('../../lib/inventory.js', async (importOriginal) => ({
  ...(await importOriginal()),
  loadActiveEquipment: vi.fn(),
  invalidateInventory: vi.fn(),
}));

const EQUIPMENT = [
  {
    id: 'scope',
    name: 'Digital Oscilloscope',
    category: 'Measurement',
    description: 'Signal analysis',
    tags: ['signals'],
    labName: 'Signals Lab',
    department: 'ECE',
    quantity: 1,
    accessLevel: 'approval',
    hazardLevel: 'none',
  },
  {
    id: 'mantle',
    name: 'Heating mantle',
    category: 'Heating',
    description: 'Even heating of flasks',
    tags: ['acid'],
    labName: 'Chemistry Lab',
    department: 'Chemistry',
    quantity: 3,
    accessLevel: 'approval',
    hazardLevel: 'high',
  },
];

const renderCatalogue = () => renderRoutes(<Route path="/" element={<Catalogue />} />);

describe('Catalogue page', () => {
  beforeEach(() => {
    loadActiveEquipment.mockResolvedValue(EQUIPMENT);
  });

  it('lists equipment with text badges and has no axe violations', async () => {
    const { container } = renderCatalogue();
    expect(await screen.findByRole('heading', { name: 'Heating mantle' })).toBeInTheDocument();
    expect(screen.getByText('High hazard')).toBeInTheDocument();
    expect(screen.getAllByText('Quiet this week')).toHaveLength(2);
    expect(screen.getByText('2 of 2 items shown')).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('Catalogue · LabLink'));
    expect(await axe(container)).toHaveNoViolations();
  });

  it('filters by department and debounced search, with an empty state', async () => {
    const user = userEvent.setup();
    renderCatalogue();
    await screen.findByText('2 of 2 items shown');
    await user.selectOptions(screen.getByLabelText('Department'), 'ECE');
    expect(screen.getByText('1 of 2 items shown')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Search'), 'acid');
    expect(await screen.findByText('No equipment matches these filters')).toBeInTheDocument();
  });

  it('shows a friendly error with a retry button', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    loadActiveEquipment.mockRejectedValueOnce({ code: 'permission-denied' });
    const user = userEvent.setup();
    renderCatalogue();
    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('2 of 2 items shown')).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
