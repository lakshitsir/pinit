from fastapi import FastAPI, HTTPException
import yt_dlp
from pydantic import BaseModel

app = FastAPI()

# Request Model
class URLRequest(BaseModel):
    url: str

@app.get("/")
def home():
    return {
        "status": "Online",
        "developer": "@lakshitpatidar",
        "message": "Hyper Pinterest Downloader API is Running!"
    }

# Main API Route
@app.get("/download")
def download_pinterest(url: str):
    """
    Pinterest URL se High Quality Media extract karta hai.
    Support: Images, Videos, GIFs.
    """
    
    # yt-dlp ki settings (Best Quality & No Download just Extraction)
    ydl_opts = {
        'quiet': True,             # Console me gandgi nahi karega
        'no_warnings': True,       # Warnings ignore karega
        'simulate': True,          # File download nahi karega server par
        'force_generic_extractor': False, 
        'format': 'best',          # Hamesha BEST quality uthayega
        'noplaylist': True,        # Playlist nahi single file focus
        # Vercel par cache error na aaye isliye /tmp folder use karenge
        'cache_dir': '/tmp/yt-dlp-cache', 
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # 1. Info Extract karna
            info = ydl.extract_info(url, download=False)
            
            # 2. Data Parse karna
            title = info.get('title', 'Pinterest Media')
            media_url = info.get('url')  # Direct video/image link
            thumbnail = info.get('thumbnail')
            ext = info.get('ext') # extension (jpg, mp4, etc)
            
            # Agar direct URL nahi mila (kabhi kabhi formats list me hota hai)
            if not media_url:
                if 'formats' in info:
                    # Sabse last wala usually best quality hota hai
                    media_url = info['formats'][-1]['url']
            
            # Media Type Detect karna
            media_type = "video" if ext in ['mp4', 'mkv', 'webm'] else "image"

            # 3. Final JSON Response
            return {
                "status": "success",
                "developer": "@lakshitpatidar",
                "data": {
                    "title": title,
                    "media_type": media_type,
                    "quality": "Max Available (Original)",
                    "thumbnail": thumbnail,
                    "download_url": media_url  # Yeh hai wo magical link
                }
            }

    except Exception as e:
        # Agar koi error aaye to clean response
        return {
            "status": "error",
            "developer": "@lakshitpatidar",
            "message": "Invalid URL or Content Removed",
            "error_details": str(e)
      }
      
