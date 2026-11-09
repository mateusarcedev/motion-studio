import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const getModelUrl = (name) => `${import.meta.env.BASE_URL}models/${name}`;

// Preload models for immediate responsiveness
useGLTF.preload(getModelUrl('carga-container.glb'));
useGLTF.preload(getModelUrl('carga-truck.glb'));
useGLTF.preload(getModelUrl('carga-crane.glb'));
useGLTF.preload(getModelUrl('carga-ship.glb'));

// Atmospheric Sky Dome with rich blue hour horizon gradient
function SkyBackdrop({ lightingMode }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 512);

    if (lightingMode === 'night') {
      grad.addColorStop(0, '#0A1220');
      grad.addColorStop(0.35, '#101F35');
      grad.addColorStop(0.68, '#1C3355');
      grad.addColorStop(0.85, '#2B4A75');
      grad.addColorStop(0.94, '#3A5F92');
      grad.addColorStop(1, '#1A293D');
    } else {
      // Twilight / Blue Hour (Cinematic, luminous & atmospheric)
      grad.addColorStop(0, '#111F36');
      grad.addColorStop(0.30, '#1C3459');
      grad.addColorStop(0.58, '#284976');
      grad.addColorStop(0.74, '#3E6090');
      grad.addColorStop(0.86, '#6D5D72'); // glowing dusk lavender haze
      grad.addColorStop(0.93, '#9E6B4B'); // warm sunset amber horizon glow
      grad.addColorStop(1, '#243447');
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [lightingMode]);

  return (
    <mesh scale={[-1, 1, 1]} position={[0, 40, 0]}>
      <sphereGeometry args={[260, 32, 16]} />
      <meshBasicMaterial map={texture} depthWrite={false} side={THREE.BackSide} />
    </mesh>
  );
}

// Camera & Scene Choreography Controller (Aspect-Aware: Desktop Landscape & Mobile Portrait)
function SceneDirector({ currentScene, inspectMode, lightingMode }) {
  const { camera, size } = useThree();
  const isPortrait = size.width < size.height;
  const isTablet = size.width >= 768 && size.width < 1024;

  const cameraConfigs = useMemo(() => {
    if (isPortrait) {
      // Mobile Portrait Framing (Calculated for narrow horizontal FOV)
      return [
        // Scene 0: O Porto (Portrait: elevated 3/4 angle showing crane, quay and ship)
        {
          pos: new THREE.Vector3(14, 15, 34),
          target: new THREE.Vector3(-2, 3.2, 0),
          fov: 54
        },
        // Scene 1: O Contêiner (Portrait: centered framing fitting the entire 12m container)
        {
          pos: new THREE.Vector3(-1.5, 2.6, 17.5),
          target: new THREE.Vector3(0, 1.45, 0),
          fov: 52
        },
        // Scene 2: A Movimentação (Portrait: vertical hoist within portal)
        {
          pos: new THREE.Vector3(6, 11, 23),
          target: new THREE.Vector3(0, 5.2, 0),
          fov: 54
        },
        // Scene 3: A Estrada (Portrait: dynamic highway tracking angle)
        {
          pos: new THREE.Vector3(8, 4.2, 18),
          target: new THREE.Vector3(0, 2.0, 0),
          fov: 52
        },
        // Scene 4: O Destino (Portrait: arrival at hub)
        {
          pos: new THREE.Vector3(5, 4.0, 20),
          target: new THREE.Vector3(-0.5, 1.8, 0),
          fov: 52
        }
      ];
    }

    // Landscape Desktop / Tablet
    const scaleFactor = isTablet ? 1.15 : 1.0;
    return [
      // Scene 0: O Porto
      {
        pos: new THREE.Vector3(14 * scaleFactor, 10.0 * scaleFactor, 24 * scaleFactor),
        target: new THREE.Vector3(-2, 2.8, 0),
        fov: 42
      },
      // Scene 1: O Contêiner
      {
        pos: new THREE.Vector3(-6.5 * scaleFactor, 3.2 * scaleFactor, 7.8 * scaleFactor),
        target: new THREE.Vector3(-0.5, 2.0, 0),
        fov: 36
      },
      // Scene 2: A Movimentação
      {
        pos: new THREE.Vector3(10 * scaleFactor, 8.5 * scaleFactor, 16 * scaleFactor),
        target: new THREE.Vector3(0, 5.0, 0),
        fov: 42
      },
      // Scene 3: A Estrada
      {
        pos: new THREE.Vector3(13 * scaleFactor, 4.0 * scaleFactor, 11 * scaleFactor),
        target: new THREE.Vector3(1.5, 2.2, 0),
        fov: 38
      },
      // Scene 4: O Destino
      {
        pos: new THREE.Vector3(6 * scaleFactor, 3.8 * scaleFactor, 14 * scaleFactor),
        target: new THREE.Vector3(-1.0, 2.0, 0),
        fov: 38
      }
    ];
  }, [size.width, size.height, isPortrait, isTablet]);

  const targetLookAt = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    const targetConfig = cameraConfigs[currentScene] || cameraConfigs[0];
    const damping = Math.min(delta * 4.5, 0.3);

    // Smooth camera interpolation
    camera.position.lerp(targetConfig.pos, damping);
    targetLookAt.current.lerp(targetConfig.target, damping);
    camera.lookAt(targetLookAt.current);

    if (camera.fov !== targetConfig.fov) {
      camera.fov = THREE.MathUtils.lerp(camera.fov, targetConfig.fov, damping);
      camera.updateProjectionMatrix();
    }

    // Inspect mode micro-interaction (gentle orbit if user toggles inspect)
    if (inspectMode && currentScene === 1) {
      const time = state.clock.getElapsedTime();
      const radius = isPortrait ? 18 : 11;
      camera.position.x = Math.sin(time * 0.5) * radius;
      camera.position.z = Math.cos(time * 0.5) * radius;
      camera.lookAt(0, 1.8, 0);
    }
  });

  return null;
}

