(function() {
	//#region src/audio-worklet-global-scope-shim.ts
	if (!("self" in globalThis)) Object.defineProperty(globalThis, "self", {
		configurable: true,
		value: globalThis
	});
	if (!("location" in globalThis)) Object.defineProperty(globalThis, "location", {
		configurable: true,
		value: { href: "https://audio-worklet.local/audio-worklet-processor.js" }
	});
	if (!("TextDecoder" in globalThis)) {
		class AudioWorkletTextDecoder {
			encoding;
			constructor(label = "utf-8") {
				this.encoding = label.toLowerCase();
			}
			decode(input) {
				const bytes = this.toBytes(input);
				if (this.encoding === "utf-16le" || this.encoding === "utf-16") return this.decodeUtf16Le(bytes);
				return this.decodeUtf8(bytes);
			}
			toBytes(input) {
				if (input === void 0) return new Uint8Array();
				if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
				return new Uint8Array(input);
			}
			decodeUtf16Le(bytes) {
				const codeUnits = [];
				for (let i = 0; i + 1 < bytes.length; i += 2) codeUnits.push(bytes[i] | bytes[i + 1] << 8);
				return String.fromCharCode(...codeUnits);
			}
			decodeUtf8(bytes) {
				const codePoints = [];
				for (let i = 0; i < bytes.length;) {
					const first = bytes[i++];
					if (first < 128) {
						codePoints.push(first);
						continue;
					}
					if ((first & 224) === 192 && i < bytes.length) {
						codePoints.push((first & 31) << 6 | bytes[i++] & 63);
						continue;
					}
					if ((first & 240) === 224 && i + 1 < bytes.length) {
						codePoints.push((first & 15) << 12 | (bytes[i++] & 63) << 6 | bytes[i++] & 63);
						continue;
					}
					if ((first & 248) === 240 && i + 2 < bytes.length) {
						codePoints.push((first & 7) << 18 | (bytes[i++] & 63) << 12 | (bytes[i++] & 63) << 6 | bytes[i++] & 63);
						continue;
					}
					codePoints.push(65533);
				}
				return String.fromCodePoint(...codePoints);
			}
		}
		Object.defineProperty(globalThis, "TextDecoder", {
			configurable: true,
			value: AudioWorkletTextDecoder
		});
	}
	if (!("URL" in globalThis)) {
		class AudioWorkletURL {
			href;
			constructor(url, base) {
				if (base !== void 0 && url === ".") {
					const lastSlash = base.lastIndexOf("/");
					this.href = lastSlash >= 0 ? base.slice(0, lastSlash + 1) : base;
					return;
				}
				this.href = url;
			}
			toString() {
				return this.href;
			}
			static createObjectURL() {
				throw new Error("URL.createObjectURL is not available in AudioWorklet.");
			}
			static revokeObjectURL() {}
		}
		Object.defineProperty(globalThis, "URL", {
			configurable: true,
			value: AudioWorkletURL
		});
	}
	if (!("crypto" in globalThis)) Object.defineProperty(globalThis, "crypto", {
		configurable: true,
		value: { getRandomValues(array) {
			if (array) {
				const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
				for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
			}
			return array;
		} }
	});
	//#endregion
	//#region forks/deepfilternet/df.js
	var wasm;
	var heap = new Array(128).fill(void 0);
	heap.push(void 0, null, true, false);
	function getObject(idx) {
		return heap[idx];
	}
	var heap_next = heap.length;
	function dropObject(idx) {
		if (idx < 132) return;
		heap[idx] = heap_next;
		heap_next = idx;
	}
	function takeObject(idx) {
		const ret = getObject(idx);
		dropObject(idx);
		return ret;
	}
	var cachedTextDecoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-8", {
		ignoreBOM: true,
		fatal: true
	}) : { decode: () => {
		throw Error("TextDecoder not available");
	} };
	if (typeof TextDecoder !== "undefined") cachedTextDecoder.decode();
	var cachedUint8Memory0 = null;
	function getUint8Memory0() {
		if (cachedUint8Memory0 === null || cachedUint8Memory0.byteLength === 0) cachedUint8Memory0 = new Uint8Array(wasm.memory.buffer);
		return cachedUint8Memory0;
	}
	function getStringFromWasm0(ptr, len) {
		ptr = ptr >>> 0;
		return cachedTextDecoder.decode(getUint8Memory0().subarray(ptr, ptr + len));
	}
	function addHeapObject(obj) {
		if (heap_next === heap.length) heap.push(heap.length + 1);
		const idx = heap_next;
		heap_next = heap[idx];
		heap[idx] = obj;
		return idx;
	}
	/**
	* Get DeepFilterNet frame size in samples.
	* @param {number} st
	* @returns {number}
	*/
	function df_get_frame_length(st) {
		return wasm.df_get_frame_length(st) >>> 0;
	}
	var WASM_VECTOR_LEN = 0;
	function passArray8ToWasm0(arg, malloc) {
		const ptr = malloc(arg.length * 1, 1) >>> 0;
		getUint8Memory0().set(arg, ptr / 1);
		WASM_VECTOR_LEN = arg.length;
		return ptr;
	}
	/**
	* Create a DeepFilterNet Model
	*
	* Args:
	*     - path: File path to a DeepFilterNet tar.gz onnx model
	*     - atten_lim: Attenuation limit in dB.
	*
	* Returns:
	*     - DF state doing the full processing: stft, DNN noise reduction, istft.
	* @param {Uint8Array} model_bytes
	* @param {number} atten_lim
	* @returns {number}
	*/
	function df_create(model_bytes, atten_lim) {
		const ptr0 = passArray8ToWasm0(model_bytes, wasm.__wbindgen_malloc);
		const len0 = WASM_VECTOR_LEN;
		return wasm.df_create(ptr0, len0, atten_lim) >>> 0;
	}
	var cachedFloat32Memory0 = null;
	function getFloat32Memory0() {
		if (cachedFloat32Memory0 === null || cachedFloat32Memory0.byteLength === 0) cachedFloat32Memory0 = new Float32Array(wasm.memory.buffer);
		return cachedFloat32Memory0;
	}
	function passArrayF32ToWasm0(arg, malloc) {
		const ptr = malloc(arg.length * 4, 4) >>> 0;
		getFloat32Memory0().set(arg, ptr / 4);
		WASM_VECTOR_LEN = arg.length;
		return ptr;
	}
	/**
	* Processes a chunk of samples.
	*
	* Args:
	*     - df_state: Created via df_create()
	*     - input: Input buffer of length df_get_frame_length()
	*     - output: Output buffer of length df_get_frame_length()
	*
	* Returns:
	*     - Local SNR of the current frame.
	* @param {number} st
	* @param {Float32Array} input
	* @returns {Float32Array}
	*/
	function df_process_frame(st, input) {
		const ptr0 = passArrayF32ToWasm0(input, wasm.__wbindgen_malloc);
		const len0 = WASM_VECTOR_LEN;
		return takeObject(wasm.df_process_frame(st, ptr0, len0));
	}
	function handleError(f, args) {
		try {
			return f.apply(this, args);
		} catch (e) {
			wasm.__wbindgen_exn_store(addHeapObject(e));
		}
	}
	typeof FinalizationRegistry === "undefined" || new FinalizationRegistry((ptr) => wasm.__wbg_dfstate_free(ptr >>> 0));
	async function __wbg_load(module, imports) {
		if (typeof Response === "function" && module instanceof Response) {
			if (typeof WebAssembly.instantiateStreaming === "function") try {
				return await WebAssembly.instantiateStreaming(module, imports);
			} catch (e) {
				if (module.headers.get("Content-Type") != "application/wasm") console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);
				else throw e;
			}
			const bytes = await module.arrayBuffer();
			return await WebAssembly.instantiate(bytes, imports);
		} else {
			const instance = await WebAssembly.instantiate(module, imports);
			if (instance instanceof WebAssembly.Instance) return {
				instance,
				module
			};
			else return instance;
		}
	}
	function __wbg_get_imports() {
		const imports = {};
		imports.wbg = {};
		imports.wbg.__wbindgen_object_drop_ref = function(arg0) {
			takeObject(arg0);
		};
		imports.wbg.__wbg_crypto_566d7465cdbb6b7a = function(arg0) {
			const ret = getObject(arg0).crypto;
			return addHeapObject(ret);
		};
		imports.wbg.__wbindgen_is_object = function(arg0) {
			const val = getObject(arg0);
			return typeof val === "object" && val !== null;
		};
		imports.wbg.__wbg_process_dc09a8c7d59982f6 = function(arg0) {
			const ret = getObject(arg0).process;
			return addHeapObject(ret);
		};
		imports.wbg.__wbg_versions_d98c6400c6ca2bd8 = function(arg0) {
			const ret = getObject(arg0).versions;
			return addHeapObject(ret);
		};
		imports.wbg.__wbg_node_caaf83d002149bd5 = function(arg0) {
			const ret = getObject(arg0).node;
			return addHeapObject(ret);
		};
		imports.wbg.__wbindgen_is_string = function(arg0) {
			return typeof getObject(arg0) === "string";
		};
		imports.wbg.__wbg_require_94a9da52636aacbf = function() {
			return handleError(function() {
				const ret = module.require;
				return addHeapObject(ret);
			}, arguments);
		};
		imports.wbg.__wbindgen_is_function = function(arg0) {
			return typeof getObject(arg0) === "function";
		};
		imports.wbg.__wbindgen_string_new = function(arg0, arg1) {
			return addHeapObject(getStringFromWasm0(arg0, arg1));
		};
		imports.wbg.__wbg_msCrypto_0b84745e9245cdf6 = function(arg0) {
			const ret = getObject(arg0).msCrypto;
			return addHeapObject(ret);
		};
		imports.wbg.__wbg_randomFillSync_290977693942bf03 = function() {
			return handleError(function(arg0, arg1) {
				getObject(arg0).randomFillSync(takeObject(arg1));
			}, arguments);
		};
		imports.wbg.__wbg_getRandomValues_260cc23a41afad9a = function() {
			return handleError(function(arg0, arg1) {
				getObject(arg0).getRandomValues(getObject(arg1));
			}, arguments);
		};
		imports.wbg.__wbg_newnoargs_e258087cd0daa0ea = function(arg0, arg1) {
			return addHeapObject(new Function(getStringFromWasm0(arg0, arg1)));
		};
		imports.wbg.__wbg_new_63b92bc8671ed464 = function(arg0) {
			return addHeapObject(new Uint8Array(getObject(arg0)));
		};
		imports.wbg.__wbg_new_9efabd6b6d2ce46d = function(arg0) {
			return addHeapObject(new Float32Array(getObject(arg0)));
		};
		imports.wbg.__wbg_buffer_12d079cc21e14bdb = function(arg0) {
			const ret = getObject(arg0).buffer;
			return addHeapObject(ret);
		};
		imports.wbg.__wbg_newwithbyteoffsetandlength_aa4a17c33a06e5cb = function(arg0, arg1, arg2) {
			return addHeapObject(new Uint8Array(getObject(arg0), arg1 >>> 0, arg2 >>> 0));
		};
		imports.wbg.__wbg_newwithlength_e9b4878cebadb3d3 = function(arg0) {
			return addHeapObject(new Uint8Array(arg0 >>> 0));
		};
		imports.wbg.__wbg_set_a47bac70306a19a7 = function(arg0, arg1, arg2) {
			getObject(arg0).set(getObject(arg1), arg2 >>> 0);
		};
		imports.wbg.__wbg_subarray_a1f73cd4b5b42fe1 = function(arg0, arg1, arg2) {
			return addHeapObject(getObject(arg0).subarray(arg1 >>> 0, arg2 >>> 0));
		};
		imports.wbg.__wbg_newwithbyteoffsetandlength_4a659d079a1650e0 = function(arg0, arg1, arg2) {
			return addHeapObject(new Float32Array(getObject(arg0), arg1 >>> 0, arg2 >>> 0));
		};
		imports.wbg.__wbg_self_ce0dbfc45cf2f5be = function() {
			return handleError(function() {
				const ret = self.self;
				return addHeapObject(ret);
			}, arguments);
		};
		imports.wbg.__wbg_window_c6fb939a7f436783 = function() {
			return handleError(function() {
				const ret = window.window;
				return addHeapObject(ret);
			}, arguments);
		};
		imports.wbg.__wbg_globalThis_d1e6af4856ba331b = function() {
			return handleError(function() {
				const ret = globalThis.globalThis;
				return addHeapObject(ret);
			}, arguments);
		};
		imports.wbg.__wbg_global_207b558942527489 = function() {
			return handleError(function() {
				const ret = global.global;
				return addHeapObject(ret);
			}, arguments);
		};
		imports.wbg.__wbindgen_is_undefined = function(arg0) {
			return getObject(arg0) === void 0;
		};
		imports.wbg.__wbg_call_27c0f87801dedf93 = function() {
			return handleError(function(arg0, arg1) {
				return addHeapObject(getObject(arg0).call(getObject(arg1)));
			}, arguments);
		};
		imports.wbg.__wbindgen_object_clone_ref = function(arg0) {
			return addHeapObject(getObject(arg0));
		};
		imports.wbg.__wbg_call_b3ca7c6051f9bec1 = function() {
			return handleError(function(arg0, arg1, arg2) {
				return addHeapObject(getObject(arg0).call(getObject(arg1), getObject(arg2)));
			}, arguments);
		};
		imports.wbg.__wbindgen_memory = function() {
			const ret = wasm.memory;
			return addHeapObject(ret);
		};
		imports.wbg.__wbindgen_throw = function(arg0, arg1) {
			throw new Error(getStringFromWasm0(arg0, arg1));
		};
		return imports;
	}
	function __wbg_finalize_init(instance, module) {
		wasm = instance.exports;
		__wbg_init.__wbindgen_wasm_module = module;
		cachedFloat32Memory0 = null;
		cachedUint8Memory0 = null;
		return wasm;
	}
	function initSync(module) {
		if (wasm !== void 0) return wasm;
		const imports = __wbg_get_imports();
		if (!(module instanceof WebAssembly.Module)) module = new WebAssembly.Module(module);
		return __wbg_finalize_init(new WebAssembly.Instance(module, imports), module);
	}
	async function __wbg_init(input) {
		if (wasm !== void 0) return wasm;
		if (typeof input === "undefined") input = new URL("/assets/df_bg-bMW9Ox8g.wasm", "" + {}.url);
		const imports = __wbg_get_imports();
		if (typeof input === "string" || typeof Request === "function" && input instanceof Request || typeof URL === "function" && input instanceof URL) input = fetch(input);
		const { instance, module } = await __wbg_load(await input, imports);
		return __wbg_finalize_init(instance, module);
	}
	//#endregion
	//#region src/float32-ring-buffer.ts
	var Float32RingBuffer = class {
		storage;
		readIndex = 0;
		writeIndex = 0;
		availableSamples = 0;
		constructor(size) {
			this.storage = new Float32Array(size);
		}
		availableRead() {
			return this.availableSamples;
		}
		availableWrite() {
			return this.storage.length - this.availableSamples;
		}
		push(source) {
			if (source.length > this.availableWrite()) throw new Error("AudioWorklet ring buffer overflow.");
			let remaining = source.length;
			let sourceOffset = 0;
			while (remaining > 0) {
				const chunk = Math.min(remaining, this.storage.length - this.writeIndex);
				this.storage.set(source.subarray(sourceOffset, sourceOffset + chunk), this.writeIndex);
				this.writeIndex = (this.writeIndex + chunk) % this.storage.length;
				this.availableSamples += chunk;
				remaining -= chunk;
				sourceOffset += chunk;
			}
		}
		pullInto(target) {
			if (target.length > this.availableSamples) return false;
			let remaining = target.length;
			let targetOffset = 0;
			while (remaining > 0) {
				const chunk = Math.min(remaining, this.storage.length - this.readIndex);
				target.set(this.storage.subarray(this.readIndex, this.readIndex + chunk), targetOffset);
				this.readIndex = (this.readIndex + chunk) % this.storage.length;
				this.availableSamples -= chunk;
				remaining -= chunk;
				targetOffset += chunk;
			}
			return true;
		}
		clear() {
			this.readIndex = 0;
			this.writeIndex = 0;
			this.availableSamples = 0;
		}
	};
	//#endregion
	//#region src/pause-gate.ts
	var DIGITAL_SILENCE_DB = -90;
	/**
	* Attenuates the pauses of an already denoised signal, frame by frame.
	*
	* The denoiser runs at a gentle limit so speech keeps no gating artefacts; this gate removes up to
	* `extraAttenuationDb` more in pauses. Speech is detected on the denoised frames, where it stands far above the
	* residual noise whatever the noise type. Output is delayed by `lookaheadFrames`, so the gate ramps open over those
	* frames and is fully open when the first speech frame comes out.
	*/
	var PauseGate = class {
		options;
		queue = [];
		gainDb = 0;
		hangover = 0;
		floorDb;
		constructor(options) {
			this.options = options;
		}
		/** Takes one denoised frame and returns the gated frame from `lookaheadFrames` earlier (silence at first). */
		process(frame) {
			const { extraAttenuationDb, lookaheadFrames, hangoverFrames, releaseDbPerFrame, speechAboveFloorDb } = this.options;
			let energy = 0;
			for (const sample of frame) energy += sample * sample;
			const levelDb = 10 * Math.log10(energy / frame.length + 1e-12);
			if (levelDb > DIGITAL_SILENCE_DB) {
				this.floorDb = Math.min(levelDb, (this.floorDb ?? levelDb) + .1);
				if (levelDb > this.floorDb + speechAboveFloorDb) this.hangover = lookaheadFrames + hangoverFrames;
			}
			this.queue.push(frame.slice());
			if (this.queue.length <= lookaheadFrames) return new Float32Array(frame.length);
			const delayed = this.queue.shift();
			const fromDb = this.gainDb;
			if (this.hangover > 0) {
				this.hangover--;
				this.gainDb = Math.min(0, this.gainDb + extraAttenuationDb / Math.max(1, lookaheadFrames));
			} else this.gainDb = Math.max(-extraAttenuationDb, this.gainDb - releaseDbPerFrame);
			for (let i = 0; i < delayed.length; i++) {
				const db = fromDb + (this.gainDb - fromDb) * i / delayed.length;
				delayed[i] *= 10 ** (db / 20);
			}
			return delayed;
		}
	};
	//#endregion
	//#region src/deepfilternet-shared.ts
	var DEEPFILTERNET_AUDIO_WORKLET_PROCESSOR_NAME = "workadventure-deepfilternet";
	/** DeepFilterNet3 runs at 48 kHz only. */
	var DEEPFILTERNET_SAMPLE_RATE = 48e3;
	//#endregion
	//#region src/deepfilternet-worklet-processor.ts
	var RING_BUFFER_CAPACITY = 4096;
	var DeepFilterNetProcessor = class extends AudioWorkletProcessor {
		bypassUntilReady;
		state;
		frameSamples = 0;
		frame = new Float32Array(0);
		pauseGate;
		inputRing = new Float32RingBuffer(RING_BUFFER_CAPACITY);
		outputRing = new Float32RingBuffer(RING_BUFFER_CAPACITY);
		constructor(options) {
			super();
			const processorOptions = options.processorOptions;
			this.bypassUntilReady = processorOptions.bypassUntilReady;
			this.port.onmessage = (event) => {
				if (event.data.type === "dispose") this.state = void 0;
			};
			try {
				if (sampleRate !== 48e3) throw new Error(`DeepFilterNet3 needs a ${DEEPFILTERNET_SAMPLE_RATE} Hz AudioContext, got ${sampleRate} Hz.`);
				initSync(processorOptions.wasmModule);
				this.state = df_create(new Uint8Array(processorOptions.modelBytes), processorOptions.speechAttenuationDb);
				this.frameSamples = df_get_frame_length(this.state);
				this.frame = new Float32Array(this.frameSamples);
				if (processorOptions.pauseGate) this.pauseGate = new PauseGate(processorOptions.pauseGate);
				const ready = {
					type: "ready",
					frameSamples: this.frameSamples
				};
				this.port.postMessage(ready);
			} catch (error) {
				this.fail(error);
			}
		}
		process(inputs, outputs) {
			const input = inputs[0]?.[0];
			const output = outputs[0]?.[0];
			if (!output) return true;
			if (!input) {
				output.fill(0);
				return true;
			}
			if (this.state === void 0) {
				if (this.bypassUntilReady) output.set(input.subarray(0, output.length));
				else output.fill(0);
				return true;
			}
			try {
				this.inputRing.push(input);
				while (this.inputRing.availableRead() >= this.frameSamples) {
					this.inputRing.pullInto(this.frame);
					const denoised = df_process_frame(this.state, this.frame);
					this.outputRing.push(this.pauseGate ? this.pauseGate.process(denoised) : denoised);
				}
				if (!this.outputRing.pullInto(output)) output.fill(0);
			} catch (error) {
				this.fail(error);
				if (this.bypassUntilReady) output.set(input.subarray(0, output.length));
				else output.fill(0);
			}
			return true;
		}
		fail(error) {
			this.state = void 0;
			const message = {
				type: "error",
				message: error instanceof Error ? error.message : String(error)
			};
			this.port.postMessage(message);
		}
	};
	registerProcessor(DEEPFILTERNET_AUDIO_WORKLET_PROCESSOR_NAME, DeepFilterNetProcessor);
	//#endregion
})();
