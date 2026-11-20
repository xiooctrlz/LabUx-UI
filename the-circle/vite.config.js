import { defineConfig } from 'vite';

export default defineConfig({
  server: { open: false, port: 5173 },
  // pre-bundle everything up front so the dev server never reloads mid-experience
  optimizeDeps: {
    include: [
      'three',
      'gsap',
      'three/examples/jsm/loaders/GLTFLoader.js',
      'three/examples/jsm/geometries/RoundedBoxGeometry.js',
      'three/examples/jsm/utils/BufferGeometryUtils.js',
      'three/examples/jsm/utils/SkeletonUtils.js',
      'three/examples/jsm/postprocessing/EffectComposer.js',
      'three/examples/jsm/postprocessing/RenderPass.js',
      'three/examples/jsm/postprocessing/UnrealBloomPass.js',
      'three/examples/jsm/postprocessing/OutputPass.js',
    ],
  },
  build: { chunkSizeWarningLimit: 1500 },
});
