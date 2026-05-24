export function buildWaveformPeaksFromSamples(samples: Float32Array, bucketCount = 480) {
  const safeBucketCount = Math.max(1, Math.floor(bucketCount));
  if (samples.length === 0) return Array.from({ length: safeBucketCount }, () => 0);

  const samplesPerBucket = Math.max(1, Math.ceil(samples.length / safeBucketCount));
  return Array.from({ length: safeBucketCount }, (_, index) => {
    const start = index * samplesPerBucket;
    const end = Math.min(samples.length, start + samplesPerBucket);
    let peak = 0;
    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
      peak = Math.max(peak, Math.abs(samples[sampleIndex] || 0));
    }
    return Number(Math.min(1, peak).toFixed(4));
  });
}
