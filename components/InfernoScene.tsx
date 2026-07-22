"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { InfernoCircle } from "@/lib/types";

const DEPTH = 15;

function material(color: string, emissive = 0.15, roughness = 0.65) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: new THREE.Color(color).multiplyScalar(emissive),
    roughness,
    metalness: 0.35,
    transparent: true,
    opacity: 0.92
  });
}

function points(count: number, radius: number, depth: number, color: string) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const r = radius * (0.25 + Math.random() * 0.75);
    positions[i * 3] = Math.cos(angle) * r;
    positions[i * 3 + 1] = Math.sin(angle) * r * 0.7;
    positions[i * 3 + 2] = (Math.random() - 0.5) * depth;
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const pointsMaterial = new THREE.PointsMaterial({
    color,
    size: 0.035,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  return new THREE.Points(geometry, pointsMaterial);
}

function addColumns(group: THREE.Group, circle: InfernoCircle) {
  for (let i = 0; i < 14; i += 1) {
    const angle = (i / 14) * Math.PI * 2;
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 5 + Math.random() * 4, 8), material(circle.palette[0], 0.05, 0.85));
    mesh.position.set(Math.cos(angle) * 4.8, Math.sin(angle) * 3.1, (Math.random() - 0.5) * 5);
    mesh.rotation.z = angle + Math.PI / 2;
    group.add(mesh);
  }
}

function addVortex(group: THREE.Group, circle: InfernoCircle) {
  for (let i = 0; i < 18; i += 1) {
    const curve = new THREE.TorusKnotGeometry(1.8 + i * 0.045, 0.025 + (i % 3) * 0.012, 90, 6, 2 + (i % 2), 3);
    const mesh = new THREE.Mesh(curve, material(i % 2 ? circle.palette[0] : circle.palette[1], 0.55, 0.35));
    mesh.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2);
    mesh.scale.setScalar(0.8 + i * 0.035);
    group.add(mesh);
  }
}

function addRain(group: THREE.Group, circle: InfernoCircle) {
  const geometry = new THREE.BufferGeometry();
  const count = 900;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 10;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 8;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 8;
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  group.add(new THREE.Points(geometry, new THREE.PointsMaterial({ color: circle.palette[0], size: 0.055, transparent: true, opacity: 0.5 })));

  for (let i = 0; i < 12; i += 1) {
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35 + Math.random() * 0.7, 2), material(circle.palette[1], 0.1, 1));
    blob.scale.y = 0.35;
    blob.position.set((Math.random() - 0.5) * 7, -2.3 + Math.random(), (Math.random() - 0.5) * 5);
    group.add(blob);
  }
}

function addWeights(group: THREE.Group, circle: InfernoCircle) {
  for (let i = 0; i < 10; i += 1) {
    const angle = (i / 10) * Math.PI * 2;
    const weight = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45 + (i % 3) * 0.2, 0), material(circle.palette[0], 0.18, 0.45));
    weight.position.set(Math.cos(angle) * 3.8, Math.sin(angle) * 2.4, (i % 2 ? 1 : -1) * 1.4);
    group.add(weight);
    const rail = new THREE.Mesh(new THREE.TorusGeometry(3.8, 0.045, 8, 90), material(circle.palette[1], 0.05, 0.9));
    rail.scale.y = 0.63;
    group.add(rail);
  }
}

function addMarsh(group: THREE.Group, circle: InfernoCircle) {
  const plane = new THREE.Mesh(new THREE.CircleGeometry(5.5, 96), new THREE.MeshStandardMaterial({ color: circle.palette[1], roughness: 0.15, metalness: 0.25, transparent: true, opacity: 0.76 }));
  plane.rotation.x = Math.PI / 2;
  plane.position.y = -1.8;
  group.add(plane);
  for (let i = 0; i < 34; i += 1) {
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.06 + Math.random() * 0.16, 12, 8), material(circle.palette[0], 0.2, 0.2));
    bubble.position.set((Math.random() - 0.5) * 8, -1.75 + Math.random() * 0.3, (Math.random() - 0.5) * 6);
    group.add(bubble);
  }
}

