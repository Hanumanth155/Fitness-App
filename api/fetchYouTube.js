export default async function handler(req, res) {
  const { query } = req.query;
  const YT_API_KEY = process.env.YT_API_KEY;

  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=8&q=${encodeURIComponent(query)}&key=${YT_API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "YouTube API request failed" });
  }
}
