export type StemAudioFileType = 'MP3' | 'WAV';

export interface StemAudioEncodeBuffer {
  sampleRate: number;
  length: number;
  numberOfChannels: number;
  channels: Float32Array[];
}

export function audioBufferToStemEncodeBuffer(audioBuffer: AudioBuffer): StemAudioEncodeBuffer {
  const channels = Array.from(
    { length: audioBuffer.numberOfChannels },
    (_, index) => audioBuffer.getChannelData(index).slice(),
  );

  return {
    sampleRate: audioBuffer.sampleRate,
    length: audioBuffer.length,
    numberOfChannels: audioBuffer.numberOfChannels,
    channels,
  };
}

export function floatTo16BitPcm(samples: Float32Array) {
  const pcm = new Int16Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index] || 0));
    pcm[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return pcm;
}

export function encodeStemWav(audioBuffer: StemAudioEncodeBuffer) {
  const channelCount = Math.max(1, Math.min(audioBuffer.numberOfChannels, audioBuffer.channels.length));
  const sampleRate = audioBuffer.sampleRate;
  const bytesPerSample = 2;
  const blockAlign = channelCount * bytesPerSample;
  const dataLength = audioBuffer.length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let sampleIndex = 0; sampleIndex < audioBuffer.length; sampleIndex += 1) {
    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      const channel = audioBuffer.channels[channelIndex];
      const sample = Math.max(-1, Math.min(1, channel?.[sampleIndex] || 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export async function encodeStemMp3(audioBuffer: StemAudioEncodeBuffer, kbps = 320) {
  const lamejs = await import('lamejs');
  const channelCount = Math.min(2, Math.max(1, audioBuffer.numberOfChannels || 1));
  const encoder = new lamejs.default.Mp3Encoder(channelCount, audioBuffer.sampleRate, kbps);
  const left = floatTo16BitPcm(audioBuffer.channels[0] || new Float32Array(audioBuffer.length));
  const right = channelCount > 1
    ? floatTo16BitPcm(audioBuffer.channels[1] || new Float32Array(audioBuffer.length))
    : undefined;
  const chunks: Int8Array[] = [];
  const blockSize = 1152;

  for (let offset = 0; offset < left.length; offset += blockSize) {
    const encoded = channelCount > 1 && right
      ? encoder.encodeBuffer(left.subarray(offset, offset + blockSize), right.subarray(offset, offset + blockSize))
      : encoder.encodeBuffer(left.subarray(offset, offset + blockSize));
    if (encoded.length > 0) chunks.push(encoded);
  }

  const tail = encoder.flush();
  if (tail.length > 0) chunks.push(tail);

  return new Blob(chunks.map((chunk) => chunk.slice().buffer as ArrayBuffer), { type: 'audio/mpeg' });
}

export async function encodeStemAudioBuffer(audioBuffer: StemAudioEncodeBuffer, fileType: StemAudioFileType) {
  return fileType === 'MP3' ? encodeStemMp3(audioBuffer) : encodeStemWav(audioBuffer);
}
