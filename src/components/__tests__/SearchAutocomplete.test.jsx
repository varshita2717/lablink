import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { axe } from 'jest-axe';
import SearchAutocomplete from '../SearchAutocomplete.jsx';

vi.mock('../../lib/firebase.js', () => ({ db: {}, auth: {} }));

const EQUIPMENT = [
  {
    id: 'eq-flask-500',
    name: 'Round-bottom flask 500 mL',
    category: 'Glassware',
    accessLevel: 'open',
    tags: ['acid'],
    status: 'active',
  },
  {
    id: 'eq-flask-250',
    name: 'Flask 250 mL',
    category: 'Glassware',
    accessLevel: 'open',
    tags: ['acid'],
    status: 'active',
  },
  {
    id: 'eq-mantle',
    name: 'Heating mantle',
    category: 'Heating',
    accessLevel: 'approval',
    tags: ['flask'],
    status: 'active',
  },
  {
    id: 'eq-scope',
    name: 'Digital Oscilloscope',
    category: 'Measurement',
    accessLevel: 'approval',
    tags: [],
    status: 'active',
  },
];

function Harness() {
  const [value, setValue] = useState('');
  return (
    <>
      <label htmlFor="search">Search</label>
      <SearchAutocomplete id="search" value={value} onChange={setValue} equipment={EQUIPMENT} />
      <p>Grid filter: {value}</p>
      <button type="button">Next control</button>
    </>
  );
}

function Detail() {
  const { id } = useParams();
  return <p>Detail page for {id}</p>;
}

function renderSearch() {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<Harness />} />
        <Route path="/equipment/:id" element={<Detail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SearchAutocomplete', () => {
  it('shows ranked options with highlighted matches, announces the count, and still updates the filter', async () => {
    const user = userEvent.setup();
    const { container } = renderSearch();
    const input = screen.getByRole('combobox', { name: 'Search' });
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
    await user.type(input, 'flask');
    expect(screen.getByText('Grid filter: flask')).toBeInTheDocument();
    const listbox = await screen.findByRole('listbox', { name: 'Equipment suggestions' });
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-controls', listbox.id);
    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([
      'Flask 250 mLGlassware · Open booking',
      'Round-bottom flask 500 mLGlassware · Open booking',
      'Heating mantleHeating · Needs approval',
    ]);
    expect(options[0].querySelector('mark')).toHaveTextContent('Flask');
    expect(screen.getByText('3 suggestions available')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('moves with ArrowDown/ArrowUp and opens the highlighted item on Enter', async () => {
    const user = userEvent.setup();
    renderSearch();
    const input = screen.getByRole('combobox', { name: 'Search' });
    await user.type(input, 'flask');
    await screen.findByRole('listbox');
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}{ArrowDown}');
    const active = screen.getAllByRole('option')[1];
    expect(input).toHaveAttribute('aria-activedescendant', active.id);
    expect(active).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Enter}');
    expect(screen.getByText('Detail page for eq-flask-500')).toBeInTheDocument();
  });

  it('closes on Escape and when Tab leaves the field', async () => {
    const user = userEvent.setup();
    renderSearch();
    const input = screen.getByRole('combobox', { name: 'Search' });
    await user.type(input, 'scope');
    await screen.findByRole('listbox');
    await user.keyboard('{Escape}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    await user.tab();
    expect(screen.getByRole('button', { name: 'Next control' })).toHaveFocus();
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens an item on mouse click', async () => {
    const user = userEvent.setup();
    renderSearch();
    await user.type(screen.getByRole('combobox', { name: 'Search' }), 'osc');
    await user.click(await screen.findByRole('option', { name: /Digital Oscilloscope/ }));
    expect(screen.getByText('Detail page for eq-scope')).toBeInTheDocument();
  });

  it('says "No equipment matches" when nothing matches', async () => {
    const user = userEvent.setup();
    renderSearch();
    await user.type(screen.getByRole('combobox', { name: 'Search' }), 'time machine');
    await waitFor(() => expect(screen.getAllByText('No equipment matches')).toHaveLength(2));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
