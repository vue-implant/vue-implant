import type { ILogger, LoggerLevel } from '../../type';

export class Logger implements ILogger {
	private static readonly LEVELS = ['debug', 'info', 'warn', 'error'];
	public static readonly PREFIX = '[Vue Implant]';

	public log(level: LoggerLevel, message: string, ...args: unknown[]): void {
		const timestamp = new Date().toISOString();
		const index = Logger.LEVELS.indexOf(level);
		if (index === -1) return;

		console[level](
			`${Logger.PREFIX}[${level.toUpperCase()}][${timestamp}] ${message}`,
			...args
		);
	}

	public info(msg: string, ...args: unknown[]): void {
		this.log('info', msg, ...args);
	}

	public error(msg: string, ...args: unknown[]): void {
		this.log('error', msg, ...args);
	}

	public warn(msg: string, ...args: unknown[]): void {
		this.log('warn', msg, ...args);
	}

	public debug(msg: string, ...args: unknown[]): void {
		this.log('debug', msg, ...args);
	}
}
