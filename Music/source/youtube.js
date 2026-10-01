const fs = require("fs");
const path = require("path");
const { Innertube } = require("youtubei.js");

const YOUTUBE_JSON = path.join(__dirname, "youtube.json");

let youtubeClient = null;
let youtubeClientPromise = null;


/* =========================================================
   YOUTUBE CLIENT
========================================================= */

async function getYouTubeClient() {
  if (youtubeClient) {
    return youtubeClient;
  }

  if (!youtubeClientPromise) {
    youtubeClientPromise = Innertube.create({
      retrieve_player: true
    })
      .then(client => {
        youtubeClient = client;
        return client;
      })
      .catch(error => {
        youtubeClientPromise = null;
        throw error;
      });
  }

  return youtubeClientPromise;
}


/* =========================================================
   YOUTUBE URL
========================================================= */

function isYouTubeUrl(input) {
  const value = String(input || "").trim();

  return /^https?:\/\/(?:(?:www|m)\.)?(?:youtube\.com|youtu\.be)\//i.test(
    value
  );
}


function getYouTubeVideoId(input) {
  const value = String(input || "").trim();

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();

    if (hostname === "youtu.be") {
      return url.pathname
        .slice(1)
        .split("/")[0] || null;
    }

    if (
      hostname === "youtube.com" ||
      hostname === "www.youtube.com" ||
      hostname === "m.youtube.com"
    ) {
      if (url.pathname === "/watch") {
        return url.searchParams.get("v");
      }

      if (url.pathname.startsWith("/shorts/")) {
        return url.pathname.split("/")[2] || null;
      }

      if (url.pathname.startsWith("/embed/")) {
        return url.pathname.split("/")[2] || null;
      }
    }
  } catch (_) {
    return null;
  }

  return null;
}


function makeYouTubeUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}


/* =========================================================
   TEXT
========================================================= */

function getText(value, fallback = "") {
  if (value == null) {
    return fallback;
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return value.toString();
  } catch (_) {
    return fallback;
  }
}


/* =========================================================
   AUTHOR
========================================================= */

function getAuthor(video) {
  if (!video?.author) {
    return "YouTube";
  }

  if (typeof video.author === "string") {
    return video.author;
  }

  return (
    getText(video.author.name) ||
    getText(video.author.text) ||
    "YouTube"
  );
}


/* =========================================================
   CHUYỂN KẾT QUẢ YOUTUBE
========================================================= */

function convertResult(video) {
  if (!video?.id) {
    return null;
  }

  return {
    source: "youtube",
    songName: getText(
      video.title,
      "YouTube"
    ),
    url: makeYouTubeUrl(video.id),
    videoId: video.id,
    author: getAuthor(video),
    thumbnail:
      video?.thumbnails?.[0]?.url || null
  };
}


/* =========================================================
   YOUTUBE.JSON
========================================================= */

function loadSavedSongs() {
  try {
    if (!fs.existsSync(YOUTUBE_JSON)) {
      return [];
    }

    const content =
      fs.readFileSync(
        YOUTUBE_JSON,
        "utf8"
      ).trim();

    if (!content) {
      return [];
    }

    const data = JSON.parse(content);

    return Array.isArray(data)
      ? data
      : [];
  } catch (error) {
    console.error(
      "❌ Không thể đọc youtube.json:",
      error.message
    );

    return [];
  }
}


/* =========================================================
   LƯU BÀI VÀO YOUTUBE.JSON
========================================================= */

function saveSong(track) {
  if (!track?.url || !track?.songName) {
    return;
  }

  const songs = loadSavedSongs();

  const exists = songs.some(
    song =>
      song.url === track.url
  );

  if (exists) {
    return;
  }

  songs.push({
    songName: track.songName,
    url: track.url
  });

  try {
    fs.writeFileSync(
      YOUTUBE_JSON,
      JSON.stringify(
        songs,
        null,
        2
      ),
      "utf8"
    );

    console.log(
      `💾 Đã lưu bài vào youtube.json: ${track.songName}`
    );
  } catch (error) {
    console.error(
      "❌ Không thể lưu youtube.json:",
      error.message
    );
  }
}


/* =========================================================
   TÌM TRONG YOUTUBE.JSON
========================================================= */

function findSavedSong(query) {
  const text =
    String(query || "")
      .trim()
      .toLowerCase();

  if (!text) {
    return null;
  }

  const songs =
    loadSavedSongs();

  // Tìm chính xác
  const exact =
    songs.find(
      song =>
        String(song.songName || "")
          .toLowerCase() === text
    );

  if (exact) {
    return {
      source: "youtube",
      songName: exact.songName,
      url: exact.url
    };
  }

  // Tìm gần đúng
  const partial =
    songs.find(
      song =>
        String(song.songName || "")
          .toLowerCase()
          .includes(text)
    );

  if (partial) {
    return {
      source: "youtube",
      songName: partial.songName,
      url: partial.url
    };
  }

  return null;
}


/* =========================================================
   TÌM KIẾM YOUTUBE
========================================================= */

async function searchYouTube(query) {
  const searchText =
    String(query || "").trim();

  if (!searchText) {
    throw new Error(
      "Bạn chưa nhập tên bài hát."
    );
  }

  /*
   * Kiểm tra youtube.json trước
   */
  const saved =
    findSavedSong(searchText);

  if (saved) {
    console.log(
      `📁 Tìm thấy trong youtube.json: ${saved.songName}`
    );

    return saved;
  }

  /*
   * Không có trong youtube.json
   * → tìm trực tiếp trên YouTube
   */

  console.log(
    `🔎 Đang tìm YouTube: ${searchText}`
  );

  const youtube =
    await getYouTubeClient();

  const results =
    await youtube.search(
      searchText,
      {
        type: "video"
      }
    );

  const items =
    Array.isArray(results?.results)
      ? results.results
      : [];

  for (const item of items) {
    const track =
      convertResult(item);

    if (track) {
      /*
       * Tự lưu bài tìm được
       */
      saveSong(track);

      return track;
    }
  }

  return null;
}


/* =========================================================
   RESOLVE YOUTUBE
========================================================= */

async function resolveYouTube(input) {
  const value =
    String(input || "").trim();

  if (!value) {
    throw new Error(
      "Bạn chưa nhập tên bài hát hoặc URL YouTube."
    );
  }

  /*
   * URL YouTube
   */

  if (isYouTubeUrl(value)) {
    const videoId =
      getYouTubeVideoId(value);

    if (!videoId) {
      throw new Error(
        "URL YouTube không hợp lệ."
      );
    }

    return {
      source: "youtube",
      songName: "YouTube",
      url: makeYouTubeUrl(videoId),
      videoId,
      author: "YouTube",
      thumbnail: null
    };
  }

  /*
   * Tên bài hát
   */

  return searchYouTube(value);
}


/* =========================================================
   EXPORT
========================================================= */

module.exports = {
  getYouTubeClient,

  isYouTubeUrl,
  getYouTubeVideoId,
  makeYouTubeUrl,

  loadSavedSongs,
  saveSong,
  findSavedSong,

  searchYouTube,
  resolveYouTube
};
