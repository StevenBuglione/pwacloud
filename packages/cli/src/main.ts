import { runCli } from './index';
import { PlatformError } from '../../contracts/src/index';
try {console.log(JSON.stringify(await runCli(process.argv.slice(2)),null,2));} catch(error) {console.error(JSON.stringify({error:error instanceof PlatformError?error.code:'cli-failed',message:error instanceof Error?error.message:'Operation failed'}));process.exitCode=1;}
