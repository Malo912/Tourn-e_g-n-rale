// Procedural cartoon characters: modelling (from a "look" description) + procedural animation.
import { Node, Mesh } from '../../engine/scene.js';
import { MeshBuilder, lathe, sphere, capsule, roundedBox, box, torus, cylinder } from '../../engine/geometry.js';
import { MATS } from '../materials.js';
import { clamp, lerp, damp, angleLerp, mixHex } from '../../engine/math.js';
import { RNG } from '../../core/rng.js';

const OUT = 0.011;
const SKINS = [0xf6d3b3, 0xedc19c, 0xe0a982, 0xc88a5f, 0xa86b45, 0x7d4b2e, 0x5c3620, 0xf2c8a8];
const HAIRS = [0x2b1a12, 0x3d2516, 0x5a3a22, 0x8a5a2b, 0xc7953e, 0xe4c16f, 0x1a1a1a, 0x9a9a9a, 0xd9d9d9, 0xa8442a, 0x6b2f1a];

export function randomLook(rng, hints = {}) {
  const pick = (a) => rng.pick(a);
  const female = hints.female ?? rng.chance(0.45);
  const age = hints.age ?? (rng.chance(0.15) ? 'old' : 'adult');
  const hairCol = age === 'old' ? pick([0x9a9a9a, 0xd9d9d9, 0xbdbdbd]) : pick(HAIRS);
  const look = {
    female,
    skin: pick(SKINS),
    hair: hairCol,
    hairStyle: hints.hairStyle ?? (female ? pick(['long', 'bun', 'ponytail', 'curly', 'short']) : pick(age === 'old' ? ['bald', 'short', 'short'] : ['short', 'spiky', 'curly', 'short', 'mohawk', 'bald'])),
    top: hints.top ?? pick([0x3e7cb1, 0xe76f51, 0x2a9d8f, 0xf4a261, 0x8d5a97, 0x264653, 0xe9c46a, 0xd62828, 0x588157, 0xffffff]),
    topStyle: hints.topStyle ?? pick(['tshirt', 'shirt', 'sweater', 'hoodie']),
    stripe: hints.stripe ?? null,
    bottom: hints.bottom ?? pick([0x2b3a55, 0x3c3c3c, 0x5c4033, 0x1d3557, 0x6b705c, 0x22223b]),
    shoes: pick([0x222222, 0x5a3a22, 0xf1f1f1, 0x8b2f22]),
    hat: hints.hat !== undefined ? hints.hat : rng.chance(0.18) ? pick(['cap', 'beanie', 'bucket']) : null,
    hatColor: hints.hatColor ?? pick([0xd62828, 0x1d3557, 0x2a9d8f, 0xf4a261, 0x333333, 0xe9c46a]),
    glasses: hints.glasses ?? rng.chance(0.2),
    beard: hints.beard ?? (!female && rng.chance(age === 'old' ? 0.35 : 0.22)),
    mustache: hints.mustache ?? (!female && rng.chance(0.12)),
    accessory: hints.accessory ?? null,
    accColor: hints.accColor ?? pick([0xd62828, 0x1d3557, 0xf4a261, 0x2a9d8f]),
    build: hints.build ?? pick(['slim', 'normal', 'normal', 'big']),
    height: hints.height ?? rng.range(0.94, 1.07),
    age,
  };
  if (look.hat === 'beret') look.hatColor = 0x22223b;
  return look;
}

function torsoProfile(build, female) {
  const w = build === 'big' ? 1.22 : build === 'slim' ? 0.9 : 1;
  const prof = [
    [0.0001, 0.44], [0.16, 0.45], [0.2, 0.52], [0.215, 0.62], [0.205, 0.74], [0.2, 0.84], [0.18, 0.93], [0.12, 0.99], [0.06, 1.02], [0.0001, 1.03],
  ];
  return prof.map(([r, y]) => {
    let k = w;
    if (build === 'big' && y > 0.5 && y < 0.82) k *= 1 + 0.12 * Math.sin(((y - 0.5) / 0.32) * Math.PI);
    if (female && y > 0.6 && y < 0.72) k *= 0.93;
    return [r * k, y];
  });
}

export class CharacterView {
  constructor(look, opts = {}) {
    this.look = look;
    this.root = new Node('char');
    this.body = new Node('body');
    this.root.add(this.body);
    const L = look;
    const s = L.height;
    this.root.setScale(s, s, s);
    this._build();
    // animation state
    this.t = Math.random() * 10;
    this.walkPhase = 0;
    this.moving = 0; // 0..1 blend
    this.speed = 0;
    this.pose = 'stand'; // stand | sit | stool
    this.action = null; // drink | wave | talk | laugh | watch | phone | cheer | angry | pour | wipe | hammer | carry | keg | mop | write | pay | shrug | dance
    this.actionT = 0;
    this.mood = 'neutral'; // happy | neutral | sad | angry | drunk | excited
    this.blinkT = 2;
    this.blink = 0;
    this.facing = 0;
    this.targetFacing = 0;
    this.lookYaw = 0;
    this.seatY = 0.46;
    this.carry = 0; // arms forward holding stuff
    this.highlight = 0;
    this.redness = 0;
    this.drunk = 0;
    this.headTurn = 0;
    this.squash = 0;
  }

