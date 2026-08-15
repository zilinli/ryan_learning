const fs = require("fs");
const path = require("path");

function loadEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  const content = fs.readFileSync(filePath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key) env[key] = val;
  }
  return env;
}

const envLocal = loadEnvFile(path.join(__dirname, ".env.local"));

module.exports = {
  apps: [
    {
      name: "spark-tutor",
      script: "npm",
      args: "run start",
      cwd: "/root/codes/ryan_learning",
      env: {
        NODE_ENV: "production",
        ...envLocal,
      },
    },
    {
      name: "formospeech-tts",
      script: "scripts/formospeech_server.py",
      cwd: "/root/codes/ryan_learning",
      // Coqui TTS lives only in this venv — system python3 → 422 No module named 'TTS'
      interpreter: path.join(__dirname, ".venv-formospeech", "bin", "python"),
      env: {
        FORMOSPEECH_PORT: "9876",
      },
    },
  ],
};
