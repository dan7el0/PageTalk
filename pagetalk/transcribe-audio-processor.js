function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

function encodeWAV(chunks, sampleRate) {
  const totalLength = chunks.reduce((len, arr) => len + arr.length, 0);
  const mono = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    mono.set(chunk, offset);
    offset += chunk.length;
  }
  const buffer = new ArrayBuffer(44 + mono.length * 2);
  const view = new DataView(buffer);
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + mono.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); // 16-bit
  writeString(view, 36, 'data');
  view.setUint32(40, mono.length * 2, true);
  let idx = 44;
  for (let i = 0; i < mono.length; i++, idx += 2) {
    const s = Math.max(-1, Math.min(1, mono[i]));
    view.setInt16(idx, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return new Blob([view], { type: 'audio/wav' });
}

async function resample(audioBuffer, targetSampleRate, playbackRate = 1) {
  const duration = audioBuffer.duration / playbackRate;
  const offlineContext = new OfflineAudioContext(
    1, // Force mono
    Math.ceil(duration * targetSampleRate),
    targetSampleRate
  );
  const bufferSource = offlineContext.createBufferSource();
  bufferSource.buffer = audioBuffer;
  bufferSource.playbackRate.value = playbackRate;
  bufferSource.connect(offlineContext.destination);
  bufferSource.start(0);
  return await offlineContext.startRendering();
}

export async function processAudioForTranscription(sourceBlob, playbackRate) {
  try {
    const arrayBuffer = await sourceBlob.arrayBuffer();
    const tempAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    const decodedAudioBuffer = await tempAudioContext.decodeAudioData(arrayBuffer);
    await tempAudioContext.close();

    const TARGET_SAMPLE_RATE = 16000;
    const resampledBuffer = await resample(decodedAudioBuffer, TARGET_SAMPLE_RATE, playbackRate);
    
    const resampledPcm = resampledBuffer.getChannelData(0);
    const wavBlob = encodeWAV([resampledPcm], TARGET_SAMPLE_RATE);
    
    return wavBlob;
  } catch (e) {
    console.error("Error processing audio:", e);
    throw new Error('音频处理失败: ' + (e?.message || e));
  }
}