function addTombs(group: THREE.Group, circle: InfernoCircle) {
  for (let i = 0; i < 18; i += 1) {
    const angle = (i / 18) * Math.PI * 2;
    const tomb = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.3, 1.5), material(circle.palette[1], 0.08, 0.9));
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 1.55), material(circle.palette[0], 0.8, 0.35));
    lid.position.y = 0.34;
    lid.rotation.x = -0.28;
    tomb.add(base, lid);
    tomb.position.set(Math.cos(angle) * 4.2, Math.sin(angle) * 2.6, (Math.random() - 0.5) * 4);
    tomb.rotation.z = angle + Math.PI / 2;
    group.add(tomb);
  }
}

function addForest(group: THREE.Group, circle: InfernoCircle) {
  for (let i = 0; i < 28; i += 1) {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.14, 2.5 + Math.random() * 2.8, 5), material(circle.palette[1], 0.03, 1));
    trunk.rotation.z = (Math.random() - 0.5) * 0.45;
    tree.add(trunk);
    for (let j = 0; j < 4; j += 1) {
      const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.055, 1.1 + Math.random(), 5), material(circle.palette[0], 0.05, 1));
      branch.position.y = 0.25 + j * 0.35;
      branch.rotation.z = (j % 2 ? 1 : -1) * (0.65 + Math.random() * 0.5);
      tree.add(branch);
    }
    const angle = Math.random() * Math.PI * 2;
    const r = 2.4 + Math.random() * 3.2;
    tree.position.set(Math.cos(angle) * r, Math.sin(angle) * r * 0.65, (Math.random() - 0.5) * 5);
    group.add(tree);
  }
}

function addDitches(group: THREE.Group, circle: InfernoCircle) {
  for (let i = 0; i < 10; i += 1) {
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(1.2 + i * 0.38, 0.08 + (i % 2) * 0.025, 8, 96),
      material(i % 2 ? circle.palette[1] : circle.palette[0], 0.2, 0.72)
    );
    torus.scale.y = 0.62;
    torus.position.z = (i - 5) * 0.18;
    group.add(torus);
  }
  for (let i = 0; i < 8; i += 1) {
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(8, 0.08, 0.16), material(circle.palette[0], 0.08, 0.85));
    bridge.rotation.z = (i / 8) * Math.PI;
    group.add(bridge);
  }
}

function addIce(group: THREE.Group, circle: InfernoCircle) {
  const lake = new THREE.Mesh(new THREE.CircleGeometry(5.5, 96), new THREE.MeshPhysicalMaterial({ color: circle.palette[0], transmission: 0.35, roughness: 0.1, metalness: 0.05, transparent: true, opacity: 0.66 }));
  lake.rotation.x = Math.PI / 2;
  lake.position.y = -1.4;
  group.add(lake);

  for (let i = 0; i < 48; i += 1) {
    const shard = new THREE.Mesh(new THREE.ConeGeometry(0.08 + Math.random() * 0.18, 0.5 + Math.random() * 1.7, 5), material(i % 2 ? circle.palette[0] : circle.palette[1], 0.2, 0.2));
    const angle = Math.random() * Math.PI * 2;
    const r = 1 + Math.random() * 4.5;
    shard.position.set(Math.cos(angle) * r, -1 + Math.random() * 1.2, Math.sin(angle) * r * 0.65);
    shard.rotation.set(Math.random(), Math.random(), Math.random());
    group.add(shard);
  }

  const core = new THREE.Group();
  for (let i = 0; i < 3; i += 1) {
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), material(circle.palette[2], 0.02, 0.95));
    head.position.x = (i - 1) * 0.58;
    core.add(head);
  }
  const body = new THREE.Mesh(new THREE.ConeGeometry(1.1, 3.8, 7), material(circle.palette[2], 0.01, 1));
  body.position.y = -1.4;
  core.add(body);
  core.position.z = -1.2;
  group.add(core);
}

function decorate(group: THREE.Group, circle: InfernoCircle) {
  const torus = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.08, 12, 140), material(circle.palette[0], 0.35, 0.45));
  torus.scale.y = 0.7;
  group.add(torus);
  group.add(points(300, 6.5, 9, circle.palette[0]));

  const adders: Record<InfernoCircle["visualMode"], (target: THREE.Group, item: InfernoCircle) => void> = {
    columns: addColumns,
    vortex: addVortex,
    rain: addRain,
    weights: addWeights,
    marsh: addMarsh,
    tombs: addTombs,
    forest: addForest,
    ditches: addDitches,
    ice: addIce
  };
  adders[circle.visualMode](group, circle);
}

