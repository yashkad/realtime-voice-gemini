// app/components/LiveAudioChat.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { GeminiWebSocket } from "../services/geminiWebSocket"; // Adjust path as needed
import { Base64 } from "js-base64";
import {
  Mic,
  MicOff,
  Phone,
  Loader2,
  AudioWaveform as Waveform,
  Check,
  ChevronDown,
} from "lucide-react";
import { agents, Agent } from "../config/agents";

interface LiveAudioChatProps {
  onTranscription: (text: string) => void;
}

export default function LiveAudioChat({ onTranscription }: LiveAudioChatProps) {
  const [isRecording, setIsRecording] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const geminiWsRef = useRef<GeminiWebSocket | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [outputAudioLevel, setOutputAudioLevel] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<
    "disconnected" | "connecting" | "connected"
  >("disconnected");
  const [sessionActive, setSessionActive] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Cleanup WebSocket
  const cleanupWebSocket = useCallback(() => {
    if (geminiWsRef.current) {
      geminiWsRef.current.disconnect();
      geminiWsRef.current = null;
    }
    setConnectionStatus("disconnected");
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
    setIsRecording(false);
  }, []);

  useEffect(() => {
    // Initialize with the first agent by default
    setSelectedAgent(agents[0]);
  }, []);

  const disconnectSession = () => {
    setSessionActive(false);
    cleanupWebSocket();
    cleanupAudio();
    onTranscription("Session disconnected.");
  };

  const connectSession = () => {
    if (!selectedAgent) return;

    setSessionActive(true);
    setupWebSocket(selectedAgent.systemInstructions);
    toggleRecording();
  };

  const toggleRecording = async () => {
    // if (!sessionActive) return;

    if (isRecording) {
      // Stop recording
      setIsRecording(false);

      if (audioWorkletNodeRef.current) {
        audioWorkletNodeRef.current.disconnect();
        audioWorkletNodeRef.current = null;
      }
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

        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext({ sampleRate: 16000 });
        } else if (audioContextRef.current.state === "suspended") {
          await audioContextRef.current.resume();
        }

        setIsRecording(true);
        setupAudioProcessing(audioStream);
      } catch (error) {
        console.error("Error starting recording:", error);
      }
    }
  };

  const setupWebSocket = (systemInstructions: string) => {
    setConnectionStatus("connecting");
    geminiWsRef.current = new GeminiWebSocket(
      systemInstructions,
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
      audioWorkletNodeRef.current.connect(ctx.destination);
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

  // Calculate visual bars for audio visualization
  const getBars = (level: number) => {
    const maxBars = 30;
    const activeBars = Math.ceil((level / 100) * maxBars);
    return Array(maxBars)
      .fill(0)
      .map((_, i) => i < activeBars);
  };

  const visualizerBars = isModelSpeaking
    ? getBars(outputAudioLevel)
    : getBars(audioLevel);

  const getStatusColor = () => {
    if (!sessionActive) return "bg-gray-500";
    if (connectionStatus === "connected") return "bg-emerald-500";
    if (connectionStatus === "connecting") return "bg-amber-500";
    return "bg-red-500";
  };

  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (!target.closest(".agent-dropdown") && dropdownOpen) {
      setDropdownOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownOpen]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900">
      {/* Background ambient patterns */}
      <div className="absolute inset-0 overflow-hidden z-0 opacity-20">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-500 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-500 rounded-full blur-3xl" />
        <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-indigo-600 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-lg p-4">
        {/* Assistant title */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white mb-2">
            {/* Voice Assistant */}
            {selectedAgent ? selectedAgent.name : "Voice Assistant"}
          </h1>
          <p className="text-blue-200 text-sm">
            {!sessionActive
              ? "Select an agent to begin"
              : connectionStatus === "connecting"
              ? "Establishing secure connection..."
              : connectionStatus === "connected"
              ? "Listening to your commands"
              : "Ready to connect"}
          </p>
        </div>

        {/* Agent Selection - Custom Dropdown */}
        <div className="w-full mb-8 relative agent-dropdown">
          <div className="mb-2 flex justify-between items-center">
            <label className="block text-slate-200 text-sm font-medium">
              Choose Agent
            </label>
            {selectedAgent && (
              <span className="text-xs text-blue-300">
                {!sessionActive ? "Ready" : "Session Active"}
              </span>
            )}
          </div>

          <div
            className={`relative w-full ${
              sessionActive ? "opacity-70 cursor-not-allowed" : "cursor-pointer"
            }`}
            onClick={() => !sessionActive && setDropdownOpen(!dropdownOpen)}
          >
            <div
              className={`flex items-center justify-between p-4 rounded-xl border ${
                selectedAgent
                  ? "bg-slate-800/60 backdrop-blur-xl border-slate-600/80 text-white"
                  : "bg-slate-800/40 border-slate-700/60 text-slate-400"
              }
              transition-all duration-200 ${
                !sessionActive && "hover:border-blue-500/70"
              }`}
            >
              <div className="flex items-center">
                {selectedAgent ? (
                  <>
                    <div className="w-10 h-10 rounded-full bg-indigo-600/70 flex items-center justify-center mr-3">
                      <span className="text-lg font-semibold text-white">
                        {selectedAgent.name.charAt(0)}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium">{selectedAgent.name}</span>
                      <span className="text-xs text-slate-300">
                        {selectedAgent.description}
                      </span>
                    </div>
                  </>
                ) : (
                  <span>Select an agent</span>
                )}
              </div>

              {!sessionActive && (
                <ChevronDown
                  className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
                    dropdownOpen ? "transform rotate-180" : ""
                  }`}
                />
              )}
            </div>

            {/* Dropdown menu */}
            {dropdownOpen && !sessionActive && (
              <div className="absolute z-20 w-full mt-2 py-1 bg-slate-800 border border-slate-700 rounded-xl shadow-lg backdrop-blur-xl">
                <div className="max-h-60 overflow-y-auto">
                  {agents.map((agent) => (
                    <div
                      key={agent.name}
                      className={`flex items-center px-4 py-3 hover:bg-slate-700/70 cursor-pointer ${
                        selectedAgent?.name === agent.name
                          ? "bg-indigo-900/50"
                          : ""
                      }`}
                      onClick={() => {
                        setSelectedAgent(agent);
                        setDropdownOpen(false);
                      }}
                    >
                      <div className="w-8 h-8 rounded-full bg-indigo-600/70 flex items-center justify-center mr-3">
                        <span className="text-sm font-semibold text-white">
                          {agent.name.charAt(0)}
                        </span>
                      </div>
                      <div className="flex flex-col flex-1">
                        <span className="font-medium text-white">
                          {agent.name}
                        </span>
                        <span className="text-xs text-slate-300">
                          {agent.description}
                        </span>
                      </div>
                      {selectedAgent?.name === agent.name && (
                        <Check className="w-5 h-5 text-blue-400" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main interaction area */}
        <div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-slate-700 flex flex-col items-center w-full">
          {/* Connection status indicator */}
          <div className="flex items-center justify-center mb-4">
            <div
              className={`h-3 w-3 rounded-full mr-2 ${getStatusColor()} ${
                (connectionStatus === "connected" ||
                  connectionStatus === "connecting") &&
                sessionActive
                  ? "animate-pulse"
                  : ""
              }`}
            />
            <span className="text-sm font-medium text-slate-200">
              {!sessionActive
                ? "Inactive"
                : connectionStatus === "connected"
                ? "Connected"
                : connectionStatus === "connecting"
                ? "Connecting..."
                : "Disconnected"}
            </span>
          </div>

          {/* Audio visualization */}
          <div className="w-full h-28 mb-6 flex items-center justify-center">
            {sessionActive && (
              <div className="flex items-end space-x-1 h-full">
                {visualizerBars.map((isActive, i) => (
                  <div
                    key={i}
                    className={`w-1.5 rounded-full transition-all duration-75 ${
                      isModelSpeaking
                        ? isActive
                          ? "bg-gradient-to-t from-cyan-400 to-blue-400"
                          : "bg-slate-700/50"
                        : isActive
                        ? "bg-gradient-to-t from-indigo-400 to-purple-400"
                        : "bg-slate-700/50"
                    }`}
                    style={{
                      height: isActive
                        ? `${Math.min(
                            15 + (i / visualizerBars.length) * 85,
                            100
                          )}%`
                        : "15%",
                    }}
                  />
                ))}
              </div>
            )}
            {!sessionActive && (
              <div className="flex flex-col items-center justify-center text-center space-y-2">
                <Waveform className="w-10 h-10 text-slate-500" />
                <p className="text-slate-400">
                  {selectedAgent
                    ? "Start session to activate assistant"
                    : "Select an agent to continue"}
                </p>
              </div>
            )}
          </div>

          {!sessionActive ? (
            /* Connect button when session is inactive */
            <button
              onClick={connectSession}
              disabled={!selectedAgent}
              className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
                !selectedAgent
                  ? "bg-slate-600 cursor-not-allowed opacity-50"
                  : "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 hover:scale-105"
              }`}
            >
              <Phone className="w-6 h-6 text-white" />
            </button>
          ) : (
            /* Microphone button when session is active */
            <button
              onClick={toggleRecording}
              disabled={connectionStatus !== "connected"}
              className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
                isRecording
                  ? "bg-red-500 hover:bg-red-600 animate-pulse"
                  : "bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 hover:scale-105"
              } ${
                connectionStatus !== "connected"
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}
            >
              {connectionStatus === "connecting" ? (
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              ) : isRecording ? (
                <MicOff className="w-8 h-8 text-white" />
              ) : (
                <Mic className="w-8 h-8 text-white" />
              )}
            </button>
          )}

          {/* Status label */}
          <p className="mt-6 text-slate-300 font-medium">
            {!sessionActive
              ? selectedAgent
                ? "Start Session"
                : "Select an Agent"
              : connectionStatus === "connecting"
              ? "Initializing..."
              : isRecording
              ? "Listening..."
              : "Tap to speak"}
          </p>

          {/* Disconnect button - only show when session is active */}
          {sessionActive && (
            <button
              onClick={disconnectSession}
              className="mt-8 px-4 py-2 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium flex items-center transition-all duration-200 hover:scale-105"
            >
              <Phone className="w-4 h-4 mr-2 rotate-135" />
              Disconnect
            </button>
          )}
        </div>

        {/* Transcription status indicator */}
        {sessionActive && connectionStatus === "connected" && (
          <div className="mt-6 p-4 bg-slate-800/40 backdrop-blur-xl rounded-xl shadow-lg border border-slate-700 w-full">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">
                Status
              </p>
              <div className="flex items-center">
                <div
                  className={`h-2 w-2 rounded-full mr-2 ${
                    isModelSpeaking || isRecording
                      ? "bg-blue-400 animate-pulse"
                      : "bg-slate-500"
                  }`}
                ></div>
                <p className="text-xs text-slate-400">
                  {isModelSpeaking
                    ? "Speaking"
                    : isRecording
                    ? "Listening"
                    : "Idle"}
                </p>
              </div>
            </div>
            <p className="text-slate-300 text-sm">
              {isModelSpeaking
                ? "Assistant speaking..."
                : isRecording
                ? "Listening to you..."
                : "Waiting for input"}
            </p>
          </div>
        )}

        {/* Agent info card - Only show when session is active */}
        {sessionActive && selectedAgent && (
          <div className="mt-4 p-4 bg-slate-800/40 backdrop-blur-xl rounded-xl shadow-lg border border-slate-700 w-full">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-indigo-600/70 flex items-center justify-center mr-3">
                <span className="text-lg font-semibold text-white">
                  {selectedAgent.name.charAt(0)}
                </span>
              </div>
              <div>
                <h3 className="text-white font-medium">{selectedAgent.name}</h3>
                <p className="text-xs text-slate-300">
                  {selectedAgent.description}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
