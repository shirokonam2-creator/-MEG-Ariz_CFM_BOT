const fs = require("fs");
const path = require("path");
const { Innertube } = require("youtubei.js");

// Railway Volume nên mount tại /data
const DATA_DIR = process.env.RAILWAY_ENVIRONMENT
  ? "/data"
  : path.join(__dirname, "data");

const CREDENTIALS_FILE = path.join(
  DATA_DIR,
  "youtube_oauth.json"
);

let youtube = null;
let authPromise = null;

function loadCredentials() {
  try {
    if (!fs.existsSync(CREDENTIALS_FILE)) {
      return {};
    }

    const text = fs
      .readFileSync(CREDENTIALS_FILE, "utf8")
      .trim();

    if (!text) return {};

    return JSON.parse(text);
  } catch (error) {
    console.error(
      "❌ Không đọc được YouTube OAuth:",
      error.message
    );

    return {};
  }
}

function saveCredentials(credentials) {
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

async function getYouTube() {
  if (youtube) {
    return youtube;
  }

  if (authPromise) {
    return authPromise;
  }

  authPromise = (async () => {
    const credentials = loadCredentials();

    const client = await Innertube.create({
      retrieve_player: true
    });

    client.ev.on("auth", data => {
      if (data.status === "AUTHORIZATION_PENDING") {
        console.log("");
        console.log("════════════════════════════════");
        console.log("🔐 YOUTUBE CẦN XÁC THỰC");
        console.log("🌐 Mở:");
        console.log(data.verification_url);
        console.log("");
        console.log("🔢 Mã xác thực:");
        console.log(data.code);
        console.log("════════════════════════════════");
        console.log("");
      }

      if (data.status === "SUCCESS") {
        console.log(
          "✅ YouTube OAuth đăng nhập thành công!"
        );

        if (data.credentials) {
          saveCredentials(data.credentials);
        }
      }

      if (data.status === "ERROR") {
        console.error(
          "❌ YouTube OAuth lỗi:",
          data
        );
      }
    });

    client.ev.on(
      "update-credentials",
      data => {
        if (data?.credentials) {
          saveCredentials(
            data.credentials
          );
        }
      }
    );

    /*
     * Nếu đã có credentials thì dùng lại.
     * Nếu chưa có, youtubei.js sẽ phát sự kiện
     * AUTHORIZATION_PENDING để Railway log
     * URL + mã xác thực.
     */
    try {
      await client.signIn(credentials);
    } catch (error) {
      console.error(
        "⚠️ YouTube OAuth chưa hoàn tất:",
        error.message
      );

      // Không làm bot Discord chết.
      // Người dùng có thể thử p!play lại sau.
    }

    youtube = client;

    return youtube;
  })();

  try {
    return await authPromise;
  } finally {
    authPromise = null;
  }
}

module.exports = {
  getYouTube,
  loadCredentials,
  saveCredentials
};
