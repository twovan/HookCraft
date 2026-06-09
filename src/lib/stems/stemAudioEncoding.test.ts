import { describe, expect, it } from 'vitest';
import {
  encodeStemAudioBuffer,
  floatTo16BitPcm,
  type StemAudioEncodeBuffer,
} from './stemAudioEncoding';

describe('stem audio encoding', () => {
  it('clamps float samples into signed 16-bit PCM', () => {
    const pcm = floatTo16BitPcm(new Float32Array([-2, -1, -0.5, 0, 0.5, 1, 2]));

    expect(Array.from(pcm)).toEqual([-32768, -32768, -16384, 0, 16383, 32767, 32767]);
  });

  it('encodes an interleaved stereo WAV file from transferable channel data', async () => {
    const audio: StemAudioEncodeBuffer = {
      sampleRate: 44100,
      length: 2,
      numberOfChannels: 2,
      channels: [
        new Float32Array([0, 1]),
        new Float32Array([-1, 0.5]),
      ],
    };

    const blob = await encodeStemAudioBuffer(audio, 'WAV');
    const buffer = await blob.arrayBuffer();
    const view = new DataView(buffer);
    const text = (offset: number, length: number) => String.fromCharCode(
      ...new Uint8Array(buffer, offset, length),
    );

    expect(blob.type).toBe('audio/wav');
    expect(buffer.byteLength).toBe(52);
    expect(text(0, 4)).toBe('RIFF');
    expect(text(8, 4)).toBe('WAVE');
    expect(text(36, 4)).toBe('data');
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(44100);
    expect(view.getInt16(44, true)).toBe(0);
    expect(view.getInt16(46, true)).toBe(-32768);
    expect(view.getInt16(48, true)).toBe(32767);
    expect(view.getInt16(50, true)).toBe(16383);
  });
});
