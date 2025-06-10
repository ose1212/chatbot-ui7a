import { ChatbotUIContext } from "@/context/context";
import { updateChat } from "@/db/chats";
import { deleteMessagesIncludingAndAfter } from "@/db/messages";
import { handleCreateChat, handleCreateMessages } from "../chat-helpers";
import { useRouter } from "next/navigation";
import { useContext, useEffect, useRef } from "react";
import { ChatMessage, LLMID, ModelProvider } from "@/types";
import { LLM_LIST } from "@/lib/models/llm/llm-list";

export const useChatHandler = () => {
  const router = useRouter();

  const {
    userInput,
    setUserInput,
    setIsGenerating,
    setChatMessages,
    setFirstTokenReceived,
    selectedChat,
    selectedWorkspace,
    setSelectedChat,
    setChats,
    chatMessages,
    newMessageFiles,
    selectedAssistant,
    chatSettings,
    setIsPromptPickerOpen,
    setIsFilePickerOpen,
    models,
    profile,
    chatFileItems,
    setChatFileItems,
    setChatImages,
    selectedTools,
    newMessageImages,
    chatImages
  } = useContext(ChatbotUIContext);

  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    chatInputRef.current?.focus();
  }, []);

  const runAssistant = async (userMessage: string): Promise<string> => {
    const res = await fetch("/api/run-assistant", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userMessage }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to run assistant");
    }

    return data.message;
  };

  const handleNewChat = async () => {
    if (!selectedWorkspace) return;

    setUserInput("");
    setChatMessages([]);
    setSelectedChat(null);

    setIsGenerating(false);
    setFirstTokenReceived(false);

    setIsPromptPickerOpen(false);
    setIsFilePickerOpen(false);

    return router.push(`/${selectedWorkspace.id}/chat`);
  };

  const handleFocusChatInput = () => {
    chatInputRef.current?.focus();
  };

  const handleStopMessage = () => {
    // No-op for now
  };

  const handleSendMessage = async (
    messageContent: string,
    chatMessages: ChatMessage[],
    isRegeneration: boolean
  ) => {
    const startingInput = messageContent;

    try {
      setUserInput("");
      setIsGenerating(true);
      setIsPromptPickerOpen(false);
      setIsFilePickerOpen(false);

      let currentChat = selectedChat ? { ...selectedChat } : null;

      // 1️⃣ Special case: Leadership GPT Assistant → use Assistants API
      if (selectedAssistant && selectedAssistant.id === "asst-xxxxxxx") {
        const generatedText = await runAssistant(messageContent);

        setIsGenerating(false);
        setFirstTokenReceived(false);

        if (!currentChat) {
          currentChat = await handleCreateChat(
            chatSettings!,
            profile!,
            selectedWorkspace!,
            messageContent,
            selectedAssistant!,
            newMessageFiles,
            setSelectedChat,
            setChats,
            () => {}
          );
        } else {
          const updatedChat = await updateChat(currentChat.id, {
            updated_at: new Date().toISOString(),
          });

          setChats((prevChats) => {
            const updatedChats = prevChats.map((prevChat) =>
              prevChat.id === updatedChat.id ? updatedChat : prevChat
            );

            return updatedChats;
          });
        }

setChatMessages([
    ...chatMessages,
    {
        message: {
            role: "user",
            content: messageContent,
            sequence_number: chatMessages.length,
            assistant_id: null,
            chat_id: currentChat ? currentChat.id : "",
            created_at: new Date().toISOString(),
            id: crypto.randomUUID(),
            image_paths: [],
            model: "gpt-4",
            updated_at: null,
            user_id: profile ? profile.user_id : ""
        },
        fileItems: []
    },
    {
        message: {
            role: "assistant",
            content: generatedText,
            sequence_number: chatMessages.length + 1,
            assistant_id: selectedAssistant ? selectedAssistant.id : null,
            chat_id: currentChat ? currentChat.id : "",
            created_at: new Date().toISOString(),
            id: crypto.randomUUID(),
            image_paths: [],
            model: "gpt-4",
            updated_at: null,
            user_id: profile ? profile.user_id : ""
        },
        fileItems: []
    }
]);

        return; // Early return → skip normal flow
      }

      // 2️⃣ Normal flow (non-Leadership GPT Assistant)
      // You can leave your existing "handleHostedChat" or "handleLocalChat" logic here
      // For now → simple placeholder:
      console.log("Normal flow not yet implemented in this minimal example.");

      setIsGenerating(false);
      setFirstTokenReceived(false);
      setUserInput(startingInput);
    } catch (error) {
      setIsGenerating(false);
      setFirstTokenReceived(false);
      setUserInput(startingInput);
      console.error("Error in handleSendMessage:", error);
    }
  };

  const handleSendEdit = async (
    editedContent: string,
    sequenceNumber: number
  ) => {
    if (!selectedChat) return;

    await deleteMessagesIncludingAndAfter(
      selectedChat.user_id,
      selectedChat.id,
      sequenceNumber
    );

    const filteredMessages = chatMessages.filter(
      (chatMessage) => chatMessage.message.sequence_number < sequenceNumber
    );

    setChatMessages(filteredMessages);

    handleSendMessage(editedContent, filteredMessages, false);
  };

  return {
    chatInputRef,
    handleNewChat,
    handleSendMessage,
    handleFocusChatInput,
    handleStopMessage,
    handleSendEdit,
  };
};
