class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferSize = 2048; // ~128ms at 16kHz. Small enough for realtime, large enough for network efficiency.
        this._buffer = new Float32Array(this.bufferSize);
        this._bytesWritten = 0;

        // Downsampling state
        this.targetSampleRate = 16000;
        console.log('[AudioWorklet] Initialized');
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (input.length > 0) {
            // console.log('[AudioWorklet] Processing data'); // Uncomment for spammy debug
            const inputChannel = input[0]; // Mono is fine for voice

            // We need to accumulate samples.
            // Since input is usually 128 frames (at 44.1/48k), we need to downsample and fill our buffer.

            // Simple decimation/downsampling
            // Note: In a real production app we'd use a better resampling filter, but for voice PTT simple ratio is okay.
            // We'll trust the main thread to tell us the sample rate if needed, but we can't get it easily in constructor.
            // However, current frame size is 128.

            // We will actually just collect the raw samples and send them to the main thread? 
            // No, that defeats the purpose of offloading. We should process here.

            // Issue: We don't know the exact Input Sample Rate inside process() easily without hacking, 
            // but we can assume standard 44.1 or 48.
            // Actually, let's keep it simple: Just pass raw audio to main thread?
            // No, clogging the message port with 48kHz floats is bad.

            // Let's implement a simple buffer and flush approach.
            // We will downsample naively by skipping.

            // Better approach for consistency:
            // Just fill a buffer and send it. Let's send 128 frames at a time? Too much message overhead.
            // Let's aggregate ~2048 raw frames and send them. 
            // Actually, the user wants "REALTIME".

            // Let's stick to the previous logic but inside the worklet:
            // We will just buffer raw float32 data until we have enough, then send.
            // But we really want to downsample to save bandwidth.

            // Let's try to get sampleRate from global scope (it exists in AudioWorkletGlobalScope)
            const inputSampleRate = sampleRate;
            const ratio = inputSampleRate / this.targetSampleRate;

            let i = 0;
            while (i < inputChannel.length) {
                // Naive downsampling: take every Nth sample
                // This is aliasing-prone, but fast.
                // For a better one, we'd average.

                // Let's just average the block corresponding to the ratio.
                // This is tricky inside the loop.

                // Let's just push to a raw buffer and process when full?
                // No, verify simpler:
                // Just append to a temporary buffer.
            }

            // ACTUALLY, for robustness and speed:
            // Let's just send the raw 128 buffer to the port, and let the main thread do the heavy logical lifting?
            // NO, the main thread is lagging. That's the problem.

            // Okay, efficient downsampling here.
            for (let i = 0; i < inputChannel.length; i += ratio) {
                const idx = Math.floor(i);
                const val = inputChannel[idx];

                if (this._bytesWritten < this.bufferSize) {
                    this._buffer[this._bytesWritten] = val;
                    this._bytesWritten++;
                }

                if (this._bytesWritten >= this.bufferSize) {
                    this.flush();
                }
            }
        }
        return true; // Keep alive
    }

    flush() {
        // Convert to Int16
        const int16Buffer = new Int16Array(this.bufferSize);
        let sumSq = 0;
        for (let i = 0; i < this.bufferSize; i++) {
            const s = Math.max(-1, Math.min(1, this._buffer[i]));
            sumSq += s * s;
            int16Buffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Post to main thread
        this.port.postMessage({ audio: int16Buffer.buffer }, [int16Buffer.buffer]);

        this._bytesWritten = 0;
    }
}

registerProcessor('audio-processor', AudioProcessor);
