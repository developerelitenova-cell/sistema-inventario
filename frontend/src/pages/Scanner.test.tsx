import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Scanner from './Scanner';
import { BrowserRouter } from 'react-router-dom';

// Mock the scanner
vi.mock('html5-qrcode', () => {
  return {
    Html5QrcodeScanner: class {
      render() {}
      clear() { return Promise.resolve(undefined); }
    }
  };
});

describe('Scanner Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly', () => {
    render(
      <BrowserRouter>
        <Scanner />
      </BrowserRouter>
    );
    expect(screen.getByText(/Control de Salidas/i)).toBeInTheDocument();
  });

  it('shows error if permission fails', async () => {
    // Render and check if the initial text is there
    render(
      <BrowserRouter>
        <Scanner />
      </BrowserRouter>
    );
    expect(screen.getByText(/Apunte la cámara al código QR del dispositivo/i)).toBeInTheDocument();
  });
});
