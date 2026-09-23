import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import RegisterByCode from './RegisterByCode';
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

describe('RegisterByCode Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly', () => {
    render(
      <BrowserRouter>
        <RegisterByCode />
      </BrowserRouter>
    );
    expect(screen.getByText(/Registrar por Código/i)).toBeInTheDocument();
  });
});
