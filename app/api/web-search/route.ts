import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { WebSearchApp } from "@/lib/types/web-search-app";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const AI_SEARCH_MODEL =
  process.env.AI_SEARCH_MODEL || "openai/gpt-4o-mini-search-preview";

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!OPENROUTER_API_KEY) {
      return NextResponse.json({ results: [] });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();

    if (!query) {
      return NextResponse.json({ results: [] });
    }

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: AI_SEARCH_MODEL,
          messages: [
            {
              role: "user",
              content: `I'm searching for a SaaS app called "${query}". Return the app itself (if it exists) and up to 3 similar or related apps. For each app return: name, a one-line description, and the official website URL. Return ONLY a JSON array with objects having fields: "name", "description", "websiteUrl". No markdown fences, no explanation, just the raw JSON array.`,
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      console.error(
        `[Web Search] OpenRouter error: ${response.status} ${response.statusText}`,
      );
      return NextResponse.json({ results: [] });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content ?? "";

    const results = parseSearchResults(content);

    return NextResponse.json({ results });
  } catch (error) {
    console.error("[Web Search] Error:", error);
    return NextResponse.json({ results: [] });
  }
}

function parseSearchResults(content: string): WebSearchApp[] {
  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item: Record<string, unknown>) =>
          typeof item.name === "string" && typeof item.websiteUrl === "string",
      )
      .slice(0, 4)
      .map((item: Record<string, unknown>) => ({
        name: item.name as string,
        description: (item.description as string) || "",
        websiteUrl: item.websiteUrl as string,
      }));
  } catch {
    return [];
  }
}
