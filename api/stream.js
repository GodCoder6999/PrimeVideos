import axios from 'axios';

const CONSUMET_API = "https://consumet-api.herokuapp.com"; 

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { id, type } = req.query;

  try {
    const tmdbUrl = `https://api.themoviedb.org/3/${type}/${id}?api_key=09ca3ca71692ba80b848d268502d24ed`;
    const tmdbRes = await axios.get(tmdbUrl);
    const title = tmdbRes.data.title || tmdbRes.data.name;
    
    const searchUrl = `${CONSUMET_API}/movies/flixhq/${encodeURIComponent(title)}`;
    const searchRes = await axios.get(searchUrl);
    
    if (!searchRes.data.results || searchRes.data.results.length === 0) throw new Error("Not found");

    const episodeId = searchRes.data.results[0].id; 
    const watchUrl = `${CONSUMET_API}/movies/flixhq/watch?episodeId=${episodeId}&server=upcloud`;
    const watchRes = await axios.get(watchUrl);
    
    const stream = watchRes.data.sources.find(s => s.quality === 'auto') || watchRes.data.sources[0];
    
    if(stream?.url) {
        res.redirect(stream.url);
    } else {
        throw new Error("Stream URL missing");
    }

  } catch (error) {
    res.redirect("https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8");
  }
}