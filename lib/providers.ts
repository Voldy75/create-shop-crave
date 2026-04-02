import { google, createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";

export type Provider = "gemini" | "openai" | "anthropic";

export interface ProviderInfo {
  id: Provider;
  label: string;
  defaultModel: string;
  description: string;
  keyPlaceholder: string;
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: "gemini",
    label: "Google Gemini",
    defaultModel: "gemini-2.5-flash",
    description: "Best for recipes and food discovery",
    keyPlaceholder: "AIza...",
  },
  {
    id: "openai",
    label: "OpenAI",
    defaultModel: "gpt-4o-mini",
    description: "Creative suggestions and detailed recipes",
    keyPlaceholder: "sk-...",
  },
  {
    id: "anthropic",
    label: "Anthropic Claude",
    defaultModel: "claude-haiku-4-5-20251001",
    description: "Thoughtful, detailed food recommendations",
    keyPlaceholder: "sk-ant-...",
  },
];

/**
 * Returns an AI SDK LanguageModel for the given provider + user-supplied API key.
 * Used for BYOK requests (user has exhausted their free daily limit).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getModel(provider: Provider, apiKey: string): any {
  switch (provider) {
    case "gemini": {
      const gemini = createGoogleGenerativeAI({ apiKey });
      return gemini("gemini-2.5-flash");
    }
    case "openai": {
      const openaiClient = createOpenAI({ apiKey });
      return openaiClient("gpt-4o-mini");
    }
    case "anthropic": {
      const anthropicClient = createAnthropic({ apiKey });
      return anthropicClient("claude-haiku-4-5-20251001");
    }
    default:
      throw new Error(`Unknown provider: ${provider as string}`);
  }
}

/**
 * Returns the server-side default model using the env API key.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getServerModel(): any {
  return google("gemini-2.5-flash");
}
