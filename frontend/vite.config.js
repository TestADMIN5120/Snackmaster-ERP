import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false, // 🚨 CRITICAL: Prevents anyone from reading your code in the browser
    minify: 'terser', // Compresses the code to make it unreadable
    terserOptions: {
      compress: {
        drop_console: true, // 🚨 Removes all console.logs from the live site
        drop_debugger: true
      }
    }
  }
})