import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
// Текстура моделей лежит в public/models/Textures, путь задаём явно: сами .glb могут быть встроены в JS
loader.setResourcePath('models/');
const cache = new Map<string, Promise<THREE.Group>>();

export function loadModel(url: string): Promise<THREE.Group> {
  let p = cache.get(url);
  if (!p) {
    p = loader.loadAsync(url).then((g) => {
      g.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
        }
      });
      return g.scene;
    });
    cache.set(url, p);
  }
  return p.then((scene) => scene.clone(true));
}
