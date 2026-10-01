import { createRoot } from 'react-dom/client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { usePluginClient } from '../../../../packages/sdk-react/src/index.ts';

type Note = {id: string; title: string; text: string; format: 'paragraph' | 'heading' | 'bullet'; bold: boolean; italic: boolean};
type NoteIndex = {id: string; title: string}[];
type AiCheckpoint={runId:string;prompt:string;answer:string;model:string;cursor:number;state:'running'|'partial'|'completed'|'cancelled'|'failed';startedAt?:string};
const noteSchema=z.strictObject({id:z.string().regex(/^[a-zA-Z0-9-]+$/),title:z.string().max(100),text:z.string().max(131072),format:z.enum(['paragraph','heading','bullet']),bold:z.boolean(),italic:z.boolean()});
const indexSchema=z.array(z.strictObject({id:z.string().regex(/^[a-zA-Z0-9-]+$/),title:z.string().max(100)})).max(1000);
const aiSchema=z.strictObject({runId:z.string().max(240),prompt:z.string().max(131072),answer:z.string().max(131072),model:z.string().max(240),cursor:z.number().int().nonnegative(),state:z.enum(['running','partial','completed','cancelled','failed']),startedAt:z.string().max(40).optional()});
function noteValid(value:unknown):value is Note{return noteSchema.safeParse(value).success;}
function indexValid(value:unknown):value is NoteIndex{return indexSchema.safeParse(value).success;}
const blank = (): Note => ({id: crypto.randomUUID(), title:'Untitled note', text:'', format:'paragraph', bold:false, italic:false});

