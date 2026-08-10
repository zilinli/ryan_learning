module.exports = {
  apps: [
    {
      name: "spark-tutor",
      script: "npm",
      args: "run start",
      cwd: "/root/codes/ryan_learning",
      env: {
        NODE_ENV: "production",
        // Secrets are in .env.local (gitignored) — Next.js auto-loads it.
        // ALIYUN_DASHSCOPE_API_KEY, CURSOR_API_KEY, etc.
      },
    },
    {
      name: "formospeech-tts",
      script: "scripts/formospeech_server.py",
      cwd: "/root/codes/ryan_learning",
      interpreter: "python3",
      env: {
        FORMASPEECH_PORT: "9876",
      },
    },
  ],
};
