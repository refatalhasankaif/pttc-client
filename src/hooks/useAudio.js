import { useState, useRef, useEffect, useCallback } from 'react';

export function useAudio(socket) {
    const [isRecording, setIsRecording] = useState(false);
    const audioContextRef = useRef(null);
    const nextStartTimeRef = useRef(0);
    const processorRef = useRef(null);
    const streamRef = useRef(null);
    const sourceRef = useRef(null);

    // Config
    const TARGET_SAMPLE_RATE = 16000;
    const BUFFER_SIZE = 4096;

    // Initialize Audio Context
    useEffect(() => {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContextRef.current = new AudioContext();

        return () => {
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        };
    }, []);

    // Helper: Convert Float32 (audio engine) to Int16 (transport)
    const floatTo16BitPCM = (input) => {
        const output = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]));
            output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return output;
    };

    // Helper: Convert Int16 (transport) to Float32 (audio engine)
    const pcmToFloat32 = (input) => {
        const output = new Float32Array(input.length);
        for (let i = 0; i < input.length; i++) {
            const int = input[i];
            // If the high bit is on, it's negative in 16-bit 2's complement
            output[i] = (int >= 32768 ? int - 65536 : int) / 32768;
        }
        return output;
    };

    // Helper: Downsample to target rate
    const downsampleBuffer = (buffer, inputRate, outputRate) => {
        if (outputRate === inputRate) return buffer;
        const sampleRateRatio = inputRate / outputRate;
        const newLength = Math.round(buffer.length / sampleRateRatio);
        const result = new Float32Array(newLength);
        let offsetResult = 0;
        let offsetBuffer = 0;
        while (offsetResult < result.length) {
            const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
            // Simple accumulation for downsampling (prevents aliasing somewhat better than skipping)
            let accum = 0, count = 0;
            for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
                accum += buffer[i];
                count++;
            }
            result[offsetResult] = count > 0 ? accum / count : 0;
            offsetResult++;
            offsetBuffer = nextOffsetBuffer;
        }
        return result;
    }


    // Handle incoming voice data
    useEffect(() => {
        if (!socket) return;

        const handleVoice = async (data) => {
            try {
                if (!audioContextRef.current) return;
                if (audioContextRef.current.state === 'suspended') {
                    await audioContextRef.current.resume();
                }

                // data.audio is expected to be an ArrayBuffer containing Int16 PCM
                const int16Data = new Int16Array(data.audio);
                const float32Data = pcmToFloat32(int16Data);

                const buffer = audioContextRef.current.createBuffer(1, float32Data.length, TARGET_SAMPLE_RATE);
                buffer.getChannelData(0).set(float32Data);

                const source = audioContextRef.current.createBufferSource();
                source.buffer = buffer;
                source.connect(audioContextRef.current.destination);

                const currentTime = audioContextRef.current.currentTime;
                if (nextStartTimeRef.current < currentTime) {
                    nextStartTimeRef.current = currentTime;
                }

                // Add a tiny safety offset if we fell behind significantly
                // to avoid glitches at the cost of slight latency
                if (nextStartTimeRef.current < currentTime + 0.05) {
                    nextStartTimeRef.current = currentTime + 0.05;
                }

                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += buffer.duration;

            } catch (err) {
                console.error('Error playing audio chunk:', err);
            }
        };

        socket.on('voice', handleVoice);
        return () => socket.off('voice', handleVoice);
    }, [socket]);

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const context = audioContextRef.current;
            if (context.state === 'suspended') {
                await context.resume();
            }
            const source = context.createMediaStreamSource(stream);
            sourceRef.current = source;

            // Use ScriptProcessorNode (deprecated but widely supported and simple for this)
            // or AudioWorklet (better but more complex setup with external files).
            // We use ScriptProcessor for immediate single-file solution.
            const processor = context.createScriptProcessor(BUFFER_SIZE, 1, 1);
            processorRef.current = processor;

            source.connect(processor);
            processor.connect(context.destination); // Needed for the processor to run in many browsers

            processor.onaudioprocess = (e) => {
                if (!socket) return;
                const inputData = e.inputBuffer.getChannelData(0);

                // Downsample if needed (e.g. 48k -> 16k)
                const downsampled = downsampleBuffer(inputData, context.sampleRate, TARGET_SAMPLE_RATE);

                // Convert to Int16
                const pcm16 = floatTo16BitPCM(downsampled);

                // emit
                socket.emit('voice', { audio: pcm16.buffer });
            };

            setIsRecording(true);

        } catch (err) {
            console.error('Error starting recording:', err);
        }
    }, [socket]);

    const stopRecording = useCallback(() => {
        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current.onaudioprocess = null;
            processorRef.current = null;
        }
        if (sourceRef.current) {
            sourceRef.current.disconnect();
            sourceRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        setIsRecording(false);
    }, []);

    return { isRecording, startRecording, stopRecording };
}
