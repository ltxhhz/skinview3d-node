import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import {
	CrouchAnimation,
	FlyingAnimation,
	HitAnimation,
	IdleAnimation,
	NodAnimation,
	PlayerAnimation,
	RotateAnimation,
	RunningAnimation,
	SkinViewer,
	SpinUpAnimation,
	SwimAnimation,
	WalkingAnimation,
	WaveAnimation,
	FlailAnimation
} from '../src/skinview3d';
import type { BackEquipment } from '../src/model';
import { Color, Vector3 } from 'three';
import gl from 'gl';
import { framesToGif } from './gif';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const examplesDir = __dirname;

type AnimationName = 'none' | 'idle' | 'walk' | 'run' | 'fly' | 'wave' | 'crouch' | 'hit' | 'swim' | 'spin' | 'rotate' | 'nod' | 'flail';

interface RenderRequestBody {
	skin?: string;
	cape?: string | null;
	animation?: AnimationName;
	progress?: number;
	useProgress?: boolean;
	width?: number;
	height?: number;
	fov?: number;
	zoom?: number;
	nameTag?: string;
	background?: string | null;
	backEquipment?: BackEquipment;
	frames?: number;
	view?: keyof typeof FOV;
}

function parseJsonBody(req: IncomingMessage): Promise<RenderRequestBody> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		req.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
		req.on('end', () => {
			try {
				const raw = Buffer.concat(chunks).toString('utf8').trim();
				resolve(raw === '' ? {} : (JSON.parse(raw) as RenderRequestBody));
			} catch (error) {
				reject(error);
			}
		});
		req.on('error', reject);
	});
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

function normalizeAssetPath(input: string | null | undefined): string | null {
	if (!input) {
		return null;
	}
	if (/^(https?:)?\/\//.test(input)) {
		return input;
	}
	if (path.isAbsolute(input)) {
		return input;
	}
	return path.resolve(examplesDir, input);
}

function getAnimation(name: AnimationName | undefined) {
	switch (name ?? 'none') {
		case 'idle':
			return IdleAnimation;
		case 'walk':
			return WalkingAnimation;
		case 'run':
			return RunningAnimation;
		case 'fly':
			return FlyingAnimation;
		case 'wave':
			return WaveAnimation;
		case 'crouch':
			return CrouchAnimation;
		case 'hit':
			return HitAnimation;
		case 'swim':
			return SwimAnimation;
		case 'spin':
			return SpinUpAnimation;
		case 'rotate':
			return RotateAnimation;
		case 'nod':
			return NodAnimation;
		case 'flail':
			return FlailAnimation;
		case 'none':
		default:
			return null;
	}
}

export const FOV = {
  /** 上左前 */
  topLeftFront: new Vector3(25, 22, 25),
  /** 上右前 */
  topRightFront: new Vector3(-25, 22, 25),
  /** 上前 */
  topFront: new Vector3(0, 22, 25),

  /** 正前 */
  front: new Vector3(0, 10, 40),
  /** 左前 */
  leftFront: new Vector3(27, 10, 25),
  /** 右前 */
  rightFront: new Vector3(-27, 10, 25),

  /** 左 */
  left: new Vector3(40, 10, 0),
  /** 右 */
  right: new Vector3(-40, 10, 0),

  /** 左后 */
  leftBack: new Vector3(27, 10, -25),
  /** 右后 */
  rightBack: new Vector3(-27, 10, -25),
  /** 正后 */
  back: new Vector3(0, 10, -40),

  /** 上左后 */
  topLeftBack: new Vector3(25, 22, -25),
  /** 上右后 */
  topRightBack: new Vector3(-25, 22, -25),
  /** 上后 */
  topBack: new Vector3(0, 22, -25),

  /** 顶 */
  top: new Vector3(0, 40, 0),

  /** 上左 */
  topLeft: new Vector3(25, 22, 0),
  /** 上右 */
  topRight: new Vector3(-25, 22, 0),

  /** 底 */
  bottom: new Vector3(0, -40, 0),

  /** 下前 */
  bottomFront: new Vector3(0, -22, 25),
  /** 下后 */
  bottomBack: new Vector3(0, -22, -25),

  /** 下左 */
  bottomLeft: new Vector3(25, -22, 0),
  /** 下右 */
  bottomRight: new Vector3(-25, -22, 0),

  /** 下左前 */
  bottomLeftFront: new Vector3(25, -22, 25),
  /** 下右前 */
  bottomRightFront: new Vector3(-25, -22, 25),
  /** 下左后 */
  bottomLeftBack: new Vector3(25, -22, -25),
  /** 下右后 */
  bottomRightBack: new Vector3(-25, -22, -25),
} as const

