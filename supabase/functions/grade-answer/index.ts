import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STOP_WORDS = new Set([
  "the","a","an","and","or","but","of","to","in","on","at","is","are","was","were","be","been","being",
  "it","its","this","that","these","those","as","by","for","from","with","about","into","than","then",
  "so","not","no","yes","do","does","did","have","has","had","i","you","he","she","we","they","them",
  "my","your","our","their","what","which","who","whom","how","why","when","where",
]);

const norm = (s: string) =>
  s.toLowerCase().trim().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ");

const tokens = (s: string) =>
  norm(s).split(" ").filter((t) => t.length > 2 && !STOP_WORDS.has(t));

function extractJsonFromResponse(response: string): unknown {
  let cleaned = response.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = cleaned.search(/[\{\[]/);
  if (start === -1) throw new Error("No JSON in response");
  const opener = cleaned[start];
  const closer = opener === "[" ? "]" : "}";
  const end = cleaned.lastIndexOf(closer);
  if (end === -1) throw new Error("Unterminated JSON in response");
  cleaned = cleaned.substring(start, end + 1);
  try {
    return JSON.parse(cleaned);
  } catch {
    cleaned = cleaned
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]")
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1F\x7F]/g, "");
    return JSON.parse(cleaned);
  }
}

function isTruncated(text: string): boolean {
  const open = (text.match(/\{/g) || []).length;
  const close = (text.match(/\}/g) || []).length;
  return open !== close;
}

function localCheck(
  answer: string,
  accepted: string[] = [],
  concepts: string[] = [],
): { matched: boolean; partial: boolean; conceptHits: number } {
  const a = norm(answer);
  if (!a) return { matched: false, partial: false, conceptHits: 0 };
  const aTokens = new Set(tokens(answer));

  for (const acc of accepted) {
    const n = norm(acc);
    if (!n) continue;
    if (a === n || a.includes(n) || (n.length > 4 && n.includes(a))) {
      return { matched: true, partial: false, conceptHits: 99 };
    }
  }

  let conceptHits = 0;
  for (const c of concepts) {
    const cTokens = tokens(c);
    if (cTokens.length === 0) continue;
    const hit = cTokens.some((t) => aTokens.has(t));
    if (hit) conceptHits++;
  }

  if (conceptHits >= 2) return { matched: true, partial: false, conceptHits };
  if (conceptHits === 1) return { matched: false, partial: true, conceptHits };
  return { matched: false, partial: false, conceptHits: 0 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { prompt, answer, accepted_answers, key_concepts } = await req.json();
    if (!prompt || typeof answer !== "string") {
      return new Response(JSON.stringify({ error: "prompt and answer required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    if (!answer.trim()) return json({ correct: false, feedback: "No answer given." });

    const accepted = Array.isArray(accepted_answers) ? accepted_answers : [];
    const concepts = Array.isArray(key_concepts) ? key_concepts : [];

    // Local fast-path
    const local = localCheck(answer, accepted, concepts);
    if (local.matched) {
      return json({ correct: true, feedback: "Spot on!" });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      // Fall back to local signal
      return json({
        correct: local.partial,
        feedback: local.partial ? "Close enough — good thinking." : "Hmm, that doesn't match.",
      });
    }

    let aiResp: Response;
    try {
      aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "You grade short student answers very leniently. Accept ANY answer that demonstrates basic understanding of the key concepts, even if phrased very differently, briefly, or with typos. Only mark wrong if the answer is clearly off-topic, blank, or contradicts the concept. Always reply by calling the `grade` tool.",
            },
            {
              role: "user",
              content:
                `Question: ${prompt}\n` +
                `Key concepts the answer should reference: ${concepts.join(", ") || "n/a"}\n` +
                `Accepted phrasings: ${accepted.join(" | ") || "n/a"}\n\n` +
                `Student answer: "${answer}"\n\n` +
                `Grade leniently. Reply via the grade tool with {correct, feedback}. Feedback = 1 short encouraging sentence.`,
            },
          ],
          tools: [{
            type: "function",
            function: {
              name: "grade",
              description: "Grade the student's short answer.",
              parameters: {
                type: "object",
                properties: {
                  correct: { type: "boolean" },
                  feedback: { type: "string", description: "1 short encouraging sentence." },
                },
                required: ["correct", "feedback"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "grade" } },
        }),
      });
    } catch (err) {
      console.error("AI fetch threw", err);
      return json({
        correct: local.partial,
        feedback: local.partial ? "Good try — that touches on it." : "Couldn't grade that — try rephrasing.",
      });
    }

    if (!aiResp.ok) {
      const t = await aiResp.text().catch(() => "");
      console.error("AI grade error", aiResp.status, t);
      // Be lenient if rate limited / out of credits
      if (aiResp.status === 429 || aiResp.status === 402) {
        return json({ correct: true, feedback: "Good try!" });
      }
      return json({
        correct: local.partial,
        feedback: local.partial ? "Close enough." : "Couldn't grade that — try rephrasing.",
      });
    }

    const aiJson = await aiResp.json();
    const msg = aiJson.choices?.[0]?.message;
    const tc = msg?.tool_calls?.[0];

    let parsed: { correct?: boolean; feedback?: string } | null = null;

    // Path 1: structured tool call
    if (tc?.function?.arguments) {
      try {
        parsed = typeof tc.function.arguments === "string"
          ? JSON.parse(tc.function.arguments)
          : tc.function.arguments;
      } catch {
        try { parsed = extractJsonFromResponse(String(tc.function.arguments)) as any; }
        catch (e) { console.error("Tool arg parse failed", e, tc.function.arguments); }
      }
    }

    // Path 2: plain content fallback
    if (!parsed && typeof msg?.content === "string" && msg.content.trim()) {
      if (isTruncated(msg.content)) {
        console.warn("AI response appears truncated:", msg.content);
      }
      try { parsed = extractJsonFromResponse(msg.content) as any; }
      catch (e) {
        // Last-ditch: look for "correct: true/false" in text
        const m = msg.content.match(/correct["\s:]+\s*(true|false)/i);
        if (m) parsed = { correct: m[1].toLowerCase() === "true", feedback: msg.content.slice(0, 140) };
        else console.error("Content parse failed", e, msg.content);
      }
    }

    if (parsed && typeof parsed.correct === "boolean") {
      return json({
        correct: parsed.correct,
        feedback: parsed.feedback || (parsed.correct ? "Nice work!" : "Not quite — review and try again."),
      });
    }

    // Fully unparseable — fall back to local signal
    console.error("Could not parse AI grading; falling back to local check");
    return json({
      correct: local.partial,
      feedback: local.partial
        ? "Close enough — that touches on the concept."
        : "Couldn't auto-grade that. Try rephrasing.",
    });
  } catch (e) {
    console.error("grade-answer fatal", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
