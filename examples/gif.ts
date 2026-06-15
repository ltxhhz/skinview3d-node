import fs from 'fs/promises';
import { Writer } from 'ts-gif';
import { applyPaletteSync, buildPaletteSync, utils } from 'image-q';
import { spawn, exec } from 'child_process';

let ffmpeg_available: boolean | null = null;
export async function framesToGif({ width, height, frames, outputPath, delay = 10 }: { width: number; height: number; frames: Uint8Array[]; outputPath: string; delay?: number }) {
	if (ffmpeg_available === null) {
		checkFFmpegPath()
			.then(() => {
				ffmpeg_available = true;
			})
			.catch(() => {
				ffmpeg_available = false;
			});
	} else if (ffmpeg_available) {
		return await framesToGifFfmpeg(arguments[0]);
	}

	// 1. 估算 Buffer
	const estimatedSize = width * height * frames.length + 1024 * 1024;
	const buffer = Buffer.allocUnsafe(estimatedSize);

	// -----------------------------
	// 2. 构建全局调色板
	// -----------------------------
	// 优化：为了防止内存溢出，如果帧数太多，只取部分帧来生成调色板
	const sampleStep = Math.ceil(frames.length / 10); // 最多取约10帧做样本
	const samplePoints: utils.PointContainer[] = [];

	for (let i = 0; i < frames.length; i += sampleStep) {
		samplePoints.push(utils.PointContainer.fromUint8Array(frames[i], width, height));
	}

	// 生成调色板
	const palette = buildPaletteSync(samplePoints, {
		paletteQuantization: 'wuquant', // 或 'neuquant'
		colors: 255,
		colorDistanceFormula: 'euclidean-bt709' // euclidean-bt709 视觉效果更好
	});

	const palettePoints = palette.getPointContainer().getPointArray();

	// -----------------------------
	// 3. 转换调色板格式 (RGB -> Int)
	// -----------------------------
	// 这一步转换成 ts-gif 需要的 0xRRGGBB 格式
	let paletteHex = palettePoints.map(p => (p.r << 16) | (p.g << 8) | p.b);
	paletteHex.push(0x000000);

	// 构建 RGB -> Index 的查找表
	const colorToIndex = new Map<string, number>();
	palettePoints.forEach((p, i) => {
		// key 必须与 image-q 输出的一致
		colorToIndex.set(`${p.r},${p.g},${p.b}`, i);
	});

	// -----------------------------
	// 4. 初始化 GIF Writer
	// -----------------------------
	const encoder = new Writer(buffer, width, height, {
		palette: paletteHex,
		loop: 0
	});

	// -----------------------------
	// 5. 逐帧编码
	// -----------------------------
	for (let index = 0; index < frames.length; index++) {
		console.log(`Encoding frame ${index + 1}/${frames.length}`);

		const rgba = frames[index];
		const frameContainer = utils.PointContainer.fromUint8Array(rgba, width, height);

		// 使用 applyPaletteSync 将原图的颜色“强行”转换成调色板里存在的颜色
		// 这一步会进行 Dithering (抖动) 处理，让图片看起来更自然
		const quantizedContainer = applyPaletteSync(frameContainer, palette, {
			colorDistanceFormula: 'euclidean',
			imageQuantization: 'floyd-steinberg' // 使用抖动算法减少色带
		});

		// 获取量化后的 RGB 数据 (此时数据里的颜色一定在 palette 中)
		const quantizedRgba = quantizedContainer.toUint8Array();

		// 转换成索引数组
		const indexedPixels = rgbaToIndexedWithTransparency(rgba, quantizedRgba, colorToIndex, paletteHex.length - 1);

		encoder.addFrame(0, 0, width, height, indexedPixels, {
			delay, // GIF 单位 1/100秒 (10 = 100ms)
			disposal: 2,
			transparent: paletteHex.length - 1
		});
	}

	console.log(`Finished encoding ${frames.length} frames`);

	// -----------------------------
	// 6. 写入文件
	// -----------------------------
	const pos = encoder.end();
	fs.writeFile(outputPath, buffer.subarray(0, pos));
}

/**
 * RGBA -> Index (支持透明度阈值)
 */
function rgbaToIndexedWithTransparency(originalRgba: Uint8Array, quantizedRgba: Uint8Array, colorToIndex: Map<string, number>, transparentIndex: number) {
	const indexed = new Uint8Array(originalRgba.length / 4);

	for (let i = 0, j = 0; i < originalRgba.length; i += 4, j++) {
		const a = originalRgba[i + 3];

		// 如果原始像素足够透明，强制设为透明索引
		if (a < 128) {
			indexed[j] = transparentIndex;
			continue;
		}

		// 否则使用量化后的颜色去找索引
		const r = quantizedRgba[i];
		const g = quantizedRgba[i + 1];
		const b = quantizedRgba[i + 2];

		const key = `${r},${g},${b}`;
		const idx = colorToIndex.get(key);

		// 如果找不到（极少数情况），回退到 0
		indexed[j] = idx ?? 0;
	}

	return indexed;
}

