export class PlatformError extends Error {constructor(public code:string,message=code){super(message);}}
