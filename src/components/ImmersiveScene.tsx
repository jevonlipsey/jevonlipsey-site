import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { damp, smoothstep } from "../lib/hero-motion";

// cache the decoded GLB so the model survives hot reloads and re-mounts
THREE.Cache.enabled = true;

function wrapAngle(radians: number) {
  return ((radians + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
}

const HalftoneDitherShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: {
      value: new THREE.Vector2(
        typeof window !== "undefined" ? window.innerWidth : 1920,
        typeof window !== "undefined" ? window.innerHeight : 1080,
      ),
    },
    gridSize: { value: 12.0 }, // Punchier dot size for true editorial print look
    patternAngle: { value: 0.7853 }, // 45° halftone screen angle
    strength: { value: 0.75 }, // Punchier contrast between ink and paper
    highlightGain: { value: 1.4 }, // Highlight multiplier (lower in dark mode)
    fadeProgress: { value: 0.0 }, // Controlled entrance fade
    neckFadeStart: { value: 0.28 }, // Screen Y bottom threshold where fade begins
    neckFadeEnd: { value: 0.12 }, // Screen Y threshold where it dissolves
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float gridSize;
    uniform float patternAngle;
    uniform float strength;
    uniform float highlightGain;
    uniform float fadeProgress;
    uniform float neckFadeStart;
    uniform float neckFadeEnd;
    varying vec2 vUv;

    float getLuma(vec3 c) {
      return dot(c, vec3(0.299, 0.587, 0.114));
    }

    void main() {
      vec4 texColor = texture2D(tDiffuse, vUv);

      if (texColor.a < 0.005) {
        gl_FragColor = vec4(0.0);
        return;
      }

      // 1. Scaled 45-degree halftone coordinate system
      vec2 screenPos = vUv * resolution;
      float s = sin(patternAngle);
      float c = cos(patternAngle);
      mat2 rot = mat2(c, -s, s, c);
      vec2 rotPos = rot * screenPos;

      vec2 cell = fract(rotPos / gridSize) - 0.5;
      float distToCenter = length(cell);

      float luma = clamp(getLuma(texColor.rgb), 0.0, 1.0);

      // Distinct dot thresholds
      float dotRadius = clamp(sqrt(luma) * 0.52, 0.05, 0.48);
      // hardware-derivative AA: always a one-pixel ramp, no moire banding on
      // high-dpi or low-res screens
      float delta = fwidth(distToCenter) * 1.25;
      float dotMask = smoothstep(dotRadius + delta, dotRadius - delta, distToCenter);

      // Contrast ink styling
      vec3 patternColor = mix(texColor.rgb * 0.25, texColor.rgb * highlightGain, dotMask);
      vec3 finalRgb = mix(texColor.rgb, patternColor, strength);

      // 2. Vertical neck fade: soften the harsh bottom boundary
      // Lower vUv.y corresponds to the bottom of the screen/model
      float neckAlpha = smoothstep(neckFadeEnd, neckFadeStart, vUv.y);

      // 3. Combine with intro fade
      float totalAlpha = texColor.a * neckAlpha * clamp(fadeProgress, 0.0, 1.0);

      gl_FragColor = vec4(finalRgb, totalAlpha);
    }
  `,
};

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
    let framingScale = 1.75;
    let camZ = 5.8;
    let layout: "mobile" | "portrait" | "landscape" = "landscape";
    let targetLayoutScale = 1.75;
    let targetLayoutY = 0.04;
    let layoutApplied = false;
    let entranceStart = -1;
    let fadeStart = -1;
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
    const ditherPass = new ShaderPass(HalftoneDitherShader);
    const outputPass = new OutputPass();
    composer.addPass(renderPass);
    composer.addPass(bloomPass);
    composer.addPass(ditherPass);
    composer.addPass(outputPass);

    const ambient = new THREE.AmbientLight(0xffffff, 1.2);
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(4, 3.5, 4.5);
    const fill = new THREE.DirectionalLight(0xffffff, 1);
    fill.position.set(-3, 1, 3);
    // low, tight, hard rim behind the silhouette: crisp glints along the
    // ear plates, jawline, and neck edge instead of a flat halo
    const rim = new THREE.DirectionalLight(0xffffff, 3.2);
    rim.position.set(-3.5, 2.5, -4);
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

    let lastActivity = performance.now();
    let spinYaw = 0;
    let spinPitch = 0;
    let spinVelocity = 0;
    let pointerId: number | null = null;
    let gesture: "pending" | "spin" | "scroll" = "pending";
    let startX = 0;
    let startY = 0;
    let previousX = 0;
    let previousY = 0;
    let previousTime = 0;
    let maxDisplacement = 0;
    let curYaw = 0;
    let curPitch = 0;
    let curRoll = 0;
    let cursorX = 0;
    let cursorY = 0;
    let smoothCursorX = 0;
    let smoothCursorY = 0;
    let cursorSpeed = 0;
    let cursorEventX = 0;
    let cursorEventY = 0;
    let cursorEventAt = 0;
    let hoverGazeX: number | null = null;
    let hoverGazeY: number | null = null;
    let lastHoverAt = 0;
    let isTrackingPaused = false;
    let hasRealCursor = false;
    let autoGazeX = 0;
    let autoGazeY = 0;
    let targetAutoX = 0;
    let targetAutoY = 0;
    let nextSaccadeTime = performance.now() + 1200;
    let scrollY = 0;
    let scrollVelocity = 0;
    let scrollBias = 0;
    let previousScrollY = 0;
    let lastScrollAt = 0;
    let hoverTarget: Element | null = null;
    const hoveredTargets = new Set<Element>();
    let focusTarget: Element | null = null;
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

    function interrupt(now = performance.now()) {
      lastActivity = now;
      wake();
    }

    // animation principle: big gaze retargets must ease in (bounded start
    // speed) and ease out (exponential settle near the target) rather than
    // whip at full exponential velocity, then creep forever
    function easedChase(
      cur: number,
      target: number,
      delta: number,
      lambda: number,
      maxSpeed: number,
    ) {
      const eased = cur + (target - cur) * (1 - Math.exp(-lambda * delta));
      const step = eased - cur;
      const maxStep = maxSpeed * delta;
      return Math.abs(step) <= maxStep
        ? eased
        : cur + Math.sign(step) * maxStep;
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
      key.intensity = dark ? 2.4 : 1.8;
      fill.color.setHex(dark ? 0xd9d9d9 : 0xd6c9b5);
      bloomPass.enabled = dark;

      if (dark) {
        ditherPass.uniforms.strength.value = 0.75;
        ditherPass.uniforms.highlightGain.value = 0.95;
      } else {
        ditherPass.uniforms.strength.value = 0.65;
        ditherPass.uniforms.highlightGain.value = 1.4;
      }

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
      // hysteresis: hold the current frame layout while the viewport wiggles
      // around the 1:1 toggle (mobile toolbars animate this during page down)
      if (height < 500) layout = "mobile";
      else if (aspect < 0.95) layout = "portrait";
      else if (aspect > 1.05) layout = "landscape";
      const shortViewport = height < 500;
      targetLayoutScale = shortViewport ? 0.9 : layout === "portrait" ? 1.4 : 1.75;
      targetLayoutY = shortViewport ? 0.04 : layout === "portrait" ? -0.05 : 0.04;
      camera.aspect = aspect;
      const fitWidth =
        (shortViewport ? 1.1 : layout === "portrait" ? 1.4 : 1.85) /
        (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect);
      cameraBaseZ = Math.max(
        shortViewport ? 3.6 : layout === "portrait" ? 4.4 : 5.8,
        fitWidth,
      );
      camera.updateProjectionMatrix();
      const pixelRatio = Math.min(window.devicePixelRatio, 2);
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height);
      composer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);
      bloomPass.resolution.set(width * pixelRatio, height * pixelRatio);
      ditherPass.uniforms.resolution.value.set(
        width * pixelRatio,
        height * pixelRatio,
      );
      // dot spacing in css pixels grows mildly with screen size (~3.2px phone,
      // ~6px desktop), then pixelRatio bumps to device pixels so a retina
      // panel gets the same crisp frequency instead of capped big cells
      const dotCss = THREE.MathUtils.clamp(
        width * 0.0026 + 2.15,
        3.0,
        7.5,
      );
      ditherPass.uniforms.gridSize.value = dotCss * pixelRatio;
      stipplePixelRatio.value = pixelRatio;
      if (!layoutApplied) {
        // first paint places the camera directly; every later resize only
        // updates targets and lets the animate loop blend the motion
        layoutApplied = true;
        framingScale = targetLayoutScale;
        framingGroup.scale.setScalar(framingScale);
        framingGroup.position.y = targetLayoutY;
        camZ = cameraBaseZ + entranceOffset();
        camera.position.set(0, targetLayoutY, camZ);
        camera.lookAt(0, targetLayoutY, 0);
      }
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
            // semi-gloss ceramic: low roughness catches sharp specular glints,
            // a touch of metalness lifts the rim reflections off the black
            material.roughness = ceramic ? 0.5 : 0.3;
            material.metalness = ceramic ? 0.15 : 0.6;
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
              shader.uniforms.stippleStrength = { value: ceramic ? 0.16 : 0 };
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
        fadeStart = performance.now();
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

    function onPointerDown(event: PointerEvent) {
      if (!event.isPrimary || event.button !== 0 || pointerId !== null) return;
      interrupt();
      pointerId = event.pointerId;
      gesture = "pending";
      startX = previousX = event.clientX;
      startY = previousY = event.clientY;
      previousTime = performance.now();
      maxDisplacement = 0;
      spinVelocity = 0;
      // keep the gaze on the mouse instead of snapping to center when the
      // drag starts: the head already sits where the cursor is, so seed the
      // smoothing there and let the drag take over from that heading
      cursorX = (event.clientX / window.innerWidth) * 2 - 1;
      cursorY = 1 - (event.clientY / window.innerHeight) * 2;
      smoothCursorX = cursorX;
      smoothCursorY = cursorY;
    }

    function onPointerMove(event: PointerEvent) {
      if (!event.isPrimary) return;
      interrupt();
      if (event.pointerId !== pointerId) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      maxDisplacement = Math.max(maxDisplacement, Math.hypot(dx, dy));
      if (gesture === "pending") {
        // vertical touch drags keep scrolling the page; mouse drags rotate on
        // both axes once the pointer has committed past the click threshold
        if (event.pointerType === "touch" && Math.abs(dy) > Math.abs(dx)) {
          gesture = "scroll";
        } else if (maxDisplacement >= 6) {
          gesture = "spin";
          container!.setPointerCapture(event.pointerId);
        }
      }
      if (gesture === "spin") {
        const nowMs = performance.now();
        const dt = Math.max((nowMs - previousTime) / 1000, 0.008);
        const moveX = event.clientX - previousX;
        const moveY = event.clientY - previousY;
        spinYaw += moveX * 0.005;
        spinPitch = THREE.MathUtils.clamp(
          spinPitch + moveY * 0.004,
          -0.5,
          0.5,
        );
        spinVelocity = THREE.MathUtils.clamp(moveX * 0.005 / dt, -20, 20);
      }
      previousX = event.clientX;
      previousY = event.clientY;
      previousTime = performance.now();
    }

    function onPointerUp(event: PointerEvent) {
      if (event.pointerId !== pointerId) return;
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
    window.addEventListener(
      "pointermove",
      (e) => {
        if (!e.isPrimary) return;
        if (isTrackingPaused) return;
        if (e.pointerType !== "touch") {
          hasRealCursor = true;
          cursorX = (e.clientX / window.innerWidth) * 2 - 1;
          cursorY = 1 - (e.clientY / window.innerHeight) * 2;
          // screen-space speed, px/ms: distinguishes a fast cross-screen roam
          // from slow precision hops inside the research cluster
          if (cursorEventAt > 0) {
            const dtMs = Math.max(e.timeStamp - cursorEventAt, 1);
            const travel = Math.hypot(
              e.clientX - cursorEventX,
              e.clientY - cursorEventY,
            );
            cursorSpeed = travel / dtMs;
          } else {
            cursorSpeed = 0;
          }
          cursorEventX = e.clientX;
          cursorEventY = e.clientY;
          cursorEventAt = e.timeStamp;
          interrupt();
        }
      },
      { passive: true, signal },
    );
    container.addEventListener("pointerdown", onPointerDown, { signal });
    container.addEventListener("pointermove", onPointerMove, { signal });
    window.addEventListener("pointerup", onPointerUp, { signal });
    window.addEventListener("pointercancel", onPointerUp, { signal });
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
        cursorSpeed = 0;
        interrupt();
      },
      { signal },
    );
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

      if (fadeStart >= 0) {
        const fadeT = (now - fadeStart) / 2500;
        ditherPass.uniforms.fadeProgress.value = Math.min(fadeT, 1.0);
        if (fadeT >= 1.0) fadeStart = -1;
      }

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

      updateAutonomousGaze(now, delta);

      const target = hoverTarget || focusTarget;
      const stillFor = now - lastActivity;

      // momentum coast: the model keeps gliding a beat after the pointer lifts,
// then eases back to facing front so the autonomous gaze/hover/scroll all
// relink to a coherent heading; hold the button to keep inspecting the back
      if (pointerId === null) {
        spinYaw += (spinVelocity * (1 - Math.exp(-5 * delta))) / 5;
        spinVelocity *= Math.exp(-5 * delta);
        if (Math.abs(spinVelocity) < 0.25) {
          const home = spinYaw - wrapAngle(spinYaw);
          spinYaw = damp(spinYaw, home, delta, 2.2);
          spinPitch = damp(spinPitch, 0, delta, 2.2);
        }
      }
      spinGroup.rotation.y = spinYaw;
      spinGroup.rotation.x = spinPitch;

      // scroll parallax: depth along Z, tilt down, and subtle elevation
      const scrollTilt = -scrollRatio * 0.35;
      const scrollZ = -scrollRatio * 2.0;
      const scrollYOffset = scrollRatio * 0.45;
      framingGroup.position.x = modelOffsetX;
      framingGroup.position.y = damp(
        framingGroup.position.y,
        reduced ? 0 : targetLayoutY + scrollYOffset,
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
      // layout transitions (window resize, collapsing mobile browser chrome)
      // blend through the dampers instead of snapping, so the view never
      // lurches toward a hard-set center as the page nears its end
      framingScale = damp(framingScale, targetLayoutScale, delta, 3);
      framingGroup.scale.setScalar(framingScale);
      camZ = damp(camZ, cameraBaseZ + entranceOffset(), delta, 3);
      camera.position.set(0, targetLayoutY, camZ);
      camera.lookAt(0, targetLayoutY, 0);

      // organic micro-drift and breathing
      const breathX =
        Math.sin(elapsed * 0.75) * 0.025 + Math.sin(elapsed * 1.7) * 0.012;
      const breathY =
        Math.cos(elapsed * 0.55) * 0.02 + Math.cos(elapsed * 1.2) * 0.01;

      // adaptive exponential chase: tightens as the raw cursor outruns it so a
// cross-screen flick arrives near-instantly, loosens to buttery near-rest
      const cursorGap = Math.hypot(
        cursorX - smoothCursorX,
        cursorY - smoothCursorY,
      );
      const chaseFactor =
        1.0 - Math.exp(-THREE.MathUtils.lerp(6, 22, smoothstep(cursorGap / 0.8)) * delta);
      smoothCursorX += (cursorX - smoothCursorX) * chaseFactor;
      smoothCursorY += (cursorY - smoothCursorY) * chaseFactor;
      cursorSpeed *= Math.exp(-8 * delta);

      let x = 0;
      let y = 0;
      if (pointerId !== null) {
        // a grab owns the orientation: ease the face back to body-neutral, and
        // drop any lingering hover glide so the next hover re-locks cleanly
        hoverGazeX = null;
        hoverGazeY = null;
      } else if (target) {
        // hover gaze rides a damped glide between the tightly-packed research
        // links so hopping element-to-element eases the eyes instead of snapping
        const rect = target.getBoundingClientRect();
        const tx = THREE.MathUtils.clamp(
          ((rect.left + rect.width / 2) / window.innerWidth) * 2 - 1,
          -1,
          1,
        );
        const ty = THREE.MathUtils.clamp(
          1 - ((rect.top + rect.height / 2) / window.innerHeight) * 2,
          -1,
          1,
        );
        const gx = hoverGazeX === null ? tx : damp(hoverGazeX, tx, delta, 5);
        const gy = hoverGazeY === null ? ty : damp(hoverGazeY, ty, delta, 5);
        hoverGazeX = gx;
        hoverGazeY = gy;
        lastHoverAt = now;
        x = gx;
        y = gy;
      } else if (hasRealCursor) {
        // hold the last glide briefly so slow leave->enter churn between packed
        // links never flicks the gaze at the cursor; a fast cross-screen roam
        // breaks the lock immediately so the head follows the cursor acutely
        const holdGlide =
          now - lastHoverAt <= 200 && cursorSpeed < 1.2;
        const gx = hoverGazeX;
        const gy = hoverGazeY;
        if (gx !== null && gy !== null && holdGlide) {
          x = gx;
          y = gy;
        } else {
          hoverGazeX = null;
          hoverGazeY = null;
          const mouseIdle = smoothstep((stillFor - 3000) / 1500);
          x = THREE.MathUtils.lerp(smoothCursorX, autoGazeX, mouseIdle) + breathX;
          y = THREE.MathUtils.lerp(smoothCursorY, autoGazeY, mouseIdle) + breathY;
        }
      } else {
        x = autoGazeX + breathX;
        y = autoGazeY + breathY;
      }

      // strong scroll-driven downward bias: as the user scrolls into research,
      // the head bows forward to read the papers instead of staring dead-ahead
      const scrollProgress = Math.min(scrollY / 600, 1);
      const scrollPitch = scrollProgress * 0.45;
      // a cursor hugging the top of the viewport must outscale the scroll
      // bias, otherwise the head is locked looking down once scrolled past
      // 600px and can never tilt back up toward interactive elements
      const cursorPitch = y < 0 ? y * 0.5 : y * 0.85;

      // the gaze is a subtle overlay on the drag-set heading: mouse-left always
      // reads as a glance left, never as a mysterious spin to the back
      const targetYaw = reduced
        ? 0
        : THREE.MathUtils.clamp(x * 0.65, -0.65, 0.65);
      // the gaze rides the scroll posture for the cursor AND hovered targets, so a
      // link hover deep in the research section tilts within the bowed reading
      // angle instead of snapping the head back up and killing the effect
      const activePitch = scrollPitch - cursorPitch;
      const targetPitch = reduced
        ? 0
        : THREE.MathUtils.clamp(activePitch, -0.45, 0.55);
      const targetRoll = reduced
        ? 0
        : target
          ? 0.04
          : -targetYaw * 0.08 + Math.sin(elapsed * 0.6) * 0.015;

      curYaw = easedChase(curYaw, targetYaw, delta, 9, 2.6);
      curPitch = easedChase(curPitch, targetPitch, delta, 9, 1.5);
      curRoll = damp(curRoll, targetRoll, delta, 7.5);
      scrollVelocity *= Math.exp(-8 * delta);
      scrollBias = damp(scrollBias, scrollVelocity * 2, delta, 5);
      modelGroup.rotation.set(curPitch + scrollBias, curYaw, curRoll);
      floatGroup.position.y = damp(
        floatGroup.position.y,
        reduced ? 0 : Math.sin(elapsed * 0.7) * 0.018,
        delta,
        3,
      );
      composer.render();
      frame = requestAnimationFrame(animate);
    }

    function wake() {
      if (frame || disposed || document.hidden) return;
      lastFrame = performance.now();
      frame = requestAnimationFrame(animate);
    }

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
      ditherPass.dispose();
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
            ASSEMBLING... [ {Math.round(loadProgress * 100)}% ]
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
