import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

// Frame-accumulation motion blur. Off (amount 0) most of the time; during the snap
// the previous frames bleed into the current one, smearing the swinging half.
export class TrailPass extends Pass {
  constructor() {
    super();
    this.amount = 0;
    this.history = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.blend = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: { tCur: { value: null }, tPrev: { value: null }, k: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D tCur, tPrev; uniform float k; varying vec2 vUv;
        void main(){ vec4 c = texture2D(tCur, vUv); vec4 p = texture2D(tPrev, vUv); gl_FragColor = mix(c, p, k); }`,
      depthTest: false, depthWrite: false,
    }));
    this.copy = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: { t: { value: null } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: 'uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor = texture2D(t, vUv); }',
      depthTest: false, depthWrite: false,
    }));
  }

  setSize(w, h) { this.history.setSize(w, h); }

  render(renderer, writeBuffer, readBuffer) {
    const u = this.blend.material.uniforms;
    u.tCur.value = readBuffer.texture;
    u.tPrev.value = this.history.texture;
    u.k.value = this.amount;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.blend.render(renderer);
    // store the result as next frame's history
    this.copy.material.uniforms.t.value = this.renderToScreen ? readBuffer.texture : writeBuffer.texture;
    renderer.setRenderTarget(this.history);
    this.copy.render(renderer);
  }
}
