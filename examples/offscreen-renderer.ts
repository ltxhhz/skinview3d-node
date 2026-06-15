import './style.css';
import defaultPayload from './offscreen-render-default.json';

type AnimationName = 'none' | 'idle' | 'walk' | 'run' | 'fly' | 'wave' | 'crouch' | 'hit' | 'swim' | 'spin' | 'rotate' | 'nod' | 'flail';
type CameraView = 'topLeftFront' | 'topRightFront' | 'topFront' | 'front' | 'leftFront' | 'rightFront' | 'left' | 'right' | 'top';

interface RenderPayload {
	skin: string;
	cape: string | null;
	animation: AnimationName;
	progress?: number;
	frames: number;
	width: number;
	height: number;
	fov: number;
	view: CameraView;
	zoom: number;
	backEquipment: 'cape' | 'elytra';
	nameTag: string;
	background?: string | null;
}

interface DefaultRenderPayload extends RenderPayload {
	useProgress: boolean;
	progress: number;
}

const form = document.getElementById('render_form') as HTMLFormElement;
const preview = document.getElementById('render_preview') as HTMLImageElement;
const status = document.getElementById('render_status') as HTMLParagraphElement;
const payloadView = document.getElementById('render_payload') as HTMLPreElement;
const skinInput = document.getElementById('skin') as HTMLInputElement;
const capeInput = document.getElementById('cape') as HTMLInputElement;
const animationInput = document.getElementById('animation') as HTMLSelectElement;
const useProgressInput = document.getElementById('useProgress') as HTMLInputElement;
const progressInput = document.getElementById('progress') as HTMLInputElement;
const framesInput = document.getElementById('frames') as HTMLInputElement;
const widthInput = document.getElementById('width') as HTMLInputElement;
const heightInput = document.getElementById('height') as HTMLInputElement;
const fovInput = document.getElementById('fov') as HTMLInputElement;
const viewInput = document.getElementById('view') as HTMLSelectElement;
const zoomInput = document.getElementById('zoom') as HTMLInputElement;
const backEquipmentInput = document.getElementById('backEquipment') as HTMLSelectElement;
const nameTagInput = document.getElementById('nameTag') as HTMLInputElement;
const backgroundInput = document.getElementById('background') as HTMLInputElement;
const resetButton = document.getElementById('reset_defaults') as HTMLButtonElement;

let currentUrl: string | null = null;

function fillDefaults(): void {
	const payload = defaultPayload as DefaultRenderPayload;
	skinInput.value = payload.skin;
	capeInput.value = payload.cape ?? '';
	animationInput.value = payload.animation;
	useProgressInput.checked = payload.useProgress;
	progressInput.value = String(payload.progress);
	framesInput.value = String(payload.frames);
	widthInput.value = String(payload.width);
	heightInput.value = String(payload.height);
	fovInput.value = String(payload.fov);
	viewInput.value = payload.view;
	zoomInput.value = String(payload.zoom);
	backEquipmentInput.value = payload.backEquipment;
	nameTagInput.value = payload.nameTag;
	backgroundInput.value = payload.background ?? '';
	updateProgressState();
}

function updateProgressState(): void {
	progressInput.disabled = !useProgressInput.checked;
}

function collectPayload(): RenderPayload {
	const payload: RenderPayload = {
		skin: skinInput.value.trim(),
		cape: capeInput.value.trim() || null,
		animation: animationInput.value as AnimationName,
		frames: Number(framesInput.value),
		width: Number(widthInput.value),
		height: Number(heightInput.value),
		fov: Number(fovInput.value),
		view: viewInput.value as CameraView,
		zoom: Number(zoomInput.value),
		backEquipment: backEquipmentInput.value as 'cape' | 'elytra',
		nameTag: nameTagInput.value.trim(),
		background: backgroundInput.value.trim() || null
	};
	if (useProgressInput.checked) {
		payload.progress = Number(progressInput.value);
	}
	return payload;
}

async function renderPreview(): Promise<void> {
	const payload = collectPayload();
	payloadView.textContent = JSON.stringify(payload, null, 2);
	status.textContent = 'Rendering...';

	const response = await fetch('/api/offscreen-render', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(payload)
	});

	if (!response.ok) {
		let message = `${response.status} ${response.statusText}`;
		try {
			const error = (await response.json()) as { error?: string };
			if (error.error) {
				message = error.error;
			}
		} catch {
			// ignore invalid json response
		}
		throw new Error(message);
	}

	const blob = await response.blob();
	if (currentUrl) {
		URL.revokeObjectURL(currentUrl);
	}
	currentUrl = URL.createObjectURL(blob);
	preview.src = currentUrl;
	preview.width = payload.width;
	preview.height = payload.height;
	status.textContent = payload.progress === undefined ? `Rendered animation ${payload.width}x${payload.height}` : `Rendered frame ${payload.width}x${payload.height}`;
}

form.addEventListener('submit', event => {
	event.preventDefault();
	void renderPreview().catch(error => {
		status.textContent = error instanceof Error ? error.message : 'Render failed';
	});
});

useProgressInput.addEventListener('change', () => {
	updateProgressState();
});

resetButton.addEventListener('click', () => {
	fillDefaults();
	void renderPreview().catch(error => {
		status.textContent = error instanceof Error ? error.message : 'Render failed';
	});
});

fillDefaults();
void renderPreview().catch(error => {
	status.textContent = error instanceof Error ? error.message : 'Render failed';
});
