import { useState, useRef, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import ChatBubble from "@/components/ChatBubble";
import ChatInput from "@/components/ChatInput";
import TypingIndicator from "@/components/TypingIndicator";
import { streamChat, type Msg } from "@/lib/streamChat";
import { toast } from "sonner";

const SUGGESTIONS = [
  "Explain quantum computing simply",
  "Write a haiku about coding",
  "Tips for better sleep",
  "What's the speed of light?",
];

export default function Index() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  const send = async (input: string) => {
    const userMsg: Msg = { role: "user", content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsLoading(true);

    let assistantSoFar = "";

    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantSoFar } : m
          );
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      await streamChat({
        messages: newMessages,
        onDelta: (chunk) => {
          setIsLoading(false);
          upsert(chunk);
        },
        onDone: () => setIsLoading(false),
        onError: (err) => {
          setIsLoading(false);
          toast.error(err);
        },
      });
    } catch {
      setIsLoading(false);
      toast.error("Failed to connect. Please try again.");
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* Header */}
      <header className="glass sticky top-0 z-10 px-4 py-3 flex items-center justify-center border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <h1 className="text-base font-semibold text-foreground tracking-tight">
            Suhu AI
          </h1>
        </div>
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scrollbar-none px-4 py-4"
      >
        {isEmpty ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center justify-center h-full gap-6"
          >
            <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-semibold text-foreground mb-1">
                How can I help?
              </h2>
              <p className="text-sm text-muted-foreground">
                Fast answers, powered by AI
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 max-w-md">
              {SUGGESTIONS.map((s) => (
                <motion.button
                  key={s}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => send(s)}
                  className="px-4 py-2 rounded-full bg-card text-card-foreground text-sm shadow-soft border border-border/50 hover:shadow-elevated transition-shadow"
                >
                  {s}
                </motion.button>
              ))}
            </div>
          </motion.div>
        ) : (
          <div className="max-w-2xl mx-auto">
            {messages.map((msg, i) => (
              <ChatBubble
                key={i}
                message={msg}
                isLatest={i === messages.length - 1}
              />
            ))}
            <AnimatePresence>
              {isLoading && <TypingIndicator />}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput onSend={send} disabled={isLoading} />
    </div>
  );
}
