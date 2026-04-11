import { useMemo, useRef } from "react";
import { Line, OrthographicCamera } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useReducedMotion } from "framer-motion";
import { createNoise2D } from "simplex-noise";
import * as THREE from "three";
import { AdditiveBlending, CanvasTexture, Color, ShaderMaterial } from "three";

const auroraVertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const auroraFragmentShader = `
  varying vec2 vUv;
  uniform float uTime;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; i++) {
      value += amp * noise(p);
      p *= 2.02;
      amp *= 0.5;
    }
    return value;
  }

  void main() {
    vec2 uv = vUv;
    float t = uTime * 0.12;
    float direction = uv.x * 6.4 - t * 3.0;
    float waveA = sin(direction + sin(uv.x * 3.0 + t * 1.7) * 0.65) * 0.14;
    float waveB = sin(direction * 1.6 - 1.5 + cos(uv.x * 3.4 - t * 1.1) * 0.45) * 0.12;
    float waveC = sin(direction * 0.95 + 2.2 + sin(uv.x * 4.4 + t * 0.9) * 0.55) * 0.11;
    float waveD = sin(direction * 1.15 - 2.8 + cos(uv.x * 2.3 + t * 1.2) * 0.4) * 0.1;

    float field = fbm(vec2(uv.x * 3.4 - t * 2.2, uv.y * 2.4 + t * 0.45));

    float ribbonA = smoothstep(0.24, 0.0, abs(uv.y - 0.62 - waveA - field * 0.14));
    float ribbonB = smoothstep(0.2, 0.0, abs(uv.y - 0.48 - waveB - field * 0.11));
    float ribbonC = smoothstep(0.2, 0.0, abs(uv.y - 0.34 - waveC - field * 0.09));
    float ribbonD = smoothstep(0.16, 0.0, abs(uv.y - 0.22 - waveD - field * 0.08));

    vec3 indigo = vec3(0.19, 0.23, 0.72);
    vec3 cyan = vec3(0.16, 0.84, 0.96);
    vec3 violet = vec3(0.56, 0.32, 0.94);
    vec3 magenta = vec3(0.83, 0.32, 0.78);

    vec3 color = vec3(0.0);
    color += indigo * ribbonA * 1.15;
    color += cyan * ribbonB * 1.1;
    color += mix(violet, magenta, field) * ribbonC * 0.96;
    color += mix(cyan, violet, field) * ribbonD * 0.72;

    float haze = smoothstep(0.0, 1.0, field) * 0.28;
    color += vec3(0.08, 0.2, 0.38) * haze;
    color += vec3(0.03, 0.06, 0.12) * (ribbonA + ribbonB + ribbonC) * 0.24;

    float alpha = clamp(max(max(color.r, color.g), color.b) * 1.7, 0.0, 0.96);
    gl_FragColor = vec4(color * 1.08, alpha);
  }
`;

function createGlowTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");

  if (!context) {
    return new CanvasTexture(canvas);
  }

  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.2, "rgba(220,245,255,0.88)");
  gradient.addColorStop(0.52, "rgba(120,190,255,0.22)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");

  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function setMaterialOpacity(
  material: THREE.Material | THREE.Material[] | undefined,
  opacity: number,
) {
  if (Array.isArray(material)) {
    material.forEach((entry) => {
      if ("opacity" in entry) {
        entry.opacity = opacity;
      }
    });
    return;
  }

  if (material && "opacity" in material) {
    material.opacity = opacity;
  }
}

