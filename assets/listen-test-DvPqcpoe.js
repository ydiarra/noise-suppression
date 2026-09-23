import"./modulepreload-polyfill-Dezn_h7o.js";/* empty css               */import{i as e,n as t,r as n,t as r}from"./dog_barking_noisy-D_VbMMTe.js";import{n as i,r as a,t as o}from"./audio-worklet-CvzWv1sw.js";var s=[{label:`Restaurant`,url:e},{label:`Helicopter`,url:n},{label:`Air conditioning`,url:t},{label:`Dog barking`,url:r}],c=document.querySelector(`#app`);if(!c)throw Error(`Missing #app container`);c.innerHTML=`
  <section class="hero">
    <p class="eyebrow">Listen Test</p>
    <h1>Noise suppression monitor</h1>
    <p class="lead">
      Route microphone or sample audio to local playback, then switch between
      direct output and the AudioWorklet denoiser.
    </p>
    <p class="status" id="status">Idle. Keep output low when monitoring a live microphone.</p>
  </section>

  <section class="listen-surface">
    <div class="listen-toolbar" aria-label="Listen test controls">
      <fieldset>
        <legend>Source</legend>
        <label><input type="radio" name="source-mode" value="microphone" checked> Microphone</label>
        <label><input type="radio" name="source-mode" value="clip"> Clip</label>
        <label><input type="radio" name="source-mode" value="file"> File</label>
      </fieldset>

      <fieldset>
        <legend>Processing</legend>
        <label><input type="radio" name="processing-mode" value="denoise" checked> Worklet</label>
        <label><input type="radio" name="processing-mode" value="bypass"> Bypass</label>
      </fieldset>

      <label class="stacked-control">
        <span>Clip</span>
        <select id="clip-select">
          ${s.map((e,t)=>`<option value="${t}">${e.label}</option>`).join(``)}
        </select>
      </label>

      <label class="stacked-control">
        <span>File</span>
        <input id="file-input" type="file" accept="audio/*">
      </label>

      <label class="stacked-control gain-control">
        <span>Output</span>
        <input id="gain-input" type="range" min="0" max="1.5" value="0.45" step="0.01">
      </label>

      <div class="button-row">
        <button id="start-button" type="button">Start</button>
        <button id="stop-button" type="button" disabled>Stop</button>
      </div>
    </div>
  </section>

  <section class="panel-grid">
    <article class="panel">
      <h2>Runtime</h2>
      <div class="metrics" id="runtime-metrics"></div>
    </article>
    <article class="panel">
      <h2>Signal</h2>
      <div class="metrics" id="signal-metrics"></div>
    </article>
  </section>

  <section class="details">
    <div class="panel">
      <h2>Messages</h2>
      <pre id="messages">No messages yet.</pre>
    </div>
  </section>
`;var l=y(`#status`),u=y(`#start-button`),d=y(`#stop-button`),f=y(`#clip-select`),p=y(`#file-input`),m=y(`#gain-input`),h=y(`#runtime-metrics`),g=y(`#signal-metrics`),_=y(`#messages`),v=null;function y(e){let t=document.querySelector(e);if(!t)throw Error(`Missing element: ${e}`);return t}function b(e){let t=document.querySelector(`input[name="${e}"]:checked`);if(!t)throw Error(`Missing selected radio: ${e}`);return t.value}function x(e,t){return`
    <div>
      <span class="metric-label">${e}</span>
      <span class="metric-value">${t}</span>
    </div>
  `}function S(e){let t=_.textContent??``;_.textContent=t===`No messages yet.`?e:`${t}\n${e}`}function C(e,t=!1){l.textContent=e,l.classList.toggle(`error`,t)}async function w(e,t){if(t===`microphone`){let t=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!1,noiseSuppression:!1,autoGainControl:!1}});return{sourceNode:e.createMediaStreamSource(t),microphoneStream:t}}let n=await T(e,t),r=new AudioBufferSourceNode(e,{buffer:n,loop:!0});return r.start(),{sourceNode:r,bufferSource:r}}async function T(e,t){if(t===`file`){let t=p.files?.[0];if(!t)throw Error(`Choose an audio file first.`);return e.decodeAudioData(await t.arrayBuffer())}let n=s[Number(f.value)]??s[0],r=await fetch(n.url);if(!r.ok)throw Error(`Failed to load clip: ${r.status}`);return e.decodeAudioData(await r.arrayBuffer())}async function E(e,t){if(e.sourceNode.disconnect(),e.outputGain.disconnect(),t===`denoise`){e.worklet??=await o(e.context,{threads:!1,numThreads:1,bypassUntilReady:!0}),e.stopMessages??=a(e.worklet,e=>{S(JSON.stringify(e,null,2)),i(e)&&(g.innerHTML=[x(`Mode`,`worklet`),x(`Processed quanta`,String(e.processedQuanta))].join(``))});let t=await e.worklet.ready;e.sourceNode.connect(e.worklet.node).connect(e.outputGain).connect(e.context.destination),h.innerHTML=[x(`Worklet`,`ready`),x(`CPU threads`,String(t.modelDetails.numThreads)),x(`Source rate`,`${e.context.sampleRate} Hz`)].join(``);return}e.sourceNode.connect(e.outputGain).connect(e.context.destination),g.innerHTML=[x(`Mode`,`bypass`),x(`Processed quanta`,`-`)].join(``)}async function D(){await O();let e=b(`source-mode`),t=b(`processing-mode`);u.disabled=!0,d.disabled=!1,C(`Starting audio graph...`),_.textContent=`No messages yet.`;try{let n=new AudioContext({sampleRate:16e3});v={context:n,outputGain:new GainNode(n,{gain:Number(m.value)}),...await w(n,e)},await n.resume(),await E(v,t),C(`Playing locally.`),g.innerHTML=[x(`Source`,e),x(`Output gain`,Number(m.value).toFixed(2))].join(``)}catch(e){await O(),C(e instanceof Error?e.message:String(e),!0)}finally{u.disabled=!1}}async function O(){let e=v;if(v=null,!e){d.disabled=!0;return}e.stopMessages?.(),e.worklet?.dispose(),e.bufferSource?.stop(),e.microphoneStream?.getTracks().forEach(e=>e.stop()),e.sourceNode.disconnect(),e.outputGain.disconnect(),await e.context.close(),d.disabled=!0,C(`Stopped.`)}u.addEventListener(`click`,()=>{D()}),d.addEventListener(`click`,()=>{O()}),m.addEventListener(`input`,()=>{v&&(v.outputGain.gain.value=Number(m.value)),g.innerHTML=[x(`Output gain`,Number(m.value).toFixed(2)),x(`Context`,v?v.context.state:`idle`)].join(``)}),document.querySelectorAll(`input[name="processing-mode"]`).forEach(e=>{e.addEventListener(`change`,()=>{v&&(C(`Switching route...`),E(v,b(`processing-mode`)).then(()=>C(`Playing locally.`)).catch(e=>{console.error(e),C(e instanceof Error?e.message:String(e),!0)}))})}),window.addEventListener(`pagehide`,()=>{O()});