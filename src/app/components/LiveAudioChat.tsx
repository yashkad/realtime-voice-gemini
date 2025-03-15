// app/components/LiveAudioChat.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button"; // Assuming Shadcn UI Button
import { GeminiWebSocket } from "../services/geminiWebSocket"; // Adjust path as needed
import { Base64 } from "js-base64";
import { Mic, MicOff } from "lucide-react";

interface LiveAudioChatProps {
  onTranscription: (text: string) => void;
}

export default function LiveAudioChat({ onTranscription }: LiveAudioChatProps) {
  const [isRecording, setIsRecording] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const geminiWsRef = useRef<GeminiWebSocket | null>(null);
  const [audioLevel, setAudioLevel] = useState(0); // For a simple visualizer
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [outputAudioLevel, setOutputAudioLevel] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<
    "disconnected" | "connecting" | "connected"
  >("disconnected");

  // Cleanup WebSocket
  const cleanupWebSocket = useCallback(() => {
    if (geminiWsRef.current) {
      geminiWsRef.current.disconnect();
      geminiWsRef.current = null;
    }
  }, []);

  const cleanupAudio = useCallback(() => {
    if (audioWorkletNodeRef.current) {
      audioWorkletNodeRef.current.disconnect();
      audioWorkletNodeRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording
      setIsRecording(false);
      cleanupWebSocket();
      cleanupAudio();
    } else {
      // Start recording
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            autoGainControl: true,
            noiseSuppression: true,
          },
        });

        audioContextRef.current = new AudioContext({ sampleRate: 16000 });
        setIsRecording(true);
        setupWebSocket();
        setupAudioProcessing(audioStream);
      } catch (error) {
        console.error("Error starting recording:", error);
        cleanupAudio();
      }
    }
  };

  const setupWebSocket = () => {
    setConnectionStatus("connecting");
    geminiWsRef.current = new GeminiWebSocket(
      (text) => {
        console.log("Received from Gemini:", text);
      },
      () => {
        console.log("WebSocket setup complete");
        setConnectionStatus("connected");
      },
      (isPlaying) => {
        setIsModelSpeaking(isPlaying);
      },
      (level) => {
        setOutputAudioLevel(level);
      },
      onTranscription
    );
    geminiWsRef.current.connect();
  };

  const setupAudioProcessing = async (stream: MediaStream) => {
    try {
      const ctx = audioContextRef.current;
      if (!ctx) return;

      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      await ctx.audioWorklet.addModule("/worklets/audio-processor.js");
      audioWorkletNodeRef.current = new AudioWorkletNode(
        ctx,
        "audio-processor",
        {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          processorOptions: {
            sampleRate: 16000,
            bufferSize: 4096,
          },
          channelCount: 1,
        }
      );

      const source = ctx.createMediaStreamSource(stream);

      audioWorkletNodeRef.current.port.onmessage = (event) => {
        if (isModelSpeaking) return; // Don't send if the model is speaking
        const { pcmData, level } = event.data;
        setAudioLevel(level);

        const pcmArray = new Uint8Array(pcmData);
        const b64Data = Base64.fromUint8Array(pcmArray);
        if (geminiWsRef.current) {
          geminiWsRef.current.sendMediaChunk(b64Data, "audio/pcm");
        }
      };

      source.connect(audioWorkletNodeRef.current);
      audioWorkletNodeRef.current.connect(ctx.destination); //THIS LINE IS THE KEY
    } catch (error) {
      console.error("Error setting up audio processing:", error);
      cleanupAudio();
    }
  };

  useEffect(() => {
    return () => {
      cleanupWebSocket();
      cleanupAudio();
    };
  }, [cleanupWebSocket, cleanupAudio]);

  return (
    <div>
      <Button
        onClick={toggleRecording}
        disabled={connectionStatus === "connecting"}
      >
        {isRecording ? (
          <>
            <MicOff className="mr-2" /> Stop
          </>
        ) : (
          <>
            <Mic className="mr-2" /> Start
          </>
        )}
      </Button>
      {isRecording && (
        <div className="w-64 h-2 bg-gray-200 rounded-full mt-2">
          <div
            className="h-full bg-blue-500 rounded-full"
            style={{
              width: `${isModelSpeaking ? outputAudioLevel : audioLevel}%`,
            }}
          />
        </div>
      )}
      {connectionStatus === "connecting" && <p>Connecting...</p>}
      {connectionStatus === "connected" && <p>Connected to Gemini</p>}
      {connectionStatus === "disconnected" && <p>Disconnected</p>}
    </div>
  );
}
