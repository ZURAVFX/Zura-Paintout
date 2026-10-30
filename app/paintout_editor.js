import {maskIcons} from './paintout_icons.js';
import {PaintoutTimeline} from './paintout_timeline.js';
import {PaintoutMaskViewer} from './paintout_viewer.js';
import {buildFrameEditGraph,frameEditAvailability} from './paintout_frame_recipes.js';

const endpoint='/zura/paintout/editor';
const el=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
const number=(value,min,max)=>Math.max(min,Math.min(max,Math.round(Number(value)||0)));

export function paintoutDraft(saved={}){
  const draft={mode:'targeted',source:'',mask:'',anchors:[],startFrame:0,frameCount:81,sequenceFps:25,sourceColour:'srgb_display',processingSpace:'SDR (sRGB)',width:1152,height:640,resolutionMode:'default',megapixels:.75,outputMode:'SDR video',seed:42,maskSubject:'',maskGrow:0,maskFeather:0,editorStage:'mask',...saved};
  draft.maskFeather=0; // Repair masks stay hard, including drafts saved by earlier builds.
  draft.anchors=Array.isArray(draft.anchors)?draft.anchors:[];
  return draft;
}

export function maskGraph(config,info={}){
  const {project,revision,source,frame,startFrame,frameCount,colourSpace,operation,direction,selection,text,segmentId,tracked}=config;
  const graph={};
  const inputs={source,project,frame,start_frame:startFrame,frame_count:frameCount,colour_space:colourSpace,
    operation,direction,positive_coords:JSON.stringify(selection.positive||[]),negative_coords:JSON.stringify(selection.negative||[]),
    text:text||'',paint_mask:selection.hasMask?selection.mask:'',expected_revision:revision};
  if(segmentId){inputs.segment_id=segmentId;inputs.segment_tracked=tracked??frameCount>1;}
  if(operation!=='absent'&&(!selection.hasMask||frameCount>1)){
    const field=info.CheckpointLoaderSimple?.input?.required?.ckpt_name;
    const files=Array.isArray(field?.[0])?field[0]:field?.[1]?.options||[];
    const file=files.find(f=>/sam3\.1_multiplex_fp16\.safetensors$/i.test(f))||files.find(f=>/sam3.*\.safetensors$/i.test(f));
    if(!file||!info.SAM3_Detect||!info.SAM3_VideoTrack)throw Error('Install the native SAM3 checkpoint to use text and point selection. You can still paint a mask manually.');
    graph.mask_model={class_type:'CheckpointLoaderSimple',inputs:{ckpt_name:file},_meta:{title:'Loading subject selection'}};
    inputs.model=['mask_model',0];
    if(text&&!selection.positive?.length&&!selection.hasMask){
      graph.mask_text={class_type:'CLIPTextEncode',inputs:{clip:['mask_model',1],text},_meta:{title:'Finding the selected subject'}};
      inputs.conditioning=['mask_text',0];
    }
  }
  graph.mask_pass={class_type:'ZuraPaintoutMaskPass',inputs,_meta:{title:operation==='absent'?'Marking the subject absent':'Preparing the removal mask'}};
  return graph;
}