function Notebook() {
  const {client, error, context,navigation} = usePluginClient();
  const [note,setNote] = useState<Note>(blank);
  const [index,setIndex] = useState<NoteIndex>([]);
  const indexRef=useRef<NoteIndex>([]);
  const latestNote=useRef(note);latestNote.current=note;
  const [status,setStatus] = useState('Opening local notes…');
  const [ready,setReady] = useState(false);
  const [preview,setPreview] = useState(false);
  const [analysis,setAnalysis] = useState('');
  const [ai,setAi] = useState(false);
  const [prompt,setPrompt] = useState('');
  const [answer,setAnswer] = useState('');
  const [runId,setRunId] = useState('');
  const [models,setModels] = useState<{slug:string;displayName:string}[]>([]);
  const [model,setModel] = useState('');
  const [canResume,setCanResume]=useState(false);
  const past = useRef<Note[]>([]), future = useRef<Note[]>([]);
  const writeQueue = useRef(Promise.resolve());
  const opened = useRef(false);
  const aiCheckpoint=useRef<AiCheckpoint|null>(null);
  const aiWriteQueue=useRef(Promise.resolve());
  const saveAi=(value:AiCheckpoint)=>{
    if(!client)return Promise.reject(new Error('Plugin connection unavailable'));
    aiWriteQueue.current=aiWriteQueue.current.catch(()=>undefined).then(async()=>{await client.call('storage.put',{key:'notes/ai',value});});
    void aiWriteQueue.current.catch(reason=>setStatus(`AI output checkpoint failed: ${reason instanceof Error?reason.message:'storage unavailable'}`));
    return aiWriteQueue.current;
  };
  useEffect(()=>{if(!context?.models)return;const catalogue=context.models;setModels(catalogue);setModel(current=>catalogue.some(item=>item.slug===current)?current:catalogue[0]?.slug??'');},[context]);
  useEffect(()=>{if(navigation)setAi(navigation==='ai');},[navigation]);
  useEffect(()=>{if(!ready)return;const frame=requestAnimationFrame(()=>performance.mark('pwacloud-ui-ready'));return()=>cancelAnimationFrame(frame);},[ready]);
  const navigateView=async(view:'ai'|'editor')=>{try{if(!client)throw new Error('Plugin connection unavailable');await client.call('ui.navigate',{route:view});setAi(view==='ai');}catch(reason){setStatus(`Navigation unavailable: ${reason instanceof Error?reason.message:'host unavailable'}`);}};

  useEffect(() => {
    if (!client) return;
    let active = true;
    void Promise.all([client.call('storage.get',{key:'notes/index'}),client.call('storage.get',{key:'notes/selected'}),client.call('storage.get',{key:'host/checkpoint'}),client.call('storage.get',{key:'notes/ai'})]).then(([savedIndex, selected, checkpoint, savedAi]) => {
      if (!active) return;
      if(indexValid(savedIndex)){indexRef.current=savedIndex;setIndex(savedIndex);}
      if(noteValid(selected)) setNote(selected);
      if(typeof checkpoint==='object'&&checkpoint!==null&&'dirty' in checkpoint&&checkpoint.dirty===true&&'draft' in checkpoint&&noteValid(checkpoint.draft)){setNote(checkpoint.draft);opened.current=true;}
      const parsedAi=aiSchema.safeParse(savedAi);
      if(parsedAi.success){aiCheckpoint.current=parsedAi.data;setPrompt(parsedAi.data.prompt);setAnswer(parsedAi.data.answer);setModel(parsedAi.data.model);setCanResume(['running','partial'].includes(parsedAi.data.state));}
      setReady(true); setStatus('Local notes ready');
    }).catch(reason => setStatus(`Storage unavailable: ${reason instanceof Error ? reason.message : 'denied'}`));
    const unsubscribe = client.subscribe(event => {
      if(typeof event !== 'object' || event === null || !('type' in event)) return;
      if(event.type==='ai.event' && 'event' in event && typeof event.event==='object' && event.event!==null) {
        const value=event.event;
        const checkpoint=aiCheckpoint.current;
        if(!checkpoint||!('runId' in value)||value.runId!==checkpoint.runId||!('sequence' in value)||typeof value.sequence!=='number'||!Number.isSafeInteger(value.sequence)||value.sequence<=checkpoint.cursor)return;
        checkpoint.cursor=value.sequence;
        if('type' in value && value.type==='delta' && 'data' in value && typeof value.data==='object' && value.data!==null && 'text' in value.data && typeof value.data.text==='string') {const delta=value.data.text;checkpoint.answer=(checkpoint.answer+delta).slice(0,131072);setAnswer(checkpoint.answer);}
        const terminal='type' in value&&(value.type==='completed'||value.type==='cancelled'||value.type==='failed');
        if('type' in value && (value.type==='completed'||value.type==='cancelled'||value.type==='failed')) {checkpoint.state=value.type;setCanResume(false);setRunId('');}
        if('type' in value&&value.type==='interrupted'){checkpoint.state='partial';setCanResume(true);setRunId('');setStatus('Transport interrupted. Saved partial output remains available. Resume this run explicitly.');}
        const saved=saveAi({...checkpoint});if(terminal)void saved.then(()=>setStatus(`AI ${checkpoint.state}`)).catch(reason=>setStatus(`AI output was not saved: ${reason instanceof Error?reason.message:'storage unavailable'}`));
      }
    });
    return () => {active=false;unsubscribe();};
  },[client]);

  const save = useCallback((value:Note, all:NoteIndex):Promise<void> => {
    if(!client) return Promise.reject(new Error('Connection unavailable'));
    const current=writeQueue.current.catch(()=>undefined).then(async()=> {
      await client.call('storage.put',{key:`notes/document/${value.id}`,value});
      await client.call('storage.put',{key:'notes/index',value:all});
      await client.call('storage.put',{key:'notes/selected',value});
      if(latestNote.current===value)await client.call('ui.checkpoint',{value:{dirty:false,documentId:value.id}});
    });
    writeQueue.current=current;
    return current;
  },[client]);
  useEffect(()=> {
    if(!ready) return;
    if(!opened.current){opened.current=true;return;}
    setStatus('Saving locally…');
    void client?.call('ui.checkpoint',{value:{dirty:true,documentId:note.id,draft:note}}).catch(reason=>setStatus(`Draft checkpoint failed: ${reason instanceof Error?reason.message:'storage unavailable'}`));
    const next=[...indexRef.current.filter(item=>item.id!==note.id),{id:note.id,title:note.title}];indexRef.current=next;setIndex(next);
    const timer=setTimeout(()=> {void save(note,next).then(()=> {if(latestNote.current===note)setStatus('Saved on this device');}).catch(reason=>setStatus(`Not saved: ${reason instanceof Error ? reason.message : 'storage failure'}`));},250);
    return ()=>clearTimeout(timer);
  },[note,ready,save]);
  const change=(patch:Partial<Note>)=> {past.current.push(note);past.current=past.current.slice(-50);future.current=[];setNote({...note,...patch});};
  const undo=()=> {const previous=past.current.pop();if(previous){future.current.push(note);setNote(previous);}};
  const redo=()=> {const next=future.current.pop();if(next){past.current.push(note);setNote(next);}};
  const open=async(id:string)=> {
    await save(note,[...indexRef.current.filter(item=>item.id!==note.id),{id:note.id,title:note.title}]);
    const value=await client?.call('storage.get',{key:`notes/document/${id}`});
    if(noteValid(value)){setNote(value);past.current=[];future.current=[];} else setStatus('The saved document is invalid. Export it from host settings for recovery.');
  };
  const newNote=async()=>{await save(note,[...indexRef.current.filter(item=>item.id!==note.id),{id:note.id,title:note.title}]);past.current=[];future.current=[];setNote(blank());};
  const analyze=async()=> {
    try {const result=await client?.call('commands.invoke',{command:'analyze',text:note.text});setAnalysis(JSON.stringify(result));setStatus('Analysis completed by the local Wasm service');}
    catch(reason){setStatus(`Analysis unavailable: ${reason instanceof Error ? reason.message : 'operation failed'}`);}
  };
  const startAi=async()=> {
    if(!client || !model) {setStatus('Connect an authorized personal runtime or enable labeled demo AI in host Settings.');return;}
    try {
      setAnswer('');
      const result=await client.call('ai.start',{model,prompt,requestId:crypto.randomUUID(),documentHandles:[]});
      if(typeof result!=='object'||!result||!('runId' in result)||typeof result.runId!=='string') throw new Error('Invalid runtime response');
      const checkpoint:AiCheckpoint={runId:result.runId,prompt,answer:'',model,cursor:0,state:'running',startedAt:new Date().toISOString()};aiCheckpoint.current=checkpoint;saveAi(checkpoint);setRunId(result.runId);setCanResume(false);setStatus('AI running');
      void client.call('ai.subscribe',{runId:result.runId,after:0}).catch(reason=>{checkpoint.state='partial';saveAi({...checkpoint});setRunId('');setCanResume(true);setStatus(`Stream interrupted: ${reason instanceof Error?reason.message:'unavailable'}. Partial output saved.`);});
    } catch(reason) {setStatus(`AI unavailable: ${reason instanceof Error ? reason.message : 'operation failed'}`);}
  };
  const stopAi=async()=> {if(client&&runId)try{await client.call('ai.cancel',{runId});setStatus('Cancellation requested');}catch(reason){setStatus(`Stop failed: ${reason instanceof Error ? reason.message : 'unavailable'}`);}};
  const resumeAi=async()=>{const checkpoint=aiCheckpoint.current;if(!client||!checkpoint)return;setRunId(checkpoint.runId);setCanResume(false);setStatus('Resuming existing run from its saved event cursor…');try{await client.call('ai.subscribe',{runId:checkpoint.runId,after:checkpoint.cursor});}catch(reason){setRunId('');setCanResume(true);setStatus(`Resume unavailable: ${reason instanceof Error?reason.message:'operation failed'}. No new inference was submitted.`);}};
  return <main aria-label="Notebook app">
    <h1>Notebook</h1>
    <p className="muted">Private local notes · changes save on this device</p>
    <label>Document<select aria-label="Document" value={note.id} onChange={event=>void open(event.target.value).catch(reason=>setStatus(String(reason)))}><option value={note.id}>{note.title}</option>{index.filter(item=>item.id!==note.id).map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
    <button onClick={()=>void newNote().catch(reason=>setStatus(`Not saved: ${reason instanceof Error?reason.message:'storage unavailable'}`))}>New note</button>
    {!ai ? <>
      <label>Title<input maxLength={100} value={note.title} onChange={event=>change({title:event.target.value})}/></label>
      <div className="toolbar" aria-label="Formatting"><button aria-pressed={note.bold} onClick={()=>change({bold:!note.bold})}>Bold</button><button aria-pressed={note.italic} onClick={()=>change({italic:!note.italic})}>Italic</button><select aria-label="Block format" value={note.format} onChange={event=>{const value=event.target.value;if(value==='paragraph'||value==='heading'||value==='bullet')change({format:value});}}><option value="paragraph">Paragraph</option><option value="heading">Heading</option><option value="bullet">List</option></select><button onClick={undo}>Undo</button><button onClick={redo}>Redo</button></div>
      <button aria-pressed={preview} onClick={()=>setPreview(!preview)}>{preview?'Edit note':'Preview formatting'}</button>
      {preview ? <article className="preview" style={{fontWeight:note.bold?'bold':'normal',fontStyle:note.italic?'italic':'normal'}}>{note.format==='heading'?<h2>{note.text}</h2>:note.format==='bullet'?<ul>{note.text.split('\n').map((line,i)=><li key={i}>{line}</li>)}</ul>:<p>{note.text || 'Your note is empty.'}</p>}</article> : <label className="editor-label">Note text<textarea aria-label="Note text" maxLength={131072} className="editor" value={note.text} onChange={event=>change({text:event.target.value})}/></label>}
      <div className="toolbar"><button onClick={()=>void analyze()}>Analyze with Wasm</button><button onClick={()=>navigateView('ai')}>AI composer</button></div>
      {analysis&&<output className="analysis" aria-label="Wasm analysis">{analysis}</output>}
    </> : <section><h2>AI composer</h2><p className="muted">Only the prompt below is sent. Demo output, when enabled, is synthetic.</p><label>Model<select value={model} onChange={event=>setModel(event.target.value)}><option value="">No runtime catalogue available</option>{models.map(item=><option key={item.slug} value={item.slug}>{item.displayName}</option>)}</select></label><label>Prompt<textarea value={prompt} onChange={event=>setPrompt(event.target.value)} maxLength={131072}/></label><div className="toolbar"><button disabled={Boolean(runId)} onClick={()=>void startAi()}>Send</button><button disabled={!runId} onClick={()=>void stopAi()}>Stop</button>{canResume&&<button onClick={()=>void resumeAi()}>Resume existing run</button>}<button onClick={()=>navigateView('editor')}>Back to editor</button></div><pre className="answer" aria-live="polite">{answer}</pre></section>}
    <p className="status" role="status">{error||status}</p>
  </main>;
}
const root=document.getElementById('root');if(root)createRoot(root).render(<Notebook/>);
