import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RiviumChatThemeProvider, useRiviumChatTheme, defaultDarkColors, defaultLightColors } from '../src/theme/RiviumChatTheme';

function Probe() {
  const { isDark, colors } = useRiviumChatTheme();
  return <span data-testid="probe">{`${isDark}|${colors.background}`}</span>;
}

function stubSystem(dark: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    matches: dark,
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
  };
  vi.stubGlobal('matchMedia', vi.fn(() => query));
  return {
    set(next: boolean) {
      query.matches = next;
      listeners.forEach((cb) => cb());
    },
  };
}

describe('RiviumChatThemeProvider', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('stays light by default, whatever the system says', () => {
    stubSystem(true);
    render(<RiviumChatThemeProvider><Probe /></RiviumChatThemeProvider>);
    expect(screen.getByTestId('probe').textContent).toBe(`false|${defaultLightColors.background}`);
  });

  it("dark='system' follows the system setting, live", () => {
    const system = stubSystem(true);
    render(<RiviumChatThemeProvider dark="system"><Probe /></RiviumChatThemeProvider>);
    expect(screen.getByTestId('probe').textContent).toBe(`true|${defaultDarkColors.background}`);

    act(() => system.set(false));
    expect(screen.getByTestId('probe').textContent).toBe(`false|${defaultLightColors.background}`);
  });
});
