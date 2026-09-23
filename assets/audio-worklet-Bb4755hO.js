import"./modulepreload-polyfill-Dezn_h7o.js";/* empty css               */import{n as e,r as t,t as n}from"./audio-worklet-CvzWv1sw.js";function r(e,t){return`
    <div>
      <span class="metric-label">${e}</span>
      <span class="metric-value">${t}</span>
    </div>
  `}var i=document.querySelector(`#app`);if(!i)throw Error(`Missing #app container`);i.innerHTML=`
  <section class="hero">
    <p class="eyebrow">AudioWorklet Demo</p>
    <h1>Noise suppression in the render thread</h1>
    <p class="lead">
      This page uses the public AudioWorklet entrypoint, initializes the forked
      LiteRT bootstrap inside <code>AudioWorkletGlobalScope</code>, and starts
      processing on a live constant source.
    </p>
    <p class="status" id="status">Waiting to start AudioWorklet initialization...</p>
    <p>
      <button id="start-button" type="button">Start worklet</button>
    </p>
  </section>
  <section class="panel-grid">
    <article class="panel">
      <h2>Runtime</h2>
      <div class="metrics" id="runtime-metrics"></div>
    </article>
    <article class="panel">
      <h2>State</h2>
      <div class="metrics" id="state-metrics"></div>
    </article>
  </section>
  <section class="details">
    <div class="panel">
      <h2>Messages</h2>
      <pre id="messages">No messages yet.</pre>
    </div>
  </section>
`;var a=document.querySelector(`#status`),o=document.querySelector(`#start-button`),s=document.querySelector(`#runtime-metrics`),c=document.querySelector(`#state-metrics`),l=document.querySelector(`#messages`);if(!a||!o||!s||!c||!l)throw Error(`Missing expected AudioWorklet demo elements`);var u=a,d=o,f=s,p=c,m=l;function h(e){let t=m.textContent??``;m.textContent=t===`No messages yet.`?e:`${t}\n${e}`}d.addEventListener(`click`,()=>{d.disabled=!0,g()});async function g(){try{u.textContent=`Creating AudioContext and initializing worklet...`;let i=new AudioContext({sampleRate:16e3}),a=new ConstantSourceNode(i,{offset:0});a.start(),await i.resume(),h(`AudioContext resumed.`);let o=await n(i,{threads:!1,numThreads:1});h(`Module URL: ${o.moduleUrl}`);let s=t(o,t=>{h(JSON.stringify(t,null,2)),e(t)&&(p.innerHTML=[r(`Processing`,`started`),r(`Processed quanta`,String(t.processedQuanta))].join(``))}),c=await o.ready;f.innerHTML=[r(`Cross-origin isolated`,globalThis.crossOriginIsolated?`yes`:`no`),r(`LiteRT threads`,c.modelDetails.threads?`enabled`:`disabled`),r(`Configured CPU threads`,String(c.modelDetails.numThreads))].join(``),a.connect(o.node).connect(i.destination),u.textContent=`AudioWorklet ready and connected.`,o.node.addEventListener(`processorerror`,()=>{s(),u.textContent=`AudioWorklet processor error.`,u.classList.add(`error`)})}catch(e){console.error(e),u.textContent=`Failed to initialize AudioWorklet: ${String(e)}`,u.classList.add(`error`),d.disabled=!1}}