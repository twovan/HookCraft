import { describe, expect, it } from 'vitest';
import { collectStemAudioTransferList } from './stemAudioEncodingWorkerClient';
import type { StemAudioEncodeBuffer } from './stemAudioEncoding';

describe('stem audio encoding worker client', () => {
  it('transfers each channel buffer to the worker', () => {
    const first = new Float32Array([0, 0.25]);
    const second = new Float32Array([0.5, 1]);
    const audio: StemAudioEncodeBuffer = {
      sampleRate: 44100,
      length: 2,
      numberOfChannels: 2,
      channels: [first, second],
    };

    expect(collectStemAudioTransferList(audio)).toEqual([first.buffer, second.buffer]);
  });
});
