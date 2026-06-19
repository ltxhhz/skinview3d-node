import Koa from 'koa';
import path from 'node:path';
import type { IncomingMessage } from 'node:http';
import { fileURLToPath } from 'node:url';
import { renderPreview, type RenderRequestBody } from './render-service.js';

function readJsonBody(req: IncomingMessage, limit = 1024 * 1024): Promise<RenderRequestBody> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		let size = 0;

		req.on('data', chunk => {
			const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
			size += buffer.length;
			if (size > limit) {
				reject(new Error('Request body too large'));
				req.destroy();
				return;
			}
			chunks.push(buffer);
		});

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

export function createServer() {
	const app = new Koa();

	app.use(async ctx => {
		if (ctx.path === '/health' && ctx.method === 'GET') {
			ctx.body = { ok: true };
			return;
		}

		if (ctx.path !== '/render') {
			ctx.status = 404;
			ctx.body = { error: 'Not Found' };
			return;
		}

		if (ctx.method !== 'POST') {
			ctx.status = 405;
			ctx.set('Allow', 'POST');
			ctx.body = { error: 'Method Not Allowed' };
			return;
		}

		try {
			const body = await readJsonBody(ctx.req);
			const result = await renderPreview(body);
			ctx.status = 200;
			ctx.set('Cache-Control', 'no-store');
			ctx.type = result.contentType;
			ctx.body = result.buffer;
		} catch (error) {
			ctx.status = 500;
			ctx.body = { error: error instanceof Error ? error.message : 'Unknown render error' };
		}
	});

	return app;
}

export async function startServer(port = Number(process.env.PORT ?? 3000), host = process.env.HOST ?? '0.0.0.0') {
	const app = createServer();
	return app.listen(port, host, () => {
		console.log(`skinview3d api listening on http://${host}:${port}`);
	});
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
	void startServer();
}