/**
 * 使用 FFmpeg 将原始 RGBA 帧转换为 GIF
 *
 * 优点：速度极快，画质最好（自动生成最优全局调色板），自动处理透明度
 * 缺点：需要运行环境安装了 FFmpeg
 */
export function framesToGifFfmpeg({
	width,
	height,
	frames,
	outputPath,
	delay = 10 // GIF 单位 1/100秒 (10 = 100ms)
}: {
	width: number;
	height: number;
	frames: Uint8Array[];
	outputPath: string;
	delay?: number;
}): Promise<void> {
	return new Promise((resolve, reject) => {
		// 1. 计算帧率 (FFmpeg 接受 fps 参数)
		// delay=10 (100ms) -> 10 fps
		// delay=5 (50ms) -> 20 fps
		const fps = 100 / delay;

		// 2. 构建 FFmpeg 参数
		// 核心思路：通过 stdin 传入 rawvideo 流，使用 filter 复杂滤镜生成 GIF
		const args = [
			'-f',
			'rawvideo', // 告诉 FFmpeg 输入格式是原始数据
			'-pix_fmt',
			'rgba', // 像素格式 RGBA (JS 的 Uint8Array 也是这个顺序)
			'-s',
			`${width}x${height}`, // 分辨率
			'-r',
			`${fps}`, // 帧率
			'-i',
			'-', // 输入源：标准输入流 (stdin)

			// 滤镜链详解：
			// [0:v] split [a][b]       -> 把输入流分叉成两路 a 和 b
			// [a] palettegen [p]       -> 用 a 流分析所有帧，生成一个最优全局调色板 p (支持透明)
			// [b][p] paletteuse        -> 用 b 流的内容，配合调色板 p 进行颜色映射生成最终 GIF
			'-vf',
			'split[a][b];[a]palettegen=reserve_transparent=1[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',

			'-y', // 覆盖输出文件
			outputPath
		];

		console.log(`Spawn ffmpeg with fps=${fps}`);

		// 3. 启动子进程
		const ffmpeg = spawn('ffmpeg', args);

		// 4. 错误日志监听 (FFmpeg 的日志输出在 stderr)
		ffmpeg.stderr.on('data', data => {
			//哪怕是正常进度信息也在 stderr，所以这里只在出错调试时打印，或者过滤 'Error' 关键字
			console.log(`FFmpeg Log: ${data}`);
		});

		ffmpeg.on('close', code => {
			if (code === 0) {
				console.log('FFmpeg finished successfully.');
				resolve();
			} else {
				reject(new Error(`FFmpeg exited with code ${code}`));
			}
		});

		ffmpeg.on('error', err => {
			reject(err);
		});

		// 5. 写入数据到 stdin (核心部分：处理背压)
		writeFramesToStdin(ffmpeg.stdin, frames).catch(err => {
			ffmpeg.kill(); // 写入出错则杀死进程
			reject(err);
		});
	});
}

/**
 * 辅助函数：处理流写入背压 (Backpressure)
 * 直接循环 write 会瞬间撑爆内存，必须配合 drain 事件
 */
async function writeFramesToStdin(stdin: NodeJS.WritableStream, frames: Uint8Array[]) {
	for (let i = 0; i < frames.length; i++) {
		const frameData = frames[i];

		// 写入数据，如果返回 false 表示缓冲区满了，需要等待
		const canContinue = stdin.write(frameData);

		if (!canContinue) {
			// 等待 drain 事件触发后再继续
			await new Promise<void>(resolve => stdin.once('drain', resolve));
		}
	}

	// 所有帧写入完毕，关闭输入流，告诉 FFmpeg 数据传完了
	stdin.end();
}

function checkFFmpegPath() {
	return new Promise((resolve, reject) => {
		// Windows 使用 'where ffmpeg'，Unix/macOS 使用 'which ffmpeg'
		const cmd = process.platform === 'win32' ? 'where.exe ffmpeg' : 'which ffmpeg';
		exec(cmd, (error, stdout, stderr) => {
			if (error) {
				reject(new Error(`FFmpeg binary not found in PATH: ${error.message}`));
				return;
			}
			resolve(stdout.trim());
		});
	});
}
