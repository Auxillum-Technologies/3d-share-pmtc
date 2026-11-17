// hubCharacters.ts — Blender-built GLB characters (doctor, nurse, patient) for the 3D hub.

import "@babylonjs/loaders/glTF";
import type { Scene } from "@babylonjs/core/scene";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import type { AssetContainer } from "@babylonjs/core/assetContainer";
import type { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { ASSETS } from "./assets";

// Staff wear coats or scrubs; patients wear gowns.
export type StaffKind = "drLara" | "drRamon" | "nurseMaria" | "nurseJames";
export type PatientKind = "patientA" | "patientB" | "patientC";
export type LobbyPatientKind = "patientALobby" | "patientBLobby" | "patientCLobby";
export type CharacterKind = "doctor" | "nurse" | "patient" | StaffKind | PatientKind | LobbyPatientKind;
export type Clip = "idle" | "walk";

const MODEL_URLS: Record<CharacterKind, string> = {
  doctor: ASSETS.models.doctor,
  nurse: ASSETS.models.nurse,
  patient: ASSETS.models.patient,
  drLara: ASSETS.models.drLara,
  drRamon: ASSETS.models.drRamon,
  nurseMaria: ASSETS.models.nurseMaria,
  nurseJames: ASSETS.models.nurseJames,
  patientA: ASSETS.models.patientA,
  patientB: ASSETS.models.patientB,
  patientC: ASSETS.models.patientC,
  patientALobby: ASSETS.models.patientALobby,
  patientBLobby: ASSETS.models.patientBLobby,
  patientCLobby: ASSETS.models.patientCLobby,
};

// One container per model; NPCs are instantiated from it.
export class CharacterLibrary {
  private containers = new Map<CharacterKind, Promise<AssetContainer>>();

  constructor(private scene: Scene) {}

  load(kind: CharacterKind) {
    let container = this.containers.get(kind);
    if (!container) {
      container = LoadAssetContainerAsync(MODEL_URLS[kind], this.scene).then((c) => {
        // UV islands touch edge to edge, so mip levels blend them into visible seams.
        c.textures.forEach((t) => (t as Texture).updateSamplingMode?.(Texture.BILINEAR_SAMPLINGMODE));
        return c;
      });
      this.containers.set(kind, container);
    }
    return container;
  }

  async spawn(kind: CharacterKind, root: TransformNode, shadows?: ShadowGenerator) {
    const container = await this.load(kind);
    if (root.isDisposed()) return null;
    const entries = container.instantiateModelsToScene((name) => `${root.name}_${name}`, false);
    entries.rootNodes.forEach((node) => {
      node.parent = root;
      node.getChildMeshes().forEach((mesh) => {
        mesh.receiveShadows = true;
        shadows?.addShadowCaster(mesh);
      });
    });
    return new CharacterAnimator(entries.animationGroups, () => entries.dispose());
  }

  dispose() {
    this.containers.forEach((container) => container.then((c) => c.dispose()).catch(() => undefined));
  }
}

export class CharacterAnimator {
  private current: AnimationGroup | null = null;

  constructor(private groups: AnimationGroup[], private disposeModel: () => void) {
    groups.forEach((group) => group.stop());
  }

  play(clip: Clip, speed = 1) {
    const group = this.groups.find((g) => g.name.endsWith(clip)) ?? null;
    if (group && group !== this.current) {
      this.current?.stop();
      group.start(true, speed);
      this.current = group;
    }
    if (group) group.speedRatio = speed;
  }

  // Freeze on the clip's first frame: a still rest pose for lying or sleeping characters.
  hold(clip: Clip) {
    const group = this.groups.find((g) => g.name.endsWith(clip));
    if (!group) return;
    this.current?.stop();
    group.start(false, 1, group.from, group.from);
    group.goToFrame(group.from);
    group.pause();
    this.current = group;
  }

  dispose() {
    this.groups.forEach((group) => group.dispose());
    this.disposeModel();
  }
}

// Player-controlled doctor: turns toward travel direction and swaps idle/walk clips.
export class HubDoctor3D {
  readonly root: TransformNode;
  private animator: CharacterAnimator | null = null;
  private heading = 0;
  private disposed = false;

  constructor(scene: Scene, start: Vector3, library: CharacterLibrary, shadows?: ShadowGenerator) {
    this.root = new TransformNode("hubDoctorRoot", scene);
    this.root.position.copyFrom(start);
    library.spawn("doctor", this.root, shadows)
      .then((animator) => {
        if (this.disposed) animator?.dispose();
        else this.animator = animator;
      })
      .catch((error) => console.error("[HubDoctor3D] model load failed", error));
  }

  update(dt: number, moving: boolean, x: number, z: number) {
    if (moving) {
      const target = Math.atan2(x, z);
      let delta = target - this.heading;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      this.heading += delta * Math.min(1, dt * 12);
      this.root.rotation.y = this.heading;
    }
    this.animator?.play(moving ? "walk" : "idle", moving ? 1.25 : 1);
  }

  dispose() {
    this.disposed = true;
    this.animator?.dispose();
    this.root.dispose(false, true);
  }
}

type Patrol = { from: Vector3; to: Vector3; speed: number };
type NpcSpec = { kind: StaffKind | LobbyPatientKind; position: Vector3; patrol?: Patrol } & ({ heading: number } | { talkTo: Vector3 });

const at = (x: number, z: number) => new Vector3(x, 0, z);

// Lanes: staff at x +-4, patient walkers at x +-1.3 in z 18-54. Talk groups stand at x +-6 or by the desk, clear of their side's doors.
const NPCS: NpcSpec[] = [
  { kind: "drRamon", position: at(0, 72.4), heading: Math.PI },
  { kind: "nurseMaria", position: at(-4, 18), heading: 0, patrol: { from: at(-4, 16), to: at(-4, 56), speed: 2.2 } },
  { kind: "nurseJames", position: at(4, 54), heading: Math.PI, patrol: { from: at(4, 56), to: at(4, 16), speed: 2 } },
  { kind: "patientALobby", position: at(1.3, 20), heading: 0, patrol: { from: at(1.3, 18), to: at(1.3, 52), speed: 1.4 } },
  { kind: "patientCLobby", position: at(-1.3, 50), heading: Math.PI, patrol: { from: at(-1.3, 54), to: at(-1.3, 22), speed: 1.2 } },
  // Groups keep about 3 units centre to centre: bodies are about 2.2 wide.
  { kind: "patientBLobby", position: at(6.6, 10.5), talkTo: at(6.6, 13.5) },
  { kind: "patientCLobby", position: at(6.6, 13.5), talkTo: at(6.6, 10.5) },
  { kind: "drLara", position: at(-6.6, 26.5), talkTo: at(-6.6, 29.5) },
  { kind: "patientALobby", position: at(-6.6, 29.5), talkTo: at(-6.6, 26.5) },
  { kind: "patientBLobby", position: at(-1.6, 67.2), talkTo: at(0, 72.4) },
  { kind: "patientALobby", position: at(1.6, 67.2), talkTo: at(0, 72.4) },
  { kind: "patientBLobby", position: at(-7.0, 44.8), talkTo: at(-6.2, 48) },
  { kind: "patientCLobby", position: at(-7.0, 51.2), talkTo: at(-6.2, 48) },
  { kind: "patientALobby", position: at(-6.2, 48), talkTo: at(-7.0, 48) },
];

// Ambient NPCs: a nurse at the station, a nurse on rounds, patients waiting.
export class HubNpcs {
  private roots: TransformNode[] = [];
  private animators: CharacterAnimator[] = [];
  private patrols: { root: TransformNode; spec: Patrol; dir: 1 | -1 }[] = [];
  private talkers: { root: TransformNode; heading: number; phase: number }[] = [];
  private time = 0;
  private disposed = false;

  constructor(scene: Scene, library: CharacterLibrary, shadows?: ShadowGenerator) {
    NPCS.forEach((spec, index) => {
      const root = new TransformNode(`npc${index}`, scene);
      root.position.copyFrom(spec.position);
      const heading = "heading" in spec ? spec.heading : Math.atan2(spec.talkTo.x - spec.position.x, spec.talkTo.z - spec.position.z);
      root.rotation.y = heading;
      if ("talkTo" in spec) this.talkers.push({ root, heading, phase: index * 1.7 });
      const patrol = spec.patrol;
      this.roots.push(root);
      if (patrol) this.patrols.push({ root, spec: patrol, dir: 1 });
      library.spawn(spec.kind, root, shadows)
        .then((animator) => {
          if (!animator) return;
          if (this.disposed) return animator.dispose();
          animator.play(patrol ? "walk" : "idle", patrol ? 0.9 : 0.6 + (index % 3) * 0.15);
          this.animators.push(animator);
        })
        .catch((error) => console.error("[HubNpcs] model load failed", error));
    });
  }

  update(dt: number) {
    this.time += dt;
    // Talking cue: slow uneven sway toward and away from the listener.
    for (const t of this.talkers) {
      t.root.rotation.y = t.heading + 0.09 * Math.sin(this.time * 1.3 + t.phase) * Math.sin(this.time * 0.37 + t.phase);
    }
    for (const patrol of this.patrols) {
      const target = patrol.dir === 1 ? patrol.spec.to : patrol.spec.from;
      const offset = target.subtract(patrol.root.position);
      const distance = offset.length();
      if (distance < 0.2) {
        patrol.dir = patrol.dir === 1 ? -1 : 1;
        continue;
      }
      const step = offset.scale(Math.min(1, (patrol.spec.speed * dt) / distance));
      patrol.root.position.addInPlace(step);
      patrol.root.rotation.y = Math.atan2(offset.x, offset.z);
    }
  }

  dispose() {
    this.disposed = true;
    this.animators.forEach((animator) => animator.dispose());
    this.roots.forEach((root) => root.dispose(false, true));
  }
}
