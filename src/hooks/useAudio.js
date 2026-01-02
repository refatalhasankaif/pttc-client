import { useState, useRef, useEffect, useCallback } from 'react';

export function useAudio(socket) {
    const [isRecording, setIsRecording] = useState(false);
    const audioContextRef = useRef(null);
    const nextStartTimeRef = useRef(0);
    const pendingAudioRef = useRef(new Uint8Array(0));
    const processorRef = useRef(null); // Changed from workletNodeRef
    const streamRef = useRef(null);
    const sourceRef = useRef(null);

    // Playback settings
    const TARGET_SAMPLE_RATE = 16000;
    const JITTER_BUFFER_DELAY = 0.15; // 150ms buffering for smoothness

    // Initialize Audio Context
    useEffect(() => {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        // latencyHint interaction is fine, but ScriptProcessor adds its own latency
        audioContextRef.current = new AudioContext({
            latencyHint: 'interactive',
        });

        return () => {
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        };
    }, []);

    // --- Helper Functions for ScriptProcessor (Legacy Mode) ---

    // Downsample from Context Sample Rate (e.g. 44.1k/48k) to Target (16k)
    const downsampleBuffer = (buffer, sampleRate, outSampleRate) => {
        if (outSampleRate === sampleRate) {
            return buffer;
        }
        if (outSampleRate > sampleRate) {
            return buffer;
        }
        const sampleRateRatio = sampleRate / outSampleRate;
        const newLength = Math.round(buffer.length / sampleRateRatio);
        const result = new Float32Array(newLength);
        let offsetResult = 0;
        let offsetBuffer = 0;
        while (offsetResult < result.length) {
            const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
            let accum = 0, count = 0;
            for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
                accum += buffer[i];
                count++;
            }
            result[offsetResult] = accum / count;
            offsetResult++;
            offsetBuffer = nextOffsetBuffer;
        }
        return result;
    };

    const floatTo16BitPCM = (input) => {
        const output = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]));
            output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return output;
    };

    // Helper: Convert Int16 (transport) to Float32 (audio engine) - Used in Playback
    const pcmToFloat32 = (input) => {
        const output = new Float32Array(input.length);
        for (let i = 0; i < input.length; i++) {
            const int = input[i];
            output[i] = (int >= 32768 ? int - 65536 : int) / 32768;
        }
        return output;
    };

    // --- End Helpers ---

    // Handle incoming voice data
    useEffect(() => {
        if (!socket) return;

        const handleVoice = async (data) => {
            try {
                if (!audioContextRef.current) return;
                const context = audioContextRef.current;

                if (context.state === 'suspended') {
                    await context.resume();
                }

                // packet reassembly: handle fragmentation (odd bytes)
                let incoming = new Uint8Array(data.audio);
                let pending = pendingAudioRef.current;
                let combined;

                if (pending.length > 0) {
                    combined = new Uint8Array(pending.length + incoming.length);
                    combined.set(pending);
                    combined.set(incoming, pending.length);
                } else {
                    combined = incoming;
                }

                const remainder = combined.length % 2;
                let processBuffer = combined;

                if (remainder !== 0) {
                    // Save the last byte for next time
                    pendingAudioRef.current = combined.slice(combined.length - 1);
                    processBuffer = combined.slice(0, combined.length - 1);
                } else {
                    pendingAudioRef.current = new Uint8Array(0);
                }

                if (processBuffer.length === 0) return;

                // Safe to view as Int16
                const int16Data = new Int16Array(processBuffer.buffer, processBuffer.byteOffset, processBuffer.byteLength / 2);
                const float32Data = pcmToFloat32(int16Data);

                const buffer = context.createBuffer(1, float32Data.length, TARGET_SAMPLE_RATE);
                buffer.getChannelData(0).set(float32Data);

                const source = context.createBufferSource();
                source.buffer = buffer;
                source.connect(context.destination);

                const currentTime = context.currentTime;

                // Jitter Buffer Logic
                // If we are starting from silence or fell behind, reset start time to 'now + buffer'
                if (nextStartTimeRef.current < currentTime) {
                    nextStartTimeRef.current = currentTime + JITTER_BUFFER_DELAY;
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
            const context = audioContextRef.current;
            if (context.state === 'suspended') {
                await context.resume();
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                }
            });
            streamRef.current = stream;

            const source = context.createMediaStreamSource(stream);
            sourceRef.current = source;

            // ScriptProcessorNode (Legacy)
            // Buffer size 4096 = ~93ms latency at 44.1kHz, but safer for main thread
            const processor = context.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
                if (!socket) return;

                const inputData = e.inputBuffer.getChannelData(0);
                // Downsample to 16kHz
                const downsampled = downsampleBuffer(inputData, context.sampleRate, TARGET_SAMPLE_RATE);
                // Convert to Int16
                const pcm16 = floatTo16BitPCM(downsampled);

                socket.emit('voice', { audio: pcm16.buffer });
            };

            source.connect(processor);
            processor.connect(context.destination); // Needed for Chrome to fire events

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
