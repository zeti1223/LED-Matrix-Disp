const socket = io();

function $(id){ return document.getElementById(id); }

function appendConsole(text){
  const el = $('console');
  el.textContent += text;
  el.scrollTop = el.scrollHeight;
}

function refreshPorts(){
  fetch('/ports').then(r=>r.json()).then(list=>{
    const sel = $('ports');
    sel.innerHTML = '';
    list.forEach(p=>{
      const opt = document.createElement('option'); opt.value = p; opt.textContent = p; sel.appendChild(opt);
    });
    if(list.length) $('status').textContent = 'Ports refreshed';
    else $('status').textContent = 'No ports found';
  }).catch(e=>{ $('status').textContent = 'Error fetching ports'; });
}

document.addEventListener('DOMContentLoaded', ()=>{
  refreshPorts();

  $('refresh').addEventListener('click', refreshPorts);

  $('connect').addEventListener('click', ()=>{
    const port = $('ports').value;
    socket.emit('connect_port', {port});
  });

  $('disconnect').addEventListener('click', ()=>{
    socket.emit('disconnect_port', {});
  });

  $('send-pattern').addEventListener('click', ()=>{
    const p = $('pattern').value;
    socket.emit('send_command', {command: `P ${p}`});
  });

  $('send-color').addEventListener('click', ()=>{
    const r = $('r').value || 0;
    const g = $('g').value || 0;
    const b = $('b').value || 0;
    socket.emit('send_command', {command: `C ${r} ${g} ${b}`});
  });

  $('send-brightness').addEventListener('click', ()=>{
    const v = $('brightness').value;
    socket.emit('send_command', {command: `B ${v}`});
  });

  document.querySelectorAll('.cmd').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const cmd = btn.dataset.cmd;
      socket.emit('send_command', {command: cmd});
    });
  });

  // Preview controls
  $('preview-start').addEventListener('click', ()=>{ startPreview(); });
  $('preview-stop').addEventListener('click', ()=>{ stopPreview(); });
});

socket.on('connect_result', (d)=>{
  $('status').textContent = d.msg || JSON.stringify(d);
  appendConsole(`[connect] ${d.msg}\n`);
});

socket.on('disconnect_result', (d)=>{
  $('status').textContent = 'Disconnected';
  appendConsole('[disconnect]\n');
});

socket.on('send_result', (d)=>{
  appendConsole(`[sent] ${d.command} -> ${d.msg}\n`);
});

socket.on('serial_data', (d)=>{
  appendConsole(d.data);
});

// --- Preview implementation ---
const PREVIEW_W = 8;
const PREVIEW_H = 8;
const canvas = document.getElementById('preview');
const ctx = canvas ? canvas.getContext('2d') : null;
let previewAnim = null;
let previewState = { pattern: 0, r:255, g:255, b:255, brightness:128, step:0 };

function getSelectedState(){
  return {
    pattern: parseInt($('pattern').value||0),
    r: parseInt($('r').value||0),
    g: parseInt($('g').value||0),
    b: parseInt($('b').value||0),
    brightness: parseInt($('brightness').value||128),
  };
}

function startPreview(){
  if(!ctx) return;
  // initialize
  const s = getSelectedState();
  previewState.pattern = s.pattern;
  previewState.r = s.r; previewState.g = s.g; previewState.b = s.b; previewState.brightness = s.brightness;
  previewState.step = 0;
  if(previewAnim) cancelAnimationFrame(previewAnim);
  function loop(){
    renderPreviewFrame(previewState);
    previewState.step = (previewState.step + 1) % 1024;
    previewAnim = requestAnimationFrame(loop);
  }
  previewAnim = requestAnimationFrame(loop);
}

function stopPreview(){
  if(previewAnim) cancelAnimationFrame(previewAnim);
  previewAnim = null;
}

function renderPreviewFrame(state){
  const w = canvas.width;
  const h = canvas.height;
  const cellW = Math.floor(w / PREVIEW_W);
  const cellH = Math.floor(h / PREVIEW_H);
  ctx.fillStyle = '#000'; ctx.fillRect(0,0,w,h);

  const bri = state.brightness/255;
  const step = state.step;

  for(let y=0;y<PREVIEW_H;y++){
    for(let x=0;x<PREVIEW_W;x++){
      let color = [0,0,0];
      switch(state.pattern){
        case 0: // static
          color = [state.r*bri, state.g*bri, state.b*bri];
          break;
        case 1: // rainbow
          {
            const hue = (step*4 + (x+y)*8) % 360;
            color = hsvToRgb(hue/360, 1, bri);
          }
          break;
        case 2: // theater chase
          {
            const idx = (y*PREVIEW_W + x);
            const on = ((idx + Math.floor(step/6)) % 3) === 0;
            if(on) color = hsvToRgb(((idx*10+step)&255)/255,1,bri);
            else color = [0,0,0];
          }
          break;
        case 3: // scanner
          {
            const pos = Math.floor((step/6) % (PREVIEW_W*2));
            const scanX = pos < PREVIEW_W ? pos : (PREVIEW_W*2 -1 - pos);
            if(x === scanX) color = hsvToRgb(((step*5)&255)/255,1,bri);
            else color = [0,0,0];
          }
          break;
        case 4: // color wipe
          {
            const total = PREVIEW_W*PREVIEW_H;
            const index = (step % total);
            const idx = y*PREVIEW_W + x;
            if(idx <= index) color = hsvToRgb(((idx*4+step)&255)/255,1,bri);
            else color = [0,0,0];
          }
          break;
      }
      // draw cell
      ctx.fillStyle = `rgb(${Math.round(color[0])},${Math.round(color[1])},${Math.round(color[2])})`;
      ctx.fillRect(x*cellW+1, y*cellH+1, cellW-2, cellH-2);
    }
  }
}

// simple HSV to RGB (v in [0..1])
function hsvToRgb(h, s, v){
  let r=0,g=0,b=0;
  let i = Math.floor(h*6);
  let f = h*6 - i;
  let p = v * (1 - s);
  let q = v * (1 - f*s);
  let t = v * (1 - (1 - f) * s);
  switch(i%6){
    case 0: r=v; g=t; b=p; break;
    case 1: r=q; g=v; b=p; break;
    case 2: r=p; g=v; b=t; break;
    case 3: r=p; g=q; b=v; break;
    case 4: r=t; g=p; b=v; break;
    case 5: r=v; g=p; b=q; break;
  }
  return [r*255, g*255, b*255];
}

