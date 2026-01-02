import { useState, useRef, useEffect, useCallback } from 'react';

export function useAudio(socket) {
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef(null);
    const audioContextRef = useRef(null);
    const nextStartTimeRef = useRef(0);

    // Initialize Audio Context for playback
    useEffect(() => {
        // Modern browsers require user interaction to resume AudioContext usually,
        // but we can init it here.
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContextRef.current = new AudioContext();

        return () => {
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        };
    }, []);

    // Handle incoming voice data
    useEffect(() => {
        if (!socket) return;

        const handleVoice = async (data) => {
            try {
                if (!audioContextRef.current) return;

                // Resume context if suspended (browser auto-play policy)
                if (audioContextRef.current.state === 'suspended') {
                    await audioContextRef.current.resume();
                }

                // data.audio should be an ArrayBuffer or similar
                const arrayBuffer = data.audio;

                // Decode the audio data
                const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

                // Schedule playback
                const source = audioContextRef.current.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioContextRef.current.destination);

                // Ensure smooth playback without gaps or overlapping too much
                const currentTime = audioContextRef.current.currentTime;
                // If next start time is in the past, reset it to now
                if (nextStartTimeRef.current < currentTime) {
                    nextStartTimeRef.current = currentTime;
                }

                source.start(nextStartTimeRef.current);

                // Advance the start time for the next chunk
                nextStartTimeRef.current += audioBuffer.duration;

            } catch (err) {
                console.error('Error playing audio chunk:', err);
            }
        };

        socket.on('voice', handleVoice);

        return () => {
            socket.off('voice', handleVoice);
        };
    }, [socket]);

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Use efficient codec if possible, but standard webm/opus is usually default
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = async (event) => {
                if (event.data.size > 0 && socket) {
                    // Convert Blob to ArrayBuffer for sending over socket
                    const buffer = await event.data.arrayBuffer();
                    socket.emit('voice', { audio: buffer });
                }
            };

            // Slice audio into 100ms chunks for low latency
            mediaRecorder.start(100);
            setIsRecording(true);

        } catch (err) {
            console.error('Error starting recording:', err);
        }
    }, [socket]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            mediaRecorderRef.current = null;
        }
        setIsRecording(false);
    }, []);

    return { isRecording, startRecording, stopRecording };
}
