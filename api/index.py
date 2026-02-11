from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import yt_dlp
import uvicorn

app = FastAPI()

# Request Model
class URLRequest(BaseModel):
    url: str

@app.get("/")
def home():
    return {
        "status": "Online",
        "developer": "@lakshitpatidar",
        "message": "Hyper Pinterest Downloader API is Running!",
        "usage": "Send GET request to /download?url=YOUR_LINK"
    }

@app.get("/download")
def download_pinterest(url: str):
    
    # yt-dlp options (Optimized for Vercel/Serverless)
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'simulate': True,  # Download nahi karega, sirf link nikalega
        'format': 'best',  # Best quality
        'noplaylist': True,
        'extract_flat': False, # Pura info extract karega
        # User Agent fake karna zaroori hai nahi to Pinterest block kar deta hai
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # Info Extract
            info = ydl.extract_info(url, download=False)
            
            # Data parsing
            title = info.get('title', 'Pinterest Media')
            media_url = info.get('url')
            thumbnail = info.get('thumbnail')
            ext = info.get('ext')
            
            # Agar direct URL nahi mila, formats check karo
            if not media_url and 'formats' in info:
                # Best quality usually last hoti hai yt-dlp me
                media_url = info['formats'][-1]['url']

            # Type detection
            media_type = "video" if ext in ['mp4', 'mkv', 'webm', 'm3u8'] else "image"

            return {
                "status": "success",
                "developer": "@lakshitpatidar",
                "data": {
                    "title": title,
                    "media_type": media_type,
                    "quality": "Max Available (Original)",
                    "thumbnail": thumbnail,
                    "download_url": media_url
                }
            }

    except Exception as e:
        return {
            "status": "error",
            "developer": "@lakshitpatidar",
            "message": "Failed to extract media. Link might be invalid or private.",
            "error_details": str(e)
        }

# Yeh local run ke liye hai, Vercel isko ignore karega par local me kaam aayega
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
