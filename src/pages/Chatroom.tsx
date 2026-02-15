import { useState, useRef, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Send, Users, Clock, Sparkles, LogOut, Smile } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import EmojiPicker from "@/components/EmojiPicker";
import { supabase } from "@/integrations/supabase/client";
import { streamChat } from "@/lib/streamChat";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

interface ChatMessage {
  id: string;
  username: string;
  content: string;
  is_ai: boolean;
  created_at: string;
}

function UsernameGate({ onJoin }: { onJoin: (name: string) => void }) {
  const [name, setName] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const handleJoin = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (["suhu", "shuvangi"].includes(trimmed.toLowerCase())) {
      setError("This username is reserved for the Queen 🌸");
      setTimeout(() => setError(""), 10000);
      return;
    }
    if (trimmed.length < 2 || trimmed.length > 20) {
      setError("Username must be 2-20 characters");
      return;
    }

    setChecking(true);
    setError("");

    // Check if username is taken
    const { data: existing } = await supabase
      .from("active_usernames")
      .select("id")
      .eq("username", trimmed)
      .maybeSingle();

    if (existing) {
      setError("Username already taken!");
      setChecking(false);
      return;
    }

    // Claim username
    const { error: insertErr } = await supabase
      .from("active_usernames")
      .insert({ username: trimmed });

    if (insertErr) {
      setError("Username already taken!");
      setChecking(false);
      return;
    }

    onJoin(trimmed);
  };

  return (
    <div className="flex flex-col h-dvh bg-background items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="glass rounded-3xl shadow-elevated p-8 w-full max-w-sm text-center"
      >
        <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <MessageCircle className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Chatroom</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Pick a username to join the conversation
        </p>

        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          placeholder="Enter a username..."
          maxLength={20}
          className="w-full px-4 py-3 rounded-2xl bg-muted text-foreground placeholder:text-muted-foreground/60 text-[15px] outline-none border border-border/50 focus:border-primary transition-colors mb-2"
        />
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-destructive text-sm mb-2"
          >
            {error}
          </motion.p>
        )}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleJoin}
          disabled={!name.trim() || checking}
          className="w-full mt-2 py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-[15px] disabled:opacity-50 transition-opacity"
        >
          {checking ? "Joining..." : "Join Chat"}
        </motion.button>

        <p className="text-xs text-muted-foreground mt-4">
          💡 Type <span className="font-mono text-primary">@suhu</span> followed by a question to ask the AI
        </p>
      </motion.div>
    </div>
  );
}

function getTimeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1m ago";
  return `${mins}m ago`;
}

