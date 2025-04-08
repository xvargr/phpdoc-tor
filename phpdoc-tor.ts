import * as fs from "fs/promises";
import { Dirent } from "fs";
import * as path from "path";
import os from "os";

// Configuration
const MAX_CONCURRENT = Math.max(os.cpus().length - 1, 1); // Better concurrency control

async function main() {
  const { dirPath, only } = getCliParams();
  const abnormalFiles: string[] = [];
  let scannedCount = 0;
  let changedCount = 0;

  const profilerStart = performance.now();

  try {
    // Get initial directory contents
    const rootContents = await getDirContents(dirPath);
    const dirStack: ExtendedDirent[] = rootContents.dirs
      .filter((dir) => only.length === 0 || only.includes(dir.name))
      .map(
        (dir) =>
          ({
            ...dir,
            parentPath: dirPath,
          } as ExtendedDirent)
      );

    const fileQueue: ExtendedDirent[] = rootContents.files["php"] || [];

    // Process directories and collect all files
    await traverseDirectories(dirStack, fileQueue);

    // Process files with concurrency control
    console.log(`Found ${fileQueue.length} PHP files to process`);
    await processFilesWithConcurrency(fileQueue, abnormalFiles, MAX_CONCURRENT);

    const profilerEnd = performance.now();
    console.log(
      `${scannedCount} file${
        scannedCount > 1 ? "s" : ""
      } scanned, ${changedCount} changed, completed in ${Math.floor(
        profilerEnd - profilerStart
      )}ms`
    );

    if (abnormalFiles.length > 0) {
      console.log(`Some abnormal files found:`, abnormalFiles);
    }
  } catch (error) {
    console.error("Error in processing:", error);
    process.exitCode = 1;
  }

  // Helper function for directory traversal
  async function traverseDirectories(
    dirStack: ExtendedDirent[],
    fileQueue: ExtendedDirent[]
  ) {
    // Process directories in batches for parallelization
    while (dirStack.length > 0) {
      // Take a batch of directories to process in parallel
      const batch = dirStack.splice(0, MAX_CONCURRENT);
      const dirPromises = batch.map(async (dir) => {
        const fullPath = path.join(dir.parentPath, dir.name);
        console.log(`Exploring directory: ${fullPath}`);

        try {
          const contents = await getDirContents(fullPath);

          // Add subdirectories to stack
          const subDirs = contents.dirs.map(
            (subDir) =>
              ({
                ...subDir,
                parentPath: fullPath,
              } as ExtendedDirent)
          );
          dirStack.push(...subDirs);

          // Add PHP files to queue
          const phpFiles = (contents.files["php"] || []).map(
            (file) =>
              ({
                ...file,
                parentPath: fullPath,
              } as ExtendedDirent)
          );
          fileQueue.push(...phpFiles);

          return { success: true };
        } catch (error) {
          console.error(`Error processing directory ${fullPath}:`, error);
          return { success: false, error };
        }
      });

      await Promise.all(dirPromises);
    }
  }

  // Helper function for parallel file processing with concurrency control
  async function processFilesWithConcurrency(
    files: ExtendedDirent[],
    abnormalFiles: string[],
    concurrency: number
  ) {
    // Process files in batches
    for (let i = 0; i < files.length; i += concurrency) {
      const batch = files.slice(i, i + concurrency);
      const promises = batch.map((file) => {
        scannedCount++;
        return fixMalformedDoc(file, abnormalFiles)
          .then((wasChanged) => {
            if (wasChanged) changedCount++;
          })
          .catch((error) => {
            console.error(`Error processing file ${file.name}:`, error);
          });
      });

      await Promise.all(promises);
    }
  }

  // Function to fix malformed docs
  async function fixMalformedDoc(
    fileDirent: ExtendedDirent,
    abnormalFiles: string[]
  ): Promise<boolean> {
    const filepath = path.join(fileDirent.parentPath, fileDirent.name);
    console.log(`Processing file: ${filepath}`);

    try {
      const content = await fs.readFile(filepath, { encoding: "utf8" });
      const malformedRgx = /^\/\*[^*].+\*\/$/gm;
      const matches = [...content.matchAll(malformedRgx)];

      if (matches.length === 0) return false;

      const pendingChanges: [string, string][] = [];

      for (let match of matches) {
        const components = match[0].split(" ");
        if (components[1].charAt(0) !== "@") continue;
        if (components[2].charAt(0) !== "$") {
          abnormalFiles.push(filepath);
          continue;
        }

        components[0] = components[0] + "*";
        [components[2], components[3]] = [components[3], components[2]];

        pendingChanges.push([match[0], components.join(" ")]);
      }

      if (pendingChanges.length === 0) return false;

      let updatedContent = content;
      for (let [original, replacement] of pendingChanges) {
        updatedContent = updatedContent.replace(original, replacement);
      }

      await fs.writeFile(filepath, updatedContent);
      return true;
    } catch (error) {
      console.error(`Error processing file ${filepath}:`, error);
      throw error;
    }
  }

  function getCliParams() {
    const [, , dirPath = ".", ...only] = process.argv;
    return { dirPath, only };
  }

  async function getDirContents(dirPath: string) {
    const contents = await fs.readdir(dirPath, { withFileTypes: true });
    const result = {
      dirs: [] as ExtendedDirent[],
      files: {} as { [key: string]: ExtendedDirent[] },
    };

    for (const item of contents) {
      const extendedItem = { ...item, parentPath: dirPath } as ExtendedDirent;

      if (item.isDirectory()) {
        result.dirs.push(extendedItem);
        continue;
      }

      const filenameParts = item.name.split(".");
      const ext =
        filenameParts.length >= 2
          ? filenameParts[filenameParts.length - 1]
          : "*";

      if (!result.files[ext]) result.files[ext] = [];
      result.files[ext].push(extendedItem);
    }

    return result;
  }
}

// Extended type to include parentPath
interface ExtendedDirent extends Dirent {
  parentPath: string;
}

// Run the main function
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exitCode = 1;
});
