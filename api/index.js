const cheerio = require('cheerio');
const axios = require('axios');
const urlParser = require('url');

export default async function handler(req, res) {
  // CORS Headers - taki tu isko kisi bhi frontend ya app se call kar sake
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { url } = req.query;

  // 1. Validation
  if (!url) {
    return res.status(400).json({
      status: false,
      message: 'Link missing hai bhai! URL bhejo.',
      developer: '@lakshitpatidar'
    });
  }

  try {
    // 2. Fetch Page (Handles pin.it redirects automatically)
    // Hum desktop user-agent use kar rahe hain taaki high quality data mile
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      }
    });

    // 3. Get Final URL (in case of short links like pin.it)
    const finalUrl = response.request.res.responseUrl || url;
    
    // 4. Load HTML
    const html = response.data;
    const $ = cheerio.load(html);

    // 5. Extract PWS Data (Pinterest ka main hidden khazana)
    const jsonScript = $('script[id="__PWS_DATA__"]').html();

    if (!jsonScript) {
        throw new Error('Pinterest data load nahi hua. Link shayad invalid hai.');
    }

    const output = JSON.parse(jsonScript);
    
    // 6. Locate Pin Data
    // Pinterest data structure complex hai, hum directly ID match karenge ya first available pin uthayenge
    let pinData = null;
    
    // Attempt 1: Try to find pin ID from URL and lookup in Redux state
    const pathSegments = urlParser.parse(finalUrl).pathname.split('/');
    // URL usually looks like /pin/123456/ so we look for numeric ID
    const potentialId = pathSegments.find(seg => /^\d+$/.test(seg));

    if (potentialId && output.props && output.props.initialReduxState && output.props.initialReduxState.pins) {
        pinData = output.props.initialReduxState.pins[potentialId];
    }

    // Attempt 2: Agar ID se nahi mila, toh first key utha lo (Common fallback)
    if (!pinData && output.props && output.props.initialReduxState && output.props.initialReduxState.pins) {
        const keys = Object.keys(output.props.initialReduxState.pins);
        if (keys.length > 0) {
            pinData = output.props.initialReduxState.pins[keys[0]];
        }
    }

    if (!pinData) {
        return res.status(404).json({
            status: false,
            message: 'Media data extract nahi ho paya.',
            developer: '@lakshitpatidar'
        });
    }

    // 7. Extract BEST Quality Media
    let mediaUrl = null;
    let mediaType = 'image';
    let thumbnail = pinData.images.orig.url; // Fallback thumbnail

    // ---> VIDEO LOGIC
    if (pinData.videos && pinData.videos.video_list) {
        mediaType = 'video';
        const vids = pinData.videos.video_list;
        
        // Priority: V_720P (MP4) > V_ORIGINAL (MP4) > Any MP4 > m3u8
        if (vids.V_720P && vids.V_720P.url.endsWith('.mp4')) {
            mediaUrl = vids.V_720P.url;
        } else if (vids.V_ORIGINAL && vids.V_ORIGINAL.url.endsWith('.mp4')) {
             mediaUrl = vids.V_ORIGINAL.url;
        } else {
            // Loop and find the first MP4
            const formats = Object.values(vids);
            const mp4Video = formats.find(v => v.url && v.url.endsWith('.mp4'));
            if (mp4Video) {
                mediaUrl = mp4Video.url;
            } else {
                // Last resort: HLS (.m3u8) - Stream only, download tricky
                mediaUrl = formats[0].url; 
            }
        }
    } 
    // ---> IMAGE LOGIC
    else if (pinData.images && pinData.images.orig) {
        mediaType = 'image';
        mediaUrl = pinData.images.orig.url; // "orig" is the master file (Max Quality)
    }

    // 8. Final Response Construction
    if (mediaUrl) {
        return res.status(200).json({
            status: true,
            developer: '@lakshitpatidar',
            data: {
                type: mediaType,
                title: pinData.title || pinData.grid_title || "Pinterest Media",
                description: pinData.description || "",
                // Ye combined link hai: Browser mein khul bhi jayega aur save bhi hoga
                download_url: mediaUrl, 
                thumbnail: thumbnail,
                source_url: finalUrl
            }
        });
    } else {
        return res.status(404).json({
            status: false,
            message: 'Media URL generate nahi hua.',
            developer: '@lakshitpatidar'
        });
    }

  } catch (error) {
    return res.status(500).json({
      status: false,
      message: 'Internal Error: Processing failed.',
      error_details: error.message,
      developer: '@lakshitpatidar'
    });
  }
}
