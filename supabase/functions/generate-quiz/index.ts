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

    const { lesson_plan_id, module_index } = await req.json();
    if (!lesson_plan_id || typeof module_index !== "number") {
      return new Response(JSON.stringify({ error: "lesson_plan_id and module_index required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cache hit?
    const { data: cached } = await supabase
      .from("module_quizzes")
      .select("questions")
      .eq("lesson_plan_id", lesson_plan_id)
      .eq("module_index", module_index)
      .maybeSingle();

    if (cached?.questions && Array.isArray(cached.questions) && cached.questions.length > 0) {
      return new Response(JSON.stringify({ questions: cached.questions, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load plan + module
    const { data: plan } = await supabase
      .from("lesson_plans")
      .select("title, level, modules")
      .eq("id", lesson_plan_id)
      .maybeSingle();

    if (!plan) {
      return new Response(JSON.stringify({ error: "Plan not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const modules = (plan.modules as any[]) || [];
    const mod = modules[module_index];
    if (!mod) {
      return new Response(JSON.stringify({ error: "Module not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const systemPrompt = `You write short, focused quiz questions for a Duolingo-style learning app. Keep questions specific and answerable from the module content. Mix 3 multiple_choice + 2 short_answer questions. For short_answer, list 2-5 accepted answer phrases (lowercase, no punctuation) and 2-4 key concepts the answer should mention.`;

    const userPrompt = `Lesson: ${plan.title}
Level: ${plan.level || "n/a"}
Module ${module_index + 1}: ${mod.title}
Summary: ${mod.summary}
${mod.exercises?.length ? `Practice ideas: ${mod.exercises.join("; ")}` : ""}

Generate exactly 5 questions for this module.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "submit_quiz",
            description: "Submit the generated quiz questions",
            parameters: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  minItems: 5,
                  maxItems: 5,
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["multiple_choice", "short_answer"] },
                      prompt: { type: "string" },
                      options: { type: "array", items: { type: "string" }, description: "4 options for multiple_choice" },
                      correct_index: { type: "number", description: "Index of correct option for multiple_choice" },
                      accepted_answers: { type: "array", items: { type: "string" }, description: "Accepted phrases for short_answer" },
                      key_concepts: { type: "array", items: { type: "string" }, description: "Concepts the answer should reference" },
                      explanation: { type: "string", description: "1-sentence explanation shown after answering" },
                    },
                    required: ["type", "prompt", "explanation"],
                  },
                },
              },
              required: ["questions"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "submit_quiz" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit, try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResp.text();
      console.error("AI error", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call", JSON.stringify(aiJson));
      return new Response(JSON.stringify({ error: "AI did not return quiz" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const parsed = JSON.parse(toolCall.function.arguments);
    const questions = parsed.questions || [];

    // Cache it
    await supabase.from("module_quizzes").upsert({
      lesson_plan_id,
      module_index,
      questions,
    }, { onConflict: "lesson_plan_id,module_index" });

    return new Response(JSON.stringify({ questions, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
