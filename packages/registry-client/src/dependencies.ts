import { PlatformError,validateManifest,type Manifest } from '../../contracts/src/index';
import Ajv2020 from 'ajv/dist/2020.js';
export type DependencyPackage={digest:string;manifest:Manifest};
export type DependencyBinding={consumer:string;interface:string;provider:string;providerDigest:string};
export type StoredDependencyBinding=Omit<DependencyBinding,'consumer'>;
const bindingValidator=new Ajv2020({strict:true}).compile<StoredDependencyBinding[]>({type:'array',maxItems:512,items:{type:'object',additionalProperties:false,required:['interface','provider','providerDigest'],properties:{interface:{type:'string',minLength:1,maxLength:240},provider:{type:'string',minLength:1,maxLength:240},providerDigest:{type:'string',pattern:'^[0-9a-f]{64}$'}}}});
export function validateDependencyBindings(value:unknown):StoredDependencyBinding[] {if(!bindingValidator(value) || new Set(value.map(binding=>binding.interface)).size!==value.length) throw new PlatformError('invalid-dependency-lock');return value;}
export function resolveDependencyGraph(packages:readonly DependencyPackage[],selections:ReadonlyMap<string,string>):{order:string[];bindings:DependencyBinding[]} {
  const byId=new Map<string,DependencyPackage>();
  for(const pkg of packages) {validateManifest(pkg.manifest);if(!/^[0-9a-f]{64}$/.test(pkg.digest)) throw new PlatformError('invalid-dependency-digest');if(byId.has(pkg.manifest.id)) throw new PlatformError('dependency-version-conflict');byId.set(pkg.manifest.id,pkg);}
  const order:string[]=[],bindings:DependencyBinding[]=[],active=new Set<string>(),visited=new Set<string>();
  function visit(id:string):void {if(visited.has(id)) return;if(active.has(id)) throw new PlatformError('dependency-cycle');const pkg=byId.get(id);if(!pkg) throw new PlatformError('missing-dependency');active.add(id);
    for(const requirement of pkg.manifest.requires) {const providerId=selections.get(`${id}:${requirement}`);if(!providerId) throw new PlatformError('unselected-dependency');const provider=byId.get(providerId);if(!provider || !provider.manifest.provides.includes(requirement)) throw new PlatformError('incompatible-dependency');bindings.push({consumer:id,interface:requirement,provider:providerId,providerDigest:provider.digest});visit(providerId);}
    active.delete(id);visited.add(id);order.push(id);
  }
  for(const pkg of packages) visit(pkg.manifest.id);return {order,bindings};
}
