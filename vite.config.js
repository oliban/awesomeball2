import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  root: 'game',
  // Optional: configure server port, base path, etc. if needed
  server: {
    port: 5173, // Default Vite port
    // open: true, // Automatically open in browser
  },
  // Optional: configure build output directory if needed
  build: {
    outDir: '../dist', // Output build files to dist/ at the project root
    emptyOutDir: true,
  },
}); 