// Port Environment: Ocean, Dock, Cranes, Ship
function HarborEnvironment({ currentScene }) {
  const crane = useGLTF(getModelUrl('carga-crane.glb'));
  const ship = useGLTF(getModelUrl('carga-ship.glb'));

  // Fade out harbor when in highway / destination scenes
  const isHarbor = currentScene <= 2;

  return (
    <group visible={isHarbor} name="HarborEnvironment">
      {/* Ship moored in the water parallel to quay: length 100 along Z, docked at X = -24 */}
      <primitive
        object={ship.scene}
        position={[-24, 0, 0]}
        rotation={[0, Math.PI / 2, 0]}
      />

      {/* Primary STS Crane standing over the quay */}
      <primitive object={crane.scene} position={[0, 0, 0]} />

      {/* Secondary STS Crane in background */}
      <primitive object={crane.scene.clone()} position={[0, 0, -32]} scale={[0.9, 0.9, 0.9]} />

      {/* Ocean plane with rich maritime cobalt and soft specular waves */}
      <mesh position={[-56, -0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[90, 200]} />
        <meshStandardMaterial color="#0E2A47" roughness={0.08} metalness={0.85} />
      </mesh>

      {/* Concrete Dock Pier — Slate industrial concrete with damp specular finish */}
      <mesh position={[18, -0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[60, 200]} />
        <meshStandardMaterial color="#263445" roughness={0.4} metalness={0.25} />
      </mesh>

      {/* Quayside yellow hazard safety line along quay edge at X = -11.5 */}
      <mesh position={[-11.5, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.5, 180]} />
        <meshBasicMaterial color="#FF9900" />
      </mesh>
    </group>
  );
}

// Highway Environment: Asphalt, Guardrails, Sodium streetlights
function HighwayEnvironment({ currentScene }) {
  const isHighway = currentScene >= 3;
  const roadLength = 200;
  const polesRef = useRef();

  useFrame((state, delta) => {
    if (isHighway && polesRef.current && currentScene === 3) {
      // Simulate road speed motion in scene 4
      polesRef.current.position.x -= delta * 30;
      if (polesRef.current.position.x < -30) {
        polesRef.current.position.x = 0;
      }
    }
  });

  return (
    <group visible={isHighway} name="HighwayEnvironment">
      {/* Wet asphalt road with specular reflections */}
      <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[roadLength, 20]} />
        <meshStandardMaterial color="#222C3A" roughness={0.25} metalness={0.3} />
      </mesh>

      {/* Road lane dashed lines */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[roadLength, 0.28]} />
        <meshBasicMaterial color="#F1F5F9" />
      </mesh>

      {/* Road border yellow continuous lines */}
      <mesh position={[0, 0.01, 6]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[roadLength, 0.25]} />
        <meshBasicMaterial color="#F59E0B" />
      </mesh>
      <mesh position={[0, 0.01, -6]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[roadLength, 0.25]} />
        <meshBasicMaterial color="#F59E0B" />
      </mesh>

      {/* Rhythmic Sodium Light Poles */}
      <group ref={polesRef}>
        {[-60, -30, 0, 30, 60, 90, 120].map((px, idx) => (
          <group key={idx} position={[px, 0, -8]}>
            <mesh position={[0, 4.5, 0]}>
              <cylinderGeometry args={[0.1, 0.15, 9, 8]} />
              <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.4} />
            </mesh>
            <mesh position={[1, 8.8, 1.5]} rotation={[0, 0, -Math.PI / 6]}>
              <cylinderGeometry args={[0.08, 0.08, 3.5, 8]} />
              <meshStandardMaterial color="#475569" />
            </mesh>
            {/* Sodium Amber Lamp Head */}
            <mesh position={[2.2, 9.4, 1.5]}>
              <boxGeometry args={[0.8, 0.3, 0.5]} />
              <meshStandardMaterial color="#F59E0B" emissive="#F59E0B" emissiveIntensity={4.5} />
            </mesh>
            <pointLight position={[2.2, 8.5, 1.5]} color="#F59E0B" intensity={120} distance={40} decay={1.5} />
          </group>
        ))}
      </group>
    </group>
  );
}

