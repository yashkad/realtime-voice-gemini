import { create } from "zustand";

interface Message {
  role: "user" | "ai";
  content: string;
}

interface Chat {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  messages: Message[];
}

interface ChatStore {
  chats: Chat[];
  addChat: (chat: Chat) => void;
  addMessage: (chatId: string, message: Message) => void;
}

export const useStore = create<ChatStore>((set) => ({
  chats: [
    {
      id: "1",
      name: "AI Assistant",
      avatar: "/avatars/ai-assistant.png",
      lastMessage: "Hello! How can I help you today?",
      messages: [{ role: "ai", content: "Hello! How can I help you today?" }],
    },
  ],
  addChat: (chat) => set((state) => ({ chats: [...state.chats, chat] })),
  addMessage: (chatId, message) =>
    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              lastMessage: message.content,
              messages: [...chat.messages, message],
            }
          : chat
      ),
    })),
}));
