declare module 'express' {
	import * as e from 'express';
	export = e;
	export type Request = e.Request;
	export type Response = e.Response;
}

declare module 'cors' {
	import * as c from 'cors';
	export = c;
}

declare module 'http-proxy-middleware' {
	import type {
		IncomingMessage,
		ServerResponse,
		ClientRequest,
	} from 'node:http';
	import type { Socket } from 'node:net';
	import type { Logger } from 'winston';
	import type { RequestHandler } from 'express';

	export interface Options {
		target: string;
		ws?: boolean;
		changeOrigin?: boolean;
		pathRewrite?: (path: string) => string;
		logProvider?: () => Logger;
		onError?: (
			err: Error,
			req: IncomingMessage,
			res: ServerResponse
		) => void;
		onProxyReqWs?: (
			proxyReq: ClientRequest,
			req: IncomingMessage,
			socket: Socket,
			options: Options,
			head: Buffer
		) => void;
		onProxyRes?: (
			proxyRes: IncomingMessage,
			req: IncomingMessage,
			res: ServerResponse
		) => void;
		upgrade?: (req: IncomingMessage, socket: Socket, head: Buffer) => void;
	}

	export function createProxyMiddleware(options: Options): RequestHandler & {
		upgrade: (req: IncomingMessage, socket: Socket, head: Buffer) => void;
	};
}
