// Ward set dressing: places the EMR-DAS prop GLBs around each case bed and along the corridor.
import type { Scene } from "@babylonjs/core/scene";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import type { AssetContainer } from "@babylonjs/core/assetContainer";
import { Axis } from "@babylonjs/core/Maths/math.axis";

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const propUrl = (name: string) => `${BASE}/game-assets/3d/props/${name}.glb`;

export interface PropPlacement {
  prop: string;
  x: number;
  y: number;
  z: number;
  scale: number;
  rotY?: number;
  // Undo glTF handedness mirroring on props with readable text.
  mirror?: boolean;
}

export async function placeProps(
  scene: Scene,
  placements: PropPlacement[],
  shadows: ShadowGenerator | undefined,
  isDisposed: () => boolean,
  track: (d: { dispose: () => void }) => void,
) {
  const containers = new Map<string, Promise<AssetContainer>>();
  const load = (prop: string) => {
    let c = containers.get(prop);
    if (!c) {
      c = LoadAssetContainerAsync(propUrl(prop), scene);
      containers.set(prop, c);
    }
    return c;
  };
  await Promise.all(
    placements.map(async (p, i) => {
      try {
        const container = await load(p.prop);
        if (isDisposed()) return;
        const entries = container.instantiateModelsToScene((n) => `${p.prop}${i}_${n}`, false);
        entries.rootNodes.forEach((node) => {
          const t = node as TransformNode;
          t.position.set(p.x, p.y, p.z);
          t.scaling.setAll(p.scale);
          if (p.mirror) t.scaling.x *= -1;
          if (p.rotY) t.rotate(Axis.Y, p.rotY);
          // Prop origins sit at mesh centre; rest the bottom on p.y.
          t.computeWorldMatrix(true);
          t.position.y += p.y - t.getHierarchyBoundingVectors(true).min.y;
          t.getChildMeshes().forEach((m) => {
            m.receiveShadows = true;
            shadows?.addShadowCaster(m);
          });
        });
        track(entries);
      } catch (error) {
        console.error(`[wardProps] ${p.prop} load failed`, error);
      }
    }),
  );
  containers.forEach((c) => c.then((ct: AssetContainer) => track(ct)).catch(() => {}));
}
