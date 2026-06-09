import {
  audioBufferToStemEncodeBuffer,
  encodeStemAudioBuffer,
  type StemAudioEncodeBuffer,
  type StemAudioFileType,
} from './stemAudioEncoding';

interface StemAudioEncodingWorkerSuccess {
  type: 'success';
  blob: Blob;
}

interface StemAudioEncodingWorkerError {
  type: 'error';
  error: string;
}

type StemAudioEncodingWorkerResponse = StemAudioEncodingWorkerSuccess | StemAudioEncodingWorkerError;

export function collectStemAudioTransferList(audioBuffer: StemAudioEncodeBuffer): Transferable[] {
  return audioBuffer.channels.map((channel) => channel.buffer);
}

function createStemAudioEncodingWorker() {
  return new Worker(new URL('./stemAudioEncoding.worker.ts', import.meta.url), { type: 'module' });
}

export async function encodeRenderedAudioInWorker(audioBuffer: AudioBuffer, fileType: StemAudioFileType) {
  if (typeof Worker === 'undefined') {
    return encodeStemAudioBuffer(audioBufferToStemEncodeBuffer(audioBuffer), fileType);
  }

  const serializableAudioBuffer = audioBufferToStemEncodeBuffer(audioBuffer);
  const worker = createStemAudioEncodingWorker();

  return new Promise<Blob>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<StemAudioEncodingWorkerResponse>) => {
      worker.terminate();
      if (event.data.type === 'success') {
        resolve(event.data.blob);
        return;
      }
      reject(new Error(event.data.error || 'Audio encoding worker failed'));
    };

    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || 'Audio encoding worker failed'));
    };

    worker.postMessage(
      { audioBuffer: serializableAudioBuffer, fileType },
      collectStemAudioTransferList(serializableAudioBuffer),
    );
  }).catch(() => encodeStemAudioBuffer(audioBufferToStemEncodeBuffer(audioBuffer), fileType));
}
