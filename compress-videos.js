#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

// Supported video extensions
const SUPPORTED_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm', '.m4v'];

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function parseArgs(args) {
  const options = {
    input: './',
    output: './compressed',
    codec: 'h264',
    quality: 23,
    width: null,
    height: null,
    preset: 'medium',
    recursive: false,
    thumbnail: false,
    help: false
  };

  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '-h' || arg === '--help') {
      options.help = true;
    } else if (arg.startsWith('--input=') || arg.startsWith('-i=')) {
      options.input = arg.split('=')[1];
    } else if (arg.startsWith('--output=') || arg.startsWith('-o=')) {
      options.output = arg.split('=')[1];
    } else if (arg.startsWith('--codec=') || arg.startsWith('-c=')) {
      options.codec = arg.split('=')[1].toLowerCase();
    } else if (arg.startsWith('--quality=') || arg.startsWith('-q=')) {
      options.quality = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--width=') || arg.startsWith('-w=')) {
      options.width = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--height=') || arg.startsWith('-H=')) {
      options.height = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--preset=') || arg.startsWith('-p=')) {
      options.preset = arg.split('=')[1].toLowerCase();
    } else if (arg === '-i' || arg === '--input') {
      options.input = args[++i];
    } else if (arg === '-o' || arg === '--output') {
      options.output = args[++i];
    } else if (arg === '-c' || arg === '--codec') {
      options.codec = args[++i].toLowerCase();
    } else if (arg === '-q' || arg === '--quality') {
      options.quality = parseInt(args[++i]);
    } else if (arg === '-w' || arg === '--width') {
      options.width = parseInt(args[++i]);
    } else if (arg === '-H' || arg === '--height') {
      options.height = parseInt(args[++i]);
    } else if (arg === '-p' || arg === '--preset') {
      options.preset = args[++i].toLowerCase();
    } else if (arg === '-r' || arg === '--recursive') {
      options.recursive = true;
    } else if (arg === '-t' || arg === '--thumbnail') {
      options.thumbnail = true;
    } else if (!arg.startsWith('-')) {
      positional.push(arg);
    }
  }

  // Support positional arguments for backward compatibility
  if (positional[0]) options.input = positional[0];
  if (positional[1]) options.output = positional[1];

  return options;
}

function showHelp() {
  console.log(`
Usage: node compress-videos.js [options] [input] [output]

Options:
  -i, --input=<dir>       Input folder (default: ./)
  -o, --output=<dir>      Output folder (default: ./compressed)
  -c, --codec=<name>      Codec: h264 or h265 (default: h264)
  -q, --quality=<num>     CRF value 0-51, lower = better quality (default: 23)
  -w, --width=<px>        Scale width (maintains aspect ratio)
  -H, --height=<px>       Scale height (maintains aspect ratio)
  -p, --preset=<name>     ffmpeg preset: ultrafast..veryslow (default: medium)
  -r, --recursive         Process subfolders recursively
  -t, --thumbnail         Extract first frame as image instead of compressing
  -h, --help              Show this help message

Examples:
  node compress-videos.js
  node compress-videos.js ./videos ./compressed
  node compress-videos.js -i=./videos -o=./compressed -q=28
  node compress-videos.js --codec=h265 --preset=slow -i=./videos
  node compress-videos.js --width=1280 -i=./videos -o=./small
  node compress-videos.js --thumbnail -i=./videos -o=./thumbnails
`);
}

function checkFfmpeg() {
  return new Promise((resolve) => {
    execFile('ffmpeg', ['-version'], (error) => {
      resolve(!error);
    });
  });
}

function getVideoFiles(dir, recursive, baseDir = dir) {
  const files = fs.readdirSync(dir);
  let videos = [];

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory() && recursive) {
      videos = videos.concat(getVideoFiles(filePath, recursive, baseDir));
    } else if (stat.isFile()) {
      const ext = path.extname(file).toLowerCase();
      if (SUPPORTED_EXTENSIONS.includes(ext)) {
        const relativePath = path.relative(baseDir, filePath);
        videos.push({ filePath, relativePath });
      }
    }
  }

  return videos;
}

