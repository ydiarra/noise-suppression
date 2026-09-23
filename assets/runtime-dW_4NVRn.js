import"./modulepreload-polyfill-Dezn_h7o.js";import{t as e}from"./src-qFkZoEnD.js";/* empty css               */function t(e,t=123456789){let n=new Float32Array(e),r=t>>>0;for(let t=0;t<e;t++)r=1664525*r+1013904223>>>0,n[t]=r/4294967295*2-1;return n}function n(e,t){return`
    <div>
      <span class="metric-label">${e}</span>
      <span class="metric-value">${t}</span>
    </div>
  `}var r=document.querySelector(`#app`);if(!r)throw Error(`Missing #app container`);r.innerHTML=`
  <section class="hero">
    <p class="eyebrow">LiteRT.js Browser Package</p>
    <h1>@workadventure/noise-suppression</h1>
    <p class="lead">
      Browser-only noise suppression built around the DTLN models and LiteRT.js.
      This demo loads the packaged runtime assets, compiles both models, and
      runs one synchronous denoise pass on a 512-sample frame.
    </p>
    <p class="status" id="status">Loading LiteRT.js and compiling models...</p>
  </section>
  <section class="panel-grid">
    <article class="panel">
      <h2>Runtime</h2>
      <div class="metrics" id="runtime-metrics"></div>
    </article>
    <article class="panel">
      <h2>Frame Timing</h2>
      <div class="metrics" id="timing-metrics"></div>
    </article>
  </section>
  <section class="details">
    <div class="panel">
      <h2>Model Details</h2>
      <pre id="details">Waiting for runtime...</pre>
    </div>
  </section>
`;var i=document.querySelector(`#status`),a=document.querySelector(`#runtime-metrics`),o=document.querySelector(`#timing-metrics`),s=document.querySelector(`#details`);if(!i||!a||!o||!s)throw Error(`Missing expected demo elements`);try{let r=await e({logModelDetails:!0});await r.ready;let c=r.dtln_create(),l=t(512),u=new Float32Array(512),d=performance.now();r.dtln_denoise(c,l,u);let f=performance.now()-d;r.dtln_stop(c),a.innerHTML=[n(`Cross-origin isolated`,globalThis.crossOriginIsolated?`yes`:`no`),n(`LiteRT threads`,r.modelDetails.threads?`enabled`:`disabled`),n(`Configured CPU threads`,String(r.modelDetails.numThreads))].join(``),o.innerHTML=[n(`Frame size`,`${r.audioConfig.frameSize} samples`),n(`Frame duration`,`${r.audioConfig.frameDuration} ms`),n(`Single frame time`,`${f.toFixed(3)} ms`)].join(``),s.textContent=JSON.stringify(r.modelDetails,null,2),i.textContent=`Runtime ready.`}catch(e){console.error(e),i.textContent=`Failed to initialize runtime: ${String(e)}`,i.classList.add(`error`)}