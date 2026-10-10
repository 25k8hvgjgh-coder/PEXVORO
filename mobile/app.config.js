module.exports = ({ config }) => ({
  ...config,
  web: { ...config.web, bundler: 'metro', output: 'single' },
  // Restrict the subpath prefix to the website export; native builds retain their config.
  ...(process.env.RECONFEED_WEB_BUILD === '1' ? {
    experiments: { ...config.experiments, baseUrl: '/app' }
  } : {})
});
