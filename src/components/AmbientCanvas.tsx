import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function AmbientCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 6.5);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // subtle floor grid
    const gridHelper = new THREE.GridHelper(5, 10, 0x3f3f46, 0x27272a);
    gridHelper.position.y = -1.8;
    rootGroup.add(gridHelper);

    // outer gimbal ring
    const baseGeo = new THREE.TorusGeometry(2.0, 0.015, 16, 80);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x71717a,
      wireframe: true,
      transparent: true,
      opacity: 0.5,
    });
    const baseRing = new THREE.Mesh(baseGeo, wireMat);
    baseRing.rotation.x = Math.PI / 2.2;
    rootGroup.add(baseRing);

    // inner gimbal ring
    const midGeo = new THREE.TorusGeometry(1.4, 0.015, 16, 64);
    const midMat = new THREE.MeshBasicMaterial({
      color: 0xa1a1aa,
      wireframe: true,
      transparent: true,
      opacity: 0.6,
    });
    const midRing = new THREE.Mesh(midGeo, midMat);
    rootGroup.add(midRing);

    // central joint node
    const coreGeo = new THREE.IcosahedronGeometry(0.75, 1);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xe4e4e7,
      wireframe: true,
      transparent: true,
      opacity: 0.75,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    rootGroup.add(core);

    // robotic kinematic linkages
    const armGroup = new THREE.Group();
    const linkGeo = new THREE.CylinderGeometry(0.012, 0.012, 1.6, 8);
    const linkMat = new THREE.MeshBasicMaterial({ color: 0x71717a, wireframe: true, transparent: true, opacity: 0.5 });
    const link1 = new THREE.Mesh(linkGeo, linkMat);
    link1.position.y = 0.8;
    armGroup.add(link1);

    const jointGeo = new THREE.SphereGeometry(0.07, 12, 12);
    const jointMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.8 });
    const joint1 = new THREE.Mesh(jointGeo, jointMat);
    joint1.position.y = 1.6;
    armGroup.add(joint1);

    const link2 = new THREE.Mesh(linkGeo, linkMat);
    link2.position.set(0.4, 2.2, 0);
    link2.rotation.z = -0.45;
    armGroup.add(link2);

    rootGroup.add(armGroup);

    let targetRotX = 0;
    let targetRotY = 0;
    let currRotX = 0;
    let currRotY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      targetRotY = x * 0.6;
      targetRotX = -y * 0.5;
    };

    container.addEventListener('mousemove', handleMouseMove);

    const handleResize = () => {
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    let frameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      baseRing.rotation.z = elapsed * 0.12;
      midRing.rotation.x = Math.sin(elapsed * 0.35) * 0.7;
      midRing.rotation.y = elapsed * 0.22;
      core.rotation.x = elapsed * 0.2;
      core.rotation.y = elapsed * 0.25;
      armGroup.rotation.z = Math.sin(elapsed * 0.45) * 0.3;

      currRotX += (targetRotX - currRotX) * 0.06;
      currRotY += (targetRotY - currRotY) * 0.06;

      rootGroup.rotation.x = currRotX + 0.1;
      rootGroup.rotation.y = currRotY + elapsed * 0.05;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameId);
      renderer.dispose();
      gridHelper.dispose();
      baseGeo.dispose();
      midGeo.dispose();
      coreGeo.dispose();
      linkGeo.dispose();
      jointGeo.dispose();
      wireMat.dispose();
      midMat.dispose();
      coreMat.dispose();
      linkMat.dispose();
      jointMat.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="w-full flex flex-col border border-border/60 rounded-lg bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 font-mono text-xs text-muted-foreground">
        <span>3D Armature Kinematics</span>
        <span>Interactive Parallax</span>
      </div>
      <div
        ref={containerRef}
        className="w-full h-[320px] cursor-crosshair relative flex items-center justify-center select-none"
      />
    </div>
  );
}