export function InfernoScene({ circles, activeIndex }: { circles: InfernoCircle[]; activeIndex: number }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(activeIndex);

  useEffect(() => { activeRef.current = activeIndex; }, [activeIndex]);

  useEffect(() => {
    const hostElement = hostRef.current;
    if (!hostElement || circles.length === 0) return;
    const mount: HTMLDivElement = hostElement;
    let cancelled = false;
    let frame = 0;
    let renderer: THREE.WebGLRenderer | { domElement: HTMLCanvasElement; setSize: (w: number, h: number) => void; setPixelRatio: (v: number) => void; render: (s: THREE.Scene, c: THREE.Camera) => void; dispose: () => void };

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#050505");
    scene.fog = new THREE.FogExp2("#050505", 0.055);
    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 350);
    camera.position.set(0, 0, 8);

    const groups: THREE.Group[] = circles.map((circle, index) => {
      const group = new THREE.Group();
      group.position.z = -index * DEPTH;
      group.rotation.z = (index % 2 ? 1 : -1) * 0.06;
      decorate(group, circle);
      scene.add(group);
      return group;
    });

    const ambient = new THREE.AmbientLight("#ffffff", 0.45);
    const key = new THREE.PointLight(circles[0].palette[0], 35, 25, 1.8);
    key.position.set(0, 2, 3);
    const rim = new THREE.PointLight("#5070ff", 18, 30, 2);
    rim.position.set(-4, -2, -4);
    scene.add(ambient, key, rim);

    let currentProgress = 0;
    let targetProgress = 0;
    const onScroll = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      targetProgress = Math.min(1, Math.max(0, window.scrollY / max));
    };
    const onResize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
      renderer?.setSize(width, height);
      renderer?.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    };

    async function init() {
      if ("gpu" in navigator) {
        try {
          const webgpu = await import("three/webgpu");
          const candidate = new webgpu.WebGPURenderer({ antialias: true, alpha: false });
          await Promise.race([
            candidate.init(),
            new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("WebGPU inicijalizacija je istekla.")), 2500))
          ]);
          renderer = candidate;
        } catch {
          // WebGPU je progresivno poboljšanje. WebGL ostaje stabilna osnovna putanja.
        }
      }

      if (!renderer) {
        try {
          renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
        } catch {
          mount.dataset.renderer = "nedostupan";
          return;
        }
      }

      if (cancelled) {
        renderer.dispose();
        return;
      }
      renderer.domElement.setAttribute("aria-hidden", "true");
      renderer.domElement.className = "inferno-canvas";
      mount.appendChild(renderer.domElement);
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onResize);
      onScroll();
      onResize();

      const clock = new THREE.Clock();
      const animate = () => {
        frame = requestAnimationFrame(animate);
        const dt = Math.min(0.05, clock.getDelta());
        currentProgress += (targetProgress - currentProgress) * Math.min(1, dt * 3.2);
        const routeDepth = Math.max(0, (circles.length - 1) * DEPTH);
        camera.position.z = 8 - currentProgress * routeDepth;
        camera.position.x = Math.sin(currentProgress * Math.PI * 5) * 0.45;
        camera.position.y = Math.cos(currentProgress * Math.PI * 3) * 0.24;
        camera.lookAt(0, 0, camera.position.z - 6);

        const active = activeRef.current;
        groups.forEach((group, index) => {
          const distance = Math.abs(index - active);
          group.rotation.z += dt * (index % 2 ? 0.045 : -0.045) * (1.25 - Math.min(1, distance * 0.2));
          group.rotation.x = Math.sin(clock.elapsedTime * 0.17 + index) * 0.035;
          group.scale.setScalar(distance === 0 ? 1.04 : 0.94);
          group.traverse((object) => {
            if (object instanceof THREE.Points) object.rotation.z += dt * 0.025;
          });
        });

        const activeCircle = circles[active] ?? circles[0];
        key.color.lerp(new THREE.Color(activeCircle.palette[0]), 0.045);
        rim.color.lerp(new THREE.Color(activeCircle.palette[1]), 0.025);
        key.position.z = camera.position.z + 2.5;
        rim.position.z = camera.position.z - 4;
        renderer.render(scene, camera);
      };
      animate();
    }

    void init();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
          object.geometry?.dispose();
          const objectMaterial = object.material;
          if (Array.isArray(objectMaterial)) objectMaterial.forEach((item) => item.dispose());
          else objectMaterial?.dispose();
        }
      });
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
    };
  }, [circles]);

  return <div ref={hostRef} className="scene-host" aria-hidden="true" />;
}
