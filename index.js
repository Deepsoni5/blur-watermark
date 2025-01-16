const fs = require("fs");
const path = require("path");
const Jimp = require("jimp");
const { exec } = require("child_process");
const ffmpeg = require("fluent-ffmpeg");

// Paths
const inputDir = path.join(__dirname, "input");
const outputDir = path.join(__dirname, "output");

// Ensure the output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Process all files in the input directory
fs.readdir(inputDir, (err, files) => {
  if (err) {
    console.error("Error reading input directory:", err.message);
    return;
  }

  files.forEach((file) => {
    const inputFile = path.join(inputDir, file);
    const outputFile = path.join(outputDir, file);

    // Determine file type
    const ext = path.extname(file).toLowerCase();
    if ([".jpg", ".jpeg", ".png"].includes(ext)) {
      // Process image
      blurImage(inputFile, outputFile);
    } else if ([".mp4", ".avi", ".mov", ".mkv"].includes(ext)) {
      // For videos, process directly
      blurRightTop(inputFile, outputFile); // Changed function name for clarity
    } else {
      console.log(`Skipping unsupported file type: ${file}`);
    }
  });
});

async function blurImage(inputPath, outputPath) {
  try {
    const image = await Jimp.read(inputPath);
    const { width, height } = image.bitmap;
    const watermarkWidth = Math.floor(width * 0.15);
    const watermarkHeight = Math.floor(height * 0.1); // Increased height to 20%
    const x = width - watermarkWidth;
    const y = height - watermarkHeight; // Changed back to bottom positioning

    const blurredRegion = image
      .clone()
      .crop(x, y, watermarkWidth, watermarkHeight)
      .blur(20);
    image.composite(blurredRegion, x, y);

    await image.writeAsync(outputPath);
    console.log(`Processed image saved at: ${outputPath}`);
  } catch (error) {
    console.error(`Error processing image ${inputPath}:`, error.message);
  }
}

function blurRightTop(inputPath, outputPath) {
  // Renamed function
  ffmpeg(inputPath)
    .output(outputPath)
    .videoFilters([
      {
        filter: "split",
        options: "2",
        outputs: ["a", "b"],
      },
      {
        inputs: "b",
        filter: "crop",
        options: {
          w: "200",
          h: "200",
          x: "in_w-200",
          y: "0", // Changed to 0 for top position
        },
        outputs: "cropped",
      },
      {
        inputs: "cropped",
        filter: "boxblur",
        options: "20:1",
        outputs: "blurred",
      },
      {
        inputs: ["a", "blurred"],
        filter: "overlay",
        options: {
          x: "W-w",
          y: "0", // Changed to 0 for top position
        },
      },
    ])
    .on("start", function (commandLine) {
      //console.log("FFmpeg command:", commandLine);
    })
    .on("progress", function (progress) {
      console.log("Processing: " + Math.floor(progress.percent) + "% done");
    })
    .on("error", function (err) {
      console.error("Error:", err);
    })
    .on("end", function () {
      console.log(`Video processing complete! Saved to: ${outputPath}`);
      if (fs.existsSync(outputPath)) {
        console.log("Output file successfully created");
      } else {
        console.error("Output file was not created");
      }
    })
    .outputOptions(["-c:v libx264", "-preset fast", "-c:a copy"])
    .run();
}