// Protagonist Container & Truck Choreography
function JourneyActors({ currentScene, onContainerClick }) {
  const container = useGLTF(getModelUrl('carga-container.glb'));
  const truck = useGLTF(getModelUrl('carga-truck.glb'));

  const containerRef = useRef();
  const truckRef = useRef();

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    if (!containerRef.current) return;

    // SCENE SPECIFIC ACTOR POSITIONS & LIFTS
    if (currentScene === 0) {
      // Scene 1: Rest on ground quay, in front of waiting truck
      containerRef.current.position.set(0, 0.05, 2);
      containerRef.current.rotation.set(0, 0, 0);
      if (truckRef.current) {
        truckRef.current.position.set(0, 0, -5);
        truckRef.current.visible = true;
      }
    } else if (currentScene === 1) {
      // Scene 2: Protagonist focus
      containerRef.current.position.set(0, 0.05, 0);
      containerRef.current.rotation.set(0, 0, 0);
      if (truckRef.current) {
        truckRef.current.position.set(0, 0, -5);
        truckRef.current.visible = true;
      }
    } else if (currentScene === 2) {
      // Scene 3: STS Crane Lift Animation
      const liftProgress = (Math.sin(t * 1.5) + 1) / 2;
      const targetY = 1.0 + liftProgress * 7.5;
      containerRef.current.position.set(0, targetY, 0);
      containerRef.current.rotation.set(0, 0, 0);
      if (truckRef.current) {
        truckRef.current.position.set(0, 0, 0);
        truckRef.current.visible = true;
      }
    } else if (currentScene === 3) {
      // Scene 4: Loaded on Truck traversing Highway
      if (truckRef.current) {
        truckRef.current.position.set(0, 0, 0);
        truckRef.current.visible = true;
      }
      containerRef.current.position.set(-2.2, 1.45, 0);
      containerRef.current.rotation.set(0, 0, 0);
    } else if (currentScene === 4) {
      // Scene 5: Final Destination Bay
      if (truckRef.current) {
        truckRef.current.position.set(0, 0, 0);
        truckRef.current.visible = true;
      }
      containerRef.current.position.set(-2.2, 1.45, 0);
      containerRef.current.rotation.set(0, 0, 0);
    }
  });

  return (
    <group name="ActorsGroup">
      {/* Semi Truck */}
      <group ref={truckRef}>
        <primitive object={truck.scene} />
        {/* Truck Headlights & Amber Marker Lights */}
        {currentScene >= 3 && (
          <group position={[8.5, 1.8, 0]}>
            <pointLight position={[0, 0, 0.9]} color="#38BDF8" intensity={50} distance={25} />
            <pointLight position={[0, 0, -0.9]} color="#38BDF8" intensity={50} distance={25} />
            <pointLight position={[-16.5, 0, 0.9]} color="#EF4444" intensity={25} distance={15} />
            <pointLight position={[-16.5, 0, -0.9]} color="#EF4444" intensity={25} distance={15} />
          </group>
        )}
      </group>

      {/* Protagonist Container */}
      <group
        ref={containerRef}
        onClick={(e) => {
          e.stopPropagation();
          onContainerClick && onContainerClick();
        }}
        onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { document.body.style.cursor = 'default'; }}
      >
        <primitive object={container.scene} />
        {/* Dedicated fill light on protagonist container */}
        <pointLight position={[0, 3.5, 4.5]} color="#FF9500" intensity={45} distance={22} />
      </group>
    </group>
  );
}