function AuroraRibbonField() {
  const materialRef = useRef<ShaderMaterial | null>(null);
  const { viewport } = useThree();

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.elapsedTime;
    }
  });

  return (
    <mesh position={[0, 0.25, -4]} scale={[viewport.width * 1.3, viewport.height * 1.25, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        uniforms={{ uTime: { value: 0 } }}
        vertexShader={auroraVertexShader}
        fragmentShader={auroraFragmentShader}
      />
    </mesh>
  );
}

function LavaPlasmaField() {
  const { viewport } = useThree();
  const noise2D = useMemo(() => createNoise2D(), []);
  const texture = useMemo(() => createGlowTexture(), []);
  const colors = useMemo(() => ["#3b82f6", "#8b5cf6", "#22d3ee", "#d946ef", "#1d4ed8", "#38bdf8"].map((value) => new Color(value)), []);
  const seeds = useMemo(() => Array.from({ length: 9 }, (_, index) => ({
    seed: index + 1,
    baseX: -0.82 + index * 0.2,
    baseY: 0.38 - index * 0.07,
    baseScale: 1.6 + (index % 3) * 0.55,
  })), []);
  const spriteRefs = useRef<Array<THREE.Sprite | null>>([]);

  useFrame(({ clock }) => {
    const time = clock.elapsedTime * 0.22;

    spriteRefs.current.forEach((sprite, index) => {
      if (!sprite) return;
      const data = seeds[index];
      const driftX = noise2D(data.seed * 0.53, time + data.seed) * viewport.width * 0.24;
      const driftY = noise2D(time + data.seed * 1.2, data.seed * 0.27) * viewport.height * 0.18;
      const breathe = 1 + noise2D(time * 0.72, data.seed * 0.33) * 0.22;
      const opacity = 0.14 + ((noise2D(time * 0.56, data.seed * 0.51) + 1) * 0.5) * 0.22;

      sprite.position.set(
        data.baseX * viewport.width * 0.5 + driftX,
        data.baseY * viewport.height * 0.5 + driftY,
        -3 + index * 0.02,
      );
      sprite.scale.setScalar(data.baseScale * breathe);
      setMaterialOpacity(sprite.material, opacity);
    });
  });

  return (
    <group>
      {seeds.map((data, index) => (
        <sprite
          key={data.seed}
          ref={(value) => {
            spriteRefs.current[index] = value;
          }}
          scale={[data.baseScale, data.baseScale, 1]}
        >
          <spriteMaterial
            map={texture}
            color={colors[index % colors.length]}
            transparent
            opacity={0.26}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </sprite>
      ))}
    </group>
  );
}

function ParticleDriftSystem() {
  const { viewport } = useThree();
  const texture = useMemo(() => createGlowTexture(), []);
  const particles = useMemo(
    () =>
      Array.from({ length: 52 }, (_, index) => ({
        x: -0.55 + ((index * 17) % 34) / 34,
        y: -0.42 + ((index * 23) % 34) / 34,
        speed: 0.2 + (index % 5) * 0.045,
        drift: 0.06 + (index % 4) * 0.02,
        scale: 0.11 + (index % 3) * 0.035,
        opacity: 0.24 + (index % 4) * 0.1,
      })),
    [],
  );
  const spriteRefs = useRef<Array<THREE.Sprite | null>>([]);

  useFrame((_, delta) => {
    spriteRefs.current.forEach((sprite, index) => {
      if (!sprite) return;
      const particle = particles[index];
      particle.x += particle.speed * delta * 0.65;
      particle.y += Math.sin((particle.x + index) * 8) * particle.drift * delta * 0.3;
      if (particle.x > 0.62) {
        particle.x = -0.62;
      }
      if (particle.y > 0.48) particle.y = -0.48;
      if (particle.y < -0.48) particle.y = 0.48;

      sprite.position.set(particle.x * viewport.width, particle.y * viewport.height, -1 + index * 0.01);
      setMaterialOpacity(sprite.material, particle.opacity + Math.sin(index + particle.x * 12) * 0.06);
    });
  });

  return (
    <group>
      {particles.map((particle, index) => (
        <sprite
          key={index}
          ref={(value) => {
            spriteRefs.current[index] = value;
          }}
          scale={[particle.scale, particle.scale, 1]}
        >
          <spriteMaterial
            map={texture}
            color={index % 3 === 0 ? "#d9f7ff" : index % 3 === 1 ? "#8dd8ff" : "#c7b3ff"}
            transparent
            opacity={particle.opacity}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </sprite>
      ))}
    </group>
  );
}

function FlowerGlyph({ radius = 0.18 }: { radius?: number }) {
  const offsets = [
    [0, 0],
    [radius, 0],
    [-radius, 0],
    [radius * 0.5, radius * 0.86],
    [-radius * 0.5, radius * 0.86],
    [radius * 0.5, -radius * 0.86],
    [-radius * 0.5, -radius * 0.86],
  ] as const;

  return (
    <group>
      {offsets.map(([x, y], index) => (
        <mesh key={index} position={[x, y, 0]}>
          <ringGeometry args={[radius * 0.78, radius * 0.84, 32]} />
          <meshBasicMaterial color="#c2d4ff" transparent opacity={0.28} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function MicroGeometrySystem() {
  const { viewport } = useThree();
  const seeds = useMemo(() => Array.from({ length: 9 }, (_, index) => ({
    seed: index + 1,
    baseX: -0.5 + index * 0.12,
    baseY: 0.24 - index * 0.07,
    radius: 0.11 + (index % 3) * 0.026,
  })), []);
  const noise2D = useMemo(() => createNoise2D(), []);
  const groupRefs = useRef<Array<THREE.Group | null>>([]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.12;
    groupRefs.current.forEach((group, index) => {
      if (!group) return;
      const data = seeds[index];
      group.position.set(
        data.baseX * viewport.width + noise2D(data.seed * 0.3, t + data.seed) * 0.24,
        data.baseY * viewport.height + noise2D(t * 0.8, data.seed * 0.42) * 0.18,
        -0.6,
      );
      const pulse = 0.16 + ((noise2D(t * 0.6 + data.seed, data.seed * 0.9) + 1) * 0.5) * 0.18;
      group.children.forEach((child: THREE.Object3D) => {
        if (!(child instanceof THREE.Mesh)) {
          return;
        }
        setMaterialOpacity(child.material, pulse);
      });
    });
  });

  return (
    <group>
      {seeds.map((data, index) => (
        <group
          key={data.seed}
          ref={(value) => {
            groupRefs.current[index] = value;
          }}
        >
          <FlowerGlyph radius={data.radius} />
        </group>
      ))}
      <Line
        points={[[-2.2, 1.2, -0.8], [-0.8, 0.6, -0.8], [0.6, 0.8, -0.8], [2.1, 0.3, -0.8]]}
        color="#93c5fd"
        lineWidth={0.5}
      />
    </group>
  );
}

function EnergyScene() {
  return (
    <>
      <OrthographicCamera makeDefault position={[0, 0, 10]} zoom={110} />
      <AuroraRibbonField />
      <LavaPlasmaField />
      <ParticleDriftSystem />
      <MicroGeometrySystem />
    </>
  );
}

export default function PublicEnergyBackground() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="public-energy-background" aria-hidden="true">
      {prefersReducedMotion ? (
        <div className="public-energy-static" />
      ) : (
        <Canvas
          className="h-full w-full"
          dpr={[1, 2]}
          gl={{ alpha: true, antialias: true }}
          eventSource={document.getElementById("root") ?? undefined}
        >
          <EnergyScene />
        </Canvas>
      )}
      <div className="public-energy-hero-focus" />
      <div className="public-energy-dark-blend" />
    </div>
  );
}
