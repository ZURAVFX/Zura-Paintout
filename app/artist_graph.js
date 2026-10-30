/** Native, editable Paintout stages. Inference stays in the original native nodes. */
let promotionApi;
async function nativePromotionApi() {
  if (!promotionApi) promotionApi=(async()=>{
    // Resolve the current frontend export rather than pinning a build hash/alias.
    const assets=performance.getEntriesByType('resource').map(entry=>entry.name)
      .filter(url=>new URL(url).origin===location.origin&&/\/assets\/[^/]+\.js(?:$|\?)/.test(url));
    // Promotion moved between frontend chunks; discover its exported symbol
    // from the current loaded build rather than relying on a chunk name.
    for(const url of [...new Set(assets)]){
      let response;try{response=await fetch(url);}catch{continue;}if(!response.ok)continue;
      const code=await response.text(),alias=code.match(/\bpromoteWidget as ([\w$]+)/)?.[1],orderAlias=code.match(/\breorderSubgraphInputsByWidgetOrder as ([\w$]+)/)?.[1];
      if(!alias)continue;
      const module=await import(url);if(typeof module[alias]==='function')return {promote:module[alias],orderInputs:module[orderAlias]};
    }
    throw new Error('This ComfyUI frontend does not expose native widget promotion.');
  })().catch(error=>{promotionApi=null;throw error;});
  return promotionApi;
}

function splitClipBranches(graph){
  const take=graph.nodes.find(n=>String(n.id)==='take');if(!take)return {};
  const plate=graph.links.get(take.inputs[0].link),source=graph.getNodeById(plate.origin_id),result={};
  for(const [name,targets]of [['Text timing',['conditioning']],['Video timing',['latent']],['Audio timing',['audio']]]){
    const duplicate=globalThis.LiteGraph.createNode('ZuraPaintoutTake');graph.add(duplicate);duplicate.title=name;
    source.connect(plate.origin_slot,duplicate,0);
    for(const link of [...graph.links.values()])if(String(link.origin_id)===String(take.id)&&targets.includes(String(link.target_id)))duplicate.connect(link.origin_slot,graph.getNodeById(link.target_id),link.target_slot);
    result[name]=String(duplicate.id);
  }
  return result;
}
function arrange(graph) {
  const nodes=[...graph.nodes], byId=new Map(nodes.map(node=>[String(node.id),node]));
  const depth=new Map(), visiting=new Set(),links=[...graph.links.values()];
  const level=node=>{
    const id=String(node.id);
    if(depth.has(id))return depth.get(id);
    if(visiting.has(id))return 0;
    visiting.add(id);
    const parents=links.filter(link=>String(link.target_id)===id).map(link=>byId.get(String(link.origin_id))).filter(Boolean);
    const value=parents.length?1+Math.max(...parents.map(level)):0;
    visiting.delete(id);depth.set(id,value);return value;
  };
  const columns=new Map();
  for(const node of nodes){const column=level(node);if(!columns.has(column))columns.set(column,[]);columns.get(column).push(node);}
  let x=120;
  for(const [,column]of [...columns].sort(([a],[b])=>a-b)){
    let y=100,width=320;
    for(const node of column){node.size=[Math.max(300,node.size[0]),Math.max(node.size[1],node.computeSize?.()[1]||0)];node.pos=[x,y];width=Math.max(width,node.size[0]);y+=node.size[1]+100;}
    x+=width+180;
  }
  if(graph.inputNode){graph.inputNode.pos=[-140,100];graph.inputNode.arrange();}
  if(graph.outputNode){graph.outputNode.pos=[x+50,100];graph.outputNode.arrange();}
}

function stage(graph,ids,title) {
  const nodes=graph.nodes.filter(node=>ids.includes(String(node.id)));
  if(!nodes.length)return null;
  const result=graph.convertToSubgraph(new Set(nodes));
  result.node.title=title;result.subgraph.name=title;
  return result;
}