export class PaintoutEditor{
  constructor(workspace){
    this.w=workspace;this.stage='mask';this.active=false;this.project=null;this.revision=-1;this.document=null;
    this.sequence=0;this.saveSequence=0;this.previewSequence=0;this.closed=false;this.toolJob=workspace.state.editorJob||null;this.selectionDirty=false;this.candidate=null;this.maskEditVersion=0;this.autoPreviewPending=false;
    const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('./paintout_editor.css',import.meta.url).href;workspace.page.append(link);
    this.nav=el('nav');this.nav.className='zp-editor-stages';this.nav.setAttribute('aria-label','Paintout process');
    for(const [key,title] of [['trim','Trim clip'],['mask','Mask'],['clean','Clean frames'],['render','Render']]){
      const b=el('button',title);b.type='button';b.onclick=()=>this.setStage(key);b.dataset.stage=key;this.nav.append(b);
    }
    this.guide=el('div');this.guide.className='zp-editor-guide';this.guideTitle=el('strong');this.guideHelp=el('span');this.guide.append(this.guideTitle,this.guideHelp);this.nav.append(this.guide);
    workspace.page.querySelector('.zf-heading').after(this.nav);
    this.projects=el('details');this.projects.className='zp-editor-projects';this.projects.innerHTML='<summary>Projects</summary><div role="group" aria-label="Saved Paintout projects"></div>';workspace.page.querySelector('.zf-heading').append(this.projects);
    this.projects.ontoggle=async()=>{if(!this.projects.open)return;if(workspace.busy()){this.projects.open=false;return;}const list=this.projects.querySelector('div');list.textContent='Loading projectsâ€¦';try{const projects=await workspace.fetch(endpoint+'/projects');list.replaceChildren();for(const project of projects){const button=el('button',project.name+(project.frames?` Â· ${project.frames} frames`:''));button.type='button';button.title=project.source+' Â· '+new Date(project.updated*1000).toLocaleString();button.onclick=()=>this.openProject(project.id);list.append(button);}if(!projects.length)list.textContent='Add footage to start your first project.';}catch(e){list.textContent=e.message;}};
    this.viewerHost=el('div');this.viewerHost.className='zp-editor-viewer-host';this.viewerHost.hidden=true;
    workspace.page.querySelector('.zf-viewer').append(this.viewerHost);
    this.viewer=new PaintoutMaskViewer(this.viewerHost,{onCommit:()=>{if(this.stage==='mask')this.flushManual().catch(e=>this.status(e.message));else this.saveCleanMask();},onChange:change=>this.maskChanged(change)});
    this.timelineHost=el('div');this.timelineHost.className='zp-editor-timeline-host';workspace.page.querySelector('.zf-viewer').after(this.timelineHost);
    this.timeline=new PaintoutTimeline(this.timelineHost,{onAddMask:()=>this.beginMaskSegment('add').catch(e=>this.status(e.message)),onSegmentSelect:id=>this.selectMaskBar(id),onMaskTrim:(id,start,end)=>this.editMaskBar(id,{start,end}),onSegmentRemove:id=>this.editMaskBar(id,{delete:true}),onTrim:(start,end,commit)=>this.setTimelineRange(start,end,commit),onSeek:f=>workspace.seek(f),onCreate:f=>this.createFrame(f),onSelect:i=>this.selectFrame(i),onRemove:i=>this.removeFrame(i),onMaskSelect:async f=>{if(workspace.busy())return;await this.setStage('mask');workspace.seek(f);}});
    this.tools=el('section');this.tools.className='zp-editor-tools';this.tools.setAttribute('aria-label','Paintout editing tools');this.timelineHost.after(this.tools);
    this.tools.innerHTML=`<div class="zp-editor-mask-intro"><strong>Select, then track</strong><span>Everything covered in red will be removed. Leave anything you want to keep unmasked.</span><button type="button" data-editor="import-mask">Import mask video</button><span>Already have a mask? Import a black-and-white video. White removes, black keeps. Use the original footageâ€™s size, frame rate and full length.</span></div>
      <div class="zp-editor-tool-row"><div class="zp-editor-tool-group" role="group" aria-label="Mask tools"><button type="button" data-tool="include" title="Click on the subject to include it">${maskIcons['circle-plus']}<span>Select subject</span></button><button type="button" data-tool="exclude" title="Click on unwanted areas to exclude them">${maskIcons['circle-minus']}<span>Exclude area</span></button><button type="button" data-tool="brush" title="Draw the removal mask manually">${maskIcons.paintbrush}<span>Paint mask</span></button><button type="button" data-tool="protect" title="Erase from the removal mask">${maskIcons.eraser}<span>Erase mask</span></button><button type="button" data-tool="pan" title="Drag to move the view. Scroll to zoom.">${maskIcons.hand}<span>Pan</span></button></div><button type="button" data-editor="undo">${maskIcons['undo-2']}<span>Undo</span></button><button type="button" data-editor="clear">Clear selection</button></div>
      <div class="zp-editor-selection-row"><p class="zp-editor-tool-help" data-editor="tool-help"></p><button type="button" data-editor="selection" hidden aria-hidden="true" tabindex="-1">Update mask</button><p class="zp-editor-selection-cue" data-editor="selection-cue"></p></div>
      <div class="zp-editor-tool-row"><label data-editor="brush-control">Brush size <output data-editor="brush-value">32 px</output><input data-editor="brush" type="range" min="1" max="200" value="32" /></label><label title="Expand the hard removal boundary in original plate pixels">Expand mask <output data-editor="grow-value">0 px</output><input data-editor="grow" type="range" min="0" max="100" value="0" /></label><label title="Only changes how the red overlay is displayed, not the mask">Red overlay<input data-editor="opacity" type="range" min="0" max="100" value="45" /></label></div>
      <div class="zp-editor-mask-actions"><div class="zp-editor-track-guide" hidden><strong>Track the shot</strong><span data-editor="track-help">Check the red area, then track it through your trimmed shot.</span></div>
        <button type="button" class="zp-editor-primary" data-editor="track">Track mask through shot</button><button type="button" data-editor="continue">Next: clean frames</button>
        <div class="zp-editor-segment-actions" role="group" aria-label="Add or repair tracking"><button type="button" data-editor="repair-segment">Repair tracking from here</button><button type="button" data-editor="add-segment">Add another mask</button></div>
        <div class="zp-editor-segment-draft" data-editor="segment-draft" hidden><strong data-editor="segment-label"></strong><span data-editor="segment-help"></span><button type="button" data-editor="segment-seed">Go to selection frame</button><button type="button" data-editor="segment-cancel">Close segment editor</button></div>
        <details class="zp-editor-advanced" data-editor="tracking-options"><summary>Advanced tracking options</summary><p>By default, track both ways through the trimmed shot. Change the range or how this pass combines with your mask here.</p><div class="zp-editor-track-range"><label>From frame<input data-editor="range-start" type="number" min="0" step="1" /></label><button type="button" data-editor="range-in" title="Set the segment start to the playhead">Set In here</button><label>To frame<input data-editor="range-end" type="number" min="0" step="1" /></label><button type="button" data-editor="range-out" title="Set the segment end to the playhead">Set Out here</button><label>Direction<select data-editor="direction"><option value="both">Both ways from selection</option><option value="forward">Forward from selection</option><option value="backward">Backward from selection</option></select></label><label>Combine with saved mask<select data-editor="operation"><option value="replace">Replace this range</option><option value="add">Add to existing masks</option><option value="protect">Protect this region</option></select></label></div></details>

        <details class="zp-editor-segments"><summary data-editor="segments-label">Tracking segments</summary><ol data-editor="segments"></ol></details>
        <details><summary>Absence / mask history</summary><div class="zp-editor-tool-row"><button type="button" data-editor="absent">Subject absent in section</button><button type="button" data-editor="previous-mask">Previous mask pass</button><button type="button" data-editor="next-mask">Next mask pass</button></div></details></div>
      <div class="zp-editor-clean-actions" hidden><strong data-editor="frame-label">Add a clean frame on the timeline</strong><label class="zp-editor-description">Replacement background<input data-editor="instruction" value="Remove the selected object and reconstruct the background." /></label><button type="button" class="zp-editor-primary" data-editor="clean">Clean with FLUX 3</button><button type="button" data-editor="download">Download original</button><button type="button" data-editor="reference" hidden>Download frame reference</button><button type="button" data-editor="import">Import edited frame</button><label data-editor="version-control" hidden>Saved version<select data-editor="version" aria-label="Saved clean-frame version"></select></label><button type="button" data-editor="accept" hidden>Use clean frame</button><button type="button" data-editor="reject" hidden>Discard result (X)</button></div>
      <p data-editor="status" role="status" aria-live="polite"></p><div data-editor="job" hidden><progress aria-label="Mask or frame processing progress"></progress><span data-editor="job-label">Queued</span><button type="button" data-editor="cancel">Cancel this run</button></div>`;
    const nextRender=el('button','Next: render');nextRender.type='button';nextRender.dataset.editor='render-next';nextRender.onclick=()=>this.setStage('render');this.tools.querySelector('.zp-editor-clean-actions').append(nextRender);
    this.$('instruction').placeholder='e.g. Empty asphalt road with matching lane markings.';
    this.$('instruction').title='Describe what should replace the painted object. For example: empty road, continuing the existing lane markings and lighting.';
    const viewerToolbar=this.tools.querySelector('.zp-editor-tool-row');
    const maskFlow=el('div');maskFlow.className='zp-editor-mask-flow';
    const selectionRow=this.tools.querySelector('.zp-editor-selection-row'),maskActions=this.tools.querySelector('.zp-editor-mask-actions');
    this.tools.querySelector('.zp-editor-mask-intro').after(maskFlow);
    const maskSettings=selectionRow.nextElementSibling;
    maskFlow.append(selectionRow,maskActions,maskSettings,this.tools.querySelector('[data-editor=job]'),this.tools.querySelector('[data-editor=status]'));
    this.trimTools=el('section');this.trimTools.className='zp-editor-trim-tools';this.trimTools.hidden=true;this.trimTools.innerHTML='<div><strong>Choose the clip to repair</strong><p>Drag the In and Out handles to choose the part you want to repair. Click Use trimmed clip when you are ready.</p><span data-trim-summary></span></div><button type="button">Use trimmed clip</button>';this.tools.after(this.trimTools);this.trimTools.querySelector('button').onclick=()=>this.confirmClipTrim();
    this.viewerToolbar=viewerToolbar;
    this.viewerToolbar.className='zp-editor-viewer-toolbar';
    this.viewerToolbar.setAttribute('role','group');this.viewerToolbar.setAttribute('aria-label','Frame editing tools');
    this.viewerHost.prepend(this.viewerToolbar);
    const toolsGroup=this.viewerToolbar.querySelector('.zp-editor-tool-group');
    for(const [name,keys]of [['Select',['include','exclude']],['Paint',['brush','protect']],['View',['pan']]]){
      const group=el('div');group.className='zp-editor-toolbar-group';group.setAttribute('role','group');group.setAttribute('aria-label',name);
      for(const key of keys)group.append(toolsGroup.querySelector(`[data-tool=${key}]`));
      toolsGroup.append(group);
    }
    maskSettings.className='zp-editor-mask-sizing';this.viewerToolbar.append(maskSettings);
    this.$('import-mask').title='Import a black-and-white mask video: white removes, black keeps. Match the plate dimensions, frame rate and length.';
    const resetMaskEdit=el('button','Reset frame edit');resetMaskEdit.type='button';resetMaskEdit.dataset.editor='reset-mask-edit';resetMaskEdit.hidden=true;resetMaskEdit.title='Remove this frameâ€™s mask correction and restore the tracked mask';resetMaskEdit.onclick=()=>this.resetMaskFrame();this.$('clear').after(resetMaskEdit);
    this.$('undo').title='Undo the last edit';this.$('clear').title='Clear the mask and selection on this frame';
    this.tools.querySelector('.zp-editor-segment-actions').dataset.timelineOnly='true';
    this.tools.querySelector('.zp-editor-segments').dataset.timelineOnly='true';
    this.tools.querySelector('.zp-editor-advanced').dataset.timelineOnly='true';
    this.$('absent').closest('details').dataset.timelineOnly='true';
    this.subjectChoices=el('section');this.subjectChoices.className='zp-editor-subject-choices';this.subjectChoices.hidden=true;this.subjectChoices.setAttribute('aria-label','Choose the subject to remove');this.tools.querySelector('.zp-editor-mask-intro').after(this.subjectChoices);
    this.$('opacity').closest('label').hidden=true;
    this.$('import-mask').onclick=()=>workspace.pickMask();
    this.maskSummary=el('div');this.maskSummary.className='zp-editor-mask-summary';this.maskSummary.innerHTML='<span></span><button type="button">Review mask</button>';this.maskSummary.querySelector('button').onclick=()=>this.setStage('mask');workspace.$('mask-control')?.after(this.maskSummary);
    workspace.state.maskFeather=0;this.$('grow').value=workspace.state.maskGrow??0;this.$('grow').oninput=()=>this.morph(false);this.$('grow').onchange=()=>this.morph(true);
    for(const b of this.viewerToolbar.querySelectorAll('[data-tool]'))b.onclick=()=>{this.viewer.setTool(b.dataset.tool);this.tool=b.dataset.tool;this.updateControls();};
    this.tool='include';this.viewer.setTool(this.tool);this.$('brush').oninput=()=>{this.viewer.setBrushSize(Number(this.$('brush').value));this.$('brush-value').textContent=this.$('brush').value+' px';};this.viewer.setBrushSize(32);
    this.$('opacity').oninput=()=>this.viewer.setOpacity(Number(this.$('opacity').value)/100);
    this.$('undo').onclick=()=>{this.viewer.undo();if(this.stage==='clean')this.saveCleanMask();if(this.stage==='mask'&&this.manualDirty)this.flushManual().catch(e=>this.status(e.message));};this.$('clear').onclick=()=>this.clearSelection();
    this.$('continue').onclick=()=>this.setStage('clean');this.$('selection').onclick=()=>this.runMask(true);this.$('track').onclick=()=>this.runMask(false);this.$('absent').onclick=()=>this.runMask(false,'absent');
    for(const field of ['range-start','range-end','direction','operation'])this.$(field).onchange=()=>{this.customRange=true;this.saveSegmentRange();this.updateControls();};
    this.$('repair-segment').onclick=()=>this.beginMaskSegment('replace').catch(error=>this.status(error.message));
    this.$('add-segment').onclick=()=>this.beginMaskSegment('add').catch(error=>this.status(error.message));
    this.$('segment-cancel').onclick=()=>this.finishMaskSegment().catch(error=>this.status(error.message));
    this.$('segment-seed').onclick=()=>{const segment=this.maskSegment();if(segment)this.w.seek(segment.frame);};
    for(const [key,field]of [['range-in','range-start'],['range-out','range-end']])this.$(key).onclick=()=>{this.$(field).value=this.w.playhead;this.customRange=true;this.saveSegmentRange();this.updateControls();};
    this.$('previous-mask').onclick=()=>this.selectMask(-1);this.$('next-mask').onclick=()=>this.selectMask(1);
    this.maskReview=el('div');this.maskReview.className='zp-editor-mask-review';this.maskReview.hidden=true;this.maskReview.innerHTML='<span data-editor="review-count"></span><button type="button" data-editor="review-next">Review next change</button><small data-editor="review-reason"></small>';this.tools.querySelector('.zp-editor-mask-actions').append(this.maskReview);this.$('review-next').onclick=()=>this.nextMaskReview().catch(error=>this.status(error.message));
    this.$('instruction').oninput=()=>{const anchor=this.selected();if(anchor){anchor.editPrompt=this.$('instruction').value;this.w.save();}};this.$('clean').onclick=()=>this.cleanFrame();this.$('accept').onclick=()=>this.acceptFrame();this.$('reject').onclick=()=>this.discardFrame();
    this.$('version').onchange=()=>this.selectVersion(this.$('version').value);
    this.$('reference').onclick=()=>{const a=this.selected();if(!a?.exportReference)return;const blob=new Blob([JSON.stringify(a.exportReference,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=el('a');link.href=url;link.download=`${this.project}_frame_${String(a.frame).padStart(6,'0')}.reference.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};this.$('download').onclick=()=>this.downloadFrame();this.$('import').onclick=()=>this.importFrame();this.$('cancel').onclick=()=>this.cancel();
    this.importReview=el('section');this.importReview.className='zp-editor-import-review';this.importReview.hidden=true;
    this.importReview.innerHTML='<strong>Review imported edit</strong><p data-editor="import-differences"></p><div><button type="button" data-editor="import-current">Keep current repair area</button><button type="button" class="zp-editor-primary" data-editor="import-include">Include highlighted edits</button></div><small>This changes this clean guide only. Your video removal mask stays as set in Mask.</small>';
    // Keep native text selection and editing shortcuts out of graph handlers.
    for(const type of ['pointerdown','pointerup','mousedown','mouseup','click','dblclick','keydown','keyup','selectstart','copy','cut','paste'])this.tools.addEventListener(type,event=>{if(event.target.closest?.('input,textarea,[contenteditable=true]'))event.stopPropagation();});
    this.tools.append(this.importReview);this.$('import-current').onclick=()=>this.acceptImported('current');this.$('import-include').onclick=()=>this.acceptImported('include');
    const compare=el('button','Show original');compare.type='button';compare.dataset.editor='compare';this.tools.querySelector('.zp-editor-clean-actions').append(compare);
    compare.onclick=()=>this.compareFrame();
    this.discardShortcut=event=>{if(event.key.toLowerCase()!=='x'||event.ctrlKey||event.metaKey||event.altKey||event.repeat||event.target.closest?.('input,textarea,select,[contenteditable=true]'))return;if(!workspace.page.isConnected||workspace.page.closest('[hidden]')||this.stage!=='clean'||!this.candidate||workspace.busy())return;event.preventDefault();this.discardFrame();};
    document.addEventListener('keydown',this.discardShortcut);

    this.viewerHost.ondragover=e=>{e.preventDefault();};this.viewerHost.ondrop=e=>{e.preventDefault();const file=e.dataTransfer?.files?.[0];if(file)this.importDropped(file);};
    workspace.api.addEventListener?.('executing',event=>{
      const d=event.detail,job=this.toolJob;if(!job||!d?.node||(d.prompt_id&&d.prompt_id!==job.id)||!job.stages[d.node])return;
      job.node=d.node;job.phase=job.stages[d.node];this.jobProgress=null;this.$('job-label').textContent=job.phase;this.$('job').querySelector('progress').removeAttribute('value');
    });
    workspace.api.addEventListener?.('progress',event=>{
      const d=event.detail,job=this.toolJob;if(!job||(d?.prompt_id?d.prompt_id!==job.id:!job.node)||!Number.isFinite(d.value)||!Number.isFinite(d.max)||d.max<=0)return;
      const bar=this.$('job').querySelector('progress');bar.max=d.max;bar.value=d.value;this.jobProgress=true;
      this.$('job-label').textContent=`${job.stages[d.node||job.node]||job.phase||'Processing'} Â· ${Math.round(d.value/d.max*100)}%`;
    });
    this.morph(false);this.update();
  }
  $(key){return this.tools.querySelector(`[data-editor="${key}"]`)||this.viewerToolbar?.querySelector(`[data-editor="${key}"]`);}
  status(message){this.$('status').textContent=message||'';}
  busy(){return !!(this.frameLoading||this.toolJob||this.maskStarting||this.submitting||this.loadingProject||this.openingProject||this.importing);}
  maskChanged(change){
    this.previewSequence++;this.maskEditVersion++;this.maskEditKind=change.kind;this.selectionDirty=true;this.candidate=null;
    if(this.stage==='mask'){
      if(change.kind==='paint'){
        this.autoPreviewPending=false;clearTimeout(this.autoPreviewTimer);
        const segment=this.maskSegment();
        if(segment&&segment.frame===this.viewer.frame){
          segment.paintDirty=true;segment.ready=this.viewer.getSelection(false).hasMask;this.selectionDirty=false;
        }else{this.manualDirty=true;this.manualVersion=(this.manualVersion||0)+1;}
      }else{
        this.autoPreviewPending=change.positive.length>0;
        clearTimeout(this.autoPreviewTimer);
        if(this.autoPreviewPending)this.scheduleMaskPreview();
        else if(!this.manualDirty){this.viewer.setMask(null);const segment=this.maskSegment();if(segment){segment.ready=false;segment.seedMask=null;segment.pendingMask=null;}this.selectionDirty=false;}
      }
    }
    this.viewer.setOpacity(Number(this.$('opacity').value)/100);this.updateControls();
  }
  scheduleMaskPreview(delay=250){
    clearTimeout(this.autoPreviewTimer);
    this.autoPreviewTimer=setTimeout(()=>this.previewMaskAutomatically(),delay);
  }
  async previewMaskAutomatically(){
    if(!this.autoPreviewPending||this.closed||this.stage!=='mask'||!this.active)return;
    if(this.toolJob||this.maskStarting||this.submitting||this.polling)return; // Queue only the newest selection after the current run finishes.
    if(this.w.busy()||this.manualSaving){this.scheduleMaskPreview(120);return;}
    if(!this.viewer.getSelection(false).positive.length){this.autoPreviewPending=false;return;}
    this.autoPreviewPending=false;await this.runMask(true);
  }
  trackingRange(){
    const state=this.w.state,start=state.startFrame,end=start+state.frameCount-1;
    const from=state.maskTrackStart==null?start:number(state.maskTrackStart,start,end),to=state.maskTrackEnd==null?end:number(state.maskTrackEnd,from,end);
    return {start:from,end:to};
  }
  setTimelineRange(start,end,commit){
    const w=this.w;if(this.stage==='trim'){
      w.state.startFrame=start;w.state.frameCount=end-start+1;
      if(w.$('start'))w.$('start').value=start;if(w.$('count'))w.$('count').value=end-start+1;
    }else if(this.stage==='mask'){
      const first=w.state.startFrame,last=first+w.state.frameCount-1;
      w.state.maskTrackStart=number(start,first,last);w.state.maskTrackEnd=number(end,w.state.maskTrackStart,last);
      this.$('range-start').value=w.state.maskTrackStart;this.$('range-end').value=w.state.maskTrackEnd;
    }else return;
    if(commit)w.save();w.render();
  }
  async confirmClipTrim(){
    if(this.w.busy())return;const state=this.w.state;
    if(state.mode!=='full'){this.tool='include';this.viewer.setTool('include');}
    state.clipTrimConfirmed=true;state.maskTrackStart=state.startFrame;state.maskTrackEnd=state.startFrame+state.frameCount-1;
    this.customRange=false;this.$('range-start').value=state.maskTrackStart;this.$('range-end').value=state.maskTrackEnd;
    if(this.w.playhead<state.startFrame||this.w.playhead>state.maskTrackEnd)this.w.playhead=state.startFrame;
    await this.setStage(state.mode==='full'?'render':'mask');
  }
  async resetMaskFrame(){
    const active=this.activeMask();if(this.w.busy()||!active?.correction_frames?.includes(this.w.playhead))return;
    await this.editMaskBar(active.id,{reset_frame:this.w.playhead});
  }
  async clearSelection(){
    if(this.w.busy())return;const draft=this.maskSegment(),active=this.activeMask(),untracked=active&&!active.tracked?active.id:null;
    this.autoPreviewPending=false;clearTimeout(this.autoPreviewTimer);this.viewer.clear();this.candidate=null;
    if(this.stage==='clean'){this.saveCleanMask();this.updateControls();return;}
    if(draft){draft.pendingMask=null;draft.seedMask=null;draft.paintDirty=false;draft.ready=false;this.selectionDirty=false;this.w.save();}
    if(untracked){await this.editMaskBar(untracked,{delete:true});this.selectionDirty=false;this.status('Selection removed. Click or paint a new object.');}
    else if(!draft&&active?.tracked){this.manualDirty=true;this.manualVersion=(this.manualVersion||0)+1;try{await this.flushManual();}catch(error){this.status(error.message);}}
    else this.selectionDirty=false;
    this.updateControls();
  }
  selected(){return this.w.state.anchors[this.w.selected];}
  activeMaskId(){
    const masks=this.document?.mask_segments||[],draft=this.maskSegment();
    if(draft?.id)return draft.id;
    const current=this.w.state.activeMaskSegment;
    if(current&&(!masks.length||masks.some(m=>m.id===current)))return current;
    const id=masks[0]?.id||crypto.randomUUID().replaceAll('-','');this.w.state.activeMaskSegment=id;return id;
  }
  activeMask(){return this.document?.mask_segments?.find(m=>m.id===this.activeMaskId());}
  async selectMaskBar(id){
    if(this.w.busy())return;
    try{await this.flushManual();this.w.state.maskSegmentDraft=null;this.w.state.activeMaskSegment=id;this.customRange=false;this.selectionDirty=false;this.viewer.setSelection({});this.frameKey=null;await this.setStage('mask');const mask=this.activeMask();if(mask&&(this.w.playhead<mask.start||this.w.playhead>mask.end))this.w.seek(mask.start);this.tool='include';this.viewer.setTool('include');this.update();this.w.save();this.status(`${mask?.name||'Mask'} selected. Correct it in the viewer, or drag its timeline ends to trim.`);}catch(e){this.status(e.message);}
  }
  async editMaskBar(id,change){
    if(this.w.busy())return;
    try{await this.flushManual();while(this.saving)await new Promise(r=>setTimeout(r,20));await this.persist();this.submitting=true;this.updateControls();const doc=await this.w.fetch(endpoint+'/segment-range',{project:this.project,segment_id:id,expected_revision:this.revision,...change});this.document=doc;this.revision=doc.revision;this.w.state.maskRevision=doc.mask_revision;this.w.state.maskProject=doc.id;this.w.state.maskCoverage=doc.mask_coverage;if(change.delete&&this.w.state.activeMaskSegment===id)this.w.state.activeMaskSegment=null;this.frameKey=null;this.status(change.delete?'Mask removed. Other masks are kept.':change.reset_frame!==undefined?'Frame edit removed. The tracked mask is restored.':'Mask duration updated. Drag back out to restore its tracked frames.');}
    catch(e){this.status(e.message);}finally{this.submitting=false;this.update();await this.frameChanged(true);this.w.save();}
  }
  maskSegment(){const segment=this.w.state.maskSegmentDraft;return segment?.source===this.w.state.source?segment:null;}
  saveSegmentRange(){const segment=this.maskSegment();if(segment){segment.start=Number(this.$('range-start').value);segment.end=Number(this.$('range-end').value);segment.direction=this.$('direction').value;segment.operation=this.$('operation').value;this.w.save();}}
  async beginMaskSegment(operation){
    if(this.w.busy()||!this.w.state.source)return;
    await this.flushManual();await this.setStage('mask');await this.ensureProject();
    const w=this.w,frame=w.playhead,trimEnd=this.trackingRange().end;
    let end=trimEnd;
    if(operation==='replace')for(const pass of this.document?.mask_history||[]){if(pass.revision>this.w.state.maskRevision)continue;const seed=pass.metadata?.frame;if(Number.isInteger(seed)&&seed>frame)end=Math.min(end,seed-1);}
    const id=crypto.randomUUID().replaceAll('-','');w.state.activeMaskSegment=id;w.state.maskSegmentDraft={id,source:w.state.source,frame,start:frame,end,operation,direction:'forward',ready:false};
    this.$('tracking-options').open=false;this.customRange=true;this.$('range-start').value=frame;this.$('range-end').value=end;this.$('operation').value=operation;this.$('direction').value='forward';
    this.maskChoices=null;this.subjectChoices.hidden=true;this.previewSequence++;this.subjectChanged=false;this.selectionDirty=true;this.viewer.setSelection({});await this.viewer.setMask(null);this.viewer.setOpacity(Number(this.$('opacity').value)/100);this.tool='include';this.viewer.setTool('include');
    this.status(operation==='add'?'Select or paint the additional object, then Track. Previous masks stay visible.':'Select or paint the object, then Track. Earlier frames are kept.');this.updateControls();w.save();this.authoritativePreview().catch(e=>this.status(e.message));
  }
  async finishMaskSegment(){
    if(this.w.busy())return;
    this.w.state.maskSegmentDraft=null;this.maskChoices=null;this.subjectChoices.hidden=true;this.selectionDirty=false;this.subjectChanged=false;this.customRange=false;this.previewSequence++;
    this.$('operation').value='replace';this.$('direction').value='both';this.$('range-start').value=this.w.state.startFrame;this.$('range-end').value=this.w.state.startFrame+this.w.state.frameCount-1;
    this.frameKey=null;await this.frameChanged(true);this.w.save();this.updateControls();this.status('Showing the saved shot mask. Accepted segment previews and tracking are kept.');
  }
  async acceptSegmentSeed(mask={},version=this.maskEditVersion){
    const segment=this.maskSegment();if(!segment)return;
    const seed=this.document?.mask_seed;
    const url=mask.seed_frame===segment.frame?mask.seed_url:seed?.frame===segment.frame&&seed.mask_revision===this.w.state.maskRevision?seed.url:null;
    if(!url)throw Error('This server needs the updated Paintout backend to keep additional mask seeds separate. Restart ComfyUI with the new package.');
    await this.viewer.setMask(this.w.url(url));
    if(version!==this.maskEditVersion)return;
    segment.seedMask=this.viewer.getSelection().mask;segment.pendingMask=null;segment.ready=true;segment.maskRevision=this.w.state.maskRevision;this.selectionDirty=false;this.w.save();
  }
  updateMaskSegments(){
    const passes=(this.document?.mask_history||[]).filter(pass=>pass.revision<=this.w.state.maskRevision&&pass.end_frame>pass.start_frame);
    this.$('segments-label').textContent=`Tracking segments (${passes.length})`;
    const list=this.$('segments');list.replaceChildren();
    if(!passes.length){list.append(el('li','No tracked segments yet. Select a subject and track, or add another mask.'));return;}
    for(const pass of passes){const row=el('li'),button=el('button',`Frames ${pass.start_frame}â€“${pass.end_frame} Â· ${pass.operation==='add'?'Added mask':pass.operation==='absent'?'Subject absent':pass.operation==='protect'?'Protected region':'Tracked repair'}`);button.type='button';button.disabled=this.w.busy();button.onclick=()=>this.w.seek(pass.metadata?.frame??pass.start_frame);row.append(button);list.append(row);}
  }
  maskReviewRanges(){
    const state=this.w.state,document=this.document;
    if(!document||document.id!==state.maskProject||document.mask_revision!==state.maskRevision)return [];
    const start=state.startFrame,end=start+state.frameCount-1,seen=new Set();
    return (document.mask_review_ranges||[]).filter(range=>Number.isInteger(range.start_frame)&&Number.isInteger(range.end_frame)&&range.end_frame>=range.start_frame).map(range=>({...range,start_frame:Math.max(start,range.start_frame),end_frame:Math.min(end,range.end_frame),status:'needs_review'})).filter(range=>{const key=[range.start_frame,range.end_frame,range.reason].join('|');if(range.start_frame>range.end_frame||seen.has(key))return false;seen.add(key);return true;}).sort((a,b)=>a.start_frame-b.start_frame||a.end_frame-b.end_frame);
  }
  async nextMaskReview(){
    const w=this.w;if(this.stage!=='mask'||w.busy()||this.manualSaving)return;
    await this.flushManual();const ranges=this.maskReviewRanges();if(!ranges.length)return;
    const next=ranges.find(range=>range.start_frame>w.playhead)||ranges[0];
    w.playhead=next.start_frame;w.updatePlayhead();await this.frameChanged(true);this.updateControls();
    this.status(`${next.label||'Mask changed'} at source frame ${next.start_frame}. Advisory only: inspect the mask and paint or erase if needed.`);
  }

  frameVersions(anchor=this.selected()){
    if(!anchor)return [];
    const versions=(anchor.versions||[]).filter((v,i,list)=>v.file&&list.findIndex(other=>other.file===v.file)===i).map(v=>({...v}));
    if(anchor.file&&!versions.some(v=>v.file===anchor.file))versions.push({file:anchor.file,preview_file:anchor.preview_file,preview_colour_space:anchor.preview_colour_space,colour_space:anchor.colour_space});
    return versions;
  }
  async selectVersion(file){
    if(this.w.busy()||this.candidate||this.stage!=='clean')return;
    const anchor=this.selected(),versions=this.frameVersions(anchor),version=versions.find(v=>v.file===file);
    if(!anchor||anchor.frame!==this.w.playhead||!version||anchor.file===file)return;
    anchor.versions=versions;
    Object.assign(anchor,{file:version.file,preview_file:version.preview_file||version.png_file||'',preview_colour_space:version.preview_colour_space||'srgb_display',colour_space:version.colour_space||anchor.colour_space,status:'accepted'});
    this.showOriginal=false;this.frameKey=null;this.w.syncAnchorControls?.(this.w.selected);this.w.changed();
    await this.frameChanged(true);this.status('Using saved version '+(versions.indexOf(version)+1)+' for source frame '+anchor.frame+'. Other versions are kept.');
  }
  showMaskChoices(result){
    this.maskChoices={...result,source:this.w.state.source};this.subjectChoices.replaceChildren(el('strong','Several subjects matched. Choose the one to remove.'));
    const list=el('div');list.className='zp-editor-subject-choices__list';
    for(const choice of result.choices){const button=el('button');button.type='button';button.setAttribute('aria-label','Choose subject '+(choice.index+1));const preview=el('span');preview.className='zp-editor-subject-choices__preview';const plate=el('img');plate.alt='';plate.src=this.w.thumbnail(this.w.state.source,result.frame,this.w.state.sourceColour,320);preview.append(plate);const overlay=el('span');overlay.style.maskImage=`url("${this.w.url(choice.url)}")`;preview.append(overlay);button.append(preview,el('span','Subject '+(choice.index+1)));button.onclick=()=>this.chooseMaskSubject(choice.index);list.append(button);}
    const cancel=el('button','Cancel selection');cancel.type='button';cancel.onclick=()=>{this.maskChoices=null;this.subjectChoices.hidden=true;this.updateControls();this.status('Selection cancelled. Your saved mask is unchanged.');};list.append(cancel);this.subjectChoices.append(list);this.updateControls();
  }
  async chooseMaskSubject(index){
    const selection=this.maskChoices,w=this.w;
    if(w.busy()||!selection)return;
    if(this.saving){this.status('Project is saving. Choose the subject again in a moment.');return;}
    if(selection.source!==w.state.source||selection.project!==this.project||selection.frame!==w.playhead){this.status('Return to the detected source frame or preview the selection again.');return;}
    this.submitting=true;clearTimeout(this.saveTimer);w.render();
    try{const document=await w.fetch(endpoint+'/select-mask-candidate',{project:this.project,token:selection.token,index,source:w.state.source,frame:w.playhead,expected_revision:this.revision});
      this.document=document;this.revision=document.revision;w.state.maskProject=document.id;w.state.maskRevision=document.mask_revision;w.state.maskCoverage=document.mask_coverage;this.maskChoices=null;this.subjectChoices.hidden=true;this.subjectChanged=false;this.selectionDirty=false;this.viewer.setSelection({});await this.acceptSegmentSeed();this.frameKey=null;this.status('Subject selected on this frame. Check the red mask, then track it through the shot.');
    }catch(error){this.status(error.message);}finally{this.submitting=false;w.render();await this.frameChanged(true);w.save();}
  }
  projectData(){return {draft:JSON.parse(JSON.stringify({...this.w.state,editorStage:this.stage,editorPlayhead:this.w.playhead,editorSelected:this.w.selected})),prompts:{...this.w.prompts},renderJob:this.w.job||null,result:this.w.result?.config?.source===this.w.state.source?this.w.result:null};}
  hydrateControls(){
    const w=this.w;
    for(const [field,key]of Object.entries({start:'startFrame',count:'frameCount',fps:'sequenceFps',colour:'sourceColour',processing:'processingSpace',width:'width',height:'height',output:'outputMode',seed:'seed'})){const input=w.$(field);if(input)input.value=w.state[key];}
    if(w.$('prompt'))w.$('prompt').value=w.prompts[w.state.mode]||'';
    this.$('grow').value=w.state.maskGrow??0;w.state.maskFeather=0;
    this.$('instruction').value=this.selected()?.editPrompt||'Remove the selected object and reconstruct the background.';this.$('range-start').value=w.state.startFrame;this.$('range-end').value=w.state.startFrame+w.state.frameCount-1;
    const segment=this.maskSegment();if(segment){this.customRange=true;this.$('range-start').value=segment.start;this.$('range-end').value=segment.end;this.$('operation').value=segment.operation;this.$('direction').value=segment.direction;}
    w.syncAnchorControls?.(w.selected);w.updatePlayhead();
  }
  async openProject(id){
    if(this.w.busy()||this.saving)return;
    try{
      await this.flushManual();if(this.w.state.source)await this.persist();this.openingProject=true;this.w.render();
      const doc=await this.w.fetch(endpoint+'/project',{id}),draft=doc.data?.draft;
      if(!draft?.source)throw Error('This project has no footage.');
      const [sourceInfo,maskInfo]=await Promise.all([this.w.info(draft.source),draft.mask?this.w.info(draft.mask):null]),w=this.w;
      w.state=paintoutDraft({...draft,editorProject:doc.id,maskProject:doc.mask_revision==null?null:doc.id,maskRevision:doc.mask_revision,maskCoverage:doc.mask_coverage});
      w.sourceInfo=sourceInfo;w.maskInfo=maskInfo;w.prompts={...doc.data.prompts};w.job=doc.data.renderJob?.config?.source===draft.source?doc.data.renderJob:null;w.result=doc.data.result?.config?.source===draft.source?doc.data.result:null;
      w.selected=Number.isInteger(draft.editorSelected)&&w.state.anchors[draft.editorSelected]?draft.editorSelected:-1;w.playhead=number(draft.editorPlayhead??draft.startFrame??0,0,sourceInfo.frames-1);
      this.source=draft.source;this.projectSource=draft.source;this.project=doc.id;this.document=doc;this.revision=doc.revision;this.frameKey=null;this.subjectChanged=false;this.customRange=false;this.selectionDirty=false;this.showOriginal=false;
      this.projects.open=false;this.toolJob=w.state.editorJob?.source===draft.source?w.state.editorJob:null;
      this.stage=draft.editorStage==='trim'?'trim':w.state.mode==='full'||w.result?'render':['trim','mask','clean','render'].includes(draft.editorStage)?draft.editorStage:'mask';this.active=['mask','clean'].includes(this.stage);this.candidate=this.stage==='clean'?this.selected()?.candidate||null:null;
      this.hydrateControls();w.view=this.stage==='clean'?'anchor':'mask';w.renderAnchors();w.render();if(this.active)await this.frameChanged(true);else w.preview(this.stage==='trim'?'source':w.result?'result':'source');if(this.toolJob)this.startPolling();if(w.job)w.startPolling();w.save();
    }catch(e){this.status(e.message);}finally{this.openingProject=false;this.w.render();}
  }
  async ensureProject(){
    if(this.loadingProject)return this.projectPromise;
    const source=this.w.state.source;if(!source)throw Error('Add footage first.');
    if(this.project&&this.projectSource===source)return;
    this.loadingProject=true;
    this.projectPromise=(async()=>{
      const id=this.w.state.editorProject;
      const doc=await this.w.fetch(endpoint+'/project',id?{id}:{data:this.projectData()});
      if(this.w.state.source!==source)return;
      const saved=doc.data?.draft,local=this.w.state;
      // Disk can recover a newer saved draft, while newer browser edits remain authoritative.
      if(saved?.source===source&&((Number(saved.editorUpdatedAt)||0)>(Number(local.editorUpdatedAt)||0)||(!local.editorUpdatedAt&&!local.anchors.length&&saved.anchors?.length))){
        Object.assign(local,saved);local.maskFeather=0;local.anchors=Array.isArray(local.anchors)?local.anchors:[];
        this.w.prompts={...doc.data?.prompts};
        this.w.selected=Number.isInteger(local.editorSelected)&&local.anchors[local.editorSelected]?local.editorSelected:-1;
        this.w.playhead=number(local.editorPlayhead??local.startFrame??0,0,(this.w.sourceInfo?.frames||1)-1);
        this.w.job=doc.data?.renderJob?.config?.source===source?doc.data.renderJob:null;
        this.w.result=doc.data?.result?.config?.source===source?doc.data.result:null;
        this.hydrateControls();this.w.renderAnchors?.();
      }
      this.project=doc.id;this.projectSource=source;this.revision=doc.revision;this.document=doc;const segment=this.maskSegment();if(segment){this.customRange=true;this.$('range-start').value=segment.start;this.$('range-end').value=segment.end;this.$('operation').value=segment.operation;this.$('direction').value=segment.direction;}
      this.w.state.editorProject=doc.id;
      if(doc.mask_revision!=null){this.w.state.maskProject=doc.id;this.w.state.maskRevision=doc.mask_revision;this.w.state.maskCoverage=doc.mask_coverage;}
    })();
    try{await this.projectPromise;}finally{this.loadingProject=false;}
  }
  saveSoon(){
    if(this.closed||!this.w.state.source)return;this.w.state.editorUpdatedAt=Date.now();this.w.state.editorSelected=this.w.selected;clearTimeout(this.saveTimer);
    this.saveTimer=setTimeout(()=>this.persist().catch(e=>this.status('Project was not saved: '+e.message)),500);
  }
  async persist(){
    if(!this.w.state.source||this.w.picking||this.toolJob||this.submitting||this.loadingProject||this.openingProject||this.importing||this.manualDirty||this.manualSaving)return;await this.ensureProject();
    if(this.saving){this.saveAgain=true;return;}this.saving=true;
    const project=this.project,source=this.projectSource;
    try{const doc=await this.w.fetch(endpoint+'/project',{id:project,data:this.projectData(),expected_revision:this.revision});if(this.project===project&&this.projectSource===source){this.document=doc;this.revision=doc.revision;}}
    finally{this.saving=false;if(this.saveAgain){this.saveAgain=false;this.saveSoon();}}
  }
  async loadDocument(){const doc=await this.w.fetch(endpoint+'/project',{id:this.project});this.document=doc;this.revision=doc.revision;this.w.state.maskCoverage=doc.mask_coverage;return doc;}
  async setStage(stage){
    if(this.w.busy()||!['trim','mask','clean','render'].includes(stage))return;if(this.w.state.clipTrimConfirmed===false&&stage!=='trim')stage='trim';if(stage!==this.stage){this.autoPreviewPending=false;clearTimeout(this.autoPreviewTimer);this.maskEditVersion++;}try{await this.flushManual();}catch(e){this.status(e.message);return;}this.closed=false;this.stage=stage;this.w.state.editorStage=stage;if(stage==='clean')this.$('instruction').value=this.selected()?.editPrompt||'Remove the selected object and reconstruct the background.';this.active=['mask','clean'].includes(stage)&&!!this.w.state.source;this.candidate=stage==='clean'?this.selected()?.candidate||null:null;
    if(stage==='clean'&&!this.selected()&&this.w.state.source)this.createFrame(this.w.playhead);
    if(this.active){this.w.view=stage==='clean'?'anchor':'mask';this.w.comparison?.hide();if(this.w.$('comparison'))this.w.$('comparison').hidden=true;this.w.$('video').pause();this.w.$('video').hidden=true;this.w.$('image-slot').hidden=true;await this.frameChanged(true);}
    else this.w.preview(stage==='trim'?'source':this.w.result?'result':'source');
    this.update();this.w.save();
  }
  async frameChanged(force=false){
    if(!this.active||!this.w.sourceInfo)return;const w=this.w;
    if(this.viewer.frame!==w.playhead){this.autoPreviewPending=false;clearTimeout(this.autoPreviewTimer);this.maskEditVersion++;}
    const accepted=this.stage==='clean'&&this.selected()?.frame===w.playhead?this.selected():null;
    const key=[w.state.source,w.playhead,w.state.maskRevision,w.state.mask,w.state.sourceColour,this.candidate?.file,accepted?.file,this.stage].join('|');
    if(!force&&key===this.frameKey&&!this.manualDirty&&!this.manualSaving)return;const seq=++this.sequence;this.frameLoading=true;this.updateControls();
    try{await this.flushManual();if(seq!==this.sequence)return;this.frameKey=key;
      const candidate=accepted?this.candidate:null,info=w.sourceInfo,url=candidate?.file?w.thumbnail(candidate.png_file||candidate.file,0,candidate.png_file?(candidate.preview_colour_space||'srgb_display'):candidate.colour_space,1280):accepted?.file?w.thumbnail(accepted.preview_file||accepted.file,0,accepted.preview_file?(accepted.preview_colour_space||'srgb_display'):accepted.colour_space,1280):w.thumbnail(w.state.source,w.playhead,w.state.sourceColour,1280);
      this.showOriginal=false;
      await this.viewer.setFrame(url,info.width,info.height,w.playhead);if(seq!==this.sequence)return;
      this.selectionDirty=false;
      if(candidate?.review){await this.viewer.setMask(w.url(candidate.review.difference_url));}
      else if(this.stage==='clean'&&accepted?.editMask){await this.viewer.setMask(accepted.editMask);}
      else if(this.stage==='mask'&&this.maskSegment()?.frame===w.playhead){const segment=this.maskSegment();await this.viewer.setMask(segment.pendingMask||segment.seedMask||null);}
      else if(w.state.maskProject&&w.state.maskRevision!=null){await this.viewer.setMask(w.url(endpoint+'/mask-preview?'+new URLSearchParams({project:w.state.maskProject,revision:w.state.maskRevision,frame:w.playhead,grow:0,feather:0,...(this.stage==='mask'&&this.activeMask()?{segment:this.activeMaskId()}: {})})));}
      else if(w.state.mask){await this.viewer.setMask(w.thumbnail(w.state.mask,w.playhead,'srgb_display',1280));}
      else await this.viewer.setMask(null);
      if(seq!==this.sequence)return;this.selectionDirty=false;this.$('grow').value=this.stage==='clean'?(accepted?.editGrow??w.state.maskGrow??0):(w.state.maskGrow??0);this.$('grow-value').textContent=this.$('grow').value+' px';this.viewer.setGrow(candidate?.review?0:Number(this.$('grow').value),0);this.viewer.setOpacity(candidate&&!candidate.review?0:Number(this.$('opacity').value)/100);this.updateControls();this.authoritativePreview().catch(e=>{if(seq===this.sequence)this.status(e.message);});
    }catch(e){if(seq===this.sequence){this.frameKey=null;if(this.manualDirty){w.playhead=this.viewer.frame;w.updatePlayhead();}this.status(e.message);}}finally{if(seq===this.sequence){this.frameLoading=false;this.w.render();}}
  }
  update(){
    const w=this.w,has=!!w.state.source;
    w.page.classList.toggle('zp-editor-open',has);w.page.dataset.editorStage=this.stage;
    this.timelineHost.hidden=!has||w.state.mode==='full'&&this.stage!=='trim';this.tools.hidden=!has||!['mask','clean'].includes(this.stage)||w.state.mode==='full';this.nav.hidden=!has;this.trimTools.hidden=!has||this.stage!=='trim';this.trimTools.querySelector('button').disabled=this.busy();this.trimTools.querySelector('[data-trim-summary]').textContent=`Frames ${w.state.startFrame}â€“${w.state.startFrame+w.state.frameCount-1} Â· ${w.state.frameCount} frames Â· ${(w.state.frameCount/w.fps()).toFixed(2)} s`;
    this.viewerHost.hidden=!this.active||!has||w.state.mode==='full';
    if(this.active&&has&&w.state.mode!=='full'){w.$('video').hidden=true;w.$('image-slot').hidden=true;}
    w.$('anchors-section').hidden=true;
    for(const b of this.nav.querySelectorAll('button')){b.setAttribute('aria-current',b.dataset.stage===this.stage?'step':'false');b.disabled=this.busy()||w.state.clipTrimConfirmed===false&&b.dataset.stage!=='trim';b.hidden=w.state.mode==='full'&&['mask','clean'].includes(b.dataset.stage);}
    const track=this.trackingRange(),range=this.stage==='mask'?track:{start:w.state.startFrame,end:w.state.startFrame+w.state.frameCount-1};
    this.timeline.update({sourceFrames:w.sourceInfo?.frames,startFrame:range.start,frameCount:range.end-range.start+1,trimMin:this.stage==='mask'?w.state.startFrame:0,trimMax:this.stage==='mask'?w.state.startFrame+w.state.frameCount-1:undefined,trimEditable:['trim','mask'].includes(this.stage),exportStart:w.state.startFrame,exportEnd:w.state.startFrame+w.state.frameCount-1,fps:w.fps(),playhead:w.playhead,
      anchors:w.state.anchors,selected:w.selected,stage:this.stage,newMaskPending:!!this.maskSegment(),maskSegments:this.document?.mask_segments||[],selectedMask:this.activeMaskId(),busy:w.busy(),thumbnail:a=>a.file?w.thumbnail(a.preview_file||a.file,0,a.preview_file?(a.preview_colour_space||'srgb_display'):a.colour_space):w.thumbnail(w.state.source,a.frame,w.state.sourceColour),maskRanges:[...(this.document?.mask_history||[]).filter(pass=>pass.revision<=w.state.maskRevision).map(pass=>({...pass,status:'tracked'})),...this.maskReviewRanges()]});
    if(has&&this.source!==w.state.source){this.source=w.state.source;this.frameKey=null;this.project=null;this.projectSource=null;this.revision=-1;
      this.customRange=false;this.$('range-start').value=w.state.startFrame;this.$('range-end').value=w.state.startFrame+w.state.frameCount-1;
      this.ensureProject().then(()=>{if(this.projectSource===w.state.source){this.stage=w.state.editorStage==='trim'||w.state.clipTrimConfirmed===false?'trim':w.state.mode==='full'||w.result?'render':w.state.editorStage||'mask';this.active=['mask','clean'].includes(this.stage);this.candidate=this.stage==='clean'?this.selected()?.candidate||null:null;if(this.active){w.view=this.stage==='clean'?'anchor':'mask';this.frameChanged(true);}else w.preview(this.stage==='trim'?'source':w.result?'result':'source');this.update();}}).catch(e=>this.status(e.message));}
    this.updateControls();
  }
  updateControls(){
    const clean=this.stage==='clean',busy=this.w.busy();
    if(clean&&['include','exclude'].includes(this.tool)){this.tool='brush';this.viewer.setTool('brush');}
    const hasRemovalMask=!!(this.w.state.maskProject&&this.w.state.maskRevision!=null||this.w.state.mask),coverage=this.w.state.maskCoverage;
    const covered=Array.isArray(coverage)?new Set(coverage):null,needed=this.w.state.frameCount;
    const count=covered?Array.from({length:needed},(_,i)=>this.w.state.startFrame+i).filter(f=>covered.has(f)).length:needed;
    this.subjectChoices.hidden=clean||this.stage==='render'||!this.maskChoices||this.maskChoices.source!==this.w.state.source||this.maskChoices.frame!==this.w.playhead;
    for(const button of this.subjectChoices.querySelectorAll('button'))button.disabled=busy;
    this.maskSummary.hidden=this.stage!=='render'||this.w.state.mode==='full';
    this.maskSummary.querySelector('span').textContent=!hasRemovalMask?'Go to Mask and mark the object you want to remove.':count<needed?`Your mask covers ${count} of ${needed} frames. Go back to Mask and track the missing sections.`:'Your tracked mask will be used automatically. Red areas are the parts that will be repaired.';
    this.maskSummary.querySelector('button').disabled=busy;
    this.tools.querySelector('.zp-editor-segment-actions').hidden=!hasRemovalMask;
    this.tools.querySelector('.zp-editor-segments').hidden=!this.document?.mask_history?.length;
    const pointPreview=this.stage==='mask'&&(this.toolJob?.maskSingle||this.maskStarting&&this.maskPreviewStarting);
    this.viewerHost.inert=busy&&!pointPreview||!!this.candidate;this.viewerHost.setAttribute('aria-busy',String(busy));if(busy)this.viewer.drag=null;
    for(const input of this.tools.querySelectorAll('input,select'))input.disabled=busy;
    for(const b of this.tools.querySelectorAll('button'))b.disabled=busy;
    for(const b of this.viewerToolbar.querySelectorAll('button'))b.disabled=busy||!!this.candidate;
    for(const input of this.viewerToolbar.querySelectorAll('input,select'))input.disabled=busy;
    if(pointPreview)for(const b of this.viewerToolbar.querySelectorAll('[data-tool=include],[data-tool=exclude],[data-tool=pan]'))b.disabled=false;
    this.tools.querySelector('.zp-editor-mask-actions').hidden=clean;this.tools.querySelector('.zp-editor-clean-actions').hidden=!clean;
    this.tools.querySelector('.zp-editor-mask-flow').classList.toggle('is-clean',clean);this.$('selection').closest('.zp-editor-selection-row').hidden=clean;
    this.tools.querySelector('.zp-editor-mask-intro').hidden=clean;
    this.$('brush-control').hidden=!['brush','protect'].includes(this.tool);
    const help={include:'Click inside the object you want to remove. Add more points if parts are missing. The red mask updates automatically.',exclude:'Click any red area you want to keep. Switch back to Select subject to add more of the object.',brush:'Paint over every part of the object you want to remove. Use Erase mask to tidy the edges, then click Track mask.',protect:'Erase red areas that must stay in the shot. Switch to Paint mask to add areas back.',pan:'Drag to move the view. Scroll to zoom in or out. Press 0 to fit the whole frame.'};
    this.$('tool-help').textContent=clean&&['brush','protect'].includes(this.tool)?(this.tool==='brush'?'Paint everything FLUX should remove, including shadows or small details. Only this clean frameâ€™s mask changes.':'Erase any area FLUX must keep. Only this clean frameâ€™s mask changes.'):help[this.tool];
    const selection=this.viewer.getSelection(false),hasSelection=selection.hasMask||selection.positive.length>0;
    this.$('selection').disabled=busy||(!hasSelection&&!this.manualDirty);
    this.$('selection').textContent='Update mask';
    this.$('track').disabled=busy||!selection.hasMask||this.subjectChanged||this.selectionDirty&&!this.manualDirty||!!this.manualSaving||this.autoPreviewPending;
    const previewNeeded=this.selectionDirty||!selection.hasMask;
    this.$('selection').classList.toggle('zp-editor-primary',previewNeeded);
    this.$('selection-cue').textContent=this.manualSaving?'Saving your painted maskâ€¦':this.autoPreviewPending||pointPreview?'Updating the red mask. You can keep adding points.':selection.hasMask&&!this.selectionDirty?'Happy with the red area? Click Track mask to follow the object through the shot.':hasSelection?'Updating your selectionâ€¦':'Start by clicking the object in the viewer, or choose Paint mask to draw over it.';
    const segment=this.maskSegment(),atSeed=segment?.frame===this.w.playhead;
    this.$('clear').hidden=!clean&&!!this.activeMask()?.tracked&&!segment;this.$('reset-mask-edit').hidden=clean||!this.activeMask()?.tracked||!this.activeMask()?.correction_frames?.includes(this.w.playhead)||this.w.playhead<this.activeMask().start||this.w.playhead>this.activeMask().end;
    this.$('segment-draft').hidden=!segment;
    this.$('segment-label').textContent=segment?`New mask Â· select on frame ${segment.frame}`:'';
    this.$('segment-help').textContent=segment?(segment.ready?'Ready to track from this frame.':'Select or paint the object. Previous masks are kept.') :'';
    this.$('segment-seed').hidden=!segment||atSeed;
    this.$('track').textContent=segment?'Track new mask':this.activeMask()?.tracked?'Track from here':'Track mask';
    if(segment)this.$('track').disabled=busy||!atSeed||!segment.ready||this.selectionDirty||this.subjectChanged||this.autoPreviewPending;
    this.updateMaskSegments();
    this.$('track-help').textContent=this.selectionDirty||this.subjectChanged?'The mask updates automatically after each point.':selection.hasMask?'Check the red mask, then track it. Scrub the timeline afterwards and fix any missed sections.':'Select or paint the object, then Track.';
    if(this.maskChoices&&!this.subjectChoices.hidden){this.$('track').disabled=true;this.$('track-help').textContent='Choose a subject from the previews above before tracking.';}
    this.$('continue').disabled=busy||!(this.w.state.mask||this.w.state.maskRevision!=null)||Array.isArray(this.document?.mask_segments)&&!this.document.mask_segments.some(m=>m.tracked);
    this.$('render-next').disabled=busy||!!this.candidate||!this.w.state.anchors.some(anchor=>anchor.file&&anchor.status==='accepted'&&anchor.enabled!==false&&anchor.frame>=this.w.state.startFrame&&anchor.frame<this.w.state.startFrame+this.w.state.frameCount);

    for(const b of this.viewerToolbar.querySelectorAll('[data-tool=include],[data-tool=exclude]'))b.hidden=clean;
    for(const b of this.viewerToolbar.querySelectorAll('[data-tool]'))b.setAttribute('aria-pressed',String(b.dataset.tool===this.tool));
    const selectedMask=this.activeMask(),outsideMask=!clean&&!segment&&selectedMask?.tracked&&(this.w.playhead<selectedMask.start||this.w.playhead>selectedMask.end);
    this.viewer.root.inert=!!outsideMask;
    if(outsideMask){for(const b of this.viewerToolbar.querySelectorAll('button'))b.disabled=true;this.$('selection').disabled=true;this.$('track').disabled=true;this.$('tool-help').textContent=`Outside ${selectedMask.name}. Select another mask bar, extend its ends, or choose Add mask.`;}
    this.$('track').classList.toggle('zp-editor-primary',!this.$('track').disabled);
    const a=this.selected();this.$('frame-label').textContent=a?`Clean frame ${a.frame} Â· ${a.frame<this.w.state.startFrame||a.frame>=this.w.state.startFrame+this.w.state.frameCount?'Outside trim. Extend the range to use this guide.':({needs_review:'Review result',needs_edit:'Ready to clean',accepted:'Accepted'})[a.status]||'Accepted'}`:'Add a clean frame on the timeline';
    const versions=this.frameVersions(a),versionSelect=this.$('version');this.$('version-control').hidden=!clean||versions.length<2;
    versionSelect.replaceChildren(...versions.map((version,index)=>{const option=el('option',`Version ${index+1} Â· ${version.method==='flux3'?'FLUX':version.method==='manual'?'Imported':'Saved'}`);option.value=version.file;return option;}));versionSelect.value=a?.file||'';versionSelect.disabled=busy||!!this.candidate||a?.frame!==this.w.playhead;versionSelect.title=this.candidate?'Use or discard the current result before choosing a saved version.':'Choose the clean image used to guide this frame.';
    const onFrame=a?.frame===this.w.playhead;this.$('reference').hidden=!clean||!onFrame||!a?.exportReference;
    this.$('compare').hidden=!clean||!onFrame||!(a?.file||this.candidate);this.$('compare').textContent=this.showOriginal?'Show clean frame':'Show original';
    this.$('reject').hidden=!this.candidate;this.$('accept').hidden=!this.candidate||!!this.candidate.review;
    if(clean&&this.candidate)this.$('grow').disabled=true;
    const review=this.candidate?.review;this.importReview.hidden=!clean||!onFrame||!review;this.$('import-differences').textContent=review?`${review.outside_pixels.toLocaleString()} changed pixels lie outside your repair area. Red highlights those changes. Keep the current bounds or include the intended edits.`:'';
    this.$('import-current').disabled=this.$('import-include').disabled=busy||!onFrame;
    if(review){for(const input of this.tools.querySelectorAll('input,select'))if(input!==this.$('opacity'))input.disabled=true;for(const b of this.viewerToolbar.querySelectorAll('button'))b.disabled=true;}
    this.$('clean').disabled=busy||!onFrame||!!this.candidate;this.$('download').disabled=busy||!onFrame;this.$('import').disabled=busy||!onFrame||!!this.candidate;this.$('accept').disabled=busy||!onFrame;
    this.$('job').hidden=!(this.toolJob||this.submitting||this.maskStarting);this.$('cancel').disabled=!this.toolJob;
    this.$('previous-mask').disabled=busy||!this.document?.mask_history?.length;this.$('next-mask').disabled=busy||!this.document?.mask_history?.length;
    const reviewRanges=this.maskReviewRanges(),atFrame=reviewRanges.find(range=>this.w.playhead>=range.start_frame&&this.w.playhead<=range.end_frame);
    this.maskReview.hidden=this.stage!=='mask'||!reviewRanges.length;
    this.$('review-count').textContent=`${reviewRanges.length} mask ${reviewRanges.length===1?'change':'changes'} to check`;
    this.$('review-reason').textContent=atFrame?`${atFrame.label||'Mask changed'}. Advisory only: inspect and correct if needed.`:'Amber timeline marks flag abrupt mask changes. Advisory only; no masks have been altered.';
    this.$('review-next').disabled=busy||!!this.manualSaving||!reviewRanges.length;
    this.updateGuidance({selection,segment,pointPreview,outsideMask});

  }
  updateGuidance({selection,segment,pointPreview,outsideMask}){
    const w=this.w,a=this.selected(),onFrame=a?.frame===w.playhead;
    let title,help;
    if(this.stage==='trim'){
      title='Choose the part of the clip you want to repair';
      help='Drag the In and Out handles on the timeline, then click Use trimmed clip. Only this section will be exported.';
    }else if(this.stage==='mask'){
      title='Mask the object you want to remove from the scene';
      help='Click the object in the viewer, or choose Paint mask and draw over it. Red shows what will be removed.';
      if(this.autoPreviewPending||pointPreview){title='Your mask is updating';help='Keep adding points to include missing parts. Use Exclude area for anything you want to keep.';}
      else if(this.toolJob||this.maskStarting){title='Following your object through the shot';help='Wait for tracking to finish. Then scrub the timeline to check that the red mask follows the object.';}
      else if(outsideMask){title='This frame is outside the selected mask';help='Select another mask bar, drag the barâ€™s ends to extend it, or click Add mask to start another selection.';}
      else if(segment){title='Mask the next object or missed section';help=segment.ready?'Check the red selection, set its range with the timeline handles, then click Track new mask. Your previous masks will be kept.':'Click or paint the object on this frame. Your previous masks stay visible in red and will be kept.';}
      else if(this.activeMask()?.tracked||w.state.mask){title='Check that the mask follows the object';help='Scrub through the timeline. Paint or erase missed areas, or click Add mask for another section. When it looks right, click Next: clean frames.';}
      else if(selection.hasMask&&!this.selectionDirty){title='Track your mask through the shot';help='Check that red covers the whole object. Adjust Expand mask if needed, then click Track mask. The timeline handles set how far it tracks.';}
    }else if(this.stage==='clean'){
      title='Make a clean frame to show what replaces the object';
      help='Move to a clear view of the object, then click Add clean frame above the timeline. A clean frame is a still image with the object removed.';
      if(this.toolJob||this.submitting){title='Creating your clean frame';help='Wait for the result, then check that the object is gone and the replacement background looks right.';}
      else if(this.candidate&&onFrame){title='Check the result before using it';help=this.candidate.review?'Review the highlighted changes below, then choose which edited areas to keep.':'Use Show original to compare. If the object is gone and the background looks right, click Use clean frame. Otherwise click Discard result and try again.';}
      else if(onFrame&&a?.status==='accepted'){title='Your clean frame is ready';help='Add more clean frames where the view changes, or click Next: render. To improve this frame, paint its removal area and clean it again.';}
      else if(onFrame){title='Paint what should disappear from this frame';help='Cover the object and any shadow you want removed. Describe the replacement background below, then click Clean with FLUX 3. Or use Download original and Import edited frame to edit it yourself.';}
    }else{
      title=w.result?'Review your finished shot':'Generate the object removal';
      help=w.result?'Play the result and compare it with the source. If it looks right, download your video.':'Check the output format below, then click Generate paintout. Your mask and accepted clean frames will guide the repair.';
      if(w.state.mode==='full'&&!w.result)help='Describe the empty scene you want below, check the output format, then click Generate clean plate.';
      if(w.job||w.submitting){title='Generating your repaired shot';help='Follow the progress below. Your result will appear here when generation finishes.';}
    }
    this.guideTitle.textContent=title;this.guideHelp.textContent=help;
  }
  morph(authoritative){
    const grow=Number(this.$('grow').value),feather=0;
    this.$('grow-value').textContent=grow+' px';
    this.previewSequence++;if(this.stage==='clean'&&this.selected()?.frame===this.w.playhead){this.selected().editGrow=grow;if(!this.candidate)this.viewer.setOpacity(Number(this.$('opacity').value)/100);}else this.w.state.maskGrow=grow;this.w.state.maskFeather=0;this.viewer.setGrow(grow,0);
    if(authoritative){this.w.save();this.authoritativePreview().catch(e=>this.status(e.message));}
  }
  async authoritativePreview(){
    const masks=this.document?.mask_segments||[],otherMasks=this.stage==='mask'&&masks.some(m=>m.tracked&&m.id!==this.activeMaskId());
    this.viewer.setContextMask(otherMasks?this.w.url(endpoint+'/mask-preview?'+new URLSearchParams({project:this.w.state.maskProject,revision:this.w.state.maskRevision,frame:this.w.playhead,grow:this.w.state.maskGrow||0,others:this.activeMaskId()})):null).catch(e=>this.status(e.message));
    if(!this.w.sourceInfo||!this.active||this.candidate?.review)return;
    const frame=this.w.playhead,seq=this.sequence,preview=++this.previewSequence;
    const state=this.w.state;let response;
    if(this.stage!=='clean'&&!this.maskSegment()&&!this.selectionDirty&&state.maskProject&&state.maskRevision!=null){
      const params=new URLSearchParams({project:state.maskProject,revision:state.maskRevision,frame,grow:state.maskGrow,feather:state.maskFeather,...(this.activeMask()?{segment:this.activeMaskId()}: {})});
      response=await this.w.api.fetchApi(endpoint+'/mask-preview?'+params);
    }else{
      const selection=this.viewer.getSelection();if(!selection.hasMask)return;
      response=await this.w.api.fetchApi(endpoint+'/effective-mask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mask:selection.mask,width:this.w.sourceInfo.width,height:this.w.sourceInfo.height,grow:Number(this.$('grow').value),feather:0,project:state.maskProject,revision:state.maskRevision,source:state.source,frame})});
    }
    if(!response.ok)throw Error('Could not update the full-resolution repair boundary.');
    const blob=await response.blob();if(seq!==this.sequence||frame!==this.w.playhead||preview!==this.previewSequence)return;
    const url=URL.createObjectURL(blob);try{await this.viewer.setEffectiveMask(url);}finally{URL.revokeObjectURL(url);}
    if(preview===this.previewSequence)this.status(this.stage==='clean'?'Red is the exact FLUX edit area. Paint to include shadows; erase to preserve detail.':'');
  }
  createFrame(frame){
    if(this.manualDirty||this.manualSaving){this.flushManual().then(()=>this.createFrame(frame)).catch(e=>this.status(e.message));return;}
    if(this.w.busy()||!this.w.state.source)return;frame=number(frame,0,(this.w.sourceInfo?.frames||1)-1);if(frame<this.w.state.startFrame||frame>=this.w.state.startFrame+this.w.state.frameCount){this.status('This frame is outside your clip. Open Trim clip to change the exported range.');return;}
    const old=this.w.state.anchors.findIndex(a=>a.frame===frame);if(old>=0){this.selectFrame(old);return;}
    this.w.state.anchors.push({id:crypto.randomUUID(),frame,file:'',strength:.75,enabled:true,status:'draft',colour_space:this.w.state.sourceColour,versions:[]});
    this.selectFrame(this.w.state.anchors.length-1);this.w.save();
  }
  selectFrame(index){if(this.manualDirty||this.manualSaving){this.flushManual().then(()=>this.selectFrame(index)).catch(e=>this.status(e.message));return;}if(this.w.busy())return;const a=this.w.state.anchors[index];if(!a)return;this.w.selected=index;this.w.syncAnchorControls?.(index);this.w.playhead=a.frame;this.stage='clean';this.$('instruction').value=a.editPrompt||'Remove the selected object and reconstruct the background.';this.w.state.editorStage='clean';this.w.view='anchor';this.active=true;this.candidate=a.candidate||null;this.tool='brush';this.viewer.setTool('brush');this.w.comparison?.hide();if(this.w.$('comparison'))this.w.$('comparison').hidden=true;this.w.updatePlayhead();this.frameChanged(true);this.update();this.w.save();}
  async compareFrame(){try{this.showOriginal=!this.showOriginal;const a=this.selected(),url=this.showOriginal?this.w.thumbnail(this.w.state.source,this.w.playhead,this.w.state.sourceColour,1280):this.candidate?.file?this.w.thumbnail(this.candidate.png_file||this.candidate.file,0,this.candidate.png_file?(this.candidate.preview_colour_space||'srgb_display'):this.candidate.colour_space,1280):this.w.thumbnail(a.preview_file||a.file,0,a.preview_file?(a.preview_colour_space||'srgb_display'):a.colour_space,1280);await this.viewer.setDisplayImage(url);this.viewer.setOpacity(0);this.updateControls();}catch(e){this.status(e.message);}}
  removeFrame(index){if(this.w.busy())return;this.w.state.anchors.splice(index,1);this.w.selected=-1;this.candidate=null;this.w.changed();}
  async downloadFrame(){
    try{const a=this.selected();if(!a)return;await this.ensureProject();const result=await this.w.fetch('/zura/paintout/export-frame',{project:this.project,file:this.w.state.source,frame:a.frame,colour_space:this.w.state.sourceColour});if(result.reference){a.exportReference=result.reference;this.w.save();this.updateControls();}const link=el('a');link.href=this.w.url(result.url);link.download=result.download_name||`paint_${a.frame}.`+(result.path.endsWith('.exr')?'exr':'png');link.click();this.status('Original frame exported. Import the edited image into this same frame card.');}
    catch(e){this.status(e.message);}
  }
  async reviewImportedFrame(result,anchor,selection=this.viewer.getSelection()){
    const w=this.w;
    if(anchor!==this.selected()||anchor.frame!==w.playhead)throw Error('Select the matching clean-frame card and import again.');
    this.importing=true;this.updateControls();
    try{await this.ensureProject();const review=await w.fetch(endpoint+'/review-import',{project:this.project,source:w.state.source,frame:anchor.frame,file:result.file,source_colour_space:w.state.sourceColour,colour_space:result.colour_space,mask:selection.mask,grow:anchor.editGrow??w.state.maskGrow??0,mask_revision:w.state.maskRevision??null});
      if(anchor!==this.selected()||anchor.frame!==w.playhead)throw Error('The selected frame changed. Import into the intended frame again.');
      this.candidate={...result,method:'manual',review,anchor:anchor.id||anchor.frame};anchor.candidate=this.candidate;if(!anchor.file)anchor.status='needs_review';this.frameKey=null;w.save();this.status('Review the red changes outside your repair, then choose which area to keep.');
    }finally{this.importing=false;w.render();if(this.active)await this.frameChanged(true);}
  }
  async acceptImported(scope){
    const w=this.w,anchor=this.selected(),candidate=this.candidate;
    if(w.busy()||!candidate?.review||!anchor||anchor.frame!==w.playhead||String(anchor.id||anchor.frame)!==String(candidate.anchor))return;
    this.importing=true;this.updateControls();
    try{while(this.saving)await new Promise(resolve=>setTimeout(resolve,10));await this.loadDocument();
      const result=await w.fetch(endpoint+'/accept-import-review',{project:this.project,source:w.state.source,frame:anchor.frame,token:candidate.review.token,scope,expected_revision:this.revision});
      anchor.versions=this.frameVersions(anchor);anchor.versions.push({...result,method:'manual'});Object.assign(anchor,{file:result.file,preview_file:result.preview_file||'',colour_space:result.colour_space,status:'accepted',editMask:result.mask,editGrow:0});delete anchor.candidate;this.candidate=null;this.frameKey=null;w.syncAnchorControls?.(w.selected);w.save();this.status(scope==='include'?'Imported edits included in this guide. The video mask is unchanged.':'Imported frame accepted. Pixels outside the repair remain identical to the source.');
    }catch(error){this.status(error.message);}finally{this.importing=false;w.render();if(this.active)await this.frameChanged(true);}
  }
  async importFrame(){
    if(this.w.busy()||this.candidate)return;const index=this.w.selected,anchor=this.selected();if(index<0||anchor?.frame!==this.w.playhead)return;
    const selection=this.viewer.getSelection();try{const result=await this.w.pickAnchors(index);if(result?.file)await this.reviewImportedFrame(result,anchor,selection);}catch(error){this.status(error.message);}
  }
  async importDropped(file){
    if(this.w.busy()||this.candidate)return;
    const anchor=this.selected(),source=this.w.state.source;
    if(!anchor||anchor.frame!==this.w.playhead){this.status('Select the matching clean-frame card before dropping an edited image.');return;}
    try{
      if(!/\.(png|exr|tiff?)$/i.test(file.name))throw Error('Choose an edited PNG, TIFF or EXR frame.');
      if(file.size>100*1024*1024)throw Error('The edited frame exceeds 100 MB.');
      await this.ensureProject();this.importing=true;this.updateControls();this.status('Checking edited frame dimensionsâ€¦');
      const body=new FormData();body.append('project',this.project);body.append('source',source);body.append('frame',String(anchor.frame));body.append('colour_space',anchor.colour_space||this.w.state.sourceColour);body.append('file',file,file.name);
      const response=await this.w.api.fetchApi(endpoint+'/import-frame',{method:'POST',body});
      const result=await response.json();if(!response.ok)throw Error(result.error||'The edited frame could not be imported.');
      if(this.w.state.source!==source||!this.w.state.anchors.includes(anchor))throw Error('The shot changed before import completed. Select the intended frame and import again.');
      if(result.frame!==anchor.frame)throw Error('The imported image did not match the selected source frame.');
      await this.reviewImportedFrame(result,anchor);
    }catch(e){this.status(e.message);}finally{this.importing=false;this.w.render();if(this.active)await this.frameChanged(true);}
  }
  async flushManual(){
    if(this.manualSaving){await this.manualSaving;if(this.manualDirty)return this.flushManual();return;}
    if(this.stage!=='mask'||this.toolJob?.maskSingle)return;
    const segment=this.maskSegment();if(segment?.frame===this.viewer.frame&&segment.paintDirty){const selection=this.viewer.getSelection();segment.pendingMask=selection.mask;segment.seedMask=selection.mask;segment.ready=selection.hasMask;segment.paintDirty=false;this.w.save();this.updateControls();}
    if(!this.manualDirty)return;
    this.manualSaving=(async()=>{
      await this.ensureProject();
      // Project saves and mask commits share the same optimistic revision.
      while(this.saving)await new Promise(resolve=>setTimeout(resolve,20));
      while(this.manualDirty){
        const version=this.manualVersion,frame=this.viewer.frame,selection=this.viewer.getSelection(),project=this.project;
        this.status('Saving mask correction on frame '+frame+'â€¦');
        const doc=await this.w.fetch(endpoint+'/paint-mask',{project,source:this.w.state.source,frame,mask:selection.mask,segment_id:this.activeMaskId(),expected_revision:this.revision,expected_mask_revision:this.w.state.maskRevision??null});
        if(this.project!==project)throw Error('The shot changed before the mask correction could be saved.');
        this.document=doc;this.revision=doc.revision;this.w.state.maskProject=doc.id;this.w.state.maskRevision=doc.mask_revision;this.w.state.maskCoverage=doc.mask_coverage;
        if(version===this.manualVersion){this.manualDirty=false;this.selectionDirty=false;this.subjectChanged=false;this.viewer.setSelection({});}
        this.status('Frame '+frame+' correction saved. Scrub to fix another frame, or track this correction through a section.');
      }
    })();
    try{await this.manualSaving;}catch(e){throw Error('Mask correction was not saved. Stay on this frame and retry. '+e.message);}
    finally{this.manualSaving=null;this.updateControls();}
    this.w.save();this.update();
  }
  async runMask(single,operation){
    if(this.w.busy())return;
    let requestVersion=this.maskEditVersion;this.maskStarting=true;this.maskPreviewStarting=!!single;this.jobProgress=null;this.$('job').querySelector('progress').removeAttribute('value');this.$('job-label').textContent=single?'Updating maskâ€¦':'Preparing trackingâ€¦';this.w.render();
    try{
      if(this.w.modelInfo?.ZuraPaintoutMaskPass&&!this.w.modelInfo.ZuraPaintoutMaskPass.input?.optional?.segment_id)throw Error('Restart ComfyUI once to enable the new mask timeline, then refresh this page.');
      if(!single)await this.flushManual();
      if(!single&&!operation&&(this.selectionDirty||this.subjectChanged||!this.viewer.getSelection().hasMask))throw Error('Wait for the automatic mask preview, or paint the object before tracking.');
      await this.ensureProject();while(this.saving)await new Promise(resolve=>setTimeout(resolve,20));await this.persist();
      let selection=this.viewer.getSelection();const segment=this.maskSegment(),selectionVersion=this.maskEditVersion;requestVersion=selectionVersion;if(single)this.autoPreviewPending=false;
      if(segment&&this.w.playhead!==segment.frame)throw Error('Return to the selection frame before tracking this new mask.');
      if(segment&&!single&&!operation){
        if(!segment.ready||this.selectionDirty||this.subjectChanged)throw Error('Select or paint this object before tracking.');
        selection={positive:[],negative:[],hasMask:true,mask:segment.pendingMask||segment.seedMask};
      }else if(!single&&selection.hasMask&&!operation){selection={positive:[],negative:[],hasMask:true,mask:selection.mask};}
      if(single&&!selection.positive.length)return;
      const hasMask=selection.hasMask&&!this.subjectChanged&&!selection.positive.length&&!selection.negative.length;
      const track=this.trackingRange();
      let start=single?this.w.playhead:segment?Math.max(segment.start,track.start):track.start;
      let end=single?start:segment?Math.min(segment.end,track.end):track.end;
      const active=this.activeMask();if(!single&&!segment&&active?.tracked){start=this.w.playhead;end=Math.min(active.end,track.end);}
      if(this.w.playhead<start||this.w.playhead>end)throw Error('Move the playhead inside the selected mask bar to track.');
      const graph=maskGraph({source:this.w.state.source,project:this.project,revision:this.revision,frame:this.w.playhead,startFrame:start,frameCount:end-start+1,
        colourSpace:this.w.state.sourceColour,operation:operation||this.$('operation').value,direction:!single&&!segment&&active?.tracked?'forward':segment?.direction||'both',selection:{...selection,hasMask},text:'',segmentId:this.activeMaskId(),tracked:!single},this.w.modelInfo);
      await this.queue(graph,'mask',null,{maskSingle:!!single,maskSegment:!!segment,selectionVersion});
    }catch(e){this.autoPreviewPending=!!(single&&requestVersion!==this.maskEditVersion&&this.maskEditKind!=='paint'&&this.viewer.getSelection(false).positive.length);this.status(e.message);}
    finally{this.maskStarting=false;this.maskPreviewStarting=false;this.w.render();if(this.autoPreviewPending&&!this.toolJob)this.scheduleMaskPreview();}
  }

  saveCleanMask(){
    const anchor=this.selected();if(this.stage!=='clean'||!anchor||anchor.frame!==this.viewer.frame||this.candidate)return;
    anchor.editMask=this.viewer.getSelection().mask;anchor.editGrow=Number(this.$('grow').value);this.w.save();this.authoritativePreview().catch(e=>this.status(e.message));
  }
  async cleanFrame(){
    if(this.w.busy()||this.candidate)return;
    try{const a=this.selected();if(!a||a.frame!==this.w.playhead)throw Error('Select the clean-frame card at the frame you want to edit.');const selection=this.viewer.getSelection();
      const availability=frameEditAvailability(this.w.modelInfo);if(!availability.ready)throw Error('Frame cleaning needs: '+availability.missing.join(', '));
      const graph=buildFrameEditGraph({source:this.w.state.source,frame:a.frame,colour_space:this.w.state.sourceColour,mask:selection.mask,
        grow:a.editGrow??this.w.state.maskGrow,feather:0,project:this.w.state.maskProject,mask_revision:this.w.state.maskRevision,context:128,max_side:1024,seed:a.editSeed??this.w.state.seed,prompt:this.$('instruction').value},this.w.modelInfo);
      await this.queue(graph,'frame',a.id||a.frame);
    }catch(e){this.status(e.message);}
  }
  async queue(graph,kind,anchor,details={}){
    this.submitting=true;this.jobProgress=null;this.$('job').querySelector('progress').removeAttribute('value');this.$('job-label').textContent=kind==='mask'?'Submitting maskâ€¦':'Submitting frame cleanupâ€¦';this.status('');this.w.render();
    try{const response=await this.w.fetch('/prompt',{prompt:graph,client_id:this.w.api.clientId,extra_data:{zura_paintout_editor:true}});
      if(!response.prompt_id)throw Error('ComfyUI did not confirm the run. Check the queue before retrying.');
      this.toolJob={id:response.prompt_id,kind,anchor,...details,source:this.w.state.source,frame:this.w.playhead,phase:'Queued',stages:Object.fromEntries(Object.entries(graph).map(([id,n])=>[id,n._meta?.title||n.class_type]))};
      this.$('job-label').textContent='Queued in ComfyUI';this.w.state.editorJob=this.toolJob;this.w.save();this.startPolling();
    }finally{this.submitting=false;this.w.render();}
  }
  startPolling(){if(this.timer)return;this.timer=setInterval(()=>this.poll(),1200);this.poll();}
  async poll(){
    if(!this.toolJob||this.polling)return;this.polling=true;const job=this.toolJob;
    try{const history=await this.w.fetch('/history/'+encodeURIComponent(job.id));if(this.toolJob!==job)return;const entry=history[job.id];
      if(!entry){
        const queue=await this.w.fetch('/queue');if(this.toolJob!==job)return;
        const running=(queue.queue_running||[]).some(item=>item[1]===job.id),present=running||(queue.queue_pending||[]).some(item=>item[1]===job.id);
        this.missingPolls=present?0:(this.missingPolls||0)+1;
        if(this.missingPolls<2){if(!this.jobProgress)this.$('job-label').textContent=running?(job.phase&&job.phase!=='Queued'?job.phase:'Processing mask or frame in ComfyUIâ€¦'):'Queued in ComfyUI';return;}
        this.toolJob=null;this.w.state.editorJob=null;clearInterval(this.timer);this.timer=null;this.missingPolls=0;this.w.save();this.w.render();this.status('This run is no longer in the ComfyUI queue. Your accepted frames and masks are saved.');return;
      }
      this.missingPolls=0;
      if(!entry.status?.completed&&entry.status?.status_str!=='error')return;
      this.toolJob=null;this.w.state.editorJob=null;clearInterval(this.timer);this.timer=null;
      const outputs=Object.values(entry.outputs||{}),mask=outputs.flatMap(o=>o.zura_mask||[])[0],frame=outputs.flatMap(o=>o.zura_frame||[])[0],choices=outputs.flatMap(o=>o.zura_mask_choices||[])[0];
      if(choices&&job.source===this.w.state.source){this.showMaskChoices(choices);this.status('Several subjects matched. Choose a preview above; your saved mask is unchanged.');}
      else if(mask&&job.source===this.w.state.source){
        if(mask.segment_id)this.w.state.activeMaskSegment=mask.segment_id;
        this.w.state.maskProject=mask.project;this.w.state.maskRevision=mask.revision;await this.loadDocument();
        if(job.maskSingle){
          if(job.selectionVersion!==undefined&&job.selectionVersion!==this.maskEditVersion){
            // Keep the user's newer points and displayed seed; only advance the committed revision.
            this.autoPreviewPending=this.maskEditKind!=='paint'&&this.viewer.getSelection(false).positive.length>0;
          }else{
            if(this.maskSegment())await this.acceptSegmentSeed(mask,job.selectionVersion);
            else if(mask.seed_url)await this.viewer.setMask(this.w.url(mask.seed_url));
            if(job.selectionVersion===undefined||job.selectionVersion===this.maskEditVersion){this.subjectChanged=false;this.selectionDirty=false;await this.authoritativePreview();this.status('');}
            else this.autoPreviewPending=this.maskEditKind!=='paint'&&this.viewer.getSelection(false).positive.length>0;
          }
        }else{
          if(job.maskSegment){this.w.state.maskSegmentDraft=null;this.customRange=false;this.$('direction').value='both';this.$('operation').value='replace';this.$('range-start').value=this.w.state.startFrame;this.$('range-end').value=this.w.state.startFrame+this.w.state.frameCount-1;}
          this.subjectChanged=false;this.selectionDirty=false;this.frameKey=null;await this.frameChanged(true);this.status('Mask tracked. Drag its timeline ends to trim, or Add mask for another object.');
        }
      }
      else if(frame&&job.source===this.w.state.source){
        const anchor=this.w.state.anchors.find(a=>String(a.id||a.frame)===String(job.anchor));
        if(anchor){anchor.candidate={...frame,anchor:job.anchor};if(!anchor.file)anchor.status='needs_review';this.candidate=anchor.candidate;await this.viewer.setFrame(this.w.thumbnail(frame.png_file||frame.file,0,frame.png_file?(frame.preview_colour_space||'srgb_display'):frame.colour_space,1280),frame.width,frame.height,frame.frame);this.viewer.setOpacity(0);this.status('Review the cleaned frame, then choose Use clean frame or keep the previous version.');}
        else this.status('The frame finished, but its guide card was removed. The result is available in ComfyUI history.');
      }
      else{const failure=entry.status?.messages?.find(m=>m[0]==='execution_error')?.[1];this.status(failure?.exception_message||'Run stopped without a saved result. Your accepted frames and masks are unchanged.');}
      this.w.save();this.w.render();
    }catch(e){this.status('Reconnecting to your run: '+e.message);}finally{this.polling=false;if(!this.toolJob){if(this.manualDirty)this.flushManual().catch(error=>this.status(error.message));else if(this.autoPreviewPending)this.scheduleMaskPreview(0);}}
  }
  discardFrame(){
    if(this.w.busy()||!this.candidate)return;
    const anchor=this.selected();if(anchor){delete anchor.candidate;if(!this.candidate.review)anchor.editSeed=((anchor.editSeed??Number(this.w.state.seed)) + 1)%2147483647;if(!anchor.file)anchor.status='draft';}
    this.candidate=null;this.frameKey=null;this.w.save();this.frameChanged(true);this.updateControls();this.status('Result discarded. Your mask and saved clean versions are kept.');
  }
  acceptFrame(){const result=this.candidate,a=this.selected();if(!result||result.review||!a||a.frame!==this.w.playhead||String(a.id||a.frame)!==String(result.anchor))return;a.versions||=[];if(a.file&&!a.versions.some(v=>v.file===a.file))a.versions.push({file:a.file,preview_file:a.preview_file,preview_colour_space:a.preview_colour_space,colour_space:a.colour_space});a.versions.push({...result,method:'flux3'});Object.assign(a,{file:result.file,preview_file:result.png_file,preview_colour_space:result.preview_colour_space||'srgb_display',colour_space:result.colour_space,status:'accepted'});delete a.candidate;this.candidate=null;this.w.syncAnchorControls?.(this.w.selected);this.w.changed();this.frameChanged(true);this.status('Clean frame '+a.frame+' will guide the next paintout.');}
  async selectMask(delta){if(this.w.busy()||!this.project)return;try{const doc=await this.loadDocument(),list=doc.mask_history||[],index=list.findIndex(m=>m.revision===doc.mask_revision),next=list[index+delta];if(!next)return;const updated=await this.w.fetch(endpoint+'/mask-select',{project:this.project,mask_revision:next.revision,expected_revision:this.revision});this.document=updated;this.revision=updated.revision;this.w.state.maskRevision=updated.mask_revision;this.w.state.maskCoverage=updated.mask_coverage;await this.frameChanged(true);this.w.changed();}catch(e){this.status(e.message);}}
  async cancel(){this.autoPreviewPending=false;clearTimeout(this.autoPreviewTimer);if(!this.toolJob)return;try{const id=this.toolJob.id;await this.w.fetch('/queue',{delete:[id]});await this.w.fetch('/interrupt',{prompt_id:id});this.status('Cancellation requested for this run.');}catch(e){this.status(e.message);}}
  close(){this.closed=true;this.autoPreviewPending=false;clearTimeout(this.autoPreviewTimer);this.previewSequence++;clearTimeout(this.saveTimer);clearInterval(this.timer);this.timer=null;this.flushManual().then(()=>this.persist()).catch(e=>this.status(e.message));}
}
