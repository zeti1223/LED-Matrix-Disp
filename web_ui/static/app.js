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
