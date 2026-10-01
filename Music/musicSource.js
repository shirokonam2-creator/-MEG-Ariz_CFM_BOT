const fs = require("fs");
const path = require("path");

const YOUTUBE_FILE = path.join(
  __dirname,
  "sources",
  "youtube.json"
);

function loadYouTubeSongs() {
  if (!fs.existsSync(YOUTUBE_FILE)) {
    return [];
  }

  try {
    const data = fs.readFileSync(
      YOUTUBE_FILE,
      "utf8"
    );

    const songs = JSON.parse(data);

    if (!Array.isArray(songs)) {
      return [];
    }

    return songs;
  } catch (error) {
    console.error(
      "❌ Không thể đọc youtube.json:",
      error.message
    );

    return [];
  }
}

function searchYouTubeSong(query) {
  if (!query || !query.trim()) {
    return null;
  }

  const songs = loadYouTubeSongs();

  const search = query
    .trim()
    .toLowerCase();

  // Tìm chính xác trước
  const exact = songs.find(song =>
    String(song.songName || "")
      .trim()
      .toLowerCase() === search
  );

  if (exact) {
    return exact;
  }

  // Nếu không chính xác thì tìm một phần tên
  const partial = songs.find(song =>
    String(song.songName || "")
      .toLowerCase()
      .includes(search)
  );

  return partial || null;
}

function getSongByUrl(url) {
  if (!url) {
    return null;
  }

  const songs = loadYouTubeSongs();

  return (
    songs.find(song =>
      String(song.url || "").trim() ===
      String(url).trim()
    ) || null
  );
}

function isYouTubeUrl(url) {
  if (!url) {
    return false;
  }

  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i
    .test(url.trim());
}

module.exports = {
  loadYouTubeSongs,
  searchYouTubeSong,
  getSongByUrl,
  isYouTubeUrl
};
