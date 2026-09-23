import"./modulepreload-polyfill-Dezn_h7o.js";/* empty css               */import{n as e,r as t,t as n}from"./audio-worklet-CvzWv1sw.js";var r=``+new URL(`audio-worklet-control-processor-B3jFc192.js`,import.meta.url).href,i=``+new URL(`audio-worklet-import-core-processor-DKGrrReD.js`,import.meta.url).href,a=``+new URL(`audio-worklet-import-fft-processor-4USHlA4U.js`,import.meta.url).href,o=document.querySelector(`#app`);if(!o)throw Error(`Missing #app container`);o.innerHTML=`
  <section class="hero">
    <p class="eyebrow">AudioWorklet Validation</p>
    <h1>LiteRT.js initialization in AudioWorkletGlobalScope</h1>
    <p class="lead">
      This page runs three AudioWorklet probes: a bare processor, a processor
      that imports <code>@litertjs/core</code>, a processor that imports
      <code>fft.js</code>, and the public AudioWorklet entrypoint that loads the
      full denoiser from bytes bundled inside the processor module.
    </p>
    <p class="status" id="status">Waiting to start validation...</p>
    <p>
      <button id="start-button" type="button">Run validation</button>
    </p>
  </section>
  <section class="panel-grid">
    <article class="panel">
      <h2>Environment</h2>
      <div class="metrics" id="environment"></div>
    </article>
    <article class="panel">
      <h2>Messages</h2>
      <pre id="messages">No messages yet.</pre>
    </article>
  </section>
`;var s=document.querySelector(`#status`),c=document.querySelector(`#start-button`),l=document.querySelector(`#environment`),u=document.querySelector(`#messages`);if(!s||!c||!l||!u)throw Error(`Missing expected validation elements`);var d=s,f=c,p=l,m=u;function h(e){let t=m.textContent??``;m.textContent=t===`No messages yet.`?e:`${t}\n${e}`}function g(e,t){return`
    <div>
      <span class="metric-label">${e}</span>
      <span class="metric-value">${t}</span>
    </div>
  `}p.innerHTML=[g(`Cross-origin isolated`,globalThis.crossOriginIsolated?`yes`:`no`),g(`Model assets`,`bundled in AudioWorklet`),g(`LiteRT Wasm asset`,`bundled in AudioWorklet`)].join(``);async function _(){f.disabled=!0,d.textContent=`Creating AudioContext and running AudioWorklet probes...`,h(`Starting validation.`);try{let e=new AudioContext({sampleRate:16e3}),t=new ConstantSourceNode(e,{offset:0});t.connect(e.destination),t.start(),await e.resume(),h(`AudioContext resumed.`),await v(e,t,{label:`control`,moduleUrl:r,processorName:`noise-suppression-control`,processorOptions:{liteRtWasmRoot:`/vendor/litert/`}}),await v(e,t,{label:`import-core`,moduleUrl:i,processorName:`noise-suppression-import-core`,processorOptions:{liteRtWasmRoot:`/vendor/litert/`}}),await v(e,t,{label:`import-fft`,moduleUrl:a,processorName:`noise-suppression-import-fft`,processorOptions:{liteRtWasmRoot:`/vendor/litert/`}}),await y(e,t),d.textContent=`All AudioWorklet probes completed. Inspect the messages for initialization and processing status.`}catch(e){console.error(e),h(String(e)),d.textContent=`Validation failed before worklet init: ${String(e)}`,d.classList.add(`error`),f.disabled=!1}}async function v(e,t,n){h(`[${n.label}] loading module: ${n.moduleUrl}`),await e.audioWorklet.addModule(n.moduleUrl),h(`[${n.label}] module loaded.`);let r=new AudioWorkletNode(e,n.processorName,{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1],processorOptions:n.processorOptions});await new Promise((i,a)=>{let o=window.setTimeout(()=>{a(Error(`[${n.label}] timed out waiting for worklet message`))},1e4);r.port.onmessage=a=>{h(`[${n.label}] ${JSON.stringify(a.data,null,2)}`),window.clearTimeout(o),t.connect(r).connect(e.destination),i()},r.onprocessorerror=e=>{window.clearTimeout(o),a(Error(`[${n.label}] processorerror: ${e.type}`))}})}async function y(r,i){h(`[full-init] creating public AudioWorklet handle.`);let a=await n(r,{threads:!1,numThreads:1});h(`[full-init] module loaded: ${a.moduleUrl}`);let o=new Promise((n,r)=>{let i=window.setTimeout(()=>{o(),r(Error(`[full-init] timed out waiting for processing to start`))},1e4),o=t(a,t=>{e(t)&&(h(`[full-init] ${JSON.stringify(t,null,2)}`),window.clearTimeout(i),o(),n())})});i.connect(a.node).connect(r.destination);let s=await a.ready;h(`[full-init] ${JSON.stringify(s,null,2)}`),await o}f.addEventListener(`click`,()=>{_()});