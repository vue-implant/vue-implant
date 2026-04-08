import type { ILogger, LoggerLevel } from './types';

export class Logger implements ILogger {
	private static readonly LEVELS = ['debug', 'info', 'warn', 'error'];
	private level: LoggerLevel;

	public static readonly PREFIX = '[Vue Implant]';

	constructor(level: LoggerLevel = 'info') {
		this.level = level;
	}

	public setLevel(level: LoggerLevel): void {
		this.level = level;
	}

	public getLevel(): LoggerLevel {
		return this.level;
	}

	public log(level: LoggerLevel, message: string, ...args: unknown[]): void {
		const timestamp = new Date().toISOString();
		const index = Logger.LEVELS.indexOf(level);
		const currentLevelIndex = Logger.LEVELS.indexOf(this.level);
		if (index === -1 || currentLevelIndex === -1 || index < currentLevelIndex) return;

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
