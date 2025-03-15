// app/page.tsx
"use client";
import { useState, useCallback } from "react";
import LiveAudioChat from "./components/LiveAudioChat"; // Import the component
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const HumanMessage = ({ text }: { text: string }) => (
  <div className="flex gap-3 items-start">
    <Avatar className="h-8 w-8">
      <AvatarImage src="/avatars/human.png" alt="Human" />
      <AvatarFallback>H</AvatarFallback>
    </Avatar>
    <div className="flex-1 space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-zinc-900">You</p>
      </div>
      <div className="rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-800">
        {text}
      </div>
    </div>
  </div>
);

const GeminiMessage = ({ text }: { text: string }) => (
  <div className="flex gap-3 items-start">
    <Avatar className="h-8 w-8 bg-blue-600">
      <AvatarImage src="/avatars/gemini.png" alt="Gemini" />
      <AvatarFallback>AI</AvatarFallback>
    </Avatar>
    <div className="flex-1 space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-zinc-900">Gemini</p>
      </div>
      <div className="rounded-lg bg-white border border-zinc-200 px-3 py-2 text-sm text-zinc-800">
        {text}
      </div>
    </div>
  </div>
);

export default function Home() {
  const [messages, setMessages] = useState<
    { type: "human" | "gemini"; text: string }[]
  >([]);

  const handleTranscription = useCallback((transcription: string) => {
    setMessages((prev) => [...prev, { type: "gemini", text: transcription }]);
  }, []);

  return (
    <>
      <h1 className="text-4xl font-bold text-zinc-800 p-8 pb-0">
        Live Audio Chat
      </h1>
      <div className="p-8">
        <LiveAudioChat onTranscription={handleTranscription} />
        <div className="mt-4">
          <ScrollArea className="h-[540px] p-6">
            <div className="space-y-6">
              <GeminiMessage text="Hi! I'm Gemini. I can hear you. Let's chat!" />
              {messages.map((message, index) =>
                message.type === "human" ? (
                  <HumanMessage key={`msg-${index}`} text={message.text} />
                ) : (
                  <GeminiMessage key={`msg-${index}`} text={message.text} />
                )
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </>
  );
}
