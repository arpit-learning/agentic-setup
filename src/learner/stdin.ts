const STDIN_TIMEOUT_MS = 5000;

export function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }

    const chunks: Buffer[] = [];
    const timer = setTimeout(() => {
      process.stdin.removeAllListeners();
      process.stdin.destroy();
      resolve(Buffer.concat(chunks).toString('utf-8'));
    }, STDIN_TIMEOUT_MS);

    process.stdin.on('data', (chunk: Buffer) => chunks.push(chunk));

    process.stdin.on('end', () => {
      clearTimeout(timer);
      resolve(Buffer.concat(chunks).toString('utf-8'));
    });

    process.stdin.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    process.stdin.resume();
  });
}
