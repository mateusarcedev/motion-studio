/**
 * Aurora Watch — Hero 3D Component (React Three Fiber)
 * 
 * Uso:
 * import { AuroraHero } from './AuroraHero';
 * <AuroraHero glbPath="/models/aurora-optimized.glb" autoRotate={true} />
 * 
 * Requisitos: @react-three/fiber, @react-three/drei, three
 * Lazy load nativo via Suspense
 */

'use client';

import { Suspense, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Html, useGLTF, Environment, ContactShadows } from '@react-three/drei';

export function AuroraHero({ 
  glbPath = '/models/aurora-optimized.glb',
  autoRotate = true,
  autoRotateSpeed = 0.3,
  enableHotspots = true,
  className = '',
  style = {},
  onLoad
}) {
  return (
    <div className={className} style={{ width: '100%', height: '100%', ...style }}>
      <Suspense fallback={<LoadingFallback />}>
        <Canvas
          camera={{ position: [0, 0.06, 0.12], fov: 35, near: 0.005, far: 5 }}
          shadows
          dpr={[1, 2]}
          gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true }}
          style={{ outline: 'none' }}
        >
          <FitCamera />
          <color attach="background" args={['#0a0a0c']} />
          
          {/* Environment */}
          <Environment
            preset="studio"
            background={false}
            resolution={256}
          />
          
          {/* Lights */}
          <directionalLight
            position={[0.5, 1, 0.7]}
            intensity={3}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
            shadow-camera-near={0.01}
            shadow-camera-far={2}
            shadow-camera-left={-0.2}
            shadow-camera-right={0.2}
            shadow-camera-top={0.2}
            shadow-camera-bottom={-0.2}
          />
          <ambientLight intensity={0.3} />
          
          {/* Scene */}
          <group>
            <Model glbPath={glbPath} onLoad={onLoad} />
            
            {/* Contact shadow */}
            <ContactShadows
              position={[0, -0.01, 0]}
              opacity={0.4}
              scale={0.3}
              blur={1.5}
            />
          </group>
          
          {/* Controls */}
          <OrbitControls
            autoRotate={autoRotate}
            autoRotateSpeed={autoRotateSpeed}
            enablePan={false}
            minDistance={0.06}
            maxDistance={0.4}
            target={[0, 0.01, 0]}
            enableDamping
            dampingFactor={0.05}
          />
          
          {/* Hotspots (HTML overlay) */}
          {enableHotspots && <Hotspots />}
        </Canvas>
      </Suspense>
    </div>
  );
}

// Keep the whole watch (case + crown, ~0.06 wide) inside the horizontal FOV on narrow viewports.
function FitCamera({ width = 0.07, height = 0.09, margin = 1.15 }) {
  const { camera, size } = useThree();
  useMemo(() => {
    const aspect = size.width / size.height;
    const vfov = (camera.fov * Math.PI) / 180;
    const distV = (height * margin) / 2 / Math.tan(vfov / 2);
    const distH = (width * margin) / 2 / (Math.tan(vfov / 2) * aspect);
    const d = Math.max(distV, distH, 0.1);
    const dir = camera.position.clone().sub({ x: 0, y: 0.01, z: 0 }).normalize();
    camera.position.set(dir.x * d, 0.01 + dir.y * d, dir.z * d);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height, width, height, margin]);
  return null;
}

function Model({ glbPath, onLoad }) {
  const { scene } = useGLTF(glbPath);
  useMemo(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    if (onLoad) onLoad(scene);
  }, [scene, onLoad]);
  return <primitive object={scene} />;
}

// ============ Hotspots ============
function Hotspots() {
  const hotspots = [
    { name: 'Case', position: [-0.021, 0, 0], info: 'Case: Titanium Grade 5, brushed' },
    { name: 'Bezel', position: [0.019, 0.0075, 0.0], info: 'Bezel: Polished ceramic' },
    { name: 'Crystal', position: [0, 0.0125, 0.012], info: 'Sapphire crystal, AR coating' },
    { name: 'Crown', position: [0.025, 0, 0], info: 'Crown: Titanium, knurled' },
    { name: 'Strap', position: [0, -0.002, 0.045], info: 'Strap: Italian leather' },
  ];

  return (
    <>
      {hotspots.map((hs, i) => (
        <Html key={i} position={hs.position} center>
          <div className="aurora-hotspot">
            <div className="ring" />
            <div className="label">{hs.name}</div>
            <div className="info">{hs.info}</div>
          </div>
        </Html>
      ))}
      <Html fullscreen style={{ pointerEvents: 'none' }}><style>{`
        .aurora-hotspot {
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          pointer-events: none;
        }
        .aurora-hotspot .ring {
          width: 24px; height: 24px; border: 2px solid #d5a94e; border-radius: 50%;
          animation: pulse 2s ease-in-out infinite;
          box-shadow: 0 0 8px #d5a94e;
        }
        .aurora-hotspot .label {
          font-size: 10px; font-weight: 700; color: #d5a94e; white-space: nowrap;
        }
        .aurora-hotspot .info {
          font-size: 9px; color: #aaa; white-space: nowrap; opacity: 0;
          transition: opacity .2s;
          background: rgba(10,10,12,0.9); padding: 2px 6px;
          border-radius: 4px; border: 1px solid #333;
        }
        .aurora-hotspot:hover .info { opacity: 1; }
        @keyframes pulse {
          0%,100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.5; }
        }
      `}</style></Html>
    </>
  );
}

// ============ Loading Fallback ============
function LoadingFallback() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: '100%', height: '100%', background: '#0a0a0c',
      color: '#888', fontFamily: 'system-ui', fontSize: 14
    }}>
      Carregando Aurora Watch…
    </div>
  );
}

export default AuroraHero;
