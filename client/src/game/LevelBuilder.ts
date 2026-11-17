// LevelBuilder.ts — builds one long hospital-corridor level from DAS patient data.
// Style: mission-control navy/teal corridor with amber door lights and cyan monitors.
// Safety: continuous walkable floor across the entire corridor length.

import { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import "@babylonjs/loaders/glTF";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import type { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import type { CharacterLibrary } from "./hubCharacters";
import type { Level, Patient } from "@/lib/patients";
import { ASSETS } from "./assets";
import type { Rect } from "./Player";
import { placeProps, type PropPlacement } from "./wardProps";

export interface BuiltBed {
  patient: Patient;
  x: number;
  root: import("@babylonjs/core/Meshes/transformNode").TransformNode;
  assessed: boolean;
}

const UNIT = 12; // world units per patient room
const FLOOR_Y = -1.2;
// ward-module.glb shell: 5 bays every 6 units across a 30-unit tile, back wall at z WARD_BACK_Z.
const BG_TILE_WIDTH = 30;
const WARD_BACK_Z = 12.6;
const BED_X_IN_TILE = [2.7, 8.7, 14.7, 20.7, 26.7] as const;
// Case patients use every other bed so rooms stay UNIT apart.
const BEDS_PER_CASE = 2;
// Bay furniture from the ward_module layout, relative to bed centre x and back wall z.
// Bed half-width 1.46, curtain at dx -3: side items fit in the 1.5-2.7 gaps.
const BAY_PROPS = [
  { prop: "bed", dx: 0, dy: 0, dz: -2.34, scale: 2.2 },
  { prop: "bedside-cabinet", dx: 2.1, dy: 0, dz: -0.7, scale: 0.9 },
  { prop: "visitor-chair", dx: 2.1, dy: 0, dz: -3.6, scale: 0.8 },
  { prop: "iv-stand", dx: -2.12, dy: 0, dz: -0.9, scale: 1.45 },
  // Real vent ~1.4 m beside a ~1.9 m IV pole, so about 2.0 units tall.
  { prop: "ventilator", dx: -2.15, dy: 0, dz: -2.6, scale: 1.05 },
  { prop: "gas-outlet-panel", dx: 0, dy: 2.7, dz: -0.1, scale: 0.65 },
  { prop: "wall-monitor", dx: 1.4, dy: 3.1, dz: -0.21, scale: 0.44 },
  { prop: "curtain-rail", dx: -3.0, dy: 1.3, dz: -2.7, scale: 2.4, rotY: -Math.PI / 2 },
] as const;
// Blanket covers feet to chest of the lying patient (head toward the back wall).
// y is the mattress top; rise is the hump height over the body.
const BLANKET = { width: 2.8, depth: 3.05, rise: 1.0, y: FLOOR_Y + 1.5, z: 9.7 };
const BED_PATIENTS = ["patientA", "patientB", "patientC"] as const;
// Head-up tilt: raised bed head, feet sink under the blanket.
const BED_TILT = 0.24;
const PATIENT_Y = FLOOR_Y + 1.75;
const PATIENT_Z = 8.6;
const bedX = (slot: number) =>
  Math.floor(slot / BED_X_IN_TILE.length) * BG_TILE_WIDTH + BED_X_IN_TILE[((slot % BED_X_IN_TILE.length) + BED_X_IN_TILE.length) % BED_X_IN_TILE.length];

export class LevelBuilder {
  private disposables: { dispose: () => void }[] = [];
  readonly beds: BuiltBed[] = [];
  readonly floors: Rect[];
  readonly width: number;
  readonly floorY = FLOOR_Y;

  private useTextures: boolean;
  private disposed = false;
  private blanketMat?: StandardMaterial;
  constructor(
    private scene: Scene,
    level: Level,
    opts: { tintHue?: number; useTextures?: boolean; library?: CharacterLibrary; shadows?: ShadowGenerator } = {},
  ) {
    this.useTextures = opts.useTextures ?? true;
    this.width = level.patients.length * UNIT + 14;

    // --- Blender ward bays, tiled along +X ---
    void this.loadWard(opts.tintHue, opts.shadows);

    // Solid continuous walkable hospital floor across the entire corridor length
    this.floors = [{ x: 0, y: FLOOR_Y, w: this.width, h: 4 }];

    // --- Doors + beds ---
    for (let i = 0; i < level.patients.length; i++) {
      const p = level.patients[i];
      this.beds.push(this.placeBed(p, bedX(i * BEDS_PER_CASE), i));
    }

    // --- EMR-DAS props around each case bed, plus level entrance and nurse station ---
    const dressing: PropPlacement[] = [];
    // Furnished bays stop one past the last case bed so the entrance and nurse station stay clear.
    const lastBaySlot = (level.patients.length - 1) * BEDS_PER_CASE + 1;
    for (let slot = 0; slot <= lastBaySlot; slot++) {
      const x = bedX(slot);
      BAY_PROPS.forEach((d) =>
        dressing.push({ prop: d.prop, x: x + d.dx, y: FLOOR_Y + d.dy, z: WARD_BACK_Z + d.dz, scale: d.scale, rotY: "rotY" in d ? d.rotY : undefined }),
      );
    }
    dressing.push(
      { prop: "level-door", x: -3.2, y: FLOOR_Y, z: 12.4, scale: 3.2 },
      { prop: "door-sign", x: -3.2, y: FLOOR_Y + 6.4, z: 12.6, scale: 0.7, mirror: true },
      { prop: "plant", x: -11.4, y: FLOOR_Y, z: 11.6, scale: 1.6 },
      { prop: "bench", x: -7.6, y: FLOOR_Y, z: 11.4, scale: 2.0 },
      { prop: "nurse-desk", x: this.width - 4, y: FLOOR_Y, z: 11, scale: 2.4 },
      { prop: "plant", x: this.width - 0.5, y: FLOOR_Y, z: 11.6, scale: 1.6 },
    );
    void placeProps(scene, dressing, opts.shadows, () => this.disposed, (d) => this.disposables.push(d));

    // --- Lying patient in every ward bed (case beds plus the beds between them) ---
    if (opts.library) {
      const bedCount = (level.patients.length - 1) * BEDS_PER_CASE + 1;
      Array.from({ length: bedCount }, (_, slot) => bedX(slot)).forEach((x, i) => {
        const root = new TransformNode(`bedPatient${i}`, scene);
        root.position.set(x, PATIENT_Y, PATIENT_Z);
        root.rotation.set(-Math.PI / 2 + BED_TILT, Math.PI, 0);
        // Thin the body front-to-back (world up once lying) so a low blanket covers it.
        root.scaling.set(0.75, 0.85, 0.45);
        this.disposables.push(root);
        this.blanket(scene, x, i);
        opts.library!.spawn(BED_PATIENTS[i % BED_PATIENTS.length], root, opts.shadows)
          .then((animator) => {
            if (!animator) return;
            if (this.disposed) return animator.dispose();
            animator.hold("idle");
            this.disposables.push(animator);
          })
          .catch((error) => console.error("[LevelBuilder] patient load failed", error));
      });
    }
  }

  private async loadWard(tintHue: number | undefined, shadows?: ShadowGenerator) {
    try {
      const container = await LoadAssetContainerAsync(ASSETS.models.wardBay, this.scene);
      if (this.disposed) return container.dispose();
      this.disposables.push(container);
      const bays = Math.ceil(this.width / BG_TILE_WIDTH);
      // One extra bay at each end so the camera never sees past the ward.
      for (let b = -1; b <= bays; b++) {
        const entries = container.instantiateModelsToScene((name) => `ward${b}_${name}`, false);
        entries.rootNodes.forEach((node) => {
          (node as TransformNode).position.set(b * BG_TILE_WIDTH + BG_TILE_WIDTH / 2, FLOOR_Y, WARD_BACK_Z);
          node.getChildMeshes().forEach((mesh) => {
            mesh.receiveShadows = true;
            shadows?.addShadowCaster(mesh);
          });
        });
        this.disposables.push(entries);
      }
      // Per-level wall tint keeps levels distinct.
      const hue = tintHue ?? 200;
      this.scene.materials
        .filter((m) => m.name.endsWith("wardWallTint"))
        .forEach((m) => ((m as PBRMaterial).albedoColor = Color3.FromHSV(hue, 0.16, 0.9).toLinearSpace()));
    } catch (error) {
      console.error("[LevelBuilder] ward load failed", error);
    }
  }

  private placeDoor(_x: number, _flip: boolean) {
    // Doors are rendered naturally as part of the hospital-ward-v1 background artwork
  }

  // Sleeping cue: draped blanket (body hump, sides hang to the mattress, white cuff at the chest), slow breathing.
  private blanket(scene: Scene, x: number, index: number) {
    this.blanketMat ??= Object.assign(new StandardMaterial("bedBlanket", scene), {
      diffuseColor: Color3.White(),
      specularColor: Color3.Black(),
      backFaceCulling: false,
    });
    const { width, depth, rise } = BLANKET;
    const mesh = CreateGround(`blanket${index}`, { width, height: depth, subdivisions: 48, updatable: true }, scene);
    const pos = mesh.getVerticesData(VertexBuffer.PositionKind)!;
    const colors: number[] = [];
    const smooth = (a: number, b: number, t: number) => {
      const k = Math.min(1, Math.max(0, (t - a) / (b - a)));
      return k * k * (3 - 2 * k);
    };
    for (let i = 0; i < pos.length; i += 3) {
      const u = Math.abs(pos[i]) / (width / 2); // 0 centre, 1 side edge
      const v = pos[i + 2] / depth + 0.5; // 0 feet, 1 chest
      const across = 1 - smooth(0.72, 1, u); // flat over body, rolls down the sides
      const along = smooth(0, 0.1, v); // rolls down over the feet
      const toes = 0.05 * Math.exp(-(((v - 0.14) / 0.05) ** 2)) * (1 - smooth(0, 0.35, u));
      const cuff = v > 0.87 ? 0.09 : 0;
      const wrinkle = 0.012 * Math.sin(pos[i] * 9 + v * 5) * across;
      const chest = 0.12 * smooth(0.55, 0.8, v) * across; // extra loft over the chest
      pos[i + 1] = rise * across * along + chest + toes + cuff + wrinkle;
      const c = v > 0.87 ? [0.96, 0.97, 0.98] : [0.93, 0.86, 0.74];
      colors.push(c[0], c[1], c[2], 1);
    }
    mesh.updateVerticesData(VertexBuffer.PositionKind, pos);
    mesh.setVerticesData(VertexBuffer.ColorKind, colors);
    const normals: number[] = [];
    VertexData.ComputeNormals(pos, mesh.getIndices()!, normals);
    mesh.updateVerticesData(VertexBuffer.NormalKind, normals);
    mesh.material = this.blanketMat;
    mesh.position.set(x, BLANKET.y, BLANKET.z);
    const phase = index * 1.3;
    const observer = scene.onBeforeRenderObservable.add(() => {
      mesh.scaling.y = 1 + 0.04 * Math.sin(performance.now() / 900 + phase);
    });
    this.disposables.push({ dispose: () => { scene.onBeforeRenderObservable.remove(observer); mesh.dispose(); } });
  }

  private placeBed(patient: Patient, x: number, index: number): BuiltBed {
    const root = new TransformNode(`bed${index}`, this.scene);
    root.position.set(x, FLOOR_Y, 10);

    // Patients are baked into background, eliminating floating overlay seams.
    // Root remains exact interaction/question anchor for this visible bed.
    this.disposables.push(root);
    return { patient, x, root, assessed: false };
  }

  dispose() {
    this.disposed = true;
    for (const d of this.disposables) d.dispose();
  }
}
