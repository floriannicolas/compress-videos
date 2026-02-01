# compress-videos

Batch compress videos using ffmpeg with h264/h265 codecs. No npm dependencies — uses your system's ffmpeg installation.

## Prerequisites

Install ffmpeg:

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg

# Windows
# Download from https://ffmpeg.org/download.html
```

For global usage:

```bash
npm link
```

## Usage

```bash
node compress-videos.js [options] [input] [output]
```

Or if installed globally:

```bash
compress-videos [options]
```

### Options

| Option            | Short | Default        | Description                                         |
| ----------------- | ----- | -------------- | --------------------------------------------------- |
| `--input=<dir>`   | `-i`  | `./`           | Input folder                                        |
| `--output=<dir>`  | `-o`  | `./compressed` | Output folder                                       |
| `--codec=<name>`  | `-c`  | `h264`         | Codec: `h264` or `h265`                             |
| `--quality=<num>` | `-q`  | `23`           | CRF value (0-51, lower = better quality)            |
| `--width=<px>`    | `-w`  | —              | Scale width (maintains aspect ratio)                |
| `--height=<px>`   | `-H`  | —              | Scale height (maintains aspect ratio)               |
| `--preset=<name>` | `-p`  | `medium`       | ffmpeg preset (`ultrafast`..`veryslow`)             |
| `--recursive`     | `-r`  | `false`        | Process subdirectories                              |
| `--thumbnail`     | `-t`  | `false`        | Extract first frame as image instead of compressing |
| `--help`          | `-h`  | —              | Show help message                                   |

### Examples

```bash
# Compress all videos in current directory
node compress-videos.js

# Specify input and output folders
node compress-videos.js -i=./videos -o=./compressed

# Use h265 with higher compression
node compress-videos.js --codec=h265 -q=28 -i=./videos

# Scale down to 1280px wide, slower preset for better compression
node compress-videos.js --width=1280 --preset=slow -i=./videos -o=./small

# Process subfolders recursively
node compress-videos.js -r -i=./videos -o=./compressed

# Extract thumbnails (first frame as JPG)
node compress-videos.js --thumbnail -i=./videos -o=./thumbnails
```

## Supported formats

**Input:** `.mp4`, `.mov`, `.avi`, `.mkv`, `.wmv`, `.flv`, `.webm`, `.m4v`

**Output:** `.mp4` (universal compatibility)

## CRF quality guide

| CRF | Quality                          |
| --- | -------------------------------- |
| 18  | Visually lossless                |
| 23  | Default, good balance            |
| 28  | Smaller files, some quality loss |
| 35+ | Low quality, very small files    |

Lower CRF = better quality, larger files. H.265 achieves similar quality at ~+4 CRF compared to H.264.
