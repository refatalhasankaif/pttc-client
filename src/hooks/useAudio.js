import { useState, useRef, useEffect, useCallback } from 'react';

export function useAudio(socket) {
    const [isRecording, setIsRecording] = useState(false);
    const audioContextRef = useRef(null);
    const nextStartTimeRef = useRef(0);
    const pendingAudioRef = useRef(new Uint8Array(0));
    const workletNodeRef = useRef(null);
    const streamRef = useRef(null);
    const sourceRef = useRef(null);

    // Playback settings
    const TARGET_SAMPLE_RATE = 16000;
    const JITTER_BUFFER_DELAY = 0.15; // 150ms buffering for smoothness

    // Initialize Audio Context
    useEffect(() => {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContextRef.current = new AudioContext({
            // Explicitly requesting low latency if supported
            latencyHint: 'interactive',
        });

        return () => {
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        };
    }, []);

    // Helper: Convert Int16 (transport) to Float32 (audio engine)
    const pcmToFloat32 = (input) => {
        const output = new Float32Array(input.length);
        for (let i = 0; i < input.length; i++) {
            const int = input[i];
            output[i] = (int >= 32768 ? int - 65536 : int) / 32768;
        }
        return output;
    };

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

            // Load the worklet module if not already loaded
            try {
                await context.audioWorklet.addModule('/audio-processor.js');
                console.log('AudioWorklet module loaded successfully');
            } catch (e) {
                console.error("Failed to load AudioWorklet module:", e);
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    // Request native sample rate to avoid internal resampling overhead if possible,
                    // though browser usually handles this.
                }
            });
            streamRef.current = stream;

            const source = context.createMediaStreamSource(stream);
            sourceRef.current = source;

            // Create AudioWorkletNode
            const workletNode = new AudioWorkletNode(context, 'audio-processor');
            workletNodeRef.current = workletNode;

            workletNode.port.onmessage = (event) => {
                if (!socket) return;
                // console.log('[useAudio] Received data from worklet, emitting to socket'); // Spammy
                // event.data.audio is an ArrayBuffer (Int16)
                socket.emit('voice', { audio: event.data.audio });
            };

            workletNode.onprocessorerror = (err) => {
                console.error('AudioWorklet processor error:', err);
            };

            source.connect(workletNode);
            workletNode.connect(context.destination); // Connect to destination to keep it alive, even if it outputs nothing

            setIsRecording(true);

        } catch (err) {
            console.error('Error starting recording:', err);
        }
    }, [socket]);

    const stopRecording = useCallback(() => {
        if (workletNodeRef.current) {
            workletNodeRef.current.disconnect();
            workletNodeRef.current.port.onmessage = null;
            workletNodeRef.current = null;
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
