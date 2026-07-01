/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import { observer } from "mobx-react";
import { Loader2, Send, Sparkle, X } from "lucide-react";
// hooks
import { useInstance } from "@/hooks/store/use-instance";
// services
import { AIService } from "@/services/ai.service";

const aiService = new AIService();

type TMessage = { id: number; role: "user" | "assistant"; text: string };

/**
 * "Ask AI for help" — a floating helper that answers how-to / "what do I do next"
 * questions about using Hangar (grounded in the app's features by the backend).
 * Only rendered when an LLM is configured for the instance.
 */
export const AiHelpWidget = observer(function AiHelpWidget({ workspaceSlug }: { workspaceSlug: string }) {
  const { config } = useInstance();
  // states
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<TMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // refs
  const idRef = useRef(0);

  if (!config?.has_llm_configured) return null;

  const send = async () => {
    const q = question.trim();
    if (!q || isLoading) return;
    setMessages((prev) => [...prev, { id: idRef.current++, role: "user", text: q }]);
    setQuestion("");
    setIsLoading(true);
    try {
      const res = await aiService.askHelp(workspaceSlug, q);
      setMessages((prev) => [
        ...prev,
        { id: idRef.current++, role: "assistant", text: res?.response || "Sorry, I couldn't answer that." },
      ]);
    } catch (error) {
      const message = (error as { error?: string })?.error || "Something went wrong. Please try again.";
      setMessages((prev) => [...prev, { id: idRef.current++, role: "assistant", text: message }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed right-5 bottom-5 z-[60] flex flex-col items-end">
      {isOpen && (
        <div className="mb-3 flex h-[28rem] w-80 flex-col overflow-hidden rounded-lg border border-subtle bg-surface-1 shadow-raised-200">
          <div className="flex items-center justify-between border-b border-subtle px-3 py-2">
            <span className="flex items-center gap-2 text-13 font-semibold text-primary">
              <Sparkle className="size-4 text-accent-primary" /> Ask AI for help
            </span>
            <button type="button" onClick={() => setIsOpen(false)} className="text-secondary hover:text-primary">
              <X className="size-4" />
            </button>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto px-3 py-2">
            {messages.length === 0 && (
              <p className="text-11 text-tertiary">
                Stuck? Ask how to use Hangar — e.g. &quot;how do I add a work item to a sprint?&quot;
              </p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-md px-2.5 py-1.5 text-12 whitespace-pre-wrap ${
                  m.role === "user" ? "ml-6 bg-accent-primary/15 text-primary" : "mr-6 bg-layer-1 text-secondary"
                }`}
              >
                {m.text}
              </div>
            ))}
            {isLoading && (
              <div className="mr-6 flex items-center gap-1.5 rounded-md bg-layer-1 px-2.5 py-1.5 text-12 text-secondary">
                <Loader2 className="size-3.5 animate-spin" /> Thinking…
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-subtle p-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void send();
              }}
              placeholder="Ask a question…"
              className="flex-1 rounded-md bg-layer-1 px-2.5 py-1.5 text-12 text-primary outline-none placeholder:text-tertiary"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={isLoading || !question.trim()}
              className="grid size-8 place-items-center rounded-md bg-accent-primary text-white disabled:opacity-50"
            >
              <Send className="size-4" />
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 rounded-full bg-accent-primary px-4 py-2.5 text-13 font-medium text-white shadow-raised-200 hover:bg-accent-primary/90"
      >
        <Sparkle className="size-4" />
        {isOpen ? "Close" : "Need help?"}
      </button>
    </div>
  );
});
