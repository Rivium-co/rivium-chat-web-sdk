import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VoiceMessageRecorder } from '../src/components/VoiceMessageRecorder';

class FakeMediaRecorder {
  state: 'inactive' | 'recording' = 'inactive';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(public stream: unknown) {}
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['x']) });
    this.onstop?.();
  }
}

describe('VoiceMessageRecorder', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })) },
    });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('reports the real duration of the recording', async () => {
    const onRecordingComplete = vi.fn();
    render(<VoiceMessageRecorder onRecordingComplete={onRecordingComplete} />);
    const button = screen.getAllByRole('button').at(-1)!;

    await act(async () => {
      fireEvent.click(button);
    });
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button').at(-1)!);
    });

    expect(onRecordingComplete).toHaveBeenCalledTimes(1);
    const [blob, durationMs] = onRecordingComplete.mock.calls[0];
    expect(blob).toBeInstanceOf(Blob);
    expect(durationMs).toBeGreaterThanOrEqual(2900);
    expect(durationMs).toBeLessThanOrEqual(3100);
  });

  it('stops by itself at maxDuration and reports it', async () => {
    const onRecordingComplete = vi.fn();
    render(<VoiceMessageRecorder onRecordingComplete={onRecordingComplete} maxDuration={2000} />);

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button').at(-1)!);
    });
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(onRecordingComplete).toHaveBeenCalledTimes(1);
    expect(onRecordingComplete.mock.calls[0][1]).toBe(2000);
  });
});