function getColor(username: string) {
  const colors = [
    "text-blue-500", "text-green-500", "text-purple-500",
    "text-orange-500", "text-pink-500", "text-teal-500",
    "text-indigo-500", "text-rose-500", "text-cyan-500",
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function Chatroom() {
  const [username, setUsername] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval>>();

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Fetch messages & subscribe to realtime
  useEffect(() => {
    if (!username) return;

    // Fetch existing messages
    supabase
      .from("chat_messages")
      .select("*")
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setMessages(data);
      });

    // Realtime subscription
    const channel = supabase
      .channel("chatroom")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as ChatMessage]);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "chat_messages" },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== (payload.old as any).id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [username]);

  // Heartbeat & online count
  useEffect(() => {
    if (!username) return;

    const updateOnline = async () => {
      await supabase
        .from("active_usernames")
        .update({ last_seen: new Date().toISOString() })
        .eq("username", username);

      const { count } = await supabase
        .from("active_usernames")
        .select("*", { count: "exact", head: true });
      setOnlineCount(count || 0);
    };

    updateOnline();
    heartbeatRef.current = setInterval(updateOnline, 30000);

    return () => {
      clearInterval(heartbeatRef.current);
      // Release username on leave
      supabase.from("active_usernames").delete().eq("username", username);
    };
  }, [username]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending || !username) return;

    setSending(true);
    setInput("");

    // Insert user message
    await supabase.from("chat_messages").insert({
      username,
      content: trimmed,
      is_ai: false,
    });

    // Check for @suhu trigger
    const suhuMatch = trimmed.match(/@suhu\s+(.+)/i);
    if (suhuMatch) {
      const prompt = suhuMatch[1];

      // Insert placeholder AI message
      const { data: aiMsg } = await supabase
        .from("chat_messages")
        .insert({
          username: "Suhu AI",
          content: "Thinking...",
          is_ai: true,
        })
        .select()
        .single();

      if (aiMsg) {
        let fullResponse = "";
        try {
          await streamChat({
            messages: [{ role: "user", content: prompt }],
            onDelta: (chunk) => {
              fullResponse += chunk;
              // Update in realtime via local state (realtime will also fire)
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMsg.id ? { ...m, content: fullResponse } : m
                )
              );
            },
            onDone: async () => {
              // Persist final response
              await supabase
                .from("chat_messages")
                .update({ content: fullResponse })
                .eq("id", aiMsg.id);
            },
            onError: async (err) => {
              await supabase
                .from("chat_messages")
                .update({ content: `Error: ${err}` })
                .eq("id", aiMsg.id);
              toast.error(err);
            },
          });
        } catch {
          await supabase
            .from("chat_messages")
            .update({ content: "Failed to get AI response." })
            .eq("id", aiMsg.id);
        }
      }
    }

    setSending(false);
  };

  const handleLeave = async () => {
    if (username) {
      await supabase.from("active_usernames").delete().eq("username", username);
    }
    setUsername(null);
    setMessages([]);
  };

  if (!username) return <UsernameGate onJoin={setUsername} />;

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* Header */}
      <header className="glass sticky top-0 z-10 px-4 py-3 flex items-center justify-between border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground leading-tight">Chatroom</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" /> {onlineCount} online
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> msgs expire in 10m
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleLeave}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-xs font-medium hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="w-3 h-3" />
            Leave
          </motion.button>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-none px-4 py-4">
        {messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-full gap-3 text-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">
              No messages yet. Start the conversation!
            </p>
            <p className="text-xs text-muted-foreground">
              Type <span className="font-mono text-primary">@suhu</span> + your question to ask the AI
            </p>
          </motion.div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-1">
            <AnimatePresence initial={false}>
              {messages.map((msg) => {
                const isMe = msg.username === username;
                const isAI = msg.is_ai;

                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className={`flex ${isMe ? "justify-end" : "justify-start"} mb-1`}
                  >
                    <div className={`max-w-[80%] ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                      {/* Username label */}
                      <span className={`text-[11px] font-medium mb-0.5 px-1 ${
                        isAI ? "text-primary" : isMe ? "text-muted-foreground" : getColor(msg.username)
                      }`}>
                        {isAI && <Sparkles className="w-3 h-3 inline mr-0.5 -mt-0.5" />}
                        {msg.username}
                        <span className="text-muted-foreground/50 ml-1.5 font-normal">
                          {getTimeAgo(msg.created_at)}
                        </span>
                      </span>

                      <div className={`px-3.5 py-2 rounded-2xl text-[14px] leading-relaxed shadow-soft ${
                        isAI
                          ? "bg-primary/10 text-foreground rounded-bl-md border border-primary/20"
                          : isMe
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-card text-card-foreground rounded-bl-md border border-border/50"
                      }`}>
                        {isAI ? (
                          <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0 prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-foreground prose-pre:bg-muted prose-pre:rounded-xl">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2">
        <div className="glass rounded-2xl shadow-elevated flex items-end gap-2 p-2 max-w-2xl mx-auto">
          <EmojiPicker onSelect={(emoji) => setInput((v) => v + emoji)} />
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={`Message as ${username}...`}
            disabled={sending}
            rows={1}
            className="flex-1 bg-transparent border-none outline-none resize-none text-[15px] leading-relaxed px-2 py-1.5 placeholder:text-muted-foreground/60 text-foreground scrollbar-none"
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
              input.trim() && !sending
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <Send className="w-4 h-4" strokeWidth={2.5} />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
