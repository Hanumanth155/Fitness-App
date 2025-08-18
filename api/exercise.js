export default async function handler(req, res) {
  try {
    const upstreamPath = req.query.u; // e.g. "/exercises/target/abs"
    if (!upstreamPath || !upstreamPath.startsWith("/")) {
      return res.status(400).json({ error: "Missing or invalid ?u path" });
    }

    const url = `https://exercisedb.p.rapidapi.com${upstreamPath}`;
    const r = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": process.env.RAPID_KEY,
        "X-RapidAPI-Host": "exercisedb.p.rapidapi.com"
      }
    });

    const text = await r.text();
    // Try to return JSON if possible; otherwise raw text
    try {
      res.status(r.status).json(JSON.parse(text));
    } catch {
      res.status(r.status).send(text);
    }
  } catch (err) {
    console.error("Exercise proxy error:", err);
    res.status(500).json({ error: "Exercise proxy failed" });
  }
}
