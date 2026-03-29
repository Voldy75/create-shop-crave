"use client";

import { useState, useEffect, useRef } from "react";
import { useChat } from "ai/react";
import { useRouter } from "next/navigation";
import { useUser } from "../context/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Bot, Sparkles, RotateCcw, AlertCircle } from "lucide-react";
import { RecipeView } from "@/components/RecipeView";
import { RestaurantView } from "@/components/RestaurantView";
import { motion, AnimatePresence } from "framer-motion";

export default function ChatPage() {
    const { userName, location } = useUser();
    const router = useRouter();
    const scrollRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);

    // Redirect to home if user hasn't entered their name
    useEffect(() => {
        if (!userName) {
            router.replace("/");
        }
    }, [userName, router]);

    // Custom body for the API call to include user context
    const { messages, input, handleInputChange, handleSubmit, setInput, setMessages, isLoading } = useChat({
        api: "/api/chat",
        body: {
            userContext: {
                userName,
                location,
            },
        },
        onError: () => {
            setError("Something went wrong. Please try again.");
        },
    });

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    // Helper to parse structured content from AI response
    // Also handles hiding incomplete JSON during streaming
    const parseContent = (content: string, isStreaming: boolean = false) => {
        // Check if we have a complete JSON block
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);

        // Check if there's an incomplete JSON block (started but not closed)
        const hasIncompleteJson = content.includes('```json') && !content.includes('\n```', content.indexOf('```json') + 7);

        if (jsonMatch) {
            try {
                const data = JSON.parse(jsonMatch[1]);
                const text = content.replace(/```json\n[\s\S]*?\n```/, "").trim();
                return { data, text, isIncomplete: false };
            } catch (e) {
                console.error("Failed to parse JSON", e);
                // If parsing fails, it might be incomplete
                return { data: null, text: isStreaming ? "" : content, isIncomplete: true };
            }
        }

        // If JSON is incomplete (still streaming), hide the raw text
        if (hasIncompleteJson && isStreaming) {
            return { data: null, text: "", isIncomplete: true };
        }

        return { data: null, text: content, isIncomplete: false };
    };

    return (
        <div className="flex flex-col h-screen bg-white">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
                        <Sparkles className="w-4 h-4" />
                    </div>
                    <h1 className="font-bold text-lg tracking-tight text-gray-900">
                        Crave & Create
                    </h1>
                </div>
                <div className="flex items-center gap-3">
                    {messages.length > 0 && (
                        <button
                            onClick={() => { setMessages([]); setError(null); }}
                            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors px-3 py-1.5 rounded-full hover:bg-gray-100"
                            aria-label="Start a new conversation"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            New Chat
                        </button>
                    )}
                    <div
                        className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-medium"
                        aria-label={userName ? `Logged in as ${userName}` : "Guest user"}
                    >
                        {userName ? userName[0].toUpperCase() : "G"}
                    </div>
                </div>
            </header>

            {/* Chat Area */}
            <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 pb-44" role="main" aria-label="Chat messages">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6">
                        <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-2">
                            <Bot className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">What are you craving?</h2>
                        <p className="text-gray-500 max-w-md text-lg">
                            I can help you find the perfect restaurant or guide you through a delicious recipe.
                        </p>
                        <div className="flex gap-2 flex-wrap justify-center" role="group" aria-label="Suggested prompts">
                            {["Italian dinner", "Spicy tacos", "Healthy salad", "Sushi nearby"].map((suggestion) => (
                                <button
                                    key={suggestion}
                                    onClick={() => setInput(suggestion)}
                                    className="px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-full text-sm font-medium text-gray-600 transition-colors"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <AnimatePresence>
                    {messages.map((m, index) => {
                        const isUser = m.role === "user";
                        // Detect if this message is currently streaming (last AI message while loading)
                        const isStreamingMessage = !isUser && isLoading && index === messages.length - 1;
                        const { data, text, isIncomplete } = !isUser
                            ? parseContent(m.content, isStreamingMessage)
                            : { data: null, text: m.content, isIncomplete: false };

                        return (
                            <motion.div
                                key={m.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                            >
                                <div className={`flex gap-4 max-w-[90%] md:max-w-[80%] ${isUser ? "flex-row-reverse" : ""}`}>
                                    {/* Avatar */}
                                    {!isUser && (
                                        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white shrink-0 mt-1" aria-hidden="true">
                                            <Bot className="w-5 h-5" />
                                        </div>
                                    )}

                                    {/* Message Content */}
                                    <div className="space-y-4 w-full">
                                        {text && (
                                            <div className={`p-5 rounded-2xl leading-relaxed text-[15px] ${isUser
                                                ? "bg-gray-900 text-white rounded-tr-sm"
                                                : "bg-gray-50 text-gray-900 rounded-tl-sm"
                                                }`}>
                                                <p className="whitespace-pre-wrap">{text}</p>
                                            </div>
                                        )}

                                        {/* Show loading indicator when JSON is streaming */}
                                        {isIncomplete && isStreamingMessage && (
                                            <div className="p-5 rounded-2xl bg-gray-50 text-gray-900 rounded-tl-sm">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex gap-1" aria-hidden="true">
                                                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" />
                                                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-75" />
                                                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-150" />
                                                    </div>
                                                    <span className="text-gray-500 text-sm">Preparing your personalized suggestions...</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Dynamic Cards */}
                                        {data && (
                                            <div className="space-y-6 mt-2">
                                                {data.type === "recipe" && data.recipe && (
                                                    <RecipeView data={data.recipe} />
                                                )}
                                                {data.type === "restaurant" && data.restaurantSuggestion && (
                                                    <RestaurantView data={data.restaurantSuggestion} />
                                                )}
                                                {data.type === "both" && (
                                                    <>
                                                        {data.recipe && <RecipeView data={data.recipe} />}
                                                        <div className="flex items-center justify-center">
                                                            <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-bold text-gray-500 uppercase tracking-wider">OR</span>
                                                        </div>
                                                        {data.restaurantSuggestion && <RestaurantView data={data.restaurantSuggestion} />}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

                {isLoading && (
                    <div className="flex justify-start ml-12" aria-live="polite">
                        <div className="flex gap-1" aria-hidden="true">
                            <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" />
                            <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce delay-75" />
                            <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce delay-150" />
                        </div>
                        <span className="sr-only">Loading response...</span>
                    </div>
                )}

                {error && (
                    <div className="flex justify-start ml-12">
                        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-600 rounded-2xl text-sm" role="alert">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{error}</span>
                            <button onClick={() => setError(null)} className="ml-2 underline text-xs">Dismiss</button>
                        </div>
                    </div>
                )}

                <div ref={scrollRef} />
            </main>

            {/* Floating Input Area */}
            <div className="fixed bottom-6 left-0 right-0 px-4 flex justify-center pointer-events-none">
                <div className="w-full max-w-3xl pointer-events-auto">
                    <form onSubmit={handleSubmit} className="relative flex items-center shadow-2xl rounded-full bg-white border border-gray-100 p-2">
                        <Input
                            value={input}
                            onChange={handleInputChange}
                            placeholder="Ask anything about food..."
                            className="flex-1 border-0 bg-transparent text-lg px-6 py-4 focus-visible:ring-0 placeholder:text-gray-400"
                            disabled={isLoading}
                            aria-label="Type your message"
                        />
                        <Button
                            type="submit"
                            size="icon"
                            className="rounded-full bg-indigo-600 hover:bg-indigo-700 text-white w-12 h-12 shrink-0 transition-transform hover:scale-105"
                            disabled={isLoading || !input.trim()}
                            aria-label="Send message"
                        >
                            <Send className="w-5 h-5" />
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
}
