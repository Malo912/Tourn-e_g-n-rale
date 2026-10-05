// GLSL sources for the stylized toon renderer.

export const MAX_POINT_LIGHTS = 10;

const common = /* glsl */ `#version 300 es
precision highp float;
`;

export const standardVS = common + /* glsl */ `
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUv;
layout(location=3) in vec3 aColor;
uniform mat4 uModel;
uniform mat3 uNormalMat;
uniform mat4 uViewProj;
uniform mat4 uLightVP;
uniform float uOutline;
out vec3 vWorldPos;
out vec3 vNormal;
out vec2 vUv;
out vec3 vColor;
out vec4 vShadowPos;
void main() {
  vec3 n = normalize(uNormalMat * aNormal);
  vec4 wp = uModel * vec4(aPos, 1.0);
  wp.xyz += n * uOutline;
  vWorldPos = wp.xyz;
  vNormal = n;
  vUv = aUv;
  vColor = aColor;
  vShadowPos = uLightVP * wp;
  gl_Position = uViewProj * wp;
}
`;

export const standardFS = common + /* glsl */ `
precision highp sampler2DShadow;
in vec3 vWorldPos;
in vec3 vNormal;
in vec2 vUv;
in vec3 vColor;
in vec4 vShadowPos;
uniform vec3 uColor;
uniform vec3 uEmissive;
uniform vec3 uFlash;
uniform float uOpacity;
uniform sampler2D uMap;
uniform float uUseMap;
uniform vec3 uSky;
uniform vec3 uGround;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform sampler2DShadow uShadowMap;
uniform float uShadowOn;
uniform float uShadowTexel;
uniform float uReceiveShadow;
uniform int uNumPoints;
uniform vec4 uPointPos[${MAX_POINT_LIGHTS}];
uniform vec3 uPointColor[${MAX_POINT_LIGHTS}];
uniform vec3 uCamPos;
uniform float uRim;
uniform float uSpec;
uniform float uToon;
uniform float uUnlit;
uniform float uExposure;
uniform vec3 uFogColor;
uniform vec2 uFog;
out vec4 fragColor;

float ramp(float x) {
  float t = smoothstep(-0.08, 0.12, x) * 0.62 + smoothstep(0.38, 0.52, x) * 0.38;
  return mix(max(x, 0.0), t, uToon);
}

float shadowFactor() {
  vec3 p = vShadowPos.xyz / vShadowPos.w * 0.5 + 0.5;
  if (p.z > 1.0 || p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) return 1.0;
  float bias = 0.0015;
  float s = 0.0;
  for (int x = -1; x <= 1; x++)
    for (int y = -1; y <= 1; y++)
      s += texture(uShadowMap, vec3(p.xy + vec2(float(x), float(y)) * uShadowTexel * 1.3, p.z - bias));
  return s / 9.0;
}

vec3 aces(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
  vec4 base = vec4(uColor * vColor, 1.0);
  if (uUseMap > 0.5) {
    vec4 t = texture(uMap, vUv);
    base.rgb *= pow(t.rgb, vec3(2.2));
    base.a *= t.a;
  }
  vec3 col;
  if (uUnlit > 0.5) {
    col = base.rgb + uEmissive + uFlash;
  } else {
    vec3 N = normalize(vNormal);
    if (!gl_FrontFacing) N = -N;
    vec3 V = normalize(uCamPos - vWorldPos);
    float hemiT = N.y * 0.5 + 0.5;
    vec3 light = mix(uGround, uSky, hemiT);
    float sh = 1.0;
    if (uShadowOn > 0.5 && uReceiveShadow > 0.5) sh = shadowFactor();
    float ndl = dot(N, uSunDir);
    light += uSunColor * ramp(ndl) * mix(0.35, 1.0, sh);
    light *= mix(0.72, 1.0, sh);
    for (int i = 0; i < ${MAX_POINT_LIGHTS}; i++) {
      if (i >= uNumPoints) break;
      vec3 L = uPointPos[i].xyz - vWorldPos;
      float d = length(L);
      float att = clamp(1.0 - d / uPointPos[i].w, 0.0, 1.0);
      att *= att;
      float nl = ramp(dot(N, L / max(d, 0.001)) * 0.8 + 0.2);
      light += uPointColor[i] * att * nl;
    }
    col = base.rgb * light;
    float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0) * uRim;
    col += rim * (light * 0.5 + vec3(0.25, 0.18, 0.1));
    if (uSpec > 0.0) {
      vec3 H = normalize(uSunDir + V);
      float s = pow(max(dot(N, H), 0.0), 60.0);
      col += smoothstep(0.35, 0.45, s) * uSpec;
    }
    col += uEmissive + uFlash;
    float fd = length(vWorldPos - uCamPos);
    col = mix(col, uFogColor, clamp((fd - uFog.x) / (uFog.y - uFog.x), 0.0, 1.0) * 0.0);
  }
  col = aces(col * uExposure);
  col = pow(col, vec3(1.0 / 2.2));
  fragColor = vec4(col, base.a * uOpacity);
}
`;