  _build() {
    const L = this.look;
    const skinShade = mixHex(L.skin, 0x8a4a3a, 0.12);
    // ---------- legs
    const legGeo = () => {
      const b = new MeshBuilder();
      b.add(capsule(0.074, 0.3, 10, 4), { color: L.bottom, p: [0, -0.2, 0] });
      b.add(roundedBox(0.13, 0.08, 0.21, 0.035, 2), { color: L.shoes, p: [0, -0.43, 0.035] });
      b.add(box(0.135, 0.015, 0.215), { color: mixHex(L.shoes, 0xffffff, 0.5), p: [0, -0.465, 0.035] });
      return b.build();
    };
    const lg = legGeo();
    this.hips = new Node('hips');
    this.hips.position[1] = 0.5;
    this.body.add(this.hips);
    this.legL = new Node('legL');
    this.legR = new Node('legR');
    this.legL.position[0] = -0.095;
    this.legR.position[0] = 0.095;
    const legMeshL = new Mesh(lg, MATS.vc), legMeshR = new Mesh(lg, MATS.vc);
    legMeshL.outline = legMeshR.outline = OUT;
    this.legL.add(legMeshL);
    this.legR.add(legMeshR);
    this.hips.add(this.legL, this.legR);

    // ---------- torso
    const tb = new MeshBuilder();
    const prof = torsoProfile(L.build, L.female);
    tb.add(lathe(prof, 18), { color: L.top });
    // belt / pants top
    tb.add(lathe(prof.slice(0, 3).map(([r, y]) => [r * 1.02, y]), 18), { color: L.bottom });
    const rAt = (y) => {
      for (let i = 1; i < prof.length; i++) if (prof[i][1] >= y) {
        const [r0, y0] = prof[i - 1], [r1, y1] = prof[i];
        return lerp(r0, r1, (y - y0) / (y1 - y0));
      }
      return 0.1;
    };
    if (L.topStyle === 'shirt' || L.topStyle === 'suit') {
      // collar + buttons
      tb.add(torus(0.085, 0.022, 6, 16), { color: L.topStyle === 'suit' ? 0xffffff : mixHex(L.top, 0xffffff, 0.35), r: [Math.PI / 2, 0, 0], p: [0, 0.985, 0.01] });
      for (let i = 0; i < 3; i++) tb.add(sphere(0.012, 6, 4), { color: 0xf5f5f5, p: [0, 0.62 + i * 0.1, rAt(0.62 + i * 0.1) + 0.003] });
    }
    if (L.topStyle === 'suit') {
      tb.add(box(0.05, 0.25, 0.02), { color: 0xffffff, p: [0, 0.86, rAt(0.86) - 0.004] });
    }
    if (L.topStyle === 'hoodie') {
      tb.add(torus(0.1, 0.045, 6, 16), { color: mixHex(L.top, 0x000000, 0.15), r: [Math.PI / 2 - 0.3, 0, 0], p: [0, 0.99, -0.06] });
      tb.add(roundedBox(0.2, 0.09, 0.04, 0.02, 2), { color: mixHex(L.top, 0x000000, 0.12), p: [0, 0.6, rAt(0.6) - 0.005] });
    }
    if (L.topStyle === 'sweater') {
      tb.add(torus(0.095, 0.025, 6, 16), { color: mixHex(L.top, 0x000000, 0.2), r: [Math.PI / 2, 0, 0], p: [0, 0.99, 0] });
    }
    if (L.topStyle === 'jersey' && L.stripe != null) {
      for (const y of [0.64, 0.76]) tb.add(lathe([[rAt(y) + 0.004, y], [rAt(y + 0.05) + 0.004, y + 0.05]], 18, { capBottom: false }), { color: L.stripe });
      tb.add(sphere(0.045, 8, 6), { color: 0xffffff, p: [0.07, 0.86, rAt(0.86) - 0.01], s: [1, 1, 0.3] });
    }
    if (L.topStyle === 'hawaii') {
      const rng = new RNG(L.top);
      for (let i = 0; i < 12; i++) {
        const y = rng.range(0.56, 0.92), a = rng.range(-1.6, 1.6);
        const r = rAt(y);
        tb.add(sphere(0.022, 6, 4), { color: rng.pick([0xffffff, 0xffd166, 0xef476f]), p: [Math.sin(a) * r, y, Math.cos(a) * r], s: [1, 1, 0.4], r: [0, a, 0] });
      }
    }
    if (L.topStyle === 'apron') {
      tb.add(roundedBox(0.3, 0.42, 0.03, 0.02, 2), { color: L.apron ?? 0x2b2b2b, p: [0, 0.64, rAt(0.64) - 0.002] });
      tb.add(box(0.012, 0.18, 0.012), { color: L.apron ?? 0x2b2b2b, p: [0.1, 0.92, rAt(0.9) - 0.01], r: [-0.4, 0, 0.2] });
      tb.add(box(0.012, 0.18, 0.012), { color: L.apron ?? 0x2b2b2b, p: [-0.1, 0.92, rAt(0.9) - 0.01], r: [-0.4, 0, -0.2] });
      tb.add(roundedBox(0.12, 0.08, 0.035, 0.015, 2), { color: mixHex(L.apron ?? 0x2b2b2b, 0xffffff, 0.15), p: [0, 0.55, rAt(0.55) + 0.012] });
    }
    // accessories
    if (L.accessory === 'backpack') {
      tb.add(roundedBox(0.3, 0.34, 0.14, 0.05, 2), { color: L.accColor, p: [0, 0.72, -rAt(0.72) - 0.06] });
      tb.add(roundedBox(0.2, 0.1, 0.05, 0.02, 2), { color: mixHex(L.accColor, 0x000000, 0.2), p: [0, 0.64, -rAt(0.64) - 0.14] });
      for (const sx of [-1, 1]) tb.add(box(0.03, 0.3, 0.02), { color: mixHex(L.accColor, 0x000000, 0.3), p: [sx * 0.11, 0.8, rAt(0.8) + 0.004], r: [0.1, 0, 0] });
    }
    if (L.accessory === 'scarf') {
      tb.add(torus(0.105, 0.04, 8, 18), { color: L.accColor, r: [Math.PI / 2, 0, 0], p: [0, 0.98, 0.01] });
      tb.add(roundedBox(0.07, 0.24, 0.03, 0.015, 2), { color: L.accColor, p: [0.06, 0.84, rAt(0.84) + 0.02], r: [0.1, 0, 0.1] });
      tb.add(box(0.072, 0.03, 0.032), { color: 0xffffff, p: [0.06, 0.78, rAt(0.78) + 0.03], r: [0.1, 0, 0.1] });
    }
    if (L.accessory === 'tie') {
      tb.add(box(0.05, 0.03, 0.02), { color: L.accColor, p: [0, 0.97, rAt(0.97) + 0.005] });
      tb.add(box(0.045, 0.24, 0.015), { color: L.accColor, p: [0, 0.83, rAt(0.83) + 0.008], r: [0.05, 0, 0] });
    }
    if (L.accessory === 'camera') {
      tb.add(roundedBox(0.13, 0.09, 0.06, 0.015, 2), { color: 0x222222, p: [0.04, 0.7, rAt(0.7) + 0.04] });
      tb.add(cylinder(0.03, 0.03, 0.04, 10), { color: 0x444444, r: [Math.PI / 2, 0, 0], p: [0.04, 0.7, rAt(0.7) + 0.085] });
      tb.add(torus(0.17, 0.008, 4, 20, Math.PI), { color: 0x222222, r: [0, 0, Math.PI], p: [0, 0.98, 0.02] });
    }
    if (L.accessory === 'towel') {
      tb.add(roundedBox(0.12, 0.04, 0.28, 0.015, 2), { color: 0xf2f2f2, p: [0.17, 1.0, 0] });
      tb.add(box(0.122, 0.042, 0.03), { color: 0xd64545, p: [0.17, 1.0, 0.08] });
    }
    const torso = new Mesh(tb.build(), MATS.vc);
    torso.outline = OUT;
    this.torso = torso;
    this.body.add(torso);

    // ---------- arms
    const sleeveLong = ['shirt', 'sweater', 'hoodie', 'suit'].includes(L.topStyle);
    const armGeo = (left) => {
      const b = new MeshBuilder();
      const w = L.build === 'big' ? 1.15 : 1;
      b.add(capsule(0.06 * w, 0.14, 8, 3), { color: L.top, p: [0, -0.08, 0] });
      b.add(capsule(0.055 * w, 0.16, 8, 3), { color: sleeveLong ? L.top : L.skin, p: [0, -0.22, 0] });
      if (sleeveLong) b.add(cylinder(0.058 * w, 0.058 * w, 0.03, 10), { color: mixHex(L.top, 0x000000, 0.15), p: [0, -0.3, 0] });
      b.add(sphere(0.068, 10, 8), { color: L.skin, p: [0, -0.37, 0.005] });
      b.add(sphere(0.03, 6, 5), { color: L.skin, p: [left ? 0.05 : -0.05, -0.35, 0.03] });
      return b.build();
    };
    this.armL = new Node('armL');
    this.armR = new Node('armR');
    const sw = L.build === 'big' ? 0.27 : L.build === 'slim' ? 0.215 : 0.235;
    this.armL.position = [-sw, 0.91, 0];
    this.armR.position = [sw, 0.91, 0];
    const amL = new Mesh(armGeo(true), MATS.vc), amR = new Mesh(armGeo(false), MATS.vc);
    amL.outline = amR.outline = OUT;
    this.armL.add(amL);
    this.armR.add(amR);
    this.handL = new Node('handL');
    this.handR = new Node('handR');
    this.handL.position = [0, -0.4, 0.04];
    this.handR.position = [0, -0.4, 0.04];
    this.armL.add(this.handL);
    this.armR.add(this.handR);
    this.body.add(this.armL, this.armR);

    // ---------- head
    this.head = new Node('head');
    this.head.position[1] = 1.0;
    this.body.add(this.head);
    const hb = new MeshBuilder();
    hb.add(sphere(0.255, 20, 16), { color: L.skin, p: [0, 0.25, 0], s: [1, 0.96, 0.95] });
    hb.add(sphere(0.052, 8, 6), { color: skinShade, p: [-0.25, 0.23, 0], s: [0.6, 1, 1] });
    hb.add(sphere(0.052, 8, 6), { color: skinShade, p: [0.25, 0.23, 0], s: [0.6, 1, 1] });
    hb.add(sphere(0.04, 10, 8), { color: mixHex(L.skin, 0xd06a5a, 0.18), p: [0, 0.205, 0.245], s: [1, 0.9, 1] });
    hb.add(cylinder(0.08, 0.09, 0.08, 10), { color: L.skin, p: [0, 0.02, 0] });
    this._hair(hb);
    this._hat(hb);
    if (L.beard) {
      hb.add(sphere(0.262, 16, 8, { thetaStart: Math.PI * 0.55, thetaLen: Math.PI * 0.32, phiStart: -1.25, phiLen: 2.5 }), { color: L.hair, p: [0, 0.25, 0.005] });
    }
    if (L.mustache || L.beard) {
      hb.add(capsule(0.02, 0.07, 6, 3), { color: L.hair, p: [-0.035, 0.165, 0.245], r: [0, 0, 1.3] });
      hb.add(capsule(0.02, 0.07, 6, 3), { color: L.hair, p: [0.035, 0.165, 0.245], r: [0, 0, -1.3] });
    }
    if (L.glasses) {
      hb.add(torus(0.055, 0.009, 6, 16), { color: 0x1d1d1d, p: [-0.09, 0.27, 0.245] });
      hb.add(torus(0.055, 0.009, 6, 16), { color: 0x1d1d1d, p: [0.09, 0.27, 0.245] });
      hb.add(box(0.05, 0.012, 0.012), { color: 0x1d1d1d, p: [0, 0.275, 0.25] });
    }
    this.headMesh = new Mesh(hb.build(), MATS.vc);
    this.headMesh.outline = OUT;
    this.head.add(this.headMesh);

    // eyes
    const eyeGeo = eyeGeometry(L.female);
    this.eyeL = new Mesh(eyeGeo, MATS.vcShiny);
    this.eyeR = new Mesh(eyeGeo, MATS.vcShiny);
    this.eyeL.position = [-0.09, 0.27, 0.205];
    this.eyeR.position = [0.09, 0.27, 0.205];
    this.eyeL.castShadow = this.eyeR.castShadow = false;
    // brows
    const browGeo = browGeometry(L.age === 'old' ? 0xdddddd : L.hair);
    this.browL = new Mesh(browGeo, MATS.vc);
    this.browR = new Mesh(browGeo, MATS.vc);
    this.browL.position = [-0.09, 0.355, 0.225];
    this.browR.position = [0.09, 0.355, 0.225];
    this.browL.castShadow = this.browR.castShadow = false;
    // mouths
    this.mouthSmile = new Mesh(mouthSmileGeo(), MATS.vc);
    this.mouthOpen = new Mesh(mouthOpenGeo(), MATS.vc);
    this.mouthFlat = new Mesh(mouthFlatGeo(), MATS.vc);
    for (const m of [this.mouthSmile, this.mouthOpen, this.mouthFlat]) {
      m.position = [0, 0.125, 0.235];
      m.castShadow = false;
    }
    // cheeks
    this.cheeks = new Mesh(cheekGeo(), MATS.vcSoft);
    this.cheeks.castShadow = false;
    this.cheeks.visible = false;
    this.head.add(this.eyeL, this.eyeR, this.browL, this.browR, this.mouthSmile, this.mouthOpen, this.mouthFlat, this.cheeks);
    this.setMouth('smile');
    this.meshes = [];
    this.root.traverse((n) => n.isMesh && this.meshes.push(n));
  }