function compressVideo(inputPath, outputPath, { codec, quality, preset, width, height }) {
  return new Promise((resolve) => {
    const codecLib = codec === 'h265' ? 'libx265' : 'libx264';

    const args = ['-i', inputPath, '-c:v', codecLib, '-crf', String(quality), '-preset', preset, '-c:a', 'aac', '-b:a', '128k'];

    // Add scaling filter if width or height specified
    if (width || height) {
      const w = width || -2;
      const h = height || -2;
      args.push('-vf', `scale=${w}:${h}:force_original_aspect_ratio=decrease`);
    }

    // Overwrite output without asking
    args.push('-y', outputPath);

    execFile('ffmpeg', args, { maxBuffer: 10 * 1024 * 1024 }, (error) => {
      if (error) {
        console.error(`  Error compressing ${inputPath}: ${error.message}`);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

function extractThumbnail(inputPath, outputPath, { width, height }) {
  return new Promise((resolve) => {
    const args = ['-i', inputPath, '-vframes', '1'];

    // Add scaling filter if width or height specified
    if (width || height) {
      const w = width || -2;
      const h = height || -2;
      args.push('-vf', `scale=${w}:${h}:force_original_aspect_ratio=decrease`);
    }

    // Overwrite output without asking
    args.push('-y', outputPath);

    execFile('ffmpeg', args, { maxBuffer: 10 * 1024 * 1024 }, (error) => {
      if (error) {
        console.error(`  Error extracting thumbnail from ${inputPath}: ${error.message}`);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  // Check ffmpeg is installed
  const hasFfmpeg = await checkFfmpeg();
  if (!hasFfmpeg) {
    console.error('ffmpeg is not installed or not found in PATH.');
    console.error('Install it with:');
    console.error('  macOS:   brew install ffmpeg');
    console.error('  Ubuntu:  sudo apt install ffmpeg');
    console.error('  Windows: https://ffmpeg.org/download.html');
    process.exit(1);
  }

  // Validate codec
  if (!['h264', 'h265'].includes(options.codec)) {
    console.error(`Unsupported codec "${options.codec}". Supported: h264, h265`);
    process.exit(1);
  }

  // Validate quality (CRF)
  if (options.quality < 0 || options.quality > 51) {
    console.error('Quality (CRF) must be between 0 and 51.');
    process.exit(1);
  }

  // Check if input folder exists
  if (!fs.existsSync(options.input)) {
    console.error(`Input folder "${options.input}" does not exist.`);
    process.exit(1);
  }

  // Create output folder if it doesn't exist
  if (!fs.existsSync(options.output)) {
    fs.mkdirSync(options.output, { recursive: true });
  }

  // Get all video files
  const videoFiles = getVideoFiles(options.input, options.recursive);

  if (videoFiles.length === 0) {
    console.log('No supported videos found in the input folder.');
    process.exit(0);
  }

  const resizeInfo = options.width || options.height
    ? `, resize: ${options.width || 'auto'}x${options.height || 'auto'}`
    : '';
  const recursiveInfo = options.recursive ? ', recursive' : '';

  if (options.thumbnail) {
    console.log(`Extracting thumbnails from ${videoFiles.length} video(s)${resizeInfo}${recursiveInfo}...\n`);
  } else {
    const codecInfo = options.codec.toUpperCase();
    console.log(`Compressing ${videoFiles.length} video(s) with ${codecInfo} (CRF: ${options.quality}, preset: ${options.preset}${resizeInfo}${recursiveInfo})...\n`);
  }

  let successCount = 0;
  let failCount = 0;
  let totalInputSize = 0;
  let totalOutputSize = 0;

  for (const { filePath: inputPath, relativePath } of videoFiles) {
    const outputExt = options.thumbnail ? '.jpg' : '.mp4';
    const outputFileName = path.parse(relativePath).name + outputExt;
    const outputRelativeDir = path.dirname(relativePath);
    const outputDir = path.join(options.output, outputRelativeDir);
    const outputPath = path.join(outputDir, outputFileName);

    // Create subdirectory if needed
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const displayInput = relativePath;
    process.stdout.write(`  Processing ${displayInput}...`);

    const success = options.thumbnail
      ? await extractThumbnail(inputPath, outputPath, options)
      : await compressVideo(inputPath, outputPath, options);

    if (success) {
      const inputStats = fs.statSync(inputPath);
      const outputStats = fs.statSync(outputPath);

      totalInputSize += inputStats.size;
      totalOutputSize += outputStats.size;

      const displayOutput = path.join(outputRelativeDir, outputFileName);
      if (options.thumbnail) {
        process.stdout.write(`\r✓ ${displayInput} → ${displayOutput} (${formatBytes(outputStats.size)})\n`);
      } else {
        const ratio = 1 - outputStats.size / inputStats.size;
        const sizeInfo = ratio >= 0
          ? `${(ratio * 100).toFixed(1)}% smaller`
          : `${(Math.abs(ratio) * 100).toFixed(1)}% larger`;
        process.stdout.write(`\r✓ ${displayInput} → ${displayOutput} (${formatBytes(inputStats.size)} → ${formatBytes(outputStats.size)}, ${sizeInfo})\n`);
      }
      successCount++;
    } else {
      process.stdout.write(`\r✗ ${displayInput} — failed\n`);
      failCount++;
    }
  }

  if (options.thumbnail) {
    console.log(`\nDone! ${successCount} thumbnail(s) extracted, ${failCount} failed.`);
    if (successCount > 0) {
      console.log(`Total size: ${formatBytes(totalOutputSize)}`);
    }
  } else {
    console.log(`\nDone! ${successCount} compressed, ${failCount} failed.`);
    if (successCount > 0) {
      const totalRatio = 1 - totalOutputSize / totalInputSize;
      const totalInfo = totalRatio >= 0
        ? `${(totalRatio * 100).toFixed(1)}% smaller`
        : `${(Math.abs(totalRatio) * 100).toFixed(1)}% larger`;
      console.log(`\nTotal: ${formatBytes(totalInputSize)} → ${formatBytes(totalOutputSize)} (${totalInfo})`);
    }
  }
}

main();
