import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

async function writeFramesToStdin(stdin: NodeJS.WritableStream, frames: Uint8Array[]): Promise<void> {
	for (const frame of frames) {
		const canContinue = stdin.write(frame);
		if (!canContinue) {
			await new Promise<void>(resolve => stdin.once('drain', resolve));
		}
	}
	stdin.end();
}

async function encodeGifWithFfmpeg({
	width,
	height,
	frames,
	outputPath,
	delay = 10
}: {
	width: number;
	height: number;
	frames: Uint8Array[];
	outputPath: string;
	delay?: number;
}): Promise<void> {
	const fps = 100 / delay;
	const args = [
		'-f',
		'rawvideo',
		'-pix_fmt',
		'rgba',
		'-s',
		`${width}x${height}`,
		'-r',
		`${fps}`,
		'-i',
		'-',
		'-vf',
		'split[a][b];[a]palettegen=reserve_transparent=1[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
		'-y',
		outputPath
	];

	await new Promise<void>((resolve, reject) => {
		const ffmpeg = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'pipe'] });
		let stderr = '';

		ffmpeg.stderr.on('data', data => {
			stderr += data.toString();
		});

		ffmpeg.on('error', reject);
		ffmpeg.on('close', code => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`ffmpeg exited with code ${code}${stderr ? `: ${stderr.trim()}` : ''}`));
			}
		});

		void writeFramesToStdin(ffmpeg.stdin, frames).catch(error => {
			ffmpeg.kill();
			reject(error);
		});
	});
}

export async function framesToGif({
	width,
	height,
	frames,
	delay = 10
}: {
	width: number;
	height: number;
	frames: Uint8Array[];
	delay?: number;
}): Promise<Buffer> {
	const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skinview3d-api-'));
	const outputPath = path.join(tempDir, 'output.gif');

	try {
		await encodeGifWithFfmpeg({ width, height, frames, outputPath, delay });
		return await fs.readFile(outputPath);
	} finally {
		await fs.rm(tempDir, { recursive: true, force: true });
	}
}
