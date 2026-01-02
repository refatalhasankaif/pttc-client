import { useState, useRef, useEffect, useCallback } from 'react';

export function useAudio(socket) {
    const [isRecording, setIsRecording] = useState(false);
    const audioContextRef = useRef(null);
    const nextStartTimeRef = useRef(0);
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

                // data.audio is Int16 PCM
                const int16Data = new Int16Array(data.audio);
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
                // Ensure we only add it once
                await context.audioWorklet.addModule('/audio-processor.js');
            } catch (e) {
                // Ignore error if already added or similar
                // console.log("Module might be already added", e);
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
