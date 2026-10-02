import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { states, type PetState } from "../../contracts/src";
export function Pet({
  state = "available",
  reduced = false,
  gallery = false,
}: {
  state?: PetState;
  reduced?: boolean;
  gallery?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null),
    control = useRef<{ play: (s: string) => void } | undefined>(undefined),
    [fallback, setFallback] = useState(false),
    [rendered, setRendered] = useState(false);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
    } catch {
      setFallback(true);
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.28;
    host.append(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 100);
    camera.position.set(0, 1.5, 5.8);
    camera.lookAt(0, 1.22, 0);
    scene.add(new THREE.HemisphereLight(0xfff9ef, 0x84948e, 2.9));
    const key = new THREE.DirectionalLight(0xfff3e4, 4);
    key.position.set(-3, 5, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xc3b5ff, 3);
    rim.position.set(3, 2, -3);
    scene.add(rim);
    let mixer: THREE.AnimationMixer | undefined,
      model: THREE.Group | undefined,
      action: THREE.AnimationAction | undefined,
      frame = 0,
      disposed = false,
      visible = true,
      until = 0,
      last = 0;
    let clips: THREE.AnimationClip[] = [];
    let firstFrame = false;
    const renderFrame = () => {
      renderer.render(scene, camera);
      if (model && !firstFrame) {
        firstFrame = true;
        setRendered(true);
      }
    };
    const draw = (time: number) => {
      frame = 0;
      if (disposed || !visible || document.hidden) return;
      const delta = Math.min((time - last) / 1000, 0.05);
      last = time;
      if (!reduced) mixer?.update(delta);
      renderFrame();
      if (!reduced && (gallery || time < until))
        frame = requestAnimationFrame(draw);
    };
    const wake = () => {
      if (disposed || !visible || document.hidden) return;
      until = performance.now() + 3200;
      last = performance.now();
      if (!frame) frame = requestAnimationFrame(draw);
    };
    control.current = {
      play: (s) => {
        if (!mixer) return;
        const clip = clips.find((c) => c.name.toLowerCase() === s) || clips[0];
        if (!clip) return;
        const next = mixer.clipAction(clip);
        if (action !== next) {
          action?.fadeOut(0.22);
          next.reset().fadeIn(0.22).play();
          action = next;
        }
        if (reduced) mixer.setTime(0.45);
        wake();
      },
    };
    new GLTFLoader().load(
      "/duby/duby.glb",
      (g) => {
        if (disposed) return;
        model = g.scene;
        model.rotation.y = -0.17;
        scene.add(model);
        clips = g.animations;
        mixer = new THREE.AnimationMixer(model);
        control.current?.play(state);
        // A newly created, unfocused WebKit overlay may defer its first rAF.
        // Publish one real 3D frame immediately; later frames remain bounded by
        // visibility and activity, so hidden windows do not run an idle loop.
        renderFrame();
        host.dataset.loaded = "true";
      },
      undefined,
      () => setFallback(true),
    );
    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      wake();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    const io = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (visible) wake();
      else if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    });
    io.observe(host);
    const visibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else wake();
    };
    document.addEventListener("visibilitychange", visibility);
    const timer = setInterval(wake, 18000);
    const loss = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(frame);
      frame = 0;
      setFallback(true);
    };
    renderer.domElement.addEventListener("webglcontextlost", loss);
    return () => {
      disposed = true;
      clearInterval(timer);
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      mixer?.stopAllAction();
      model?.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
            m.dispose(),
          );
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      control.current = undefined;
    };
  }, [reduced, gallery]);
  useEffect(() => control.current?.play(state), [state]);
  return (
    <div
      className="pet-canvas"
      ref={ref}
      role="img"
      aria-label={
        fallback
          ? `Duby rendered atlas fallback, ${state}.`
          : rendered
            ? `Duby 3D companion, ${state}.`
            : "Loading Duby"
      }
    >
      {fallback && (
        <svg
          viewBox="0 0 192 192"
          width="100%"
          height="100%"
          role="img"
          aria-label={`Duby · ${state} · rendered atlas fallback`}
        >
          <image
            href="/duby/atlas.png"
            width="768"
            height="576"
            x={-(states.indexOf(state) % 4) * 192}
            y={-Math.floor(states.indexOf(state) / 4) * 192}
          />
        </svg>
      )}
    </div>
  );
}
