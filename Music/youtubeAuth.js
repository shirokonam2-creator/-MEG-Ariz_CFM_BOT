const fs = require("fs");
const path = require("path");
const { Innertube } = require("youtubei.js");

const DATA_DIR = process.env.RAILWAY_ENVIRONMENT
  ? "/data"
  : path.join(__dirname, "data");

const CREDENTIALS_FILE = path.join(
  DATA_DIR,
  "youtube_oauth.json"
);

let youtube = null;
let youtubePromise = null;

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

  if (youtubePromise) {
    return youtubePromise;
  }

  youtubePromise = (async () => {
    const credentials = loadCredentials();

    const client = await Innertube.create({
      retrieve_player: true
    });

    /*
     * youtubei.js 18.x dùng session
     * cho cơ chế xác thực.
     */
    const session = client.session;

    if (!session) {
      throw new Error(
        "Không tìm thấy YouTube session."
      );
    }

    /*
     * Đăng ký OAuth events trên session.
     */
    if (session.on) {
      session.on(
        "auth",
        data => {
          if (
            data.status ===
            "AUTHORIZATION_PENDING"
          ) {
            console.log("");
            console.log(
              "════════════════════════════════"
            );
            console.log(
              "🔐 YOUTUBE CẦN XÁC THỰC"
            );
            console.log(
              "🌐 Mở:"
            );
            console.log(
              data.verification_url
            );
            console.log("");
            console.log(
              "🔢 Mã xác thực:"
            );
            console.log(data.code);
            console.log(
              "════════════════════════════════"
            );
            console.log("");
          }

          if (
            data.status === "SUCCESS"
          ) {
            console.log(
              "✅ YouTube OAuth đăng nhập thành công!"
            );

            if (data.credentials) {
              saveCredentials(
                data.credentials
              );
            }
          }

          if (
            data.status === "ERROR"
          ) {
            console.error(
              "❌ YouTube OAuth lỗi:",
              data
            );
          }
        }
      );

      session.on(
        "update-credentials",
        data => {
          if (
            data?.credentials
          ) {
            saveCredentials(
              data.credentials
            );
          }
        }
      );
    }

    /*
     * Nếu có credentials cũ,
     * dùng lại phiên đăng nhập.
     */
    try {
      if (
        credentials &&
        Object.keys(credentials).length
      ) {
        await client.signIn(
          credentials
        );

        console.log(
          "✅ Đã sử dụng YouTube credentials đã lưu."
        );
      } else {
        /*
         * Không có credentials:
         * yêu cầu OAuth.
         */
        await client.signIn();
      }
    } catch (error) {
      console.error(
        "⚠️ YouTube OAuth:",
        error.message
      );

      /*
       * Không làm Discord bot crash
       * chỉ vì YouTube chưa đăng nhập.
       */
    }

    youtube = client;

    return client;
  })();

  try {
    return await youtubePromise;
  } finally {
    youtubePromise = null;
  }
}

module.exports = {
  getYouTube,
  loadCredentials,
  saveCredentials
};
