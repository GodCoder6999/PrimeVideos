export default async function handler(req, res) {
  const { imdbId } = req.query;

  if (!imdbId) {
    return res.status(400).json({ error: "Missing IMDb ID" });
  }

  try {
    // 1. Search for the movie
    const searchUrl = `https://moviesmod.cards/search/${encodeURIComponent(imdbId)}`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
    });
    const searchHtml = await searchRes.text();

    // Regex to find the first post link (Simulating DOMParser .post-cards .title a)
    // Looking for the standard WordPress structure for search results
    const linkMatch = searchHtml.match(/<div class="title">\s*<a href="(https:\/\/moviesmod.cards\/[^"]+)"/i) || 
                      searchHtml.match(/<a href="(https:\/\/moviesmod.cards\/[^"]+)"[^>]+rel="bookmark"/i);

    if (!linkMatch) {
      return res.status(404).json({ error: "Movie not found on provider", links: [] });
    }

    const targetUrl = linkMatch[1];

    // 2. Fetch the movie page
    const pageRes = await fetch(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
    });
    const pageHtml = await pageRes.text();

    // 3. Extract download links (Simulating .maxbutton-download-links)
    const links = [];
    // Regex to capture the text (quality) and the href
    // This regex looks for the maxbutton class and captures the href
    const linkRegex = /<a[^>]+class=["'][^"']*maxbutton-download-links[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/g;
    
    let match;
    while ((match = linkRegex.exec(pageHtml)) !== null) {
      const url = match[1];
      // Clean up the label (remove HTML tags if any inside the button)
      const label = match[2].replace(/<[^>]*>/g, '').trim() || "Download";
      links.push({ url, label });
    }

    return res.status(200).json({ links });

  } catch (error) {
    console.error("Scraping error:", error);
    return res.status(500).json({ error: "Failed to fetch downloads" });
  }
}
