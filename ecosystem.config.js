module.exports = {
  apps: [{
    name: 'dashboard',
    script: 'npm',
    args: 'start',
    env: {
      PORT: 3000,
      HOSTNAME: '0.0.0.0',
      NODE_ENV: 'production'
    }
  }]
};
