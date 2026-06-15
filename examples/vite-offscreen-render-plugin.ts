import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import os from 'os';
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
  /** 顶 */
  top: new Vector3(0, 40, 0)
} as const


async function renderImg(body: RenderRequestBody): Promise<Buffer> {
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
	const skin = normalizeAssetPath(body.skin ?? 'img/hatsune_miku.png');
	const cape = normalizeAssetPath(body.cape ?? null);
	const Animation = getAnimation(body.animation);
	console.log(body)
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
		if (viewer.animation) {
			if (progress !== null) {
				return Buffer.from(viewer.renderAnimationFrame(progress,true)())
			}
			const frames = viewer.renderAnimationLoop(framesCount);
			const arr: Uint8Array[] = [];
			frames.forEach((frame, i) => {
				const buffer = frame();
				arr.push(buffer);
				// writeFileSync(`out/frame-${i}.png`, buffer)
			});
			const tmpgif = path.join(os.tmpdir(), 'skinview3d_tmp.gif');
			await framesToGif({
				width,
				height,
				frames: arr,
				outputPath: tmpgif,
				delay: Animation!.params.delay.value
			});
			return fs.readFile(tmpgif);
		}
		viewer.render();
		return viewer.toBuffer('png');
	} finally {
		viewer.dispose();
	}
}

async function handleRender(req: IncomingMessage, res: ServerResponse): Promise<void> {
	try {
		const body = await parseJsonBody(req);
		const png = await renderImg(body);
		const contentType = typeof body.progress === 'number' || body.animation === 'none' || body.animation === undefined ? 'image/png' : 'image/gif';
		res.statusCode = 200;
		res.setHeader('Content-Type', contentType);
		res.setHeader('Content-Length', png.byteLength);
		res.setHeader('Cache-Control', 'no-store');
		res.end(png);
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
