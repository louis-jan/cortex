import { createReadStream } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';

/**
 * Print the last N lines of a file that contain the word 'ERROR'
 * @param filename
 * @param numLines
 */
export async function printLastErrorLines(
  logPath: string,
  numLines: number = 10,
): Promise<void> {
  const errorLines: string[] = [];

  const fileStream = createReadStream(logPath);
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    errorLines.push(line);
    if (errorLines.length > numLines) {
      errorLines.shift();
    }
  }

  console.log(`Last errors:`);
  errorLines.forEach((line) => console.log(line));
  console.log('...');
}