export const outlineFS = common + /* glsl */ `
uniform vec3 uOutlineColor;
out vec4 fragColor;
void main() { fragColor = vec4(uOutlineColor, 1.0); }
`;

export const depthVS = common + /* glsl */ `
layout(location=0) in vec3 aPos;
uniform mat4 uModel;
uniform mat4 uLightVP;
void main() { gl_Position = uLightVP * uModel * vec4(aPos, 1.0); }
`;

export const depthFS = common + /* glsl */ `
out vec4 fragColor;
void main() { fragColor = vec4(1.0); }
`;

// Billboard glow (additive) and ground decals share a quad
export const spriteVS = common + /* glsl */ `
layout(location=0) in vec3 aPos;
uniform mat4 uView;
uniform mat4 uProj;
uniform vec3 uCenter;
uniform float uSize;
uniform float uMode; // 0 billboard, 1 ground decal
out vec2 vUv;
void main() {
  vUv = aPos.xy;
  if (uMode < 0.5) {
    vec4 c = uView * vec4(uCenter, 1.0);
    c.xy += aPos.xy * uSize;
    c.z += uSize * 0.3;
    gl_Position = uProj * c;
  } else {
    vec3 wp = uCenter + vec3(aPos.x * uSize, 0.0, aPos.y * uSize);
    gl_Position = uProj * uView * vec4(wp, 1.0);
  }
}
`;

export const spriteFS = common + /* glsl */ `
in vec2 vUv;
uniform vec3 uColor;
uniform float uIntensity;
uniform float uKind;
uniform float uTime;
out vec4 fragColor;
void main() {
  float d = length(vUv);
  if (uKind < 0.5) {
    // soft glow / blob
    float a = pow(clamp(1.0 - d, 0.0, 1.0), 2.2);
    fragColor = vec4(pow(uColor, vec3(1.0/2.2)) * uIntensity * a, a * uIntensity);
  } else if (uKind < 1.5) {
    // puddle: wobbly edge
    float ang = atan(vUv.y, vUv.x);
    float r = 0.82 + 0.1 * sin(ang * 3.0 + 1.3) + 0.06 * sin(ang * 5.0 + uTime * 0.5);
    float a = smoothstep(r, r - 0.06, d);
    float hl = smoothstep(0.35, 0.0, length(vUv - vec2(-0.25, 0.2))) * 0.5;
    fragColor = vec4(pow(uColor, vec3(1.0/2.2)) + hl, a * uIntensity);
  } else {
    // ring marker
    float a = smoothstep(0.08, 0.0, abs(d - 0.8)) * (0.6 + 0.4 * sin(uTime * 6.0));
    fragColor = vec4(pow(uColor, vec3(1.0/2.2)), a * uIntensity);
  }
}
`;
