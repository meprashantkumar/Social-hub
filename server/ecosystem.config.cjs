// PM2 process config for the SocialHub API.
// Usage (from the server/ directory):  pm2 start ecosystem.config.cjs
// The app loads server/.env via dotenv, so all secrets live there — not here.
module.exports = {
  apps: [
    {
      name: "socialhub-api",
      script: "dist/index.js",
      instances: 1,
      autorestart: true,
      max_memory_restart: "400M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
