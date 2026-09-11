"use client";

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Loader2, AlertCircle, Sparkles, Ghost, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [rateLimitHit, setRateLimitHit] = useState(false);
  const [isTrollMode, setIsTrollMode] = useState(false);
  const [showTrollInfo, setShowTrollInfo] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');

  // Handle clicking outside the info bubble to dismiss it
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (infoRef.current && !infoRef.current.contains(event.target as Node)) {
        setShowTrollInfo(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

    const updateAssistantMessage = (messageId: string, content: string) => {
      setMessages((currentMessages) =>
        currentMessages.map((message) =>
          message.id === messageId ? { ...message, content } : message
        )
      );
    };

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, rateLimitHit]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (rateLimitHit || !inputValue.trim() || isLoading) return;

    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: inputValue,
    };
    const assistantMessageId = crypto.randomUUID();

    const nextMessages = [...messages, userMessage];
    setMessages([...nextMessages, { id: assistantMessageId, role: 'assistant', content: '' }]);
    setInputValue('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: nextMessages,
          trollMode: isTrollMode,
        }),
      });

      if (response.status === 429) {
        setRateLimitHit(true);
        setTimeout(() => setRateLimitHit(false), 60000);
        setMessages(nextMessages);
        return;
      }

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to reach the chat service.');
      }

      const assistantContent = String(payload?.message || '').trim();
      updateAssistantMessage(
        assistantMessageId,
        assistantContent || 'Sorry, I could not generate a response just now.'
      );
    } catch (submitError) {
      setMessages(nextMessages);
      setError(submitError instanceof Error ? submitError.message : 'Unable to send message.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Chat Window */}
      {isOpen && (
        <div className="mb-4 w-[350px] sm:w-[400px] h-[500px] max-h-[80vh] bg-white/80 backdrop-blur-xl border border-white/60 shadow-2xl rounded-2xl overflow-hidden flex flex-col transition-all duration-300 ease-in-out origin-bottom-right">
          {/* Header */}
          <div className="bg-primary/5 border-b border-primary/10 p-4 flex justify-between items-center">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="bg-primary/20 p-2 rounded-full text-primary shrink-0">
                {isTrollMode ? <Ghost className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-800 whitespace-nowrap truncate">
                  {isTrollMode ? "Meanie Assistant" : "PhotoFinder Assistant"}
                </h3>
                <p className="text-xs text-slate-500 whitespace-nowrap truncate">
                  {isTrollMode ? "Prepare to be roasted..." : "Ask anything about the app"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Animated Icon Switch */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsTrollMode(!isTrollMode)}
                  className={cn(
                    "relative w-20 h-8 rounded-full transition-all duration-300 flex items-center p-1",
                    isTrollMode ? "bg-amber-200 shadow-inner" : "bg-slate-200 shadow-inner"
                  )}
                  title={isTrollMode ? "Switch to Helpful Mode" : "Switch to Troll Mode"}
                >
                  <div 
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 transform shadow-md z-10",
                      isTrollMode 
                        ? "translate-x-12 bg-amber-600 text-white rotate-12" 
                        : "translate-x-0 bg-slate-800 text-white rotate-0"
                    )}
                  >
                    {isTrollMode ? <Ghost className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                  </div>
                  
                  {/* Symmetrical text labels */}
                  <span className={cn(
                    "absolute text-[10px] font-bold uppercase transition-all duration-300 tracking-wider",
                    isTrollMode ? "left-3 opacity-100 text-amber-900" : "left-10 opacity-0"
                  )}>
                    Troll
                  </span>
                  <span className={cn(
                    "absolute text-[10px] font-bold uppercase transition-all duration-300 tracking-wider",
                    isTrollMode ? "right-10 opacity-0" : "right-3 opacity-100 text-slate-900"
                  )}>
                    Help
                  </span>
                </button>
                <div className="relative flex items-center" ref={infoRef}>
                  <button 
                    onClick={() => setShowTrollInfo(!showTrollInfo)}
                    onMouseEnter={() => setShowTrollInfo(true)}
                    onMouseLeave={() => setShowTrollInfo(false)}
                    className="text-slate-400 hover:text-slate-600 transition-colors ml-1 p-2 rounded-full hover:bg-slate-50 active:bg-slate-100"
                    aria-label="Troll mode info"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                  {showTrollInfo && (
                    <div className="absolute top-full right-0 mt-1 w-32 p-2 bg-slate-800 text-white text-[10px] rounded-lg shadow-xl z-50 animate-in fade-in zoom-in-95 duration-200 pointer-events-none text-center">
                      Troll mode works better in English
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-white/50 to-slate-50/50">
            {messages.length === 0 && (
              <div className="text-center text-slate-500 my-auto pt-20 flex flex-col items-center justify-center gap-2">
                <Bot className="w-10 h-10 text-slate-300" />
                <p className="text-sm">Hi! I can help you find your photos, explain privacy settings, or navigate the app.</p>
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex gap-3 max-w-[85%]",
                  m.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                  m.role === 'user' ? "bg-slate-200 text-slate-600" : "bg-primary text-white"
                )}>
                  {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={cn(
                  "rounded-2xl px-4 py-2 text-sm",
                  m.role === 'user'
                    ? "bg-slate-100 text-slate-800 rounded-tr-none"
                    : "bg-primary/10 text-slate-800 rounded-tl-none border border-primary/10"
                )}>
                  {m.content}
                </div>
              </div>
            ))}

            {/* Loading State */}
            {isLoading && (
              <div className="flex gap-3 max-w-[85%] mr-auto">
                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-primary/10 rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-1 border border-primary/10">
                  <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                </div>
              </div>
            )}

            {/* Graceful Failure / Rate Limit Error State */}
            {rateLimitHit && (
              <div className="flex gap-3 max-w-[90%] mr-auto">
                <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div className="bg-amber-50 text-amber-800 rounded-2xl rounded-tl-none px-4 py-3 text-sm border border-amber-200">
                  Oops! I've been helping so many students today that I need a short break. Please try asking your question again in about a minute!
                </div>
              </div>
            )}

            {/* General Error State */}
            {error && !rateLimitHit && (
              <div className="flex gap-3 max-w-[90%] mr-auto">
                <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div className="bg-red-50 text-red-800 rounded-2xl rounded-tl-none px-4 py-3 text-sm border border-red-200">
                  Sorry, I'm having trouble connecting to my server right now. Please try again in a moment!
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white border-t border-slate-100">
            <form onSubmit={onSubmit} className="flex relative">
              <input
                className={cn(
                  "w-full bg-slate-50 border border-slate-200 rounded-full py-3 pl-4 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all",
                  (isLoading || rateLimitHit) && "opacity-60 cursor-not-allowed bg-slate-100"
                )}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={rateLimitHit ? "Taking a quick break..." : "Ask me anything..."}
                disabled={isLoading || rateLimitHit}
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isLoading || rateLimitHit}
                className={cn(
                  "absolute right-1 top-1 bottom-1 w-10 flex items-center justify-center rounded-full text-white transition-all",
                  (!inputValue.trim() || isLoading || rateLimitHit)
                    ? "bg-slate-300 cursor-not-allowed"
                    : "bg-primary hover:bg-primary/90"
                )}
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 ml-0.5" />}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-105 active:scale-95",
          isOpen ? "bg-slate-800 text-white hover:bg-slate-700" : "bg-primary text-white hover:bg-primary/90"
        )}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
    </div>
  );
}
