// Fetches real YouTube video links for a given query by scraping the public
// search page (no API key required). Returns top results as { id, title, channel }.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Video = { id: string; title: string; channel: string; url: string };

async function searchYouTube(query: string, limit = 5): Promise<Video[]> {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=en&gl=US`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`YouTube fetch failed: ${res.status}`);
  const html = await res.text();

  // YouTube embeds initial data as: var ytInitialData = {...};
  const match = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
  if (!match) return [];

  let data: any;
  try {
    data = JSON.parse(match[1]);
  } catch {
    return [];
  }

  const videos: Video[] = [];
  const sections =
    data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents ?? [];

  for (const section of sections) {
    const items = section?.itemSectionRenderer?.contents ?? [];
    for (const item of items) {
      const v = item?.videoRenderer;
      if (!v?.videoId) continue;
      const title = v?.title?.runs?.[0]?.text ?? "";
      const channel = v?.ownerText?.runs?.[0]?.text ?? "";
      videos.push({
        id: v.videoId,
        title,
        channel,
        url: `https://www.youtube.com/watch?v=${v.videoId}`,
      });
      if (videos.length >= limit) return videos;
    }
  }
  return videos;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { query, limit } = await req.json();
    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "query required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const videos = await searchYouTube(query, Math.min(limit ?? 4, 8));
    return new Response(JSON.stringify({ videos }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("youtube-videos error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
