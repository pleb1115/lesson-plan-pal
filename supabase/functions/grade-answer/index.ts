import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // Quick local check first
    const norm = (s: string) => s.toLowerCase().trim().replace(/[^\w\s]/g, "");
    const a = norm(answer);
    if (a.length === 0) {
      return new Response(JSON.stringify({ correct: false, feedback: "No answer given." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (Array.isArray(accepted_answers)) {
      for (const acc of accepted_answers) {
        if (a === norm(acc) || a.includes(norm(acc)) || norm(acc).includes(a)) {
          return new Response(JSON.stringify({ correct: true, feedback: "Spot on!" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: "You grade short answers leniently — accept any answer that demonstrates understanding of the key concepts, even if phrased differently. Be encouraging.",
          },
          {
            role: "user",
            content: `Question: ${prompt}\nKey concepts the answer should reference: ${(key_concepts || []).join(", ") || "n/a"}\nAccepted phrasings: ${(accepted_answers || []).join(" | ") || "n/a"}\n\nStudent answer: "${answer}"\n\nIs this correct?`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "grade",
            parameters: {
              type: "object",
              properties: {
                correct: { type: "boolean" },
                feedback: { type: "string", description: "1 short encouraging sentence" },
              },
              required: ["correct", "feedback"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "grade" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429 || aiResp.status === 402) {
        // Be lenient on AI failures so the user isn't blocked
        return new Response(JSON.stringify({ correct: true, feedback: "Good try!" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResp.text();
      console.error("grade AI error", aiResp.status, t);
      return new Response(JSON.stringify({ correct: false, feedback: "Could not grade." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const tc = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc?.function?.arguments) {
      return new Response(JSON.stringify({ correct: false, feedback: "Could not grade." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const parsed = JSON.parse(tc.function.arguments);
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
