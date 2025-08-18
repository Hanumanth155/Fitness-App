export default async function handler(req, res) {
  const { path } = req.query;
  const EX_BASE = "https://exercisedb.p.rapidapi.com";
  const RAPID_KEY = process.env.RAPID_KEY;

  const url = path.startsWith("http") ? path : `${EX_BASE}${path}`;

  try {
    const response = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": RAPID_KEY,
        "X-RapidAPI-Host": "exercisedb.p.rapidapi.com"
      }
    });
    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Exercise API request failed" });
  }
}
