import { render, screen } from '@testing-library/react';
import { RouterProvider } from '../src/routing/router';
import { HomePage } from '../src/pages/HomePage';

describe('HomePage', () => {
  it('presents the primary readiness proposition and action', () => {
    render(
      <RouterProvider initialPath="/">
        <HomePage />
      </RouterProvider>,
    );
    expect(
      screen.getByRole('heading', { name: /know where your business stands/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /start your/i }).length).toBeGreaterThan(0);
    expect(screen.getByText(/does not promise funding or guarantee success/i)).toBeInTheDocument();
  });
});