export default function CargaExperience({
  currentScene,
  inspectMode,
  lightingMode,
  onContainerClick
}) {
  return (
    <div className="experience-viewport">
      <Canvas
        className="canvas-container"
        shadows
        dpr={typeof window !== 'undefined' ? [1, Math.min(window.devicePixelRatio || 1, 1.75)] : [1, 1.5]}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: lightingMode === 'night' ? 1.4 : 1.75
        }}
        camera={{ position: [14, 10.0, 24], fov: 42, near: 0.1, far: 600 }}
      >
        <color attach="background" args={[lightingMode === 'night' ? '#101F35' : '#1A293D']} />
        <fog attach="fog" args={[lightingMode === 'night' ? '#101F35' : '#1E2C3D', 80, 320]} />

        {/* 360 Sky Dome Backdrop */}
        <SkyBackdrop lightingMode={lightingMode} />

        {/* Soft sky and ground hemisphere fill so shadows are sculpted and visible */}
        <hemisphereLight
          skyColor={lightingMode === 'night' ? '#7DD3FC' : '#BAE6FD'}
          groundColor="#334155"
          intensity={lightingMode === 'night' ? 1.1 : 1.5}
        />

        {/* Ambient fill */}
        <ambientLight intensity={lightingMode === 'night' ? 0.6 : 0.85} color="#E2E8F0" />

        {/* Primary Sun / Horizon Key Light (Warm golden/twilight, shining from front-right) */}
        <directionalLight
          position={[25, 28, 28]}
          intensity={lightingMode === 'night' ? 2.0 : 3.6}
          color="#FFF5E6"
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.0001}
        />

        {/* Secondary Sky Blue Fill Light */}
        <directionalLight
          position={[-25, 20, 20]}
          intensity={lightingMode === 'night' ? 1.2 : 1.8}
          color="#7DD3FC"
        />

        {/* Harbor Blue/Cyan Rim Light (shining from back-left for gorgeous rim highlights) */}
        <directionalLight
          position={[-30, 25, -20]}
          intensity={lightingMode === 'night' ? 2.4 : 2.2}
          color="#00F0FF"
        />

        {/* Harbor Cyan Overhead Floodlight */}
        <spotLight
          position={[8, 30, 16]}
          angle={0.65}
          penumbra={0.7}
          intensity={lightingMode === 'night' ? 110 : 90}
          color="#00F0FF"
          distance={90}
        />

        {/* Container Amber Warm Flood Light */}
        <pointLight position={[-3, 6, 8]} color="#FF8A00" intensity={45} distance={35} />

        {/* Highway Fill Light when traversing road */}
        {currentScene >= 3 && (
          <directionalLight position={[10, 20, 15]} intensity={0.8} color="#38BDF8" />
        )}

        <SceneDirector
          currentScene={currentScene}
          inspectMode={inspectMode}
          lightingMode={lightingMode}
        />

        <HarborEnvironment currentScene={currentScene} />
        <HighwayEnvironment currentScene={currentScene} />
        <JourneyActors
          currentScene={currentScene}
          onContainerClick={onContainerClick}
        />
      </Canvas>
    </div>
  );
}
