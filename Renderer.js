// WebGL2 stylized renderer: toon lighting, soft shadow map, outlines, transparency, glows and decals.
import { mat4, normalMatrix, hexToLinear } from './math.js';
import * as S from './shaders.js';

class Program {
  constructor(gl, vs, fs) {
    this.gl = gl;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(s);
        throw new Error('Shader compile error: ' + log + '\n' + src.split('\n').map((l, i) => i + 1 + ': ' + l).join('\n'));
      }
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Link error: ' + gl.getProgramInfoLog(p));
    this.p = p;
    this.locs = new Map();
    this.frame = -1;
  }
  u(name) {
    let l = this.locs.get(name);
    if (l === undefined) {
      l = this.gl.getUniformLocation(this.p, name);
      this.locs.set(name, l);
    }
    return l;
  }
}

export class Renderer {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: opts.antialias ?? true, alpha: false, powerPreference: 'high-performance', stencil: false });
    if (!gl) throw new Error('WebGL2 indisponible');
    this.gl = gl;
    this.shadows = opts.shadows ?? true;
    this.shadowSize = opts.shadowSize ?? 2048;
    this.pixelRatio = 1;
    this.clearColor = [0.08, 0.05, 0.04];
    this.env = {
      sky: hexToLinear(0xffe2b8).map((v) => v * 0.55),
      ground: hexToLinear(0x5a3a2a).map((v) => v * 0.45),
      sunDir: [0.35, 0.85, 0.4],
      sunColor: hexToLinear(0xfff0d8).map((v) => v * 0.75),
      exposure: 1.0,
      points: [],
      shadowCenter: [6, 0, 5],
      shadowRadius: 12,
    };
    this.time = 0;
    this.frameId = 0;
    this.info = { calls: 0 };

    this.std = new Program(gl, S.standardVS, S.standardFS);
    this.outlineProg = new Program(gl, S.standardVS, S.outlineFS);
    this.depth = new Program(gl, S.depthVS, S.depthFS);
    this.sprite = new Program(gl, S.spriteVS, S.spriteFS);

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.vertexAttrib3f(3, 1, 1, 1);
    gl.vertexAttrib3f(1, 0, 1, 0);
    gl.vertexAttrib2f(2, 0, 0);
    this.aniso = gl.getExtension('EXT_texture_filter_anisotropic');

    // sprite quad
    this.quadVao = gl.createVertexArray();
    gl.bindVertexArray(this.quadVao);
    const qb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, qb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    this._initShadow();
    this.lightVP = mat4.create();
    this._nm = new Float32Array(9);
    this._lists = { opaque: [], transparent: [], outline: [], glows: [], decals: [] };
    this._v3 = [0, 0, 0];
    this.whiteTex = this._makeWhite();
  }

  _makeWhite() {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    return t;
  }

  _initShadow() {
    const gl = this.gl;
    const size = this.shadowSize;
    this.shadowTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, size, size);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    this.shadowFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTex, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  setSize(w, h, dpr = 1) {
    this.pixelRatio = dpr;
    this.width = w;
    this.height = h;
    this.canvas.width = Math.max(1, Math.floor(w * dpr));
    this.canvas.height = Math.max(1, Math.floor(h * dpr));
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
  }

  _vao(geo) {
    if (geo.vao) return geo.vao;
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const bufs = [];
    const attr = (loc, data, size) => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      bufs.push(b);
    };
    attr(0, geo.positions, 3);
    if (geo.normals) attr(1, geo.normals, 3);
    if (geo.uvs) attr(2, geo.uvs, 2);
    if (geo.colors) attr(3, geo.colors, 3);
    if (geo.indices) {
      const ib = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.indices, gl.STATIC_DRAW);
      bufs.push(ib);
    }
    gl.bindVertexArray(null);
    geo.vao = vao;
    geo._buffers = bufs;
    geo._indexType = geo.indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
    return vao;
  }

  _tex(tex) {
    const gl = this.gl;
    if (!tex.glTex) tex.glTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex.glTex);
    if (tex.needsUpdate) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tex.source);
      const wrap = tex.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
      if (tex.nearest) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      } else if (tex.mipmap) {
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        if (this.aniso) gl.texParameterf(gl.TEXTURE_2D, this.aniso.TEXTURE_MAX_ANISOTROPY_EXT, 8);
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      }
      tex.needsUpdate = false;
    }
  }

  _collect(scene) {
    const L = this._lists;
    L.opaque.length = 0; L.transparent.length = 0; L.outline.length = 0; L.glows.length = 0; L.decals.length = 0;
    scene.traverseVisible((n) => {
      if (n.isMesh) {
        if (n.material.transparent) L.transparent.push(n);
        else L.opaque.push(n);
        if (n.outline > 0) L.outline.push(n);
      } else if (n.isGlow) L.glows.push(n);
      else if (n.isDecal) L.decals.push(n);
    });
  }

  _updateLightVP() {
    const e = this.env;
    const c = e.shadowCenter;
    const d = e.sunDir;
    const r = e.shadowRadius;
    const eye = [c[0] + d[0] * 30, c[1] + d[1] * 30, c[2] + d[2] * 30];
    const view = mat4.lookAt(mat4.create(), eye, c, [0, 1, 0]);
    const proj = mat4.ortho(mat4.create(), -r, r, -r, r, 1, 70);
    mat4.multiply(this.lightVP, proj, view);
  }

  render(scene, camera, dt = 0) {
    const gl = this.gl;
    this.time += dt;
    this.frameId++;
    this.info.calls = 0;
    scene.updateWorld(null);
    camera.update();
    this._collect(scene);
    const L = this._lists;

    // ---------- shadow pass
    this._updateLightVP();
    if (this.shadows) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
      gl.viewport(0, 0, this.shadowSize, this.shadowSize);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(2.0, 4.0);
      gl.useProgram(this.depth.p);
      gl.uniformMatrix4fv(this.depth.u('uLightVP'), false, this.lightVP);
      const uModel = this.depth.u('uModel');
      for (const m of L.opaque) {
        if (!m.castShadow) continue;
        gl.bindVertexArray(this._vao(m.geometry));
        gl.uniformMatrix4fv(uModel, false, m.world);
        if (m.material.doubleSided) gl.disable(gl.CULL_FACE);
        this._draw(m.geometry);
        if (m.material.doubleSided) gl.enable(gl.CULL_FACE);
      }
      gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    // ---------- main pass
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(this.clearColor[0], this.clearColor[1], this.clearColor[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    const P = this.std;
    gl.useProgram(P.p);
    this._frameUniforms(P, camera);
    // sort opaque by geometry to reduce VAO switches
    L.opaque.sort((a, b) => a.renderOrder - b.renderOrder || a.geometry.id - b.geometry.id);
    for (const m of L.opaque) this._drawStd(P, m);

    // outlines
    if (L.outline.length) {
      const O = this.outlineProg;
      gl.useProgram(O.p);
      gl.uniformMatrix4fv(O.u('uViewProj'), false, camera.viewProj);
      gl.uniformMatrix4fv(O.u('uLightVP'), false, this.lightVP);
      gl.uniform3f(O.u('uOutlineColor'), 0.09, 0.05, 0.035);
      gl.cullFace(gl.FRONT);
      const uModel = O.u('uModel'), uNM = O.u('uNormalMat'), uOut = O.u('uOutline');
      for (const m of L.outline) {
        gl.bindVertexArray(this._vao(m.geometry));
        gl.uniformMatrix4fv(uModel, false, m.world);
        gl.uniformMatrix3fv(uNM, false, normalMatrix(this._nm, m.world));
        gl.uniform1f(uOut, m.outline);
        this._draw(m.geometry);
      }
      gl.cullFace(gl.BACK);
      gl.useProgram(P.p);
    }

    // decals (ground)
    if (L.decals.length) {
      this._sprites(L.decals, camera, 1);
      gl.useProgram(P.p);
    }

    // transparent
    if (L.transparent.length) {
      const cp = camera.position;
      for (const m of L.transparent) {
        const dx = m.world[12] - cp[0], dy = m.world[13] - cp[1], dz = m.world[14] - cp[2];
        m._depth = dx * dx + dy * dy + dz * dz;
      }
      L.transparent.sort((a, b) => b._depth - a._depth);
      gl.enable(gl.BLEND);
      for (const m of L.transparent) {
        gl.depthMask(m.material.depthWrite);
        if (m.material.additive) gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        else gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        this._drawStd(P, m);
      }
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }

    // glows
    if (L.glows.length) this._sprites(L.glows, camera, 0);
    gl.bindVertexArray(null);
  }

  _sprites(list, camera, mode) {
    const gl = this.gl;
    const S = this.sprite;
    gl.useProgram(S.p);
    gl.uniformMatrix4fv(S.u('uView'), false, camera.view);
    gl.uniformMatrix4fv(S.u('uProj'), false, camera.proj);
    gl.uniform1f(S.u('uMode'), mode);
    gl.uniform1f(S.u('uTime'), this.time);
    gl.enable(gl.BLEND);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    if (mode === 0) gl.blendFunc(gl.ONE, gl.ONE);
    else {
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(-2, -4);
    }
    gl.bindVertexArray(this.quadVao);
    const uC = S.u('uCenter'), uSize = S.u('uSize'), uCol = S.u('uColor'), uI = S.u('uIntensity'), uK = S.u('uKind');
    for (const g of list) {
      gl.uniform3f(uC, g.world[12], g.world[13], g.world[14]);
      gl.uniform1f(uSize, g.size * (g.scale[0] || 1));
      gl.uniform3fv(uCol, g.color);
      gl.uniform1f(uI, mode === 0 ? g.intensity : g.opacity);
      gl.uniform1f(uK, mode === 0 ? 0 : g.kind);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      this.info.calls++;
    }
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
  }

  _frameUniforms(P, camera) {
    const gl = this.gl;
    const e = this.env;
    gl.uniformMatrix4fv(P.u('uViewProj'), false, camera.viewProj);
    gl.uniformMatrix4fv(P.u('uLightVP'), false, this.lightVP);
    gl.uniform3fv(P.u('uSky'), e.sky);
    gl.uniform3fv(P.u('uGround'), e.ground);
    const d = e.sunDir, l = Math.hypot(d[0], d[1], d[2]);
    gl.uniform3f(P.u('uSunDir'), d[0] / l, d[1] / l, d[2] / l);
    gl.uniform3fv(P.u('uSunColor'), e.sunColor);
    gl.uniform3fv(P.u('uCamPos'), camera.position);
    gl.uniform1f(P.u('uExposure'), e.exposure);
    gl.uniform1f(P.u('uShadowOn'), this.shadows ? 1 : 0);
    gl.uniform1f(P.u('uShadowTexel'), 1 / this.shadowSize);
    gl.uniform3f(P.u('uFogColor'), 0, 0, 0);
    gl.uniform2f(P.u('uFog'), 30, 60);
    const pts = e.points.slice(0, S.MAX_POINT_LIGHTS);
    gl.uniform1i(P.u('uNumPoints'), pts.length);
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      gl.uniform4f(P.u(`uPointPos[${i}]`), p.pos[0], p.pos[1], p.pos[2], p.range);
      gl.uniform3f(P.u(`uPointColor[${i}]`), p.color[0] * p.intensity, p.color[1] * p.intensity, p.color[2] * p.intensity);
    }
    gl.uniform1i(P.u('uMap'), 0);
    gl.uniform1i(P.u('uShadowMap'), 1);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1f(P.u('uOutline'), 0);
  }

  _drawStd(P, m) {
    const gl = this.gl;
    const mat = m.material;
    gl.bindVertexArray(this._vao(m.geometry));
    gl.uniformMatrix4fv(P.u('uModel'), false, m.world);
    gl.uniformMatrix3fv(P.u('uNormalMat'), false, normalMatrix(this._nm, m.world));
    const c = mat.color, t = m.tint;
    if (t) gl.uniform3f(P.u('uColor'), c[0] * t[0], c[1] * t[1], c[2] * t[2]);
    else gl.uniform3fv(P.u('uColor'), c);
    gl.uniform3fv(P.u('uEmissive'), mat.emissive);
    const f = m.flash;
    if (f) gl.uniform3fv(P.u('uFlash'), f);
    else gl.uniform3f(P.u('uFlash'), 0, 0, 0);
    gl.uniform1f(P.u('uOpacity'), mat.opacity * (m.opacity ?? 1));
    gl.uniform1f(P.u('uRim'), mat.rim);
    gl.uniform1f(P.u('uSpec'), mat.spec);
    gl.uniform1f(P.u('uToon'), mat.toon);
    gl.uniform1f(P.u('uUnlit'), mat.unlit ? 1 : 0);
    gl.uniform1f(P.u('uReceiveShadow'), m.receiveShadow ? 1 : 0);
    if (mat.map) {
      this._tex(mat.map);
      gl.uniform1f(P.u('uUseMap'), 1);
    } else {
      gl.bindTexture(gl.TEXTURE_2D, this.whiteTex);
      gl.uniform1f(P.u('uUseMap'), 0);
    }
    if (mat.doubleSided) gl.disable(gl.CULL_FACE);
    this._draw(m.geometry);
    if (mat.doubleSided) gl.enable(gl.CULL_FACE);
  }

  _draw(geo) {
    const gl = this.gl;
    if (geo.indices) gl.drawElements(gl.TRIANGLES, geo.count, geo._indexType, 0);
    else gl.drawArrays(gl.TRIANGLES, 0, geo.count);
    this.info.calls++;
  }
}