async function renderImg(body: RenderRequestBody): Promise<{ buffer: Buffer; contentType: 'image/png' | 'image/gif' }> {
	const width = clamp(Math.floor(body.width ?? 300), 64, 1024);
	const height = clamp(Math.floor(body.height ?? 300), 64, 1024);
	const framesCount = clamp(Math.floor(body.frames ?? 60), 10, 120);
	const glContext = gl(width, height, { preserveDrawingBuffer: true });

	const mockCanvas = {
		width,
		height,
		style: {},
		addEventListener: () => {},
		removeEventListener: () => {},
		getContext: () => glContext
	};

	const progress = typeof body.progress === 'number' ? clamp(body.progress, 0, 1) : null;
	const useProgress = body.useProgress !== false && progress !== null;
	const skin = normalizeAssetPath(body.skin ?? 'img/hatsune_miku.png');
	const cape = normalizeAssetPath(body.cape ?? null);
	const Animation = getAnimation(body.animation);
	const viewer = new SkinViewer({
		width,
		height,
		canvas: mockCanvas as any,
		skin: skin ?? undefined,
		cape: cape ?? undefined,
		capeLoadOptions: { backEquipment: body.backEquipment ?? 'cape' },
		fov: clamp(body.fov ?? 65, 10, 120),
		zoom: clamp(body.zoom ?? 0.8, 0.1, 2),
		pixelRatio: 1,
		preserveDrawingBuffer: true,
		background: body.background ? new Color(body.background) : undefined,
		nameTag: body.nameTag || undefined,
		animation: Animation ? new Animation() : undefined
	});

	try {
		await viewer.ready;
		const view = body.view && body.view in FOV ? FOV[body.view] : FOV.topLeftFront;
		viewer.camera.position.copy(view);
		viewer.camera.lookAt(new Vector3(0, 5, 0));

		if (viewer.animation && useProgress) {
			return {
				buffer: viewer.renderAnimationFrame(progress, true)(),
				contentType: 'image/png'
			};
		}

		if (viewer.animation) {
			const frames = viewer.renderAnimationLoop(framesCount);
			const rgbaFrames: Uint8Array[] = [];
			for (const frame of frames) {
				rgbaFrames.push(frame());
			}
			const tmpGif = path.join(os.tmpdir(), 'skinview3d_tmp.gif');
			await framesToGif({
				width,
				height,
				frames: rgbaFrames,
				outputPath: tmpGif,
				delay: viewer.animation.params.delay
			});
			return {
				buffer: await fs.readFile(tmpGif),
				contentType: 'image/gif'
			};
		}

		viewer.render();
		return {
			buffer: viewer.toBuffer('png'),
			contentType: 'image/png'
		};
	} finally {
		viewer.dispose();
	}
}

async function handleRender(req: IncomingMessage, res: ServerResponse): Promise<void> {
	try {
		const body = await parseJsonBody(req);
		const result = await renderImg(body);
		res.statusCode = 200;
		res.setHeader('Content-Type', result.contentType);
		res.setHeader('Content-Length', result.buffer.byteLength);
		res.setHeader('Cache-Control', 'no-store');
		res.end(result.buffer);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown render error';
		res.statusCode = 500;
		res.setHeader('Content-Type', 'application/json; charset=utf-8');
		res.end(JSON.stringify({ error: message }));
	}
}

function registerMiddleware(use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void): void {
	use((req, res, next) => {
		const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
		if (pathname !== '/api/offscreen-render') {
			next();
			return;
		}
		if (req.method !== 'POST') {
			res.statusCode = 405;
			res.setHeader('Allow', 'POST');
			res.end('Method Not Allowed');
			return;
		}
		void handleRender(req, res);
	});
}

export function offscreenRenderPlugin(): Plugin {
	return {
		name: 'examples-offscreen-render',
		configureServer(server) {
			registerMiddleware(server.middlewares.use.bind(server.middlewares));
		},
		configurePreviewServer(server) {
			registerMiddleware(server.middlewares.use.bind(server.middlewares));
		}
	};
}
