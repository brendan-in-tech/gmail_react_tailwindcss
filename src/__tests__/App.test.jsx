import { render, screen } from '@testing-library/react';
import App from '../App';

// Mock fetch to simulate not authenticated
beforeAll(() => {
  global.fetch = vi.fn((url) => {
    if (url.endsWith('/me')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ user: null })
      });
    }
    if (url.endsWith('/')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ status: 'Server is running' })
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
});

afterAll(() => {
  global.fetch.mockRestore && global.fetch.mockRestore();
  vi.restoreAllMocks && vi.restoreAllMocks();
});

test('renders login form when not authenticated', async () => {
  render(<App />);
  const heading = await screen.findByText(/sign in to gmail template/i);
  expect(heading).toBeInTheDocument();
}); 