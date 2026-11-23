import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'jest-axe';
import Welcome from '../Welcome.jsx';
import NotFound from '../NotFound.jsx';

describe.each([
  ['Welcome', Welcome, 'Welcome · LabLink'],
  ['NotFound', NotFound, 'Page not found · LabLink'],
])('%s page', (_name, Page, expectedTitle) => {
  it('has one h1, a unique title and no axe violations', async () => {
    const { container } = render(
      <MemoryRouter>
        <Page />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(document.title).toBe(expectedTitle);
    expect(await axe(container)).toHaveNoViolations();
  });
});
