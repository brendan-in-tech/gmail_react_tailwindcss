import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';

const mockUser = {
  email: 'test@example.com',
  name: 'Test User',
  photo: 'https://example.com/photo.jpg'
};

const mockEmails = [
  {
    id: '1',
    sender: 'Alice',
    sender_photo: '',
    from: 'Alice <alice@example.com>',
    to: 'test@example.com',
    subject: 'Hello',
    snippet: 'Hi there!',
    date: new Date().toISOString(),
    body: 'Hi there!',
    body_type: 'plain',
    attachments: []
  },
  {
    id: '2',
    sender: 'Bob',
    sender_photo: '',
    from: 'Bob <bob@example.com>',
    to: 'test@example.com',
    subject: 'Update',
    snippet: 'Here is an update.',
    date: new Date().toISOString(),
    body: 'Here is an update.',
    body_type: 'plain',
    attachments: []
  }
];

beforeAll(() => {
  global.fetch = vi.fn((url) => {
    if (url.endsWith('/me')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ user: mockUser })
      });
    }
    if (url.endsWith('/fetch-emails')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockEmails)
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

test('renders inbox and emails when authenticated', async () => {
  render(<App />);
  // Wait for inbox to appear
  const inboxHeading = await screen.findByText(/inbox/i);
  expect(inboxHeading).toBeInTheDocument();
  // Emails should be rendered
  expect(await screen.findByText('Alice')).toBeInTheDocument();
  expect(await screen.findByText('Bob')).toBeInTheDocument();
  expect(screen.getByText('Hello')).toBeInTheDocument();
  expect(screen.getByText('Update')).toBeInTheDocument();
});

test('opens and closes email modal', async () => {
  render(<App />);
  // Wait for emails
  const emailItem = await screen.findByText('Alice');
  fireEvent.click(emailItem);
  // Modal should open
  expect(await screen.findByText(/from:/i)).toBeInTheDocument();
  // Close modal
  const closeBtn = screen.getByRole('button', { name: /close/i }) || screen.getByLabelText(/close/i) || screen.getByText(/x/i);
  fireEvent.click(closeBtn);
  await waitFor(() => {
    expect(screen.queryByText(/from:/i)).not.toBeInTheDocument();
  });
});

test('logout returns to login form and clears emails', async () => {
  render(<App />);
  // Wait for inbox
  await screen.findByText(/inbox/i);
  // Click logout
  const logoutBtn = screen.getByRole('button', { name: /logout/i });
  fireEvent.click(logoutBtn);
  // Login form should appear
  expect(await screen.findByText(/sign in to gmail template/i)).toBeInTheDocument();
  // Emails should be cleared
  expect(screen.queryByText('Alice')).not.toBeInTheDocument();
});

test('shows error if fetch-emails fails', async () => {
  // Mock fetch to fail for /fetch-emails
  global.fetch = vi.fn((url) => {
    if (url.endsWith('/me')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ user: mockUser })
      });
    }
    if (url.endsWith('/fetch-emails')) {
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: 'Server error' })
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
  render(<App />);
  // Wait for error message
  expect(await screen.findByText(/server error/i)).toBeInTheDocument();
}); 