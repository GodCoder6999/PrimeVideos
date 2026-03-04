// Step C: Find the largest VIDEO file (the actual movie/episode)
        const files = myTorrent.files || [];
        if (files.length === 0) throw new Error("TorBox finished, but no files were found.");
        
        // Force TorBox to only look at actual video files (ignoring large .zip or .nfo files)
        const videoFiles = files.filter(f => {
            const name = (f.name || f.short_name || '').toLowerCase();
            return name.endsWith('.mp4') || name.endsWith('.mkv') || name.endsWith('.avi');
        });
        
        const targetFiles = videoFiles.length > 0 ? videoFiles : files;
        const bestFile = targetFiles.sort((a, b) => b.size - a.size)[0];

        // Step D: Request the final playable stream link
        // FIX: Passing the token in the URL parameter as TorBox prefers
        const dlUrl = `https://api.torbox.app/v1/api/torrents/requestdl?token=${TB_API_KEY}&torrent_id=${myTorrent.id}&file_id=${bestFile.id}`;
        
        const dlRes = await fetch(dlUrl, {
            method: "GET",
            headers: { "Authorization": `Bearer ${TB_API_KEY}` }
        });
        
        const dlData = await dlRes.json();

        // FIX: Catch the EXACT error TorBox throws
        if (!dlData.success && !dlData.data) {
            throw new Error(`TorBox rejected the stream link. Reason: ${dlData.detail || JSON.stringify(dlData)}`);
        }

        const rawUrl = dlData.data;

        // Route through your local proxy to bypass CORS/Mixed Content
        const protocol = req.headers['x-forwarded-proto'] || (req.headers.host.includes('localhost') ? 'http' : 'https');
        const proxyBase = `${protocol}://${req.headers.host}/api/proxy?url=`;

        return res.status(200).json({ 
            success: true, 
            streamUrl: `${proxyBase}${encodeURIComponent(rawUrl)}` 
        });
