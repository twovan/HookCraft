import { encodeStemAudioBuffer, type StemAudioFileType, type StemAudioEncodeBuffer } from './stemAudioEncoding';

interface StemAudioEncodingWorkerRequest {
  audioBuffer: StemAudioEncodeBuffer;
  fileType: StemAudioFileType;
}

self.onmessage = async (event: MessageEvent<StemAudioEncodingWorkerRequest>) => {
  try {
    const blob = await encodeStemAudioBuffer(event.data.audioBuffer, event.data.fileType);
    self.postMessage({ type: 'success', blob });
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Audio encoding failed',
    });
  }
};
