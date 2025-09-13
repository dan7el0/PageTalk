class AudioProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const channelData = input[0];
    if (channelData) {
      // Post a copy of the data. The underlying ArrayBuffer may be reused.
      this.port.postMessage(channelData.slice());
    }
    return true;
  }
}
registerProcessor('audio-processor', AudioProcessor);
