import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function SocialRobotVisualizer() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // scene, camera & renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 0.1, 4.8);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(3, 4, 3);
    scene.add(keyLight);

    const cyanRim = new THREE.DirectionalLight(0x38bdf8, 2.0);
    cyanRim.position.set(-3, 2, -2);
    scene.add(cyanRim);

    // materials
    const matCeramic = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.25,
      metalness: 0.3,
    });

    const matVisor = new THREE.MeshStandardMaterial({
      color: 0x09090b,
      roughness: 0.1,
      metalness: 0.9,
    });

    const matChrome = new THREE.MeshStandardMaterial({
      color: 0xe4e4e7,
      roughness: 0.15,
      metalness: 0.95,
    });

    const matAmberJoint = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.4,
      metalness: 0.6,
    });

    const matGazeOcular = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
    });

    const matEyelid = new THREE.MeshBasicMaterial({
      color: 0x09090b,
    });

    const robot = new THREE.Group();
    scene.add(robot);

    // neck base
    const baseGeo = new THREE.CylinderGeometry(0.7, 0.9, 0.2, 32);
    const base = new THREE.Mesh(baseGeo, matCeramic);
    base.position.y = -1.35;
    robot.add(base);

    // neck actuator
    const neckGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.45, 20);
    const neck = new THREE.Mesh(neckGeo, matChrome);
    neck.position.y = -1.05;
    robot.add(neck);

    // Head assembly
    const headGroup = new THREE.Group();
    headGroup.position.y = -0.45;
    robot.add(headGroup);

    // Rounded ergonomic head casing
    const headGeo = new THREE.SphereGeometry(0.92, 32, 28);
    headGeo.scale(1.0, 0.92, 0.95);
    const head = new THREE.Mesh(headGeo, matCeramic);
    headGroup.add(head);

    // Ear pivot modules (antenna/audio sensors)
    const earGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.12, 24);
    earGeo.rotateZ(Math.PI / 2);

    const leftEar = new THREE.Mesh(earGeo, matAmberJoint);
    leftEar.position.set(-0.96, 0.05, 0);
    headGroup.add(leftEar);

    const rightEar = new THREE.Mesh(earGeo, matAmberJoint);
    rightEar.position.set(0.96, 0.05, 0);
    headGroup.add(rightEar);

    // Front Visor faceplate
    const visorGeo = new THREE.SphereGeometry(0.85, 32, 24, 0, Math.PI, 0, Math.PI / 1.7);
    visorGeo.scale(0.82, 0.58, 0.62);
    visorGeo.rotateX(Math.PI / 2);
    const visor = new THREE.Mesh(visorGeo, matVisor);
    visor.position.set(0, 0.05, 0.44);
    headGroup.add(visor);

    // Expressive Ocular Pupils (glowing dynamic eyes)
    const createEye = (x: number) => {
      const eyeGroup = new THREE.Group();
      eyeGroup.position.set(x, 0.08, 0.84);

      // outer glowing iris ring
      const ringGeo = new THREE.RingGeometry(0.08, 0.12, 32);
      const iris = new THREE.Mesh(ringGeo, matGazeOcular);
      eyeGroup.add(iris);

      // central bright pupil
      const pupilGeo = new THREE.CircleGeometry(0.055, 24);
      const pupil = new THREE.Mesh(pupilGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      pupil.position.z = 0.005;
      eyeGroup.add(pupil);

      // top eyelid shutter (for realistic blinking)
      const lidGeo = new THREE.PlaneGeometry(0.3, 0.28);
      const lidTop = new THREE.Mesh(lidGeo, matEyelid);
      lidTop.position.set(0, 0.2, 0.01);
      eyeGroup.add(lidTop);

      return { eyeGroup, iris, pupil, lidTop };
    };

    const leftEye = createEye(-0.32);
    const rightEye = createEye(0.32);
    headGroup.add(leftEye.eyeGroup, rightEye.eyeGroup);

    // Interaction state
    let targetYaw = 0;
    let targetPitch = 0;
    let targetRoll = 0;

    let currentYaw = 0;
    let currentPitch = 0;
    let currentRoll = 0;

    let isBlinking = false;
    let blinkProgress = 0;
    let nextBlinkTime = 2.0;

    // Saccadic eye micro-movement
    let saccadeOffsetX = 0;
    let saccadeOffsetY = 0;
    let nextSaccadeTime = 1.0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

      targetYaw = THREE.MathUtils.clamp(x * 0.8, -0.75, 0.75);
      targetPitch = THREE.MathUtils.clamp(y * 0.6, -0.5, 0.5);
      targetRoll = -x * 0.15; // inquisitive slight head tilt
    };

    const handleClick = () => {
      // Inquisitive nod/blink when clicked
      targetPitch += 0.25;
      isBlinking = true;
      blinkProgress = 0;
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('click', handleClick);

    const handleResize = () => {
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    // Animation loop
    let frameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      const delta = clock.getDelta();

      // Autonomous saccades (rapid micro-movements of gaze)
      if (elapsed > nextSaccadeTime) {
        saccadeOffsetX = (Math.random() - 0.5) * 0.04;
        saccadeOffsetY = (Math.random() - 0.5) * 0.03;
        nextSaccadeTime = elapsed + 1.2 + Math.random() * 2.5;
      }

      // Autonomous blinks
      if (elapsed > nextBlinkTime && !isBlinking) {
        isBlinking = true;
        blinkProgress = 0;
        nextBlinkTime = elapsed + 3.0 + Math.random() * 4.0;
      }

      if (isBlinking) {
        blinkProgress += 0.12;
        const blinkAmount = Math.sin(blinkProgress * Math.PI);
        const lidY = 0.2 - blinkAmount * 0.2;
        leftEye.lidTop.position.y = lidY;
        rightEye.lidTop.position.y = lidY;

        if (blinkProgress >= 1.0) {
          isBlinking = false;
          leftEye.lidTop.position.y = 0.2;
          rightEye.lidTop.position.y = 0.2;
        }
      }

      // Organic physiological breathing (vertical + micro pitch)
      const breathing = Math.sin(elapsed * 1.6) * 0.025;
      const breathPitch = Math.cos(elapsed * 1.6) * 0.015;
      headGroup.position.y = -0.45 + breathing;

      // Smooth kinematic interpolation (spring-damped head rotation)
      currentYaw += (targetYaw - currentYaw) * 0.08;
      currentPitch += (targetPitch + breathPitch - currentPitch) * 0.08;
      currentRoll += (targetRoll - currentRoll) * 0.08;

      headGroup.rotation.y = currentYaw;
      headGroup.rotation.x = -currentPitch;
      headGroup.rotation.z = currentRoll;

      // Pupil ocular tracking (leads the head movement for realism)
      const ocularLeadX = THREE.MathUtils.clamp(targetYaw * 0.08 + saccadeOffsetX, -0.05, 0.05);
      const ocularLeadY = THREE.MathUtils.clamp(targetPitch * 0.06 + saccadeOffsetY, -0.04, 0.04);
      leftEye.pupil.position.set(ocularLeadX, ocularLeadY, 0.005);
      rightEye.pupil.position.set(ocularLeadX, ocularLeadY, 0.005);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('click', handleClick);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameId);
      renderer.dispose();
      baseGeo.dispose();
      neckGeo.dispose();
      headGeo.dispose();
      earGeo.dispose();
      visorGeo.dispose();
      matCeramic.dispose();
      matVisor.dispose();
      matChrome.dispose();
      matAmberJoint.dispose();
      matGazeOcular.dispose();
      matEyelid.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="w-full relative border border-zinc-800/80 rounded-xl bg-gradient-to-b from-zinc-900/40 via-zinc-950/60 to-black overflow-hidden shadow-2xl select-none">
      <div
        ref={containerRef}
        className="w-full h-[280px] sm:h-[320px] cursor-grab active:cursor-grabbing relative flex items-center justify-center"
      />
      <div className="absolute bottom-3 left-4 text-[11px] font-mono text-zinc-500/80 pointer-events-none flex items-center gap-2">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
        <span>social gaze &bull; saccades &bull; click to interact</span>
      </div>
    </div>
  );
}
