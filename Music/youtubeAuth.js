const fs = require("fs");
const path = require("path");
const {
  Innertube,
  Platform,
  Utils
} = require("youtubei.js");

// ========================================
// CẤU HÌNH LƯU YOUTUBE OAUTH
// ========================================

const DATA_DIR = process.env.RAILWAY_ENVIRONMENT
  ? "/data"
  : path.join(__dirname, "data");

const CREDENTIALS_FILE = path.join(
  DATA_DIR,
  "youtube_oauth.json"
);

let youtube = null;
let youtubePromise = null;

// ========================================
// ĐỌC CREDENTIALS ĐÃ LƯU
// ========================================

function loadCredentials() {
  try {
    if (!fs.existsSync(CREDENTIALS_FILE)) {
      return {};
    }

    const content = fs
      .readFileSync(CREDENTIALS_FILE, "utf8")
      .trim();

    if (!content) {
      return {};
    }

    const credentials = JSON.parse(content);

    return credentials &&
      typeof credentials === "object" &&
      !Array.isArray(credentials)
      ? credentials
      : {};
  } catch (error) {
    console.error(
      "❌ Không đọc được YouTube OAuth:",
      error.message
    );

    return {};
  }
}

// ========================================
// LƯU CREDENTIALS
// ========================================

function saveCredentials(credentials) {
  if (
    !credentials ||
    typeof credentials !== "object"
  ) {
    return;
  }

  try {
    fs.mkdirSync(DATA_DIR, {
      recursive: true
    });

    fs.writeFileSync(
      CREDENTIALS_FILE,
      JSON.stringify(credentials, null, 2),
      "utf8"
    );

    console.log(
      "💾 Đã lưu YouTube OAuth credentials."
    );
  } catch (error) {
    console.error(
      "❌ Không thể lưu YouTube OAuth:",
      error.message
    );
  }
}

// ========================================
// KHỞI TẠO YOUTUBE
// ========================================

async function getYouTube() {
  if (youtube) {
    return youtube;
  }

  if (youtubePromise) {
    return youtubePromise;
  }

  youtubePromise = (async () => {
    const credentials = loadCredentials();

    const client = await Innertube.create({
      retrieve_player: true
    });

    const session = client.session;

    if (!session) {
      throw new Error(
        "Không tìm thấy YouTube session."
      );
    }

    // ------------------------------------
    // NHẬN SỰ KIỆN OAUTH
    // ------------------------------------

    if (typeof session.on === "function") {
      session.on("auth", data => {
        if (
          data?.status ===
          "AUTHORIZATION_PENDING"
        ) {
          console.log("");
          console.log(
            "================================"
          );
          console.log(
            "🔐 YOUTUBE CẦN XÁC THỰC"
          );
          console.log(
            "🌐 Mở trang xác minh:"
          );
          console.log(data.verification_url);
          console.log("");
          console.log(
            "🔢 Mã xác thực:"
          );
          console.log(data.code);
          console.log(
            "================================"
          );
          console.log("");
        }

        if (data?.status === "SUCCESS") {
          console.log(
            "✅ YouTube OAuth đăng nhập thành công!"
          );

          if (data.credentials) {
            saveCredentials(data.credentials);
          }
        }

        if (data?.status === "ERROR") {
          console.error(
            "❌ YouTube OAuth lỗi:",
            data
          );
        }
      });

      session.on(
        "update-credentials",
        data => {
          if (data?.credentials) {
            saveCredentials(data.credentials);
          }
        }
      );
    }

    // ------------------------------------
    // ĐĂNG NHẬP HOẶC YÊU CẦU XÁC THỰC
    // ------------------------------------

    try {
      if (
        credentials &&
        Object.keys(credentials).length > 0
      ) {
        await session.signIn(credentials);

        console.log(
          "✅ Đã thử đăng nhập bằng credentials đã lưu."
        );
      } else {
        await session.signIn();
      }
    } catch (error) {
      console.error(
        "⚠️ YouTube OAuth:",
        error.message
      );
    }

    youtube = client;

    return client;
  })();

  try {
    return await youtubePromise;
  } catch (error) {
    youtubePromise = null;
    throw error;
  }
}

// ========================================
// EXPORT
// ========================================

module.exports = {
  getYouTube,
  loadCredentials,
  saveCredentials
};