  _hair(b) {
    const L = this.look;
    const H = L.hair;
    const c = [0, 0.25, 0];
    const cap = (tilt = -0.35, len = 1.2, r = 0.268) => b.add(sphere(r, 18, 10, { thetaLen: len }), { color: H, p: c, r: [tilt, 0, 0] });
    switch (L.hairStyle) {
      case 'short':
        cap(-0.4, 1.25);
        b.add(sphere(0.262, 16, 8, { thetaStart: 0.9, thetaLen: 1.1, phiStart: Math.PI * 0.62, phiLen: Math.PI * 0.76 }), { color: H, p: c });
        break;
      case 'spiky':
        cap(-0.35, 1.15);
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          b.add(cylinder(0.0001, 0.06, 0.14, 6), { color: H, p: [Math.cos(a) * 0.12, 0.47, Math.sin(a) * 0.12 - 0.02], r: [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5] });
        }
        b.add(cylinder(0.0001, 0.07, 0.17, 6), { color: H, p: [0, 0.52, 0] });
        break;
      case 'mohawk':
        b.add(roundedBox(0.07, 0.16, 0.42, 0.03, 2), { color: H, p: [0, 0.5, -0.02], r: [0.1, 0, 0] });
        b.add(sphere(0.258, 14, 8, { thetaStart: 0.9, thetaLen: 1.0, phiStart: Math.PI * 0.65, phiLen: Math.PI * 0.7 }), { color: H, p: c });
        break;
      case 'bun':
        cap(-0.3, 1.3);
        b.add(sphere(0.262, 16, 8, { thetaStart: 0.9, thetaLen: 1.2, phiStart: Math.PI * 0.6, phiLen: Math.PI * 0.8 }), { color: H, p: c });
        b.add(sphere(0.1, 10, 8), { color: H, p: [0, 0.5, -0.14] });
        break;
      case 'ponytail':
        cap(-0.3, 1.3);
        b.add(sphere(0.262, 16, 8, { thetaStart: 0.9, thetaLen: 1.2, phiStart: Math.PI * 0.6, phiLen: Math.PI * 0.8 }), { color: H, p: c });
        b.add(capsule(0.055, 0.22, 8, 3), { color: H, p: [0, 0.25, -0.3], r: [0.35, 0, 0] });
        break;
      case 'long':
        cap(-0.25, 1.35, 0.272);
        b.add(roundedBox(0.46, 0.5, 0.16, 0.07, 2), { color: H, p: [0, 0.13, -0.12] });
        b.add(roundedBox(0.09, 0.32, 0.1, 0.04, 2), { color: H, p: [-0.21, 0.13, 0.05] });
        b.add(roundedBox(0.09, 0.32, 0.1, 0.04, 2), { color: H, p: [0.21, 0.13, 0.05] });
        break;
      case 'curly':
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          const ring = i % 2;
          b.add(sphere(0.085, 8, 6), { color: H, p: [Math.cos(a) * (0.2 - ring * 0.06), 0.42 + ring * 0.07, Math.sin(a) * (0.2 - ring * 0.06) - 0.05] });
        }
        b.add(sphere(0.1, 8, 6), { color: H, p: [0, 0.5, -0.03] });
        break;
      case 'bald':
        b.add(sphere(0.262, 16, 8, { thetaStart: 1.2, thetaLen: 0.7, phiStart: Math.PI * 0.55, phiLen: Math.PI * 0.9 }), { color: H, p: c });
        break;
      default:
        cap();
    }
  }

  _hat(b) {
    const L = this.look;
    const C = L.hatColor;
    switch (L.hat) {
      case 'cap':
        b.add(sphere(0.275, 18, 8, { thetaLen: Math.PI / 2 }), { color: C, p: [0, 0.29, 0], s: [1, 0.9, 1] });
        b.add(cylinder(0.17, 0.17, 0.02, 16, {}), { color: C, p: [0, 0.3, 0.2], s: [1, 1, 0.75] });
        b.add(sphere(0.025, 6, 4), { color: mixHex(C, 0xffffff, 0.4), p: [0, 0.54, 0] });
        break;
      case 'beanie':
        b.add(sphere(0.28, 18, 10, { thetaLen: Math.PI / 2 }), { color: C, p: [0, 0.3, 0], s: [1, 1.1, 1] });
        b.add(torus(0.27, 0.035, 6, 20), { color: mixHex(C, 0x000000, 0.2), r: [Math.PI / 2, 0, 0], p: [0, 0.32, 0] });
        b.add(sphere(0.06, 8, 6), { color: 0xffffff, p: [0, 0.62, 0] });
        break;
      case 'beret':
        b.add(sphere(0.3, 18, 8), { color: C, p: [0.03, 0.47, -0.01], s: [1, 0.28, 1], r: [0, 0, -0.18] });
        b.add(cylinder(0.008, 0.012, 0.05, 6), { color: C, p: [0.03, 0.56, 0] });
        break;
      case 'bucket':
        b.add(lathe([[0.36, 0.0], [0.27, 0.05], [0.24, 0.2], [0.0001, 0.22]], 18, { capBottom: true }), { color: C, p: [0, 0.33, 0] });
        break;
      case 'flatcap':
        b.add(sphere(0.285, 18, 8, { thetaLen: Math.PI / 2 }), { color: C, p: [0, 0.32, -0.01], s: [1.02, 0.55, 1.08] });
        b.add(cylinder(0.16, 0.16, 0.02, 16), { color: C, p: [0, 0.33, 0.2], s: [1, 1, 0.6] });
        break;
      case 'chef':
        b.add(cylinder(0.24, 0.22, 0.12, 16), { color: 0xffffff, p: [0, 0.48, 0] });
        for (let i = 0; i < 5; i++) b.add(sphere(0.11, 8, 6), { color: 0xffffff, p: [Math.cos(i * 1.26) * 0.12, 0.6, Math.sin(i * 1.26) * 0.12] });
        break;
      default:
    }
  }

  setMouth(kind) {
    if (this._mouth === kind) return;
    this._mouth = kind;
    this.mouthSmile.visible = kind === 'smile' || kind === 'frown';
    this.mouthSmile.rotation[2] = kind === 'frown' ? Math.PI : 0;
    this.mouthSmile.position[1] = kind === 'frown' ? 0.1 : 0.125;
    this.mouthOpen.visible = kind === 'open' || kind === 'o';
    this.mouthOpen.scale[0] = kind === 'o' ? 0.6 : 1;
    this.mouthFlat.visible = kind === 'flat';
  }

  /** attach an item to a hand ('L' | 'R') */
  hold(side, node) {
    const hand = side === 'L' ? this.handL : this.handR;
    for (const c of [...hand.children]) hand.remove(c);
    if (node) {
      node.position = [0, -0.02, 0.03];
      node.rotation = [0, 0, 0];
      hand.add(node);
    }
  }
  clearHands() {
    this.hold('L', null);
    this.hold('R', null);
  }

  setAction(a, duration = 0) {
    if (this.action !== a) this.actionT = 0;
    this.action = a;
    this.actionDur = duration;
  }

  setHighlight(on) {
    const f = on ? [0.12, 0.09, 0.03] : null;
    for (const m of this.meshes) m.flash = f;
  }

  update(dt, moving) {
    this.t += dt;
    this.actionT += dt;
    const t = this.t;
    this.moving = damp(this.moving, moving ? 1 : 0, 12, dt);
    this.facing = angleLerp(this.facing, this.targetFacing, 1 - Math.exp(-12 * dt));
    this.root.rotation[1] = this.facing;
    const mv = this.moving;
    this.walkPhase += dt * (6.5 + this.speed * 2) * mv;

    // ---- blink
    this.blinkT -= dt;
    if (this.blinkT < 0) {
      this.blink = 0.14;
      this.blinkT = 1.8 + Math.random() * 3.5;
    }
    this.blink = Math.max(0, this.blink - dt);
    let eyeOpen = this.blink > 0 ? 0.12 : 1;

    // ---- base pose
    const sw = Math.sin(this.walkPhase);
    let bodyY = 0, bodyLean = 0, bodyRoll = 0;
    let legLx = 0, legRx = 0, legLz = 0, legRz = 0;
    let armLx = 0.05, armRx = 0.05, armLz = -0.1, armRz = 0.1, armLy = 0, armRy = 0;
    let headX = 0, headY = 0, headZ = 0;
    const breathe = Math.sin(t * 2.2) * 0.012;

    if (this.pose === 'sit' || this.pose === 'stool') {
      const stool = this.pose === 'stool';
      bodyY = (stool ? this.seatY : this.seatY) - 0.5;
      legLx = legRx = stool ? -1.25 : -1.5;
      legLz = 0.06; legRz = -0.06;
      armLx = armRx = -0.55;
      armLz = 0.25; armRz = -0.25;
      headX = 0.03;
    } else {
      legLx = sw * 0.7 * mv;
      legRx = -sw * 0.7 * mv;
      armLx = -sw * 0.55 * mv + 0.05;
      armRx = sw * 0.55 * mv + 0.05;
      bodyY = Math.abs(Math.cos(this.walkPhase)) * 0.045 * mv;
      bodyLean = 0.08 * mv;
      bodyRoll = Math.sin(this.walkPhase) * 0.04 * mv;
    }

    // drunk sway
    if (this.drunk > 0) {
      bodyRoll += Math.sin(t * 1.7) * 0.07 * this.drunk;
      headZ += Math.sin(t * 1.3 + 1) * 0.12 * this.drunk;
      eyeOpen = Math.min(eyeOpen, 1 - 0.35 * this.drunk);
    }

    // carrying (worker): arms forward
    if (this.carry > 0 && !this.action) {
      const c = this.carry;
      armLx = lerp(armLx, -1.15, c);
      armRx = lerp(armRx, -1.15, c);
      armLz = lerp(armLz, 0.12, c);
      armRz = lerp(armRz, -0.12, c);
    }

    // ---- actions overlay
    const a = this.action, at = this.actionT;
    let mouth = null;
    switch (a) {
      case 'drink': {
        const cyc = (at % 4.2) / 4.2;
        const sip = cyc > 0.55 ? Math.sin(((cyc - 0.55) / 0.45) * Math.PI) : 0;
        armRx = lerp(-0.85, -2.25, sip);
        armRz = lerp(-0.2, -0.5, sip);
        armRy = lerp(0, -0.3, sip);
        headX = lerp(headX, -0.28, sip);
        if (sip > 0.6) eyeOpen = 0.35;
        break;
      }
      case 'hold': {
        armRx = -0.85;
        armRz = -0.2;
        break;
      }
      case 'wave': {
        armRx = -2.6 + Math.sin(at * 14) * 0.12;
        armRz = 0.25 + Math.sin(at * 10) * 0.35;
        headY = 0;
        mouth = Math.sin(at * 6) > 0 ? 'open' : 'smile';
        break;
      }
      case 'talk': {
        armLx = lerp(armLx, -0.9 + Math.sin(at * 4) * 0.25, 0.8);
        armLz = -0.3 - Math.sin(at * 3) * 0.2;
        headY = Math.sin(at * 1.3) * 0.3;
        headX = Math.sin(at * 5) * 0.06;
        mouth = Math.sin(at * 11) > 0.1 ? 'open' : 'smile';
        break;
      }
      case 'laugh': {
        headX = -0.25 + Math.sin(at * 18) * 0.05;
        bodyY += Math.abs(Math.sin(at * 18)) * 0.02;
        armLx = -0.5; armRx = -0.5;
        armLz = 0.5; armRz = -0.5;
        eyeOpen = 0.15;
        mouth = 'open';
        break;
      }
      case 'watch': {
        const k = Math.min(1, at * 4);
        armLx = lerp(armLx, -1.5, k);
        armLz = lerp(armLz, 0.7, k);
        headX = lerp(0, 0.35, k);
        headY = 0.15 * k;
        mouth = 'flat';
        break;
      }
      case 'impatient': {
        // drumming fingers / foot tap
        armRx = -0.6 + Math.abs(Math.sin(at * 10)) * 0.1;
        if (this.pose === 'stand') legRx = -Math.abs(Math.sin(at * 7)) * 0.2;
        headY = Math.sin(at * 0.9) * 0.6;
        mouth = 'flat';
        break;
      }
      case 'phone': {
        armRx = -1.6; armRz = -0.55; armRy = -0.4;
        armLx = -1.2; armLz = 0.35;
        headX = 0.4;
        break;
      }
      case 'cheer': {
        armLx = -2.8 + Math.sin(at * 12) * 0.15;
        armRx = -2.8 - Math.sin(at * 12) * 0.15;
        armLz = -0.3; armRz = 0.3;
        bodyY += Math.abs(Math.sin(at * 8)) * (this.pose === 'stand' ? 0.12 : 0.04);
        mouth = 'open';
        eyeOpen = 0.2;
        break;
      }
      case 'angry': {
        armLx = -0.4 + Math.sin(at * 8) * 0.3;
        armRx = -0.4 - Math.sin(at * 8) * 0.3;
        armLz = -0.6; armRz = 0.6;
        headX = 0.1;
        headZ = Math.sin(at * 9) * 0.08;
        mouth = 'frown';
        break;
      }
      case 'shrug': {
        armLx = -0.5; armRx = -0.5;
        armLz = -0.9; armRz = 0.9;
        headZ = 0.2;
        mouth = 'flat';
        break;
      }
      case 'dance': {
        armLx = -2.2 + Math.sin(at * 6) * 0.8;
        armRx = -1.0 - Math.sin(at * 6) * 0.8;
        armLz = -0.4; armRz = 0.4;
        bodyRoll += Math.sin(at * 6) * 0.15;
        bodyY += Math.abs(Math.sin(at * 6)) * 0.05;
        headZ = Math.sin(at * 6) * 0.2;
        mouth = 'open';
        break;
      }
      case 'pour': {
        armRx = -1.55 + Math.sin(at * 2) * 0.05;
        armRz = -0.1;
        armLx = -1.05;
        armLz = 0.3;
        headX = 0.25;
        break;
      }
      case 'wipe': {
        armRx = -1.1 + Math.sin(at * 9) * 0.2;
        armRz = Math.cos(at * 9) * 0.3 - 0.1;
        headX = 0.3;
        break;
      }
      case 'hammer': {
        armRx = -1.8 + Math.abs(Math.sin(at * 9)) * 1.0;
        armRz = 0.2;
        armLx = -0.9;
        headX = 0.25;
        mouth = 'flat';
        break;
      }
      case 'write': {
        armLx = -1.1; armLz = 0.3;
        armRx = -1.0 + Math.sin(at * 12) * 0.05; armRz = -0.35;
        headX = 0.3;
        break;
      }
      case 'take': {
        armRx = -1.3; armRz = 0.1;
        headX = 0.25;
        break;
      }
      case 'keg':
      case 'carryBoth': {
        armLx = armRx = -1.2;
        armLz = 0.35; armRz = -0.35;
        break;
      }
      case 'mop': {
        armRx = -0.9 + Math.sin(at * 7) * 0.25;
        armLx = -0.6 + Math.sin(at * 7) * 0.25;
        armLz = 0.3; armRz = -0.3;
        bodyRoll += Math.sin(at * 7) * 0.05;
        break;
      }
      case 'pay': {
        armRx = -1.25; armRz = -0.1;
        mouth = 'smile';
        break;
      }
      case 'sad': {
        headX = 0.35;
        armLx = armRx = 0;
        mouth = 'frown';
        break;
      }
      default:
    }

    // idle variety for seated customers without action
    if (!a && (this.pose === 'sit' || this.pose === 'stool')) {
      headY = Math.sin(t * 0.5 + this.root.id) * 0.35 + this.headTurn;
    } else if (!a) {
      headY += this.headTurn;
    }

    // mood -> face
    const mood = this.mood;
    let browRot = 0, browY = 0;
    if (!mouth) {
      mouth = mood === 'angry' ? 'frown' : mood === 'sad' ? 'frown' : mood === 'excited' ? 'open' : mood === 'neutral' ? (Math.sin(t * 0.3 + this.root.id) > 0.6 ? 'flat' : 'smile') : 'smile';
    }
    if (mood === 'angry' || a === 'angry') { browRot = 0.42; browY = -0.015; }
    else if (mood === 'sad' || a === 'watch' || a === 'impatient') { browRot = -0.3; browY = 0.01; }
    else if (mood === 'excited' || a === 'cheer') { browY = 0.03; }
    this.setMouth(mouth);
    this.browL.rotation[2] = -browRot;
    this.browR.rotation[2] = browRot;
    this.browL.position[1] = this.browR.position[1] = 0.355 + browY;
    this.eyeL.scale[1] = this.eyeR.scale[1] = eyeOpen;
    this.cheeks.visible = this.drunk > 0.3 || a === 'laugh' || mood === 'excited';

    // face redness when angry
    const targetRed = mood === 'angry' || a === 'angry' ? 1 : 0;
    this.redness = damp(this.redness, targetRed, 3, dt);
    this.headMesh.tint = this.redness > 0.02 ? [1 + this.redness * 0.25, 1 - this.redness * 0.35, 1 - this.redness * 0.35] : null;

    // squash (landing / reaction)
    this.squash = damp(this.squash, 0, 8, dt);
    const sq = this.squash;

    // ---- apply
    this.body.position[1] = bodyY + breathe * 0.5;
    this.body.rotation[0] = bodyLean;
    this.body.rotation[2] = bodyRoll;
    this.body.scale[1] = 1 - sq * 0.12 + breathe * 0.3;
    this.body.scale[0] = this.body.scale[2] = 1 + sq * 0.1;
    this.legL.rotation[0] = legLx; this.legL.rotation[2] = legLz;
    this.legR.rotation[0] = legRx; this.legR.rotation[2] = legRz;
    this.armL.rotation[0] = armLx; this.armL.rotation[1] = armLy; this.armL.rotation[2] = armLz;
    this.armR.rotation[0] = armRx; this.armR.rotation[1] = armRy; this.armR.rotation[2] = armRz;
    this.head.rotation[0] = headX;
    this.head.rotation[1] = clamp(headY + this.lookYaw, -1.1, 1.1);
    this.head.rotation[2] = headZ;
    // keep held items upright-ish relative to world when arm rotates
    const fix = (hand, ax) => {
      for (const c of hand.children) c.rotation[0] = -ax * (c.kindTag === 'tray' ? 1 : 0.85);
    };
    fix(this.handR, armRx);
    fix(this.handL, armLx);
  }
}

