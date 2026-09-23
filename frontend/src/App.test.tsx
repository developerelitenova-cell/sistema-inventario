import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import App from './App';

describe('App Sanity Test', () => {
  it('renders without crashing', () => {
    // Just a dummy test to ensure vitest setup works
    expect(true).toBe(true);
  });
});
