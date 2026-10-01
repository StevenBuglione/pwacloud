/** @module Interface pwacloud:plugin/lifecycle@0.1.0 **/
export function activate(configJson: string, checkpoint: Uint8Array | undefined): void;
export function handle(message: Event): Array<Effect>;
export function snapshot(): Uint8Array;
export function shutdown(): void;
export type Event = import('./pwacloud-plugin-types.js').Event;
export type Effect = import('./pwacloud-plugin-types.js').Effect;
export type ErrorInfo = import('./pwacloud-plugin-types.js').ErrorInfo;
