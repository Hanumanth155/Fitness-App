export default async function handler(req, res) {
  try {
    // Mode A) Google YouTube Data API (used for thumbnail fallback)
    if (req.query.google) {
      const q = req.query.q || "";
      if (!q) return res.status(400).json({ error: "Missing q" });

      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(q)}&key=${process.env.YT_API_KEY}`;
      const r = await fetch(url);
      if (!r.ok) {
        const t = await r.text();
        return res.status(r.status).send(t);
      }
      const data = await r.json();
      if (data.items && data.items.length) {
        const v = data.items[0];
        return res.status(200).json({
          videoId: v.id?.videoId,
          title: v.snippet?.title,
          thumbnail: v.snippet?.thumbnails?.medium?.url
        });
      }
      return res.status(200).json(null);
    }

    // Mode B) RapidAPI YouTube Search & Download (main search used in detail view)
    const upstreamPath = req.query.u; // e.g. "/search?query=push up&hl=en&gl=US"
    if (!upstreamPath || !upstreamPath.startsWith("/")) {
      return res.status(400).json({ error: "Missing or invalid ?u path" });
    }

    const url = `https://youtube-search-and-download.p.rapidapi.com${upstreamPath}`;
    const r = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": process.env.RAPID_KEY,
        "X-RapidAPI-Host": "youtube-search-and-download.p.rapidapi.com"
      }
    });

    const text = await r.text();
    try {
      res.status(r.status).json(JSON.parse(text));
    } catch {
      res.status(r.status).send(text);
    }
  } catch (err) {
    console.error("YouTube proxy error:", err);
    res.status(500).json({ error: "YouTube proxy failed" });
  }
}
