module.exports = {
  apps: [
    {
      name: "spark-tutor",
      script: "npm",
      args: "run start",
      cwd: "/root/codes/ryan_learning",
      env: {
        NODE_ENV: "production",
        CURSOR_API_KEY: "crsr_7d9e4149365f2e279a8716bf279885c58d5bb49d9c74f540b30fc1a20c58dd70",
        ALIYUN_DASHSCOPE_API_KEY: "y1nCnRVFj3WK24NY",
        ALIYUN_WORKSPACE_ID: "ws-9lat3npgs3fq58nh",
        ALIYUN_DASHSCOPE_REGION: "cn-beijing",
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
