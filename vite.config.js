import { defineConfig } from 'vite'
import legacy from '@vitejs/plugin-legacy'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
//    legacy({
//      targets: ['defaults', 'not IE 11']
//    })
  ],
  server: {
    proxy: {
      // string shorthand
      '/account/account/check_login.json': 'https://www.raceon.com.tw/account/check_login.json',
    }  
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `liff.app.js`,
        chunkFileNames: `liff.app.js`,
        assetFileNames: `liff.app[extname]`,}
    }
  }     
})
