"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export type Zone = "engine" | "wheel";
export interface Hotspot { zone: Zone; label: string; cost: number; severity: "overdue" | "due_soon"; }

const TONE_COLOR: Record<"ok" | "warn" | "danger", number> = {
  ok: 0x3a3732,
  warn: 0x4a3a28,
  danger: 0x4a2a2c,
};

const SEVERITY_COLOR: Record<Hotspot["severity"], number> = {
  overdue: 0xcf2033,
  due_soon: 0xb06a12,
};

/** Procedural low-poly car — no external model/API. Hotspot markers mark zones
 *  with a real overdue/due-soon part, colored by that zone's worst severity. */
export function CarModel3D({ tone, hotspots }: { tone: "ok" | "warn" | "danger"; hotspots: Hotspot[] }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(4.4, 2.4, 5.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x29261f, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(4, 6, 3);
    scene.add(key);

    const car = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: TONE_COLOR[tone], roughness: 0.55, metalness: 0.15 });
    const lower = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.9, 1.8), bodyMat);
    lower.position.y = 0.45;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.75, 1.55), bodyMat);
    cabin.position.set(-0.25, 0.9 + 0.375, 0);
    car.add(lower, cabin);

    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1b1a16, roughness: 0.9 });
    const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.32, 20);
    [
      [1.55, 0.45, 0.95], [1.55, 0.45, -0.95],
      [-1.55, 0.45, 0.95], [-1.55, 0.45, -0.95],
    ].forEach(([x, y, z]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, y, z);
      car.add(wheel);
    });

    const ZONE_POS: Record<Zone, THREE.Vector3> = {
      engine: new THREE.Vector3(1.95, 1.0, 0),
      wheel: new THREE.Vector3(1.55, 0.75, 1.0),
    };
    const markers: THREE.Mesh[] = [];
    (["engine", "wheel"] as Zone[]).forEach((zone) => {
      const zoneHotspots = hotspots.filter((h) => h.zone === zone);
      if (!zoneHotspots.length) return;
      const worst = zoneHotspots.some((h) => h.severity === "overdue") ? "overdue" : "due_soon";
      const color = SEVERITY_COLOR[worst];
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 16, 16),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8 }),
      );
      marker.position.copy(ZONE_POS[zone]);
      car.add(marker);
      markers.push(marker);
    });

    scene.add(car);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 4;
    controls.maxDistance = 9;
    controls.target.set(0, 0.6, 0);
    controls.autoRotate = !reduce;
    controls.autoRotateSpeed = 1.1;

    let pauseUntil = 0;
    const onInteract = () => { pauseUntil = Date.now() + 2500; };
    renderer.domElement.addEventListener("pointerdown", onInteract);

    let raf = 0;
    const clock = new THREE.Clock();
    function animate() {
      raf = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      controls.autoRotate = !reduce && Date.now() > pauseUntil;
      controls.update();
      if (!reduce) markers.forEach((m) => { m.scale.setScalar(1 + Math.sin(t * 2.4) * 0.18); });
      renderer.render(scene, camera);
    }
    animate();

    const ro = new ResizeObserver(() => {
      if (!mount.clientWidth || !mount.clientHeight) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    });
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onInteract);
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [tone, hotspots]);

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
}
