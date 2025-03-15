// store/useVoiceCallStore.ts
import { create } from "zustand";

interface VoiceCallState {
  isRecording: boolean;
  isPlaying: boolean;
  audioLevel: number;
  transcription: string;
  setIsRecording: (isRecording: boolean) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setAudioLevel: (level: number) => void;
  setTranscription: (text: string) => void;
}

export const useVoiceCallStore = create<VoiceCallState>((set) => ({
  isRecording: false,
  isPlaying: false,
  audioLevel: 0,
  transcription: "",
  setIsRecording: (isRecording) => set({ isRecording }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setAudioLevel: (audioLevel) => set({ audioLevel }),
  setTranscription: (transcription) => set({ transcription }),
}));
