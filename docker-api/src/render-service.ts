import path from 'node:path';
import { Color, Vector3 } from 'three';
import gl from 'gl';
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
} from 'skinview3d-node';
import type { BackEquipment } from 'skinview3d-node';
import { framesToGif } from './gif.js';

export type AnimationName = 'none' | 'idle' | 'walk' | 'run' | 'fly' | 'wave' | 'crouch' | 'hit' | 'swim' | 'spin' | 'rotate' | 'nod' | 'flail';
export type CameraView =
	| 'topLeftFront'
	| 'topRightFront'
	| 'topFront'
	| 'front'
	| 'leftFront'
	| 'rightFront'
	| 'left'
	| 'right'
	| 'top'
	| 'leftBack'
	| 'rightBack'
	| 'back'
	| 'topLeftBack'
	| 'topRightBack'
	| 'topBack'
	| 'topLeft'
	| 'topRight'
	| 'bottom'
	| 'bottomFront'
	| 'bottomBack'
	| 'bottomLeft'
	| 'bottomRight'
	| 'bottomLeftFront'
	| 'bottomRightFront'
	| 'bottomLeftBack'
	| 'bottomRightBack';

export interface RenderRequestBody {
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
	view?: CameraView;
}

export interface RenderResult {
	buffer: Buffer;
	contentType: 'image/png' | 'image/gif';
}

export const FOV = {
	topLeftFront: new Vector3(25, 22, 25),
	topRightFront: new Vector3(-25, 22, 25),
	topFront: new Vector3(0, 22, 25),
	front: new Vector3(0, 10, 40),
	leftFront: new Vector3(27, 10, 25),
	rightFront: new Vector3(-27, 10, 25),
	left: new Vector3(40, 10, 0),
	right: new Vector3(-40, 10, 0),
	leftBack: new Vector3(27, 10, -25),
	rightBack: new Vector3(-27, 10, -25),
	back: new Vector3(0, 10, -40),
	topLeftBack: new Vector3(25, 22, -25),
	topRightBack: new Vector3(-25, 22, -25),
	topBack: new Vector3(0, 22, -25),
	top: new Vector3(0, 40, 0),
	topLeft: new Vector3(25, 22, 0),
	topRight: new Vector3(-25, 22, 0),
	bottom: new Vector3(0, -40, 0),
	bottomFront: new Vector3(0, -22, 25),
	bottomBack: new Vector3(0, -22, -25),
	bottomLeft: new Vector3(25, -22, 0),
	bottomRight: new Vector3(-25, -22, 0),
	bottomLeftFront: new Vector3(25, -22, 25),
	bottomRightFront: new Vector3(-25, -22, 25),
	bottomLeftBack: new Vector3(25, -22, -25),
	bottomRightBack: new Vector3(-25, -22, -25)
} as const;

const animationConstructors: Record<Exclude<AnimationName, 'none'>, new () => PlayerAnimation> = {
	idle: IdleAnimation,
	walk: WalkingAnimation,
	run: RunningAnimation,
	fly: FlyingAnimation,
	wave: WaveAnimation,
	crouch: CrouchAnimation,
	hit: HitAnimation,
	swim: SwimAnimation,
	spin: SpinUpAnimation,
	rotate: RotateAnimation,
	nod: NodAnimation,
	flail: FlailAnimation
};

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

function normalizeAssetPath(input: string | null | undefined): string | null {
	if (!input) {
		return null;
	}
	if (/^(https?:)?\/\//.test(input) || input.startsWith('data:')) {
		return input;
	}
	if (path.isAbsolute(input)) {
		return input;
	}
	return path.resolve(process.cwd(), input);
}

function createAnimation(name: AnimationName | undefined): PlayerAnimation | null {
	if (!name || name === 'none') {
		return null;
	}
	return new animationConstructors[name]();
}

function createViewer(width: number, height: number, body: RenderRequestBody, animation: PlayerAnimation | null): SkinViewer {
	const glContext = gl(width, height, { preserveDrawingBuffer: true });
	const mockCanvas = {
		width,
		height,
		style: {},
		addEventListener: () => {},
		removeEventListener: () => {},
		getContext: () => glContext
	};

	return new SkinViewer({
		width,
		height,
		canvas: mockCanvas as any,
		skin: normalizeAssetPath(body.skin ?? './test-skin.png') ?? undefined,
		cape: normalizeAssetPath(body.cape ?? null) ?? undefined,
		capeLoadOptions: { backEquipment: body.backEquipment ?? 'cape' },
		fov: clamp(body.fov ?? 65, 10, 120),
		zoom: clamp(body.zoom ?? 0.8, 0.1, 2),
		pixelRatio: 1,
		preserveDrawingBuffer: true,
		background: body.background ? new Color(body.background) : undefined,
		nameTag: body.nameTag || undefined,
		animation: animation ?? undefined
	});
}

export async function renderPreview(body: RenderRequestBody): Promise<RenderResult> {
	const width = clamp(Math.floor(body.width ?? 300), 64, 1024);
	const height = clamp(Math.floor(body.height ?? 300), 64, 1024);
	const framesCount = clamp(Math.floor(body.frames ?? 60), 10, 120);
	const animation = createAnimation(body.animation);
	const viewer = createViewer(width, height, body, animation);

	try {
		await viewer.ready;
		const view = body.view && body.view in FOV ? FOV[body.view] : FOV.topLeftFront;
		viewer.camera.position.copy(view);
		viewer.camera.lookAt(new Vector3(0, 5, 0));

		const useProgress = body.useProgress !== false && typeof body.progress === 'number';
		if (viewer.animation && useProgress) {
			return {
				buffer: await Promise.resolve(viewer.renderAnimationFrame(clamp(body.progress ?? 0, 0, 1), true)()),
				contentType: 'image/png'
			};
		}

		if (viewer.animation) {
			const frames = viewer.renderAnimationLoop(framesCount);
			const buffers: Uint8Array[] = [];
			for (const frame of frames) {
				buffers.push(frame());
			}
			return {
				buffer: await framesToGif({
					width,
					height,
					frames: buffers,
					delay: (animation as any)?.params?.delay ?? 5
				}),
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
