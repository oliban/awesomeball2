import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react' // Assuming React, change if using Vue/Svelte etc.

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()], // Adjust or remove if not using React
  base: '/awesomeball2/', // IMPORTANT: Replace 'awesomeball2' if your GitHub repository name is different!
  build: {
    // Output directory relative to the 'game/' directory.
    // '../docs' means it goes up one level from 'game/' and into 'docs/'
    outDir: '../docs', 
    emptyOutDir: true, // Clears the 'docs' directory before each build
  },
}) 