import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Smile } from "lucide-react";

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  { label: "😊 Smileys", emojis: ["😀", "😂", "🤣", "😊", "😍", "🥰", "😎", "🤩", "😇", "🥳", "😜", "🤗"] },
  { label: "👋 Gestures", emojis: ["👍", "👎", "👏", "🙌", "🤝", "✌️", "🤞", "💪", "🫡", "🫶", "👋", "🤙"] },
  { label: "❤️ Hearts", emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💖", "💝", "💗", "💕"] },
  { label: "🔥 Popular", emojis: ["🔥", "⭐", "✨", "💯", "🎉", "🎊", "🏆", "💎", "🚀", "💡", "⚡", "🌟"] },
  { label: "🐱 Animals", emojis: ["🐱", "🐶", "🦊", "🐻", "🐼", "🐨", "🦁", "🐸", "🐙", "🦋", "🐝", "🐬"] },
  { label: "🍕 Food", emojis: ["🍕", "🍔", "🌮", "🍣", "🍩", "🍦", "☕", "🧋", "🍿", "🎂", "🍪", "🥑"] },
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

export default function EmojiPicker({ onSelect }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen((o) => !o)}
        type="button"
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Emoji picker"
      >
        <Smile className="w-5 h-5" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="absolute bottom-10 left-0 z-50 glass rounded-2xl shadow-elevated w-72 overflow-hidden"
          >
            {/* Category tabs */}
            <div className="flex gap-1 px-2 pt-2 pb-1 overflow-x-auto scrollbar-none border-b border-border/50">
              {EMOJI_CATEGORIES.map((cat, i) => (
                <button
                  key={cat.label}
                  onClick={() => setActiveTab(i)}
                  className={`text-xs px-2 py-1 rounded-lg whitespace-nowrap transition-colors ${
                    activeTab === i
                      ? "bg-primary/15 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Emoji grid */}
            <div className="grid grid-cols-6 gap-0.5 p-2 max-h-48 overflow-y-auto scrollbar-none">
              {EMOJI_CATEGORIES[activeTab].emojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onSelect(emoji);
                    setOpen(false);
                  }}
                  className="w-10 h-10 flex items-center justify-center text-xl rounded-xl hover:bg-muted transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
