import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { damp, smoothstep, tourYaw, springExplode } from "../lib/hero-motion";

// cache the decoded GLB so the model survives hot reloads and re-mounts
THREE.Cache.enabled = true;

const INTERACTIVE_TARGETS =
  'nav a, header a, a[href*="github"], a[href*="scholar"], a[href*="cv"], a[href*="mailto"], .pub-card, .project-card, #theme-toggle';

function disposeModel(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of [object.material].flat()) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
}

export default function ImmersiveScene() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("loading");
  const [loadProgress, setLoadProgress] = useState(0);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        premultipliedAlpha: false,
        powerPreference: "high-performance",
      });
      renderer.setClearColor(0x000000, 0);
    } catch {
      setStatus("unavailable");
      return;
    }

    let cameraBaseZ = 5.8;
    let entranceStart = -1;
    let disposed = false;
    let frame = 0;
    let lastFrame = performance.now();
    let elapsed = 0;
    let model: THREE.Group | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    const center = new THREE.Vector3();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const controller = new AbortController();
    const { signal } = controller;
    const scene = new THREE.Scene();
    const fog = new THREE.FogExp2(0x000000, 0.025);
    scene.fog = fog;
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.domElement.setAttribute("aria-hidden", "true");
    container.appendChild(renderer.domElement);

    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(1, 1),
      0.08,
      0.3,
      1.3,
    );
    const outputPass = new OutputPass();
    composer.addPass(renderPass);
    composer.addPass(bloomPass);
    composer.addPass(outputPass);

    const ambient = new THREE.AmbientLight(0xffffff, 1.2);
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(3, 4, 5);
    const fill = new THREE.DirectionalLight(0xffffff, 1);
    fill.position.set(-3, 1, 3);
    const rim = new THREE.DirectionalLight(0xffffff, 2);
    rim.position.set(-2, 3, -3);
    scene.add(ambient, key, fill, rim);

    const framingGroup = new THREE.Group();
    const floatGroup = new THREE.Group();
    const spinGroup = new THREE.Group();
    const modelGroup = new THREE.Group();
    scene.add(framingGroup);
    framingGroup.add(floatGroup);
    floatGroup.add(spinGroup);
    spinGroup.add(modelGroup);

    // nudge the head right so its left silhouette slices through the text edge
    const modelOffsetX = 0.1;

    let mode: "GAZE" | "SHOWCASE" = "GAZE";
    let lastActivity = performance.now();
    let nextTourDelay = 25000 + Math.random() * 5000;
    let tourStart = 0;
    let tourFrom = 0;
    let spinYaw = 0;
    let spinVelocity = 0;
    let curYaw = 0;
    let curPitch = 0;
    let curRoll = 0;
    let cursorX = 0;
    let cursorY = 0;
    let smoothCursorX = 0;
    let smoothCursorY = 0;
    let isTrackingPaused = false;
    let hasRealCursor = false;
    let autoGazeX = 0;
    let autoGazeY = 0;
    let targetAutoX = 0;
    let targetAutoY = 0;
    let nextSaccadeTime = performance.now() + 1200;
    let gazeWeight = 1;
    let weightFrom = 1;
    let weightTo = 1;
    let weightStart = performance.now();
    let weightDuration = 800;
    let curExplode = 0;
    let targetExplode = 0;
    let explodeVelocity = 0;
    let scrollY = 0;
    let scrollVelocity = 0;
    let scrollBias = 0;
    let previousScrollY = 0;
    let lastScrollAt = 0;
    let hoverTarget: Element | null = null;
    const hoveredTargets = new Set<Element>();
    let focusTarget: Element | null = null;
    let pointerId: number | null = null;
    let gesture: "pending" | "spin" | "scroll" = "pending";
    let startX = 0;
    let startY = 0;
    let previousX = 0;
    let previousTime = 0;
    let maxDisplacement = 0;
    const pings: {
      mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
      born: number;
    }[] = [];
    const stipplePixelRatio = { value: renderer.getPixelRatio() };

    // natural human-like fixation targets across the viewport
    const SACCADE_TARGETS = [
      { x: 0, y: 0.02 },
      { x: -0.26, y: 0.06 },
      { x: -0.2, y: -0.16 },
      { x: 0.16, y: 0.04 },
      { x: -0.1, y: -0.22 },
      { x: 0.04, y: -0.04 },
      { x: -0.3, y: -0.02 },
    ];

    function updateAutonomousGaze(now: number, dt: number) {
      if (now > nextSaccadeTime) {
        const choice =
          SACCADE_TARGETS[Math.floor(Math.random() * SACCADE_TARGETS.length)];
        targetAutoX = choice.x + (Math.random() - 0.5) * 0.06;
        targetAutoY = choice.y + (Math.random() - 0.5) * 0.05;
        nextSaccadeTime = now + 2000 + Math.random() * 2200;
      }
      autoGazeX = damp(autoGazeX, targetAutoX, dt, 3.2);
      autoGazeY = damp(autoGazeY, targetAutoY, dt, 3.2);
    }

    function rampGaze(target: number, now: number) {
      weightFrom = gazeWeight;
      weightTo = target;
      weightStart = now;
      weightDuration = target === 0 ? 350 : 800;
    }

    function setMode(next: "GAZE" | "SHOWCASE", now: number) {
      mode = next;
      container!.dataset.motionMode = next;
      rampGaze(next === "GAZE" ? 1 : 0, now);
    }

    function interrupt(now = performance.now()) {
      lastActivity = now;
      if (mode === "SHOWCASE") {
        // preserve the rendered angle when ownership returns to manual motion.
        spinYaw = spinGroup.rotation.y;
        spinVelocity = 0;
        setMode("GAZE", now);
      }
      wake();
    }

    function applyTheme() {
      const dark = document.documentElement.classList.contains("dark");
      const background = dark ? 0x000000 : 0xeae7e1;
      fog.color.setHex(background);
      // transparent clear (alpha 0): the page background shows through the canvas,
      // and CSS handles the dark/light themes cleanly on its own
      renderer.setClearColor(background, 0);
      ambient.color.setHex(dark ? 0xffffff : 0xfff1df);
      ambient.intensity = dark ? 1.2 : 1.5;
      key.color.setHex(dark ? 0xffffff : 0xfff7eb);
      fill.color.setHex(dark ? 0xd9d9d9 : 0xd6c9b5);
      bloomPass.enabled = dark;
      interrupt();
    }

    function entranceOffset() {
      if (entranceStart < 0) return 0;
      const t = (performance.now() - entranceStart) / 600;
      if (t >= 1) {
        entranceStart = -1;
        return 0;
      }
      return 0.3 * (1 - smoothstep(t));
    }

    function resize() {
      const width = container!.clientWidth;
      const height = container!.clientHeight;
      if (!width || !height) return;
      const aspect = width / height;
      const shortViewport = height < 500;
      const isPortrait = aspect < 1.0;
      const targetScale = shortViewport ? 0.9 : isPortrait ? 1.4 : 1.75;
      framingGroup.scale.setScalar(targetScale);
      const targetY = shortViewport ? 0.04 : isPortrait ? -0.05 : 0.04;
      framingGroup.position.set(modelOffsetX, targetY, 0);
      camera.aspect = aspect;
      const fitWidth =
        (shortViewport ? 1.1 : isPortrait ? 1.4 : 1.85) /
        (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect);
      cameraBaseZ = Math.max(
        shortViewport ? 3.6 : isPortrait ? 4.4 : 5.8,
        fitWidth,
      );
      camera.position.set(0, targetY, cameraBaseZ + entranceOffset());
      camera.lookAt(0, targetY, 0);
      camera.updateProjectionMatrix();
      const pixelRatio = Math.min(window.devicePixelRatio, 2);
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height);
      composer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);
      bloomPass.resolution.set(width * pixelRatio, height * pixelRatio);
      stipplePixelRatio.value = pixelRatio;
      wake();
    }

    const manager = new THREE.LoadingManager();
    manager.onProgress = (url, itemsLoaded, itemsTotal) => {
      setLoadProgress(itemsLoaded / itemsTotal);
    };

    const loader = new GLTFLoader(manager);
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      "/models/jev_cyborg.web.glb",
      (gltf) => {
        if (disposed) {
          disposeModel(gltf.scene);
          return;
        }
        model = gltf.scene;
        const bounds = new THREE.Box3().setFromObject(model);
        bounds.getCenter(center);
        const pivot = new THREE.Group();
        pivot.rotation.y = Math.PI;
        model.position.sub(center);
        pivot.add(model);
        modelGroup.add(pivot);
        modelGroup.updateWorldMatrix(true, true);
        const inverseModelBasis = modelGroup.matrixWorld.clone().invert();
        const originals = new Set<THREE.Material>();

        model.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          object.geometry.computeBoundingBox();
          const restBasis = inverseModelBasis
            .clone()
            .multiply(object.matrixWorld);
          const headHeight = bounds.max.y - bounds.min.y;
          const fadeBottom = bounds.min.y - center.y + headHeight * 0.02;
          const fadeTop = bounds.min.y - center.y + headHeight * 0.2;

          // cache origin for mechanical venting
          object.userData.origin = object.position.clone();
          const isOuterPlate =
            /^(Back_low|Top_low|TopInner_low|SideRot_low)/i.test(object.name) &&
            !/face|eye|mouth|jaw|brow|inside|ear|torus|stud/i.test(object.name);
          object.userData.isOuterPlate = isOuterPlate;

          // isolate the true neck/base stump mesh for soft gradient fade
          const isDissolveTarget = /BackBottom_low/i.test(object.name);
          const patch = (source: THREE.Material) => {
            originals.add(source);
            const material = source.clone();
            if (!(material instanceof THREE.MeshStandardMaterial))
              return material;
            const silver =
              /silver/i.test(material.name) || /stud/i.test(object.name);
            const gold =
              /gold/i.test(material.name) || /earring|torus/i.test(object.name);
            const ceramic = !silver && !gold;
            material.roughness = ceramic ? 0.72 : 0.3;
            material.metalness = ceramic ? 0.08 : 0.6;
            material.emissive.setHex(0x000000);
            material.emissiveIntensity = 0;
            if (silver) material.color.setHex(0xc8c7c3);
            if (gold) material.color.setHex(0xb78b41);
            if (isDissolveTarget) {
              material.transparent = true;
              // CRITICAL: no depth writes so the soft gradient tail blends into
              // the page background instead of occluding it
              material.depthWrite = false;
              material.alphaTest = 0.01;
              material.side = THREE.FrontSide;
            } else {
              material.transparent = false;
              material.depthWrite = true;
            }
            material.customProgramCacheKey = () => "ceramic_halftone_v1";
            material.onBeforeCompile = (shader) => {
              // uniforms keep program identity stable across independently faded meshes.
              shader.uniforms.stippleStrength = { value: ceramic ? 0.22 : 0 };
              shader.uniforms.stipplePixelRatio = stipplePixelRatio;
              shader.uniforms.neckFade = {
                value: isDissolveTarget ? 1.0 : 0.0,
              };
              shader.uniforms.neckBasis = { value: restBasis };
              shader.uniforms.neckRange = {
                value: new THREE.Vector2(fadeBottom, fadeTop),
              };
              // exported mesh axes differ; fade in the head's rest-local y, never world y.
              shader.vertexShader =
                "varying float vLocalY;\nuniform mat4 neckBasis;\n" +
                shader.vertexShader;
              shader.vertexShader = shader.vertexShader.replace(
                "#include <begin_vertex>",
                "#include <begin_vertex>\nvLocalY = (neckBasis * vec4(position, 1.0)).y;",
              );
              shader.fragmentShader =
                `
              varying float vLocalY;
              uniform float stippleStrength;
              uniform float stipplePixelRatio;
              uniform float neckFade;
              uniform vec2 neckRange;
            ` + shader.fragmentShader;
              shader.fragmentShader = shader.fragmentShader.replace(
                "#include <color_fragment>",
                `
              #include <color_fragment>
              diffuseColor.a *= mix(1.0, smoothstep(neckRange.x, neckRange.y, vLocalY), neckFade);
            `,
              );
              shader.fragmentShader = shader.fragmentShader.replace(
                "#include <aomap_fragment>",
                `
              #include <aomap_fragment>
              vec2 printCoord = gl_FragCoord.xy / stipplePixelRatio / 3.0;
              printCoord = mat2(0.866, -0.5, 0.5, 0.866) * printCoord;
              vec2 cell = fract(printCoord) - 0.5;
              float luminance = dot(reflectedLight.directDiffuse + reflectedLight.indirectDiffuse, vec3(0.2126, 0.7152, 0.0722));
              float shade = 1.0 - smoothstep(0.05, 0.8, luminance);
              float radius = mix(0.06, 0.36, shade);
              float edge = max(fwidth(length(cell)), 0.025);
              float toner = 1.0 - smoothstep(radius - edge, radius + edge, length(cell));
              float printShade = 1.0 - toner * shade * stippleStrength;
              reflectedLight.directDiffuse *= printShade;
              reflectedLight.indirectDiffuse *= printShade;
            `,
              );
            };
            return material;
          };
          object.material = Array.isArray(object.material)
            ? object.material.map(patch)
            : patch(object.material);
        });
        originals.forEach((material) => material.dispose());
        mixer = new THREE.AnimationMixer(model);
        // the export contains one synchronized clip per articulated part.
        gltf.animations.forEach((clip) => mixer!.clipAction(clip).play());
        mixer.update(0);
        renderer.compile(scene, camera);
        setStatus("ready");
        entranceStart = performance.now();
        window.setTimeout(() => {
          if (!disposed) setBooted(true);
        }, 400);
        resize();
        wake();
      },
      undefined,
      (error) => {
        console.error("GLTF loading error:", error);
        if (!disposed) setStatus("unavailable");
      },
    );

    function spawnPing() {
      if (reducedMotion.matches || !model) return;
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(0.06, 0.08, 32),
        new THREE.MeshBasicMaterial({
          color: document.documentElement.classList.contains("dark")
            ? 0xdddddd
            : 0x141414,
          transparent: true,
          opacity: 0.65,
          depthWrite: false,
        }),
      );
      mesh.position.set(modelOffsetX, framingGroup.position.y, 1);
      mesh.quaternion.copy(camera.quaternion);
      scene.add(mesh);
      pings.push({ mesh, born: performance.now() });
      wake();
    }

    function onPointerDown(event: PointerEvent) {
      if (!event.isPrimary || event.button !== 0 || pointerId !== null) return;
      interrupt();
      pointerId = event.pointerId;
      gesture = "pending";
      startX = previousX = event.clientX;
      startY = event.clientY;
      previousTime = performance.now();
      maxDisplacement = 0;
      spinVelocity = 0;
    }

    function onPointerMove(event: PointerEvent) {
      if (!event.isPrimary) return;
      const now = performance.now();
      interrupt(now);
      if (event.pointerId !== pointerId) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      maxDisplacement = Math.max(maxDisplacement, Math.hypot(dx, dy));
      if (gesture === "pending") {
        if (Math.abs(dy) > Math.abs(dx)) gesture = "scroll";
        else if (Math.abs(dx) > Math.abs(dy) + 8) {
          gesture = "spin";
          container!.setPointerCapture(event.pointerId);
        }
      }
      if (gesture === "spin") {
        const movement = event.clientX - previousX;
        spinYaw += movement * 0.009;
        spinVelocity = THREE.MathUtils.clamp(
          (movement * 0.009) / Math.max((now - previousTime) / 1000, 0.008),
          -5,
          5,
        );
        if (Math.abs(spinVelocity) > 0.8) {
          targetExplode = Math.max(
            targetExplode,
            Math.min(0.55, Math.abs(spinVelocity) * 0.12),
          );
        }
      }
      previousX = event.clientX;
      previousTime = now;
    }

    function onPointerUp(event: PointerEvent) {
      if (event.pointerId !== pointerId) return;
      if (
        event.type === "pointerup" &&
        gesture === "pending" &&
        maxDisplacement < 4 &&
        Math.hypot(event.clientX - startX, event.clientY - startY) < 4
      )
        spawnPing();
      if (container!.hasPointerCapture(event.pointerId))
        container!.releasePointerCapture(event.pointerId);
      if (event.type !== "pointerup") spinVelocity = 0;
      pointerId = null;
      interrupt();
    }

    const targets = document.querySelectorAll(INTERACTIVE_TARGETS);
    targets.forEach((target) => {
      target.addEventListener(
        "pointerenter",
        (e: Event) => {
          if ((e as PointerEvent).pointerType === "touch") return;
          hoveredTargets.add(target);
          hoverTarget = target;
          interrupt();
        },
        { signal },
      );
      target.addEventListener(
        "pointerleave",
        (e: Event) => {
          if ((e as PointerEvent).pointerType === "touch") return;
          hoveredTargets.delete(target);
          hoverTarget = Array.from(hoveredTargets).at(-1) ?? null;
          interrupt();
        },
        { signal },
      );
      target.addEventListener(
        "focusin",
        (event) => {
          if (
            window.matchMedia("(pointer: coarse)").matches &&
            !target.matches(":focus-visible")
          )
            return;
          focusTarget =
            event.target instanceof Element
              ? event.target.closest(INTERACTIVE_TARGETS)
              : target;
          interrupt();
        },
        { signal },
      );
      target.addEventListener(
        "focusout",
        () => {
          if (focusTarget === target) focusTarget = null;
          interrupt();
        },
        { signal },
      );
    });
    container.addEventListener("pointerdown", onPointerDown, { signal });
    container.addEventListener(
      "dblclick",
      () => {
        targetExplode = 0.55;
        interrupt();
      },
      { signal },
    );
    window.addEventListener(
      "pointermove",
      (e) => {
        if (!e.isPrimary) return;
        if (isTrackingPaused) return;
        if (e.pointerType !== "touch") {
          hasRealCursor = true;
          cursorX = (e.clientX / window.innerWidth) * 2 - 1;
          cursorY = 1 - (e.clientY / window.innerHeight) * 2;
          interrupt();
        }
      },
      { passive: true, signal },
    );
    // freeze gaze while the theme toggle is clicked so the head doesn't
    // lurch toward the top-right button; hold neutral, then resume
    document.querySelector("#theme-toggle")?.addEventListener(
      "click",
      () => {
        isTrackingPaused = true;
        cursorX = 0;
        cursorY = 0;
        smoothCursorX = 0;
        smoothCursorY = 0;
        hoverTarget = null;
        hoveredTargets.clear();
        focusTarget = null;
        window.setTimeout(() => {
          isTrackingPaused = false;
        }, 500);
      },
      { signal },
    );
    window.addEventListener(
      "mouseleave",
      () => {
        hasRealCursor = false;
        cursorX = 0;
        cursorY = 0;
        interrupt();
      },
      { signal },
    );
    window.addEventListener("pointerup", onPointerUp, { signal });
    window.addEventListener("pointercancel", onPointerUp, { signal });
    window.addEventListener("wheel", () => interrupt(), {
      passive: true,
      signal,
    });
    window.addEventListener(
      "scroll",
      () => {
        scrollY = window.scrollY;
        const now = performance.now();
        const dt = Math.max(now - lastScrollAt, 16);
        if (lastScrollAt > 0) {
          const rawDelta = (scrollY - previousScrollY) / window.innerHeight;
          scrollVelocity = THREE.MathUtils.clamp(rawDelta, -0.03, 0.03);
        } else {
          scrollVelocity = 0;
        }
        previousScrollY = scrollY;
        lastScrollAt = now;
        const maxScroll = Math.max(
          1,
          document.documentElement.scrollHeight - window.innerHeight,
        );
        if (scrollY / maxScroll < 0.8) {
          wake();
        }
        targetAutoY = -0.18;
        nextSaccadeTime = performance.now() + 1000;
        interrupt();
      },
      { passive: true, signal },
    );
    window.addEventListener("keydown", () => interrupt(), { signal });
    document.addEventListener("themechange", applyTheme, { signal });
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) {
          cancelAnimationFrame(frame);
          frame = 0;
        } else interrupt();
      },
      { signal },
    );
    reducedMotion.addEventListener("change", () => interrupt(), { signal });
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    window.addEventListener("resize", resize, { signal });

    function animate(now: number) {
      frame = 0;
      if (disposed || document.hidden) return;

      // scroll exit & retirement at page bottom (smooth GPU opacity dissolve, no layout thrashing)
      const maxScroll = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const scrollRatio = Math.min(Math.max(scrollY / maxScroll, 0), 1);

      let scrollAlpha = 1.0;
      if (scrollRatio > 0.35) {
        scrollAlpha = Math.max(0, 1.0 - (scrollRatio - 0.35) / 0.4);
      }

      const mountEl = mountRef.current;
      if (mountEl) {
        if (entranceStart >= 0) {
          mountEl.style.removeProperty("opacity");
        } else {
          mountEl.style.opacity = scrollAlpha.toFixed(3);
        }
      }

      if (scrollAlpha <= 0.001) return;

      const delta = Math.max(0, Math.min((now - lastFrame) / 1000, 0.05));
      lastFrame = now;
      elapsed += delta;
      const reduced = reducedMotion.matches;
      if (!reduced) mixer?.update(delta);

      if (entranceStart >= 0) {
        const offset = entranceOffset();
        camera.position.z = cameraBaseZ + offset;
        camera.lookAt(0, camera.position.y, 0);
      }

      updateAutonomousGaze(now, delta);

      const target = hoverTarget || focusTarget;
      const stillFor = now - lastActivity;
      if (
        !reduced &&
        model &&
        mode === "GAZE" &&
        pointerId === null &&
        !target &&
        stillFor > nextTourDelay
      ) {
        tourStart = now;
        tourFrom = spinYaw;
        setMode("SHOWCASE", now);
      }
      if (mode === "SHOWCASE") {
        const t = (now - tourStart) / 1000;
        spinYaw = tourYaw(t, tourFrom);
        if (t < 2.0) {
          targetExplode = Math.max(
            targetExplode,
            0.45 * Math.sin((t / 2.0) * Math.PI),
          );
        }
        if (t >= 6.7) {
          spinYaw = 0;
          spinVelocity = 0;
          lastActivity = now;
          nextTourDelay = 25000 + Math.random() * 5000;
          setMode("GAZE", now);
        }
      } else if (pointerId === null) {
        spinYaw += (spinVelocity * (1 - Math.exp(-5 * delta))) / 5;
        spinVelocity *= Math.exp(-5 * delta);
        spinYaw = damp(spinYaw, 0, delta, 2.6);
      }
      spinGroup.rotation.y = spinYaw;
      gazeWeight = THREE.MathUtils.lerp(
        weightFrom,
        weightTo,
        smoothstep((now - weightStart) / weightDuration),
      );

      // subtle mechanical venting expansion (face/eyes/jaw remain completely rigid)
      const spr = springExplode(
        curExplode,
        targetExplode,
        explodeVelocity,
        delta,
      );
      curExplode = spr.position;
      explodeVelocity = spr.velocity;
      targetExplode = damp(targetExplode, 0, delta, 3.2);
      if (
        model &&
        (curExplode > 0.0005 || Math.abs(explodeVelocity) > 0.0005)
      ) {
        model.traverse((obj) => {
          if (obj instanceof THREE.Mesh && obj.userData.origin) {
            if (obj.userData.isOuterPlate) {
              const vent = THREE.MathUtils.clamp(curExplode * 0.08, 0, 0.08);
              obj.position.set(
                obj.userData.origin.x,
                obj.userData.origin.y + vent * 0.35,
                obj.userData.origin.z - vent,
              );
            } else {
              obj.position.copy(obj.userData.origin);
            }
          }
        });
      }

      // scroll parallax: depth along Z, tilt down, and subtle elevation
      const aspect = container!.clientWidth / container!.clientHeight;
      const isPortrait = aspect < 1.0;
      const scrollTilt = -scrollRatio * 0.35;
      const scrollZ = -scrollRatio * 2.0;
      const scrollYOffset = scrollRatio * 0.45;
      framingGroup.position.x = modelOffsetX;
      framingGroup.position.y = damp(
        framingGroup.position.y,
        reduced ? 0 : (isPortrait ? -0.05 : 0.04) + scrollYOffset,
        delta,
        4,
      );
      framingGroup.position.z = damp(
        framingGroup.position.z,
        reduced ? 0 : scrollZ,
        delta,
        4,
      );
      framingGroup.rotation.x = damp(
        framingGroup.rotation.x,
        reduced ? 0 : scrollTilt,
        delta,
        4,
      );

      // organic micro-drift and breathing
      const breathX =
        Math.sin(elapsed * 0.75) * 0.025 + Math.sin(elapsed * 1.7) * 0.012;
      const breathY =
        Math.cos(elapsed * 0.55) * 0.02 + Math.cos(elapsed * 1.2) * 0.01;

      // butter-smooth exponential chase: cursor never snaps or freezes
      const chaseFactor = 1.0 - Math.exp(-6.0 * delta);
      smoothCursorX += (cursorX - smoothCursorX) * chaseFactor;
      smoothCursorY += (cursorY - smoothCursorY) * chaseFactor;

      let x = 0;
      let y = 0;
      if (target) {
        const rect = target.getBoundingClientRect();
        x = THREE.MathUtils.clamp(
          ((rect.left + rect.width / 2) / window.innerWidth) * 2 - 1,
          -1,
          1,
        );
        y = THREE.MathUtils.clamp(
          1 - ((rect.top + rect.height / 2) / window.innerHeight) * 2,
          -1,
          1,
        );
      } else if (hasRealCursor) {
        // active global mouse gaze tracking down the page with subtle organic breath
        const mouseIdle = smoothstep((stillFor - 3000) / 1500);
        x =
          THREE.MathUtils.lerp(smoothCursorX, autoGazeX, mouseIdle) + breathX;
        y =
          THREE.MathUtils.lerp(smoothCursorY, autoGazeY, mouseIdle) + breathY;
      } else {
        x = autoGazeX + breathX;
        y = autoGazeY + breathY;
      }

      // strong scroll-driven downward bias: as the user scrolls into research,
      // the head bows forward to read the papers instead of staring dead-ahead
      const scrollProgress = Math.min(scrollY / 600, 1);
      const scrollPitch = scrollProgress * 0.45;
      const cursorPitch = y < 0 ? y * 0.5 : y * 0.25;

      const targetYaw = reduced
        ? 0
        : THREE.MathUtils.clamp(x * 0.58, -0.55, 0.55);
      const targetPitch = reduced
        ? 0
        : THREE.MathUtils.clamp(
            scrollPitch - cursorPitch,
            -0.3,
            0.6,
          );
      const targetRoll = reduced
        ? 0
        : target
          ? 0.04
          : -targetYaw * 0.08 + Math.sin(elapsed * 0.6) * 0.015;

      curYaw = damp(curYaw, targetYaw, delta, 7.5 * gazeWeight);
      curPitch = damp(curPitch, targetPitch, delta, 7.5 * gazeWeight);
      curRoll = damp(curRoll, targetRoll, delta, 7.5 * gazeWeight);
      scrollVelocity *= Math.exp(-8 * delta);
      scrollBias = damp(scrollBias, scrollVelocity * 2, delta, 5);
      modelGroup.rotation.set(curPitch + scrollBias, curYaw, curRoll);
      floatGroup.position.y = damp(
        floatGroup.position.y,
        reduced ? 0 : Math.sin(elapsed * 0.7) * 0.018,
        delta,
        3,
      );
      for (let i = pings.length - 1; i >= 0; i--) {
        const ping = pings[i];
        const progress = (now - ping.born) / 500;
        ping.mesh.scale.setScalar(1 + 2.2 * progress);
        ping.mesh.material.opacity = 0.65 * (1 - progress);
        if (progress >= 1) {
          scene.remove(ping.mesh);
          ping.mesh.geometry.dispose();
          ping.mesh.material.dispose();
          pings.splice(i, 1);
        }
      }
      composer.render();
      frame = requestAnimationFrame(animate);
    }

    function wake() {
      if (frame || disposed || document.hidden) return;
      lastFrame = performance.now();
      frame = requestAnimationFrame(animate);
    }

    container.dataset.motionMode = mode;
    resize();
    applyTheme();
    return () => {
      disposed = true;
      controller.abort();
      resizeObserver.disconnect();
      cancelAnimationFrame(frame);
      mixer?.stopAllAction();
      if (model) mixer?.uncacheRoot(model);
      disposeModel(scene);
      bloomPass.dispose();
      renderPass.dispose();
      outputPass.dispose();
      composer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div className="robot-stage" data-status={status}>
      <div
        ref={mountRef}
        className="robot-canvas"
        style={{ touchAction: "pan-y" }}
      />
      {!booted && status !== "unavailable" && (
        <div className="boot-loader" role="status" aria-live="polite">
          <div className="boot-track">
            <div
              className="boot-beam"
              style={{ transform: `scaleX(${loadProgress})` }}
            />
          </div>
          <span className="boot-text">
            // ASSEMBLING... [ {Math.round(loadProgress * 100)}% ]
          </span>
        </div>
      )}
      {status === "unavailable" && (
        <p className="scene-status" role="status">
          [ 3D PREVIEW UNAVAILABLE ]
        </p>
      )}
    </div>
  );
}
