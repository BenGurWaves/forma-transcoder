// ==========================================================================
// FORMA BY CALYVENT — CLIENT-SIDE TRANSCODING WEB WORKER
// WEB DESIGN BY VELOCITY
// ==========================================================================

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg = null;

// Handle messages from the main thread
self.onmessage = async (e) => {
  const { type, fileBuffer, fileName, preset, bitrate } = e.data;

  if (type === 'LOAD') {
    try {
      if (ffmpeg) {
        self.postMessage({ type: 'LOAD_COMPLETE' });
        return;
      }

      ffmpeg = new FFmpeg();
      
      // Load FFmpeg.wasm from a stable public CDN
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      // Bind progress handler
      ffmpeg.on('progress', ({ progress }) => {
        self.postMessage({ type: 'PROGRESS', progress: progress * 100 });
      });

      // Bind logger
      ffmpeg.on('log', ({ message }) => {
        self.postMessage({ type: 'LOG', log: message });
      });

      self.postMessage({ type: 'LOAD_COMPLETE' });
    } catch (err) {
      self.postMessage({ type: 'ERROR', error: `FFmpeg initialization failed: ${err.message}` });
    }
  }

  if (type === 'TRANSCODE') {
    if (!ffmpeg) {
      self.postMessage({ type: 'ERROR', error: 'FFmpeg not loaded' });
      return;
    }

    try {
      const inputName = `input_${fileName}`;
      let outputName = 'output.mp4';
      let args = [];

      // Write raw file buffer to virtual filesystem
      await ffmpeg.writeFile(inputName, new Uint8Array(fileBuffer));

      // Build FFmpeg commands based on preset selection
      if (preset === 'web_optimized') {
        outputName = 'output.mp4';
        args = [
          '-i', inputName,
          '-vcodec', 'libx264',
          '-crf', '23',
          '-preset', 'medium',
          '-acodec', 'aac',
          '-b:a', `${bitrate}k`,
          '-movflags', '+faststart',
          outputName
        ];
      } else if (preset === 'alpha_mask') {
        outputName = 'alpha_mask.mp4';
        args = [
          '-i', inputName,
          '-vf', 'alphaextract',
          outputName
        ];
      } else if (preset === 'audio_extract') {
        outputName = 'output.mp3';
        args = [
          '-i', inputName,
          '-vn',
          '-acodec', 'libmp3lame',
          '-q:a', '2',
          outputName
        ];
      }

      self.postMessage({ type: 'STATUS', status: 'transmuting crude ores...' });
      
      // Execute standard CLI commands inside try/catch loop
      await ffmpeg.exec(args);

      // Read output buffer
      const data = await ffmpeg.readFile(outputName);
      
      // Clean up inputs and outputs to preserve virtual memory space
      try {
        await ffmpeg.deleteFile(inputName);
        await ffmpeg.deleteFile(outputName);
      } catch (cleanupErr) {
        console.warn('Virtual FS cleanup warning:', cleanupErr);
      }

      // Return binary buffer to main thread
      self.postMessage({ 
        type: 'TRANSCODE_COMPLETE', 
        outputBuffer: data.buffer, 
        outputName: outputName 
      }, [data.buffer]);

    } catch (err) {
      self.postMessage({ type: 'ERROR', error: `Transcoding failed: ${err.message}` });
    }
  }
};