// ---- shared face geometries
const faceCache = new Map();
function fc(key, fn) {
  if (!faceCache.has(key)) faceCache.set(key, fn());
  return faceCache.get(key);
}
function eyeGeometry(female) {
  return fc('eye' + female, () => {
    const b = new MeshBuilder();
    b.add(sphere(0.062, 12, 10), { color: 0xffffff, s: [0.9, 1.15, 0.55] });
    b.add(sphere(0.036, 10, 8), { color: 0x1b1210, p: [0, -0.005, 0.03], s: [1, 1.15, 0.5] });
    b.add(sphere(0.012, 6, 5), { color: 0xffffff, p: [0.012, 0.012, 0.047] });
    if (female) {
      b.add(box(0.03, 0.008, 0.008), { color: 0x1b1210, p: [-0.05, 0.05, 0.02], r: [0, 0, -0.5] });
      b.add(box(0.03, 0.008, 0.008), { color: 0x1b1210, p: [0.05, 0.05, 0.02], r: [0, 0, 0.5] });
    }
    return b.build();
  });
}
function browGeometry(col) {
  return fc('brow' + col, () => new MeshBuilder().add(roundedBox(0.085, 0.022, 0.025, 0.01, 2), { color: mixHex(col, 0x000000, 0.25) }).build());
}
function mouthSmileGeo() {
  return fc('smile', () => new MeshBuilder().add(torus(0.05, 0.011, 6, 12, Math.PI), { color: 0x6a1f1a, r: [0, 0, Math.PI] }).build());
}
function mouthOpenGeo() {
  return fc('open', () => {
    const b = new MeshBuilder();
    b.add(sphere(0.055, 12, 8, { thetaStart: Math.PI / 2, thetaLen: Math.PI / 2 }), { color: 0x5a1512, s: [1, 1.1, 0.4], p: [0, 0.02, 0] });
    b.add(sphere(0.03, 8, 6), { color: 0xe06c6c, p: [0, -0.02, 0.008], s: [1, 0.5, 0.4] });
    return b.build();
  });
}
function mouthFlatGeo() {
  return fc('flat', () => new MeshBuilder().add(capsule(0.009, 0.06, 6, 2), { color: 0x6a1f1a, r: [0, 0, Math.PI / 2] }).build());
}
function cheekGeo() {
  return fc('cheek', () => {
    const b = new MeshBuilder();
    b.add(sphere(0.045, 8, 6), { color: 0xff7b8a, p: [-0.155, 0.19, 0.19], s: [1, 0.6, 0.3], r: [0, -0.6, 0] });
    b.add(sphere(0.045, 8, 6), { color: 0xff7b8a, p: [0.155, 0.19, 0.19], s: [1, 0.6, 0.3], r: [0, 0.6, 0] });
    return b.build();
  });
}
