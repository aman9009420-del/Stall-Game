import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Static batching: merge all plain meshes under `root` that share a material
 * (and shadow flags) into a single mesh. Cuts draw calls for scenery built
 * from many small pieces. Instanced meshes and anything flagged with
 * `userData.noBatch` are left alone. Call once, before the first render.
 */
export function staticBatch(root) {
  root.updateMatrixWorld(true);
  const rootInverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.userData.noBatch) return;
    if (Array.isArray(o.material) || !o.visible) return;
    const attrs = Object.keys(o.geometry.attributes).sort().join(',');
    const key = [o.material.uuid, attrs, o.castShadow, o.receiveShadow, o.renderOrder].join('|');
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(o);
  });

  const m = new THREE.Matrix4();
  let removed = 0;
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    const mixed = list.some((o) => !o.geometry.index);
    const geos = list.map((o) => {
      let g = o.geometry.clone();
      g.applyMatrix4(m.multiplyMatrices(rootInverse, o.matrixWorld));
      g.clearGroups();
      if (mixed && g.index) g = g.toNonIndexed();
      for (const name of Object.keys(g.morphAttributes)) delete g.morphAttributes[name];
      return g;
    });
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    merged.computeBoundingSphere();
    const first = list[0];
    const mesh = new THREE.Mesh(merged, first.material);
    mesh.castShadow = first.castShadow;
    mesh.receiveShadow = first.receiveShadow;
    mesh.renderOrder = first.renderOrder;
    mesh.name = `${first.name || 'batch'}(${list.length})`;
    root.add(mesh);
    for (const o of list) o.parent.remove(o);
    removed += list.length - 1;
  }
  return removed;
}
