import type { ObserveEvent } from '../hooks/type';

type ObservePayload = Omit<ObserveEvent, 'name' | 'ts'>;

export type ObservePayloadBuilderMap<
	TEventName extends string,
	TInputByName extends Record<TEventName, unknown>,
	TPayloadByName extends Record<TEventName, ObservePayload>
> = {
	[K in TEventName]: (input: TInputByName[K]) => TPayloadByName[K];
};

export function buildObservePayload<
	TEventName extends string, // event name
	TInputByName extends Record<TEventName, unknown>, // key is event name, value is Input data
	TPayloadByName extends Record<TEventName, ObservePayload>, // key is event name, value is ObservePayload
	TName extends TEventName
>(
	name: TName,
	input: TInputByName[TName],
	builders: ObservePayloadBuilderMap<TEventName, TInputByName, TPayloadByName>
): TPayloadByName[TName] {
	return builders[name](input);
}
