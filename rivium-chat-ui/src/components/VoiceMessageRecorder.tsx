import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRiviumChatTheme } from '../theme/RiviumChatTheme';

export interface VoiceMessageRecorderProps {
  /** Called when recording is completed with the audio blob and duration. */
  onRecordingComplete: (blob: Blob, durationMs: number) => void;
  /** Called when recording is cancelled. */
  onCancel?: () => void;
  /** Maximum recording duration in milliseconds. */
  maxDuration?: number;
  /** Custom mic icon. */
  micIcon?: React.ReactNode;
  /** Custom stop icon. */
  stopIcon?: React.ReactNode;
  /** Custom class name. */
  className?: string;
}

/**
 * A voice message recorder with click-to-record functionality.
 * Uses the Web Audio API for recording.
 */
export function VoiceMessageRecorder({
  onRecordingComplete,
  onCancel,
  maxDuration = 60000,
  micIcon,
  stopIcon,
  className = '',
}: VoiceMessageRecorderProps) {
  const { colors } = useRiviumChatTheme();
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());
        onRecordingComplete(blob, duration);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);

      intervalRef.current = window.setInterval(() => {
        setDuration((prev) => {
          const next = prev + 100;
          if (next >= maxDuration) {
            stopRecording();
          }
          return next;
        });
      }, 100);
    } catch (err) {
      setError('Microphone access denied');
      console.error('Error starting recording:', err);
    }
  }, [maxDuration, onRecordingComplete]);

  const stopRecording = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    setIsRecording(false);
  }, []);

  const cancelRecording = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      chunksRef.current = [];
    }

    setIsRecording(false);
    setDuration(0);
    onCancel?.();
  }, [onCancel]);

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const buttonStyle: React.CSSProperties = {
    width: 48,
    height: 48,
    borderRadius: '50%',
    border: 'none',
    backgroundColor: isRecording ? colors.failedMessage : colors.linkText,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.15)',
    transition: 'transform 0.2s',
    animation: isRecording ? 'pulse 1s infinite' : 'none',
  };

  const defaultMicIcon = <span style={{ fontSize: 24, color: '#fff' }}>🎤</span>;
  const defaultStopIcon = <span style={{ fontSize: 24, color: '#fff' }}>⏹</span>;

  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center' }}>
      <style>
        {`
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
          }
        `}
      </style>

      {isRecording && (
        <div style={{ display: 'flex', alignItems: 'center', marginRight: 12, flex: 1 }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: '#FF3B30',
            marginRight: 8,
            animation: 'pulse 1s infinite',
          }} />
          <span style={{ fontSize: 14, fontWeight: 600, minWidth: 40 }}>
            {formatDuration(duration)}
          </span>

          <button
            type="button"
            onClick={cancelRecording}
            style={{
              marginLeft: 16,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              color: colors.timestampText,
            }}
          >
            Cancel
          </button>
        </div>
      )}

      <button
        type="button"
        style={buttonStyle}
        onClick={isRecording ? stopRecording : startRecording}
      >
        {isRecording ? (stopIcon || defaultStopIcon) : (micIcon || defaultMicIcon)}
      </button>

      {error && (
        <span style={{ marginLeft: 8, fontSize: 12, color: colors.failedMessage }}>
          {error}
        </span>
      )}
    </div>
  );
}

/**
 * Voice message playback component.
 */
export interface VoiceMessagePlayerProps {
  /** URL of the audio file. */
  src: string;
  /** Duration of the audio in milliseconds. */
  durationMs: number;
  /** Whether this is the current user's message. */
  isMe?: boolean;
  /** Custom class name. */
  className?: string;
}

export function VoiceMessagePlayer({
  src,
  durationMs,
  isMe = false,
  className = '',
}: VoiceMessagePlayerProps) {
  const { colors } = useRiviumChatTheme();
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;

    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime * 1000);
      setProgress(audio.currentTime / audio.duration);
    });

    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    });

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, [src]);

  const togglePlayback = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    minWidth: 200,
    gap: 8,
  };

  const playButtonStyle: React.CSSProperties = {
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: 'none',
    backgroundColor: isMe ? 'rgba(255, 255, 255, 0.2)' : `${colors.linkText}20`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  };

  const waveformStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    height: 32,
    gap: 2,
  };

  // Generate random waveform bars (in real implementation, analyze audio)
  const bars = Array.from({ length: 20 }, () => 8 + Math.random() * 16);

  return (
    <div className={className} style={containerStyle}>
      <button type="button" style={playButtonStyle} onClick={togglePlayback}>
        <span style={{
          fontSize: 16,
          color: isMe ? '#fff' : colors.linkText,
        }}>
          {isPlaying ? '⏸' : '▶'}
        </span>
      </button>

      <div style={waveformStyle}>
        {bars.map((height, i) => (
          <div
            key={i}
            style={{
              width: 3,
              height,
              borderRadius: 2,
              backgroundColor: i / bars.length < progress
                ? colors.linkText
                : isMe
                ? 'rgba(255, 255, 255, 0.3)'
                : 'rgba(0, 0, 0, 0.1)',
              transition: 'background-color 0.1s',
            }}
          />
        ))}
      </div>

      <span style={{
        fontSize: 11,
        minWidth: 32,
        textAlign: 'right' as const,
        color: isMe ? 'rgba(255, 255, 255, 0.7)' : colors.timestampText,
      }}>
        {formatDuration(isPlaying ? currentTime : durationMs)}
      </span>
    </div>
  );
}

export default VoiceMessageRecorder;
