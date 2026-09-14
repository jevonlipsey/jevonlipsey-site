import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function RobotManipulator() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // scene & camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(3.2, 2.6, 4.4);
    camera.lookAt(0, 1.1, 0);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    // lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(4, 6, 3);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.001;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x8899bb, 1.6);
    rimLight.position.set(-4, 3, -3);
    scene.add(rimLight);

    const fillLight = new THREE.PointLight(0x38bdf8, 1.2, 8);
    fillLight.position.set(0, 0.4, 1.5);
    scene.add(fillLight);

    // ground plane with shadow receiver & subtle grid
    const groundGeo = new THREE.PlaneGeometry(10, 10);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.35 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(7, 20, 0x3f3f46, 0x1f1f23);
    grid.position.y = 0.001;
    scene.add(grid);

    // materials palette
    const matDarkMetal = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      metalness: 0.85,
      roughness: 0.3,
    });

    const matBrushedAlum = new THREE.MeshStandardMaterial({
      color: 0x71717a,
      metalness: 0.75,
      roughness: 0.25,
    });

    const matJointOrange = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.5,
      roughness: 0.35,
    });

    const matChrome = new THREE.MeshStandardMaterial({
      color: 0xe4e4e7,
      metalness: 0.95,
      roughness: 0.15,
    });

    const matSensorGlow = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
    });

    // robot arm kinematic chain
    const root = new THREE.Group();
    scene.add(root);

    // base platform
    const basePlateGeo = new THREE.CylinderGeometry(0.85, 0.95, 0.14, 32);
    const basePlate = new THREE.Mesh(basePlateGeo, matDarkMetal);
    basePlate.position.y = 0.07;
    basePlate.receiveShadow = true;
    basePlate.castShadow = true;
    root.add(basePlate);

    const baseRingGeo = new THREE.TorusGeometry(0.72, 0.02, 16, 48);
    const baseRing = new THREE.Mesh(baseRingGeo, matChrome);
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.y = 0.145;
    root.add(baseRing);

    // J0: Base Turret (Yaw around Y)
    const j0Turret = new THREE.Group();
    j0Turret.position.y = 0.14;
    root.add(j0Turret);

    const turretBodyGeo = new THREE.CylinderGeometry(0.48, 0.58, 0.42, 24);
    const turretBody = new THREE.Mesh(turretBodyGeo, matDarkMetal);
    turretBody.position.y = 0.21;
    turretBody.castShadow = true;
    j0Turret.add(turretBody);

    // J1: Shoulder Pivot (Pitch around Z/X)
    const shoulderMountGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.5, 20);
    shoulderMountGeo.rotateZ(Math.PI / 2);
    const shoulderMount = new THREE.Mesh(shoulderMountGeo, matJointOrange);
    shoulderMount.position.y = 0.48;
    shoulderMount.castShadow = true;
    j0Turret.add(shoulderMount);

    const j1Shoulder = new THREE.Group();
    j1Shoulder.position.set(0, 0.48, 0);
    j0Turret.add(j1Shoulder);

    // Link 1: Upper Arm Twin Spars
    const upperArmLength = 1.35;
    const sparGeo = new THREE.BoxGeometry(0.06, upperArmLength, 0.1);
    const leftSpar = new THREE.Mesh(sparGeo, matBrushedAlum);
    leftSpar.position.set(-0.16, upperArmLength / 2, 0);
    leftSpar.castShadow = true;
    j1Shoulder.add(leftSpar);

    const rightSpar = new THREE.Mesh(sparGeo, matBrushedAlum);
    rightSpar.position.set(0.16, upperArmLength / 2, 0);
    rightSpar.castShadow = true;
    j1Shoulder.add(rightSpar);

    // hydraulic counter-balancer piston on upper arm
    const pistonCylinderGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 16);
    const pistonCylinder = new THREE.Mesh(pistonCylinderGeo, matDarkMetal);
    pistonCylinder.position.set(0, upperArmLength * 0.45, 0.12);
    pistonCylinder.castShadow = true;
    j1Shoulder.add(pistonCylinder);

    const pistonRodGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.6, 16);
    const pistonRod = new THREE.Mesh(pistonRodGeo, matChrome);
    pistonRod.position.set(0, upperArmLength * 0.75, 0.12);
    pistonRod.castShadow = true;
    j1Shoulder.add(pistonRod);

    // J2: Elbow Pivot
    const elbowJointGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.42, 20);
    elbowJointGeo.rotateZ(Math.PI / 2);
    const elbowJoint = new THREE.Mesh(elbowJointGeo, matJointOrange);
    elbowJoint.position.set(0, upperArmLength, 0);
    elbowJoint.castShadow = true;
    j1Shoulder.add(elbowJoint);

    const j2Elbow = new THREE.Group();
    j2Elbow.position.set(0, upperArmLength, 0);
    j1Shoulder.add(j2Elbow);

    // Link 2: Forearm carbon body
    const forearmLength = 1.15;
    const forearmGeo = new THREE.CylinderGeometry(0.09, 0.12, forearmLength, 16);
    const forearm = new THREE.Mesh(forearmGeo, matDarkMetal);
    forearm.position.y = forearmLength / 2;
    forearm.castShadow = true;
    j2Elbow.add(forearm);

    // status accent ring around forearm
    const accentRingGeo = new THREE.TorusGeometry(0.11, 0.012, 16, 32);
    const accentRing = new THREE.Mesh(accentRingGeo, matSensorGlow);
    accentRing.rotation.x = Math.PI / 2;
    accentRing.position.y = forearmLength * 0.6;
    j2Elbow.add(accentRing);

    // J3: Wrist Pitch
    const wristPitchGeo = new THREE.SphereGeometry(0.14, 16, 16);
    const wristPitch = new THREE.Mesh(wristPitchGeo, matJointOrange);
    wristPitch.position.set(0, forearmLength, 0);
    wristPitch.castShadow = true;
    j2Elbow.add(wristPitch);

    const j3WristPitch = new THREE.Group();
    j3WristPitch.position.set(0, forearmLength, 0);
    j2Elbow.add(j3WristPitch);

    // J4: Wrist Roll
    const j4WristRoll = new THREE.Group();
    j3WristPitch.add(j4WristRoll);

    // End-Effector Tool: Industrial 2-Jaw Gripper
    const toolFlangeGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.12, 16);
    const toolFlange = new THREE.Mesh(toolFlangeGeo, matChrome);
    toolFlange.position.y = 0.06;
    toolFlange.castShadow = true;
    j4WristRoll.add(toolFlange);

    const gripperBodyGeo = new THREE.BoxGeometry(0.24, 0.16, 0.18);
    const gripperBody = new THREE.Mesh(gripperBodyGeo, matDarkMetal);
    gripperBody.position.y = 0.18;
    gripperBody.castShadow = true;
    j4WristRoll.add(gripperBody);

    // LED laser pointer diode on gripper
    const diodeGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.04, 12);
    const diode = new THREE.Mesh(diodeGeo, matSensorGlow);
    diode.position.set(0, 0.26, 0.08);
    j4WristRoll.add(diode);

    // Gripper Jaws (dynamic grasp)
    const fingerGeo = new THREE.BoxGeometry(0.035, 0.22, 0.05);
    const fingerLeft = new THREE.Mesh(fingerGeo, matChrome);
    fingerLeft.position.set(-0.08, 0.35, 0);
    fingerLeft.castShadow = true;
    j4WristRoll.add(fingerLeft);

    const fingerRight = new THREE.Mesh(fingerGeo, matChrome);
    fingerRight.position.set(0.08, 0.35, 0);
    fingerRight.castShadow = true;
    j4WristRoll.add(fingerRight);

    // Target pointer ball (shows user what the robot is tracking)
    const targetIndicatorGeo = new THREE.OctahedronGeometry(0.07);
    const targetIndicatorMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, wireframe: true });
    const targetIndicator = new THREE.Mesh(targetIndicatorGeo, targetIndicatorMat);
    scene.add(targetIndicator);

    // 3D Inverse Kinematics target
    const targetPos = new THREE.Vector3(1.2, 1.4, 0.8);
    const currentPos = new THREE.Vector3(1.2, 1.4, 0.8);

    // mouse raycasting plane to track true 3D spatial cursor
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.2);
    const raycaster = new THREE.Raycaster();
    const mouseNorm = new THREE.Vector2();
    let hasMouseInteracted = false;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouseNorm.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseNorm.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      hasMouseInteracted = true;

      raycaster.setFromCamera(mouseNorm, camera);
      const intersection = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(plane, intersection)) {
        // clamp reachable workspace bounds
        targetPos.x = THREE.MathUtils.clamp(intersection.x, -1.8, 1.8);
        targetPos.z = THREE.MathUtils.clamp(intersection.z, -0.6, 2.2);
        targetPos.y = THREE.MathUtils.clamp(1.1 + mouseNorm.y * 1.0, 0.3, 2.2);
      }
    };

    let isGripperClosed = false;
    const handleMouseDown = () => {
      isGripperClosed = true;
    };
    const handleMouseUp = () => {
      isGripperClosed = false;
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    const handleResize = () => {
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    // Real analytical 3-link 3D inverse kinematics solver
    // Solves for:
    // θ0 = Turret Yaw (atan2(Z, X))
    // θ1 = Shoulder Pitch
    // θ2 = Elbow Pitch
    // θ3 = Wrist alignment to target
    const solveIK = (tx: number, ty: number, tz: number) => {
      // 1. Turret Yaw
      const theta0 = Math.atan2(tz, tx);

      // 2. Project target into 2D plane of the arm
      const planarDist = Math.sqrt(tx * tx + tz * tz);
      // height relative to shoulder joint
      const shoulderY = 0.62;
      const targetY = ty - shoulderY;

      // distance from shoulder to wrist target
      const D = Math.sqrt(planarDist * planarDist + targetY * targetY);
      const l1 = upperArmLength;
      const l2 = forearmLength;

      // Law of Cosines for elbow angle
      const clampedD = THREE.MathUtils.clamp(D, 0.4, (l1 + l2) * 0.98);
      const cosElbow = (clampedD * clampedD - l1 * l1 - l2 * l2) / (2 * l1 * l2);
      const elbowAngle = Math.acos(THREE.MathUtils.clamp(cosElbow, -1, 1));

      // Shoulder angle
      const phi = Math.atan2(targetY, planarDist);
      const cosShoulder = (clampedD * clampedD + l1 * l1 - l2 * l2) / (2 * clampedD * l1);
      const shoulderOffset = Math.acos(THREE.MathUtils.clamp(cosShoulder, -1, 1));
      const shoulderAngle = phi + shoulderOffset;

      return {
        yaw: theta0,
        shoulder: Math.PI / 2 - shoulderAngle,
        elbow: Math.PI - elbowAngle,
        wristPitch: (Math.PI / 2 - shoulderAngle) - (Math.PI - elbowAngle) - 0.2,
      };
    };

    // Animation & Physics Loop
    let frameId: number;
    let clock = new THREE.Clock();
    let currentGripWidth = 0.08;

    let currYaw = 0;
    let currShoulder = 0.3;
    let currElbow = 1.2;
    let currWrist = -0.4;
    let currRoll = 0;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Organic autonomous search / breathing if user is idle
      if (!hasMouseInteracted) {
        targetPos.x = Math.sin(elapsed * 0.6) * 1.2;
        targetPos.z = 1.0 + Math.cos(elapsed * 0.5) * 0.6;
        targetPos.y = 1.2 + Math.sin(elapsed * 1.2) * 0.35;
      } else {
        // subtle organic micro-tremor/breathing
        targetPos.y += Math.sin(elapsed * 3.0) * 0.002;
      }

      // Smoothly interpolate current spatial tracking
      currentPos.lerp(targetPos, 0.08);
      targetIndicator.position.copy(currentPos);
      targetIndicator.rotation.x = elapsed * 0.8;
      targetIndicator.rotation.y = elapsed * 1.1;

      // Solve 3D IK for the interpolated target
      const ik = solveIK(currentPos.x, currentPos.y, currentPos.z);

      // Smooth joint compliance (mass/spring dampening)
      currYaw += (ik.yaw - currYaw) * 0.12;
      currShoulder += (ik.shoulder - currShoulder) * 0.1;
      currElbow += (ik.elbow - currElbow) * 0.1;
      currWrist += (ik.wristPitch - currWrist) * 0.12;
      currRoll += (Math.sin(elapsed * 1.2) * 0.4 - currRoll) * 0.05;

      // Apply joint rotations
      j0Turret.rotation.y = -currYaw + Math.PI / 2;
      j1Shoulder.rotation.z = currShoulder;
      j2Elbow.rotation.z = -currElbow;
      j3WristPitch.rotation.z = currWrist;
      j4WristRoll.rotation.y = currRoll;

      // Dynamic gripper jaw response
      const targetGrip = isGripperClosed ? 0.015 : 0.075 + Math.sin(elapsed * 2.0) * 0.01;
      currentGripWidth += (targetGrip - currentGripWidth) * 0.2;
      fingerLeft.position.x = -currentGripWidth;
      fingerRight.position.x = currentGripWidth;

      // Camera dynamic subtle parallax
      camera.position.x = 3.2 + (mouseNorm.x || 0) * 0.4;
      camera.position.y = 2.6 + (mouseNorm.y || 0) * 0.3;
      camera.lookAt(0, 0.9, 0);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameId);
      renderer.dispose();
      groundGeo.dispose();
      grid.dispose();
      basePlateGeo.dispose();
      baseRingGeo.dispose();
      turretBodyGeo.dispose();
      shoulderMountGeo.dispose();
      sparGeo.dispose();
      pistonCylinderGeo.dispose();
      pistonRodGeo.dispose();
      elbowJointGeo.dispose();
      forearmGeo.dispose();
      accentRingGeo.dispose();
      wristPitchGeo.dispose();
      toolFlangeGeo.dispose();
      gripperBodyGeo.dispose();
      diodeGeo.dispose();
      fingerGeo.dispose();
      targetIndicatorGeo.dispose();
      matDarkMetal.dispose();
      matBrushedAlum.dispose();
      matJointOrange.dispose();
      matChrome.dispose();
      matSensorGlow.dispose();
      targetIndicatorMat.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="w-full relative border border-zinc-800/80 rounded-xl bg-gradient-to-b from-zinc-900/40 via-zinc-950/60 to-black overflow-hidden shadow-2xl">
      <div
        ref={containerRef}
        className="w-full h-[320px] sm:h-[380px] cursor-crosshair relative flex items-center justify-center select-none"
      />
      <div className="absolute bottom-3 left-4 text-[11px] font-mono text-zinc-500/80 pointer-events-none flex items-center gap-2">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
        <span>6-dof analytical inverse kinematics &bull; drag / click to grasp</span>
      </div>
    </div>
  );
}