function reorderInputs(host,order){
 const sub=host.subgraph;
 const snapshot=sub.inputs.map((slot,index)=>({name:slot.name,type:slot.type,
  internal:slot.getLinks().map(link=>({node:sub.getNodeById(link.target_id),slot:link.target_slot})),
  external:host.inputs[index].link==null?null:host.graph.links.get(host.inputs[index].link)}));
 for(const slot of [...sub.inputs].reverse())sub.removeInput(slot);
 for(const index of order){const entry=snapshot[index],slot=sub.addInput(entry.name,entry.type);
  for(const old of entry.internal)slot.connect(old.node.inputs[old.slot],old.node);
  const link=entry.external;if(link)host.graph.getNodeById(link.origin_id).connect(link.origin_slot,host,sub.inputs.indexOf(slot));
 }
}
function samplingModelAncestors(graph){
 const sampler=graph.nodes.find(n=>String(n.id)==='sample'),ids=new Set(),visit=node=>{if(!node||ids.has(String(node.id)))return;ids.add(String(node.id));for(const input of node.inputs||[])if(input.link!=null&&(input.type==='MODEL'||input.name==='model')){const link=graph.links.get(input.link);if(link)visit(graph.getNodeById(link.origin_id));}};
 if(sampler)for(const input of sampler.inputs||[])if(input.link!=null&&(input.type==='MODEL'||input.name==='model')){const link=graph.links.get(input.link);if(link)visit(graph.getNodeById(link.origin_id));}
 return [...ids];
}
function reorderOutputs(host,rank){
 const sub=host.subgraph,snapshot=sub.outputs.map((slot,index)=>({name:slot.name,type:slot.type,
  internal:slot.getLinks().map(link=>({node:sub.getNodeById(link.origin_id),slot:link.origin_slot})),
  external:(host.outputs[index].links||[]).map(id=>host.graph.links.get(id)).filter(Boolean).map(link=>({node:host.graph.getNodeById(link.target_id),slot:link.target_slot}))}));
 const order=snapshot.map((v,i)=>i).sort((a,b)=>rank(snapshot[a].internal[0])-rank(snapshot[b].internal[0]));
 for(const slot of [...sub.outputs].reverse())sub.removeOutput(slot);
 for(const index of order){const e=snapshot[index],slot=sub.addOutput(e.name,e.type);for(const old of e.internal)slot.connect(old.node.outputs[old.slot],old.node);for(const old of e.external)host.connect(sub.outputs.indexOf(slot),old.node,old.slot);}
}
function find(graph,id){return graph.nodes.find(n=>String(n.id)===id||n.title===id);}
function move(graph,id,x,y){const n=find(graph,id);if(n)n.pos=[x,y];return n;}
function route(graph,origin,slot,target,points){const a=find(graph,origin),b=find(graph,target),link=[...graph.links.values()].find(l=>String(l.origin_id)===String(a?.id??origin)&&l.origin_slot===slot&&String(l.target_id)===String(b?.id??target));if(link)for(const p of points)graph.createReroute(p,link);}
function layoutStage(graph){
 const moves=rows=>{for(const [id,x,y]of rows)move(graph,id,x,y);};
 if(graph.name==='Prepare source'){
  moves([['Text conditioning',620,100],['Video samples',620,400],['Source images',620,650],['Audio samples',620,900]]);
  graph.inputNode.pos=[-220,100];graph.outputNode.pos=[1300,100];
 }
 if(graph.name==='Text conditioning'){
  moves([['text',120,100],['positive',720,100],['negative',720,400],['Text timing',120,800],['conditioning',1320,400]]);
  graph.inputNode.pos=[-220,400];graph.outputNode.pos=[1900,400];
 }
 if(graph.name==='Video samples')moves([['Video timing',120,100],['latent',720,100]]);
 if(graph.name==='Audio samples')moves([['audio_vae',120,100],['Audio timing',120,400],['audio',720,100]]);
 if(graph.name==='Source images'){moves([['take',120,100],['grow_mask',620,400],['block_mask',1120,400],['invert_mask',1620,400]]);graph.outputNode.pos=[Math.max(...graph.nodes.map(n=>n.pos[0]+n.size[0]))+380,100];}
 if(graph.name==='Video VAE')moves([['video_vae',120,100],['float_vae',720,100]]);
 if(graph.name==='Painted guides'){
  moves([['Video VAE',120,400],['guide',720,100],['apply_anchors',1320,100]]);
  graph.inputNode.pos=[-220,100];graph.outputNode.pos=[1900,100];
 }
 if(graph.name==='Generate paintout'){const n=find(graph,'sample');graph.inputNode.pos=[n.pos[0]-220,100];}
 if(graph.name==='Decode result'){
  moves([['separate',120,500],['crop_guides',720,100],['decode',1320,100]]);graph.inputNode.pos=[-220,100];graph.outputNode.pos=[1900,100];
 }
 graph.inputNode?.arrange();graph.outputNode?.arrange();
 if(graph.name==='Painted guides'){
  route(graph,'Video VAE',0,'apply_anchors',[[500,750],[1150,750]]);
  route(graph,'-10',5,'apply_anchors',[[0,850],[1200,850]]);
  route(graph,'Video VAE',0,'-20',[[500,500],[1800,500]]);
 }
 if(graph.name==='Decode result')route(graph,'-10',3,'decode',[[0,850],[1200,850]]);
 if(graph.name==='Text conditioning'){const timing=find(graph,'Text timing');if(timing)route(graph,String(timing.id),5,'conditioning',[[500,1100],[1250,1100]]);}
}
function layoutRoot(graph){
 let x=120;for(const id of ['mask_source','colour_check']){const n=find(graph,id);if(n){n.pos=[x,100];x+=Math.max(n.size[0],400)+180;}}
 const source=move(graph,'source',x,400),right=x+(source?.size[0]||510),prepX=right+300,paintX=prepX+850,genX=paintX+1100,decodeX=genX+550;
 move(graph,'Prepare source',prepX,100);move(graph,'anchors',prepX,900);move(graph,'Painted guides',paintX,100);move(graph,'combine',paintX+550,600);move(graph,'Generate paintout',genX,100);move(graph,'Decode result',decodeX,100);
 const save=find(graph,'repair_save')||find(graph,'save');if(save)save.pos=[decodeX+550,100];const hdr=find(graph,'Convert to HDR');if(hdr){hdr.pos=[save.pos[0]+save.size[0]+220,100];move(graph,'save',hdr.pos[0]+hdr.size[0]+220,100);}
 const floor=2000;
 route(graph,'source',2,find(graph,'repair_save')?'repair_save':'save',[[right+100,floor],[save.pos[0]-100,floor]]);
 route(graph,'Prepare source',5,'combine',[[prepX+420,700],[paintX+450,700]]);
 route(graph,'Painted guides',3,'Decode result',[[paintX+420,1200],[decodeX-100,1200]]);
 route(graph,'Painted guides',0,'Generate paintout',[[paintX+420,-220],[genX-100,-220]]);
 route(graph,'Painted guides',1,'Generate paintout',[[paintX+440,-170],[genX-120,-170]]);
 route(graph,'Painted guides',0,'Decode result',[[paintX+420,-220],[decodeX-100,-220]]);
 route(graph,'Painted guides',1,'Decode result',[[paintX+440,-170],[decodeX-120,-170]]);
}
/** Build editable native stages. API inference nodes and model settings stay intact. */
export async function tidyPaintoutArtistGraph(app,apiGraph){
 const graph=app.rootGraph||app.graph;if(!graph?.convertToSubgraph)throw Error('Update ComfyUI to open native Paintout stages.');if(graph.nodes.some(n=>n.subgraph))throw Error('Open a fresh Paintout graph before arranging its stages.');
 const frontend=await nativePromotionApi(),branches=splitClipBranches(graph);
 const prep=stage(graph,[...Object.values(branches),'text','positive','negative','conditioning','latent','audio_vae','audio','take','grow_mask','block_mask','invert_mask'],'Prepare source');
 const painted=stage(graph,['video_vae','float_vae','guide','apply_anchors'],'Painted guides');
 const generation=stage(graph,[...samplingModelAncestors(graph),'sample'],'Generate paintout');
 const decoder=stage(graph,['separate','crop_guides','decode'],'Decode result');if(decoder)reorderInputs(decoder.node,[1,2,0,3]);
 const hdr=stage(graph,Object.keys(apiGraph||{}).filter(id=>id.startsWith('hdr_')),'Convert to HDR');
 for(const [result,id,names]of [[prep,'positive',['text']],[generation,'sample',['seed','steps','cfg']],[hdr,'hdr_sample',['seed']]]){const inner=result?.subgraph.nodes.find(n=>String(n.id)===id);for(const name of names){const w=inner?.widgets?.find(w=>w.name===name);if(w)frontend.promote(inner,w,[result.node]);}}
 if(prep){
  reorderOutputs(prep.node,e=>e.node.id==='conditioning'?e.slot:e.node.id==='latent'?2:e.node.id==='take'&&e.slot===0?3:['invert_mask','take'].includes(String(e.node.id))?4:e.node.id==='audio'?5:9);
  const g=prep.subgraph,text=stage(g,[branches['Text timing'],'text','positive','negative','conditioning'],'Text conditioning');
  stage(g,[branches['Video timing'],'latent'],'Video samples');stage(g,[branches['Audio timing'],'audio_vae','audio'],'Audio samples');stage(g,['take','grow_mask','block_mask','invert_mask'],'Source images');
  if(text&&frontend.orderInputs){frontend.orderInputs(text.node,['positive','negative'].map(id=>find(text.subgraph,id)?.widgets?.find(w=>w.name==='text')).filter(Boolean));}
  const sourceLink=graph.links.get(prep.node.inputs.find(i=>i.name==='plate').link),samples=g.addInput('samples_plate','ZURA_PLATE');for(const name of ['Video samples','Audio samples','Source images']){const child=find(g,name);if(child)samples.connect(child.inputs.find(i=>i.name==='plate'),child);}
  graph.getNodeById(sourceLink.origin_id).connect(sourceLink.origin_slot,prep.node,g.inputs.indexOf(samples));
 }
 if(painted){reorderOutputs(painted.node,e=>e.node.id==='apply_anchors'?e.slot:3);stage(painted.subgraph,['video_vae','float_vae'],'Video VAE');}
 for(const g of graph.subgraphs.values())arrange(g);for(const g of graph.subgraphs.values())layoutStage(g);
 arrange(graph);app.canvas?.setGraph?.(graph);await new Promise(r=>setTimeout(r,250));layoutRoot(graph);graph.setDirtyCanvas?.(true,true);app.canvas?.fitView?.();return {stages:graph.subgraphs.size};
}

// Preserve the Studio entry point while using the native Paintout stages.
export const tidyArtistGraph = tidyPaintoutArtistGraph;
