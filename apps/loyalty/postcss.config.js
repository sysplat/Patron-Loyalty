const path = require('path');

module.exports = {
  plugins: {
    // Pin config path so Tailwind runs even when the dev server cwd differs (pnpm/turbo/monorepo).
    tailwindcss: { config: path.join(__dirname, 'tailwind.config.js') },
    autoprefixer: {},
  },
};
