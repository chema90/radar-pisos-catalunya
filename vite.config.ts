import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.DEPLOY_BASE ?? (process.env.GITHUB_ACTIONS && process.env.GITHUB_REPOSITORY
    ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/`
    : '/'),
  build: { target: 'es2022' },
  server: {
    proxy: {
      '/official/sabadell': {
        target: 'https://geoserver.ajsabadell.cat',
        changeOrigin: true,
        secure: true,
        rewrite: path => path.replace(/^\/official\/sabadell/, ''),
      },
      '/official/terrassa': {
        target: 'https://emap.terrassa.cat',
        changeOrigin: true,
        secure: true,
        rewrite: path => path.replace(/^\/official\/terrassa/, ''),
      },
      '/official/hospitalet': {
        target: 'https://dadesobertes.seu-e.cat',
        changeOrigin: true,
        secure: true,
        rewrite: path => path.replace(/^\/official\/hospitalet/, ''),
      },
    },
  },
});
