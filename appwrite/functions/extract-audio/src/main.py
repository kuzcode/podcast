import json
import os
import re
import subprocess
import tempfile
import hashlib
from datetime import datetime, timezone

from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.services.storage import Storage
from appwrite.id import ID
from appwrite.query import Query
from appwrite.input_file import InputFile


def get_session_user(databases, db_id, users_col, session_token):
    if not session_token:
        raise Exception("Unauthorized: no session token")
    res = databases.list_documents(db_id, users_col, [
        Query.equal("sessionToken", session_token),
        Query.limit(1),
    ])
    if res["total"] == 0:
        raise Exception("Unauthorized: invalid session")
    return res["documents"][0]


def run_ytdlp(url, output_dir):
    """Extract best audio + metadata using yt-dlp."""
    output_template = os.path.join(output_dir, "%(id)s.%(ext)s")
    cmd = [
        "yt-dlp",
        "--no-playlist" if "list=" not in url else "--yes-playlist",
        "--max-downloads", "1",
        "--extract-audio",
        "--audio-format", "mp3",
        "--audio-quality", "5",
        "--write-thumbnail",
        "--convert-thumbnails", "jpg",
        "--embed-thumbnail",
        "-o", output_template,
        "--print", "after_move:%(title)s|||%(duration)s|||%(uploader)s|||%(id)s",
        url,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    if result.returncode != 0:
        raise Exception(f"yt-dlp failed: {result.stderr[:500]}")

    lines = [l for l in result.stdout.strip().split("\n") if "|||" in l]
    meta = {"title": "Untitled", "duration": 0, "uploader": "", "id": ""}
    if lines:
        parts = lines[-1].split("|||")
        if len(parts) >= 4:
            meta = {
                "title": parts[0],
                "duration": int(float(parts[1] or 0)),
                "uploader": parts[2],
                "id": parts[3],
            }

    audio_files = [f for f in os.listdir(output_dir) if f.endswith((".mp3", ".m4a", ".webm", ".ogg"))]
    thumb_files = [f for f in os.listdir(output_dir) if f.endswith((".jpg", ".webp", ".png"))]

    if not audio_files:
        raise Exception("No audio file extracted")

    return (
        os.path.join(output_dir, audio_files[0]),
        os.path.join(output_dir, thumb_files[0]) if thumb_files else None,
        meta,
    )


def detect_platform(url):
    u = url.lower()
    platforms = {
        "youtube.com": "youtube", "youtu.be": "youtube",
        "tiktok.com": "tiktok", "instagram.com": "instagram",
        "vk.com": "vk", "twitter.com": "twitter", "x.com": "twitter",
        "facebook.com": "facebook", "twitch.tv": "twitch",
        "soundcloud.com": "soundcloud", "rutube.ru": "rutube",
        "vimeo.com": "vimeo",
    }
    for key, val in platforms.items():
        if key in u:
            return val
    return "other"


def main(context):
    context.log("extract-audio started")

    try:
        body = json.loads(context.req.body or "{}")
    except Exception:
        body = {}

    session_token = (
        body.get("sessionToken")
        or context.req.headers.get("x-session-token", "")
    )
    url = body.get("url", "").strip()

    if not url:
        return context.res.json({"status": "error", "error": "URL required"}, 400)

    if not re.match(r"^https?://", url):
        return context.res.json({"status": "error", "error": "Invalid URL"}, 400)

    client = Client()
    client.set_endpoint(os.environ["APPWRITE_FUNCTION_API_ENDPOINT"])
    client.set_project(os.environ["APPWRITE_FUNCTION_PROJECT_ID"])
    client.set_key(os.environ["APPWRITE_API_KEY"])

    databases = Databases(client)
    storage = Storage(client)

    db_id = os.environ.get("APPWRITE_DATABASE_ID", "podcast_db")
    users_col = os.environ.get("APPWRITE_USERS_COLLECTION", "users")
    podcasts_col = os.environ.get("APPWRITE_PODCASTS_COLLECTION", "podcasts")
    audio_bucket = os.environ.get("APPWRITE_AUDIO_BUCKET", "audio")
    covers_bucket = os.environ.get("APPWRITE_COVERS_BUCKET", "covers")

    try:
        user = get_session_user(databases, db_id, users_col, session_token)
    except Exception as e:
        return context.res.json({"status": "error", "error": str(e)}, 401)

    with tempfile.TemporaryDirectory() as tmpdir:
        try:
            audio_path, thumb_path, meta = run_ytdlp(url, tmpdir)
        except Exception as e:
            context.error(str(e))
            return context.res.json({
                "status": "error",
                "error": f"Не удалось извлечь аудио: {str(e)}",
            }, 422)

        audio_file = storage.create_file(
            audio_bucket,
            ID.unique(),
            InputFile.from_path(audio_path),
        )

        cover_file_id = None
        if thumb_path and os.path.exists(thumb_path):
            cover_file = storage.create_file(
                covers_bucket,
                ID.unique(),
                InputFile.from_path(thumb_path),
            )
            cover_file_id = cover_file["$id"]

        endpoint = os.environ["APPWRITE_FUNCTION_API_ENDPOINT"]
        project = os.environ["APPWRITE_FUNCTION_PROJECT_ID"]

        podcast = databases.create_document(db_id, podcasts_col, ID.unique(), {
            "title": meta["title"][:200],
            "description": f"Из {detect_platform(url)}",
            "audioFileId": audio_file["$id"],
            "coverFileId": cover_file_id or "",
            "sourceUrl": url,
            "sourcePlatform": detect_platform(url),
            "duration": meta["duration"],
            "tags": json.dumps([detect_platform(url), "imported"]),
            "userId": user["$id"],
            "authorName": meta["uploader"] or user.get("firstName", ""),
            "isPublic": True,
            "playCount": 0,
            "likeCount": 0,
            "chapters": "[]",
            "createdAt": datetime.now(timezone.utc).isoformat(),
        })

        return context.res.json({
            "status": "done",
            "podcast": {
                "$id": podcast["$id"],
                "title": podcast["title"],
                "description": podcast["description"],
                "audioUrl": f"{endpoint}/storage/buckets/{audio_bucket}/files/{audio_file['$id']}/view?project={project}",
                "coverUrl": f"{endpoint}/storage/buckets/{covers_bucket}/files/{cover_file_id}/view?project={project}" if cover_file_id else "",
                "audioFileId": audio_file["$id"],
                "coverFileId": cover_file_id,
                "sourceUrl": url,
                "sourcePlatform": detect_platform(url),
                "duration": meta["duration"],
                "tags": [detect_platform(url), "imported"],
                "userId": user["$id"],
                "authorName": podcast["authorName"],
                "isPublic": True,
                "playCount": 0,
                "likeCount": 0,
                "createdAt": podcast["createdAt"],
            },
        })
