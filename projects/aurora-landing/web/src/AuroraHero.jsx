/**
 * Aurora Hero — Hero 3D Component (React Three Fiber)
 * 
 * Uso:
 * import { AuroraHero } from './AuroraHero'
 * <AuroraHero glbPath="/models/aurora-watch.glb" autoRotate={true} />
 * 
 * Requisitos: @react-three/fiber, @react-three/drei, three
 * Lazy load nativo via Suspense
 */

'use client';

import { Suspense, useMemo, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, useGLTF, Environment, ContactShadows } from '@react-three/drei';

export function AuroraHero({ 
  glbPath = '/models/aurora-watch.glb',
  autoRotate = true,
  autoRotateSpeed = 0.3,
  enableHotspots = true,
  reducedMotion = false,
  className = '',
  style = {},
  onLoad
}) {
  const { scene, cameras } = useGLTF(glbPath)
  
  useMemo(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
    if (onLoad) onLoad(scene)
  }, [scene, onLoad])

  return (
    <div className={`aurora-hero ${className}`} style={{ width: '100%', height: '100%', ...style }}>
      <Suspense fallback={<LoadingFallback />}>
        <Canvas
          camera={{ position: [0, 0.06, 0.12], fov: 35, near: 0.005, far: 5 }}
          shadows
          dpr={[1, 2]}
          gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true }}
          style={{ outline: 'none' }}
        >
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
            shadow-camera-near={0.1}
            shadow-camera-far={20}
            shadow-camera-left={-5}
            shadow-camera-right={5}
            shadow-camera-top={5}
            shadow-camera-bottom={-5}
          />
          <ambientLight intensity={0.3} />
          
          {/* Scene */}
          <group>
            <primitive object={scene} />
            
            {/* Contact shadow */}
            <ContactShadows
              position={[0, -0.05, 0]}
              opacity={0.2}
              scale={1.5}
              blur={1.5}
            />
          </group>
          
          {/* Controls */}
          <OrbitControls
            autoRotate={autoRotate && !reducedMotion}
            autoRotateSpeed={autoRotateSpeed}
            enablePan={false}
            minDistance={1.5}
            maxDistance={8}
            target={[0, 0.1, 0]}
            enableDamping
            dampingFactor={0.05}
          />
          
          {/* Hotspots */}
          {enableHotspots && !reducedMotion && <Hotspots />}
        </Canvas>
      </Suspense>
      
      {/* Fallback poster para reduced-motion / sem WebGL */}
      {reducedMotion && <PosterFallback />}
    </div>
  )
}

// ============ Hotspots ============
function Hotspots() {
  const { camera } = useThree()
  const hotspots = [
    { name: 'Case', position: [0, 0.02, 0.03], info: 'Case: Titânio Grau 5, acabamento escovado' },
    { name: 'Bezel', position: [0, 0.035, 0.025], info: 'Bezel: Cerâmica polida' },
    { name: 'Crystal', position: [0, 0.045, 0.015], info: 'Safira, AR coating' },
    { name: 'Crown', position: [0.022, 0, 0], info: 'Coroa: Titânio, knurled' },
    { name: 'Strap', position: [0, -0.03, -0.03], info: 'Strap: Couro italiano' },
  ]

  return (
    <>
      {hotspots.map((hs, i) => (
        <Html key={i} position={hs.position} transform center occlude>
          <div className="aurora-hotspot">
            <div className="ring" />
            <div className="label">{hs.name}</div>
            <div className="info">{hs.info}</div>
          </div>
        </Html>
      ))}
    </>
  )
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
  )
}

// ============ Poster Fallback ============
function PosterFallback() {
  return (
    <div style={{
      width: '100%', height: '100%', background: '#0a0a0c',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontFamily: 'Georgia, serif', fontSize: 'clamp(24px, 4vw, 48px)',
      fontWeight: 400, lineHeight: 1.1, textAlign: 'center', padding: '2rem'
    }}>
      Aurora.<br/><em style="color:#f38fa8">Watch</em>
    </div>
  )
}

// ============ FitCamera ============
function FitCamera() {
  const { camera } = useThree()
  useFrame(() => {
    camera.position.z = 0.12
    camera.position.y = 0.06
    camera.lookAt(0, 0.02, 0)
  })
}

