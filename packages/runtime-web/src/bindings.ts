import ts from 'typescript-compiler-api';
import {PlatformError} from '../../contracts/src/errors.ts';
/** Compare maintained-tool generated declarations structurally, independently of declaration order. */
export function canonicalBindings(text:string):string{
 const source=ts.createSourceFile('bindings.d.ts',text,ts.ScriptTarget.Latest,true),printer=ts.createPrinter({removeComments:true,newLine:ts.NewLineKind.LineFeed});
 const declarations=source.statements.map(statement=>{if(!(ts.isInterfaceDeclaration(statement)||ts.isTypeAliasDeclaration(statement)||ts.isFunctionDeclaration(statement))||!statement.name)throw new PlatformError('unknown-world');return {name:statement.name.text,text:printer.printNode(ts.EmitHint.Unspecified,statement,source)};});
 if(new Set(declarations.map(declaration=>declaration.name)).size!==declarations.length)throw new PlatformError('unknown-world');return JSON.stringify(declarations.sort((a,b)=>a.name.localeCompare(b.name)));
}
