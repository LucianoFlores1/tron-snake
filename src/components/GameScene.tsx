/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { useEffect, useRef, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGameStore, globalGameState } from '../store/gameStore';
import { WORLD_SIZE, TURN_SPEED, BOOST_SPEED, BASE_SPEED } from '../shared/types';
import * as THREE from 'three';
import { Sphere, Grid } from '@react-three/drei';

const localCollectedOrbs = new Set<string>();

let audioCtx: AudioContext | null = null;
export const getAudioContext = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
};

function EngineSound({ isBoosting, isLocal, position }: { isBoosting: boolean, isLocal: boolean, position: THREE.Vector3 }) {
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const pannerRef = useRef<PannerNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);

  useEffect(() => {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(50, ctx.currentTime);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(250, ctx.currentTime);
    
    gain.gain.setValueAtTime(0, ctx.currentTime);
    
    osc.connect(filter).connect(gain);
    
    if (isLocal) {
      gain.connect(ctx.destination);
    } else {
      const panner = ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'exponential';
      panner.refDistance = 2;
      panner.maxDistance = 100;
      panner.rolloffFactor = 1.5;
      pannerRef.current = panner;
      gain.connect(panner).connect(ctx.destination);
    }

    osc.start();
    oscillatorRef.current = osc;
    gainRef.current = gain;
    filterRef.current = filter;

    return () => {
      try {
        osc.stop();
        osc.disconnect();
        gain.disconnect();
        filter.disconnect();
        if (pannerRef.current) pannerRef.current.disconnect();
      } catch (e) {
        // Ignore errors if context is closed
      }
    };
  }, [isLocal]);

  useFrame(() => {
    if (!oscillatorRef.current || !gainRef.current || !filterRef.current) return;
    const ctx = getAudioContext();
    if (ctx.state !== 'running') return;
    
    const targetFreq = isBoosting ? 90 : 45;
    const targetGain = isLocal ? 0.04 : 0.02;

    oscillatorRef.current.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.1);
    gainRef.current.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.1);
    filterRef.current.frequency.setTargetAtTime(isBoosting ? 400 : 250, ctx.currentTime, 0.1);

    if (pannerRef.current) {
      pannerRef.current.positionX.setTargetAtTime(position.x, ctx.currentTime, 0.1);
      pannerRef.current.positionY.setTargetAtTime(position.y, ctx.currentTime, 0.1);
      pannerRef.current.positionZ.setTargetAtTime(position.z, ctx.currentTime, 0.1);
    }
  });

  return null;
}

function VehicleHead({ color, headRef }: { color: string, headRef: React.RefObject<THREE.Group | null> }) {
  return (
    <group ref={headRef}>
      {/* Main Elongated Chassis - Very dark black */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2.4, 0.7, 0.4]} />
        <meshStandardMaterial color="#020202" metalness={1} roughness={0.05} />
      </mesh>
      
      {/* Rider - Extremely low profile, integrated into the bike */}
      <group position={[-0.1, 0, 0.2]}>
        {/* Torso/Back */}
        <mesh rotation={[0, -0.2, 0]}>
          <capsuleGeometry args={[0.22, 0.8, 4, 12]} />
          <meshStandardMaterial color="#050505" roughness={0.3} />
        </mesh>
        
        {/* Curved Neon Suit Lines (Shoulders/Back) */}
        <mesh position={[0.1, 0.22, 0.15]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.25, 0.02, 8, 24, Math.PI]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={6} toneMapped={false} />
        </mesh>
        <mesh position={[0.1, -0.22, 0.15]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.25, 0.02, 8, 24, Math.PI]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={6} toneMapped={false} />
        </mesh>

        {/* Helmet - Sleek and low */}
        <mesh position={[0.6, 0, 0.15]}>
          <sphereGeometry args={[0.16, 16, 16]} />
          <meshStandardMaterial color="#020202" metalness={0.9} roughness={0.1} />
        </mesh>
        {/* Helmet Visor Glow */}
        <mesh position={[0.72, 0, 0.18]}>
          <boxGeometry args={[0.04, 0.18, 0.08]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={4} toneMapped={false} />
        </mesh>
      </group>

      {/* Side Neon Strips - Thicker and brighter */}
      <mesh position={[0.1, 0.36, 0.05]}>
        <boxGeometry args={[2.0, 0.08, 0.15]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={8} toneMapped={false} />
      </mesh>
      <mesh position={[0.1, -0.36, 0.05]}>
        <boxGeometry args={[2.0, 0.08, 0.15]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={8} toneMapped={false} />
      </mesh>

      {/* Central Identity Disc / Power Core */}
      <group position={[-0.2, 0, 0.42]}>
        <mesh rotation={[0, 0, 0]}>
          <ringGeometry args={[0.14, 0.22, 32]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={10} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0, -0.01]}>
          <circleGeometry args={[0.13, 32]} />
          <meshStandardMaterial color="#000" />
        </mesh>
      </group>

      {/* Front Light Bar - Horizontal */}
      <mesh position={[1.15, 0, 0]}>
        <boxGeometry args={[0.08, 0.5, 0.25]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={6} toneMapped={false} />
      </mesh>

      {/* Rear Light Bar - Horizontal */}
      <mesh position={[-1.15, 0, 0]}>
        <boxGeometry args={[0.08, 0.5, 0.25]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={6} toneMapped={false} />
      </mesh>

      {/* Arm Neon Accents */}
      <mesh position={[0.3, 0.28, 0.3]} rotation={[0, -0.2, 0.5]}>
        <boxGeometry args={[0.5, 0.04, 0.04]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={5} toneMapped={false} />
      </mesh>
      <mesh position={[0.3, -0.28, 0.3]} rotation={[0, -0.2, -0.5]}>
        <boxGeometry args={[0.5, 0.04, 0.04]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={5} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Racer({ playerId, color, isLocal }: { playerId: string, color: string, isLocal: boolean }) {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.Group>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const currentPositions = useRef<{x: number, y: number}[]>([]);
  const [isBoosting, setIsBoosting] = useState(false);
  const [position] = useState(() => new THREE.Vector3());

  useFrame((state, delta) => {
    if (!bodyRef.current || !headRef.current) return;
    const gs = globalGameState.current;
    if (!gs) return;
    
    const player = gs.players[playerId];
    if (!player || player.segments.length === 0) {
      bodyRef.current.count = 0;
      headRef.current.visible = false;
      return;
    }
    
    headRef.current.visible = true;
    setIsBoosting(player.isBoosting);
    const count = player.segments.length;
    const skipSegments = 3; // Reduced skip segments to keep trail closer during boost
    bodyRef.current.count = Math.max(0, count - 1 - skipSegments);
    
    while (currentPositions.current.length < count) {
      const idx = currentPositions.current.length;
      currentPositions.current.push({ 
        x: player.segments[idx]?.x || 0, 
        y: player.segments[idx]?.y || 0 
      });
    }

    for (let i = 0; i < count; i++) {
      let targetX = player.segments[i].x;
      let targetY = player.segments[i].y;
      
      const curr = currentPositions.current[i];
      if (isLocal) {
        curr.x = targetX;
        curr.y = targetY;
      } else {
        const dist = Math.abs(targetX - curr.x) + Math.abs(targetY - curr.y);
        if (dist > 10) {
          curr.x = targetX;
          curr.y = targetY;
        } else {
          const lerpFactor = 15;
          curr.x += (targetX - curr.x) * lerpFactor * delta;
          curr.y += (targetY - curr.y) * lerpFactor * delta;
        }
      }
      
      if (i === 0) {
        headRef.current.position.set(curr.x, curr.y, 0.5);
        headRef.current.rotation.z = player.currentAngle;
        position.set(curr.x, curr.y, 0.5);
      } else if (i > skipSegments) {
        dummy.position.set(curr.x, curr.y, 0.5);
        dummy.updateMatrix();
        bodyRef.current.setMatrixAt(i - 1 - skipSegments, dummy.matrix);
      }
    }
    bodyRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <EngineSound isBoosting={isBoosting} isLocal={isLocal} position={position} />
      <VehicleHead color={color} headRef={headRef} />
      <instancedMesh ref={bodyRef} args={[null as any, null as any, 2000]} castShadow receiveShadow frustumCulled={false}>
        <sphereGeometry args={[0.28, 8, 8]} />
        <meshStandardMaterial
          color={color}
          roughness={0.2}
          metalness={0.8}
          toneMapped={false}
          onBeforeCompile={(shader) => {
            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <emissivemap_fragment>',
              `
              #include <emissivemap_fragment>
              float fresnel = pow(1.0 - max(dot(normal, normalize(vViewPosition)), 0.0), 2.0);
              totalEmissiveRadiance += diffuseColor.rgb * (1.5 + fresnel * 4.0);
              `
            );
          }}
        />
      </instancedMesh>
    </group>
  );
}

function Orbs() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorObj = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    if (!meshRef.current) return;
    const gs = globalGameState.current;
    if (!gs) return;

    let i = 0;
    for (const orbId in gs.orbs) {
      if (localCollectedOrbs.has(orbId)) continue;
      const orb = gs.orbs[orbId];
      dummy.position.set(orb.x, orb.y, 0.5);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      colorObj.set(orb.color);
      meshRef.current.setColorAt(i, colorObj);
      i++;
    }
    meshRef.current.count = i;
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[null as any, null as any, 1000]} castShadow receiveShadow frustumCulled={false}>
      <sphereGeometry args={[0.5, 16, 16]} />
      <meshStandardMaterial
        roughness={0.4}
        metalness={0.1}
        toneMapped={false}
        onBeforeCompile={(shader) => {
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <emissivemap_fragment>',
            `
            #include <emissivemap_fragment>
            totalEmissiveRadiance += diffuseColor.rgb * 2.5;
            `
          );
        }}
      />
    </instancedMesh>
  );
}

export function GameScene() {
  const { gameState, playerId, sendPlayerState, sendCollectOrb, setLocalFuel } = useGameStore();
  const { camera } = useThree();
  const inputs = useRef({ left: false, right: false, boost: false });
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const [lightTarget] = useState(() => new THREE.Object3D());

  const localPlayerRef = useRef<{
    active: boolean;
    segments: {x: number, y: number}[];
    score: number;
    currentAngle: number;
    isBoosting: boolean;
    lastSendTime: number;
    fuel: number;
    isOverheated: boolean;
  }>({
    active: false,
    segments: [],
    score: 10,
    currentAngle: 0,
    isBoosting: false,
    lastSendTime: 0,
    fuel: 100,
    isOverheated: false,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') && !inputs.current.left) { inputs.current.left = true; }
      if ((e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') && !inputs.current.right) { inputs.current.right = true; }
      if ((e.key === ' ' || e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') && !inputs.current.boost) { inputs.current.boost = true; }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if ((e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') && inputs.current.left) { inputs.current.left = false; }
      if ((e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') && inputs.current.right) { inputs.current.right = false; }
      if ((e.key === ' ' || e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') && inputs.current.boost) { inputs.current.boost = false; }
    };

    const handleBlur = () => {
      inputs.current = { left: false, right: false, boost: false };
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  useFrame((state, delta) => {
    const gs = globalGameState.current;
    if (!gs || !playerId) return;
    
    const serverPlayer = gs.players[playerId];
    if (serverPlayer && serverPlayer.state === 'alive') {
      
      // Initialize from server if not active
      if (!localPlayerRef.current.active && serverPlayer.segments.length > 0) {
        localPlayerRef.current.active = true;
        localPlayerRef.current.segments = [...serverPlayer.segments];
        localPlayerRef.current.score = serverPlayer.score;
        localPlayerRef.current.currentAngle = serverPlayer.currentAngle;
        localPlayerRef.current.fuel = 100;
        localPlayerRef.current.isOverheated = false;
        setLocalFuel(100, false);
      }

      if (!localPlayerRef.current.active) return;

      // Local movement logic
      if (inputs.current.left) localPlayerRef.current.currentAngle += TURN_SPEED * delta;
      if (inputs.current.right) localPlayerRef.current.currentAngle -= TURN_SPEED * delta;
      
      if (localPlayerRef.current.fuel <= 0) {
        localPlayerRef.current.isOverheated = true;
      } else if (localPlayerRef.current.fuel >= 10) {
        localPlayerRef.current.isOverheated = false;
      }

      let wantsToBoost = inputs.current.boost;
      if (localPlayerRef.current.isOverheated || localPlayerRef.current.fuel <= 0) {
        wantsToBoost = false;
      }
      
      localPlayerRef.current.isBoosting = wantsToBoost;
      const speed = localPlayerRef.current.isBoosting ? BOOST_SPEED : BASE_SPEED;
      
      if (localPlayerRef.current.isBoosting) {
        localPlayerRef.current.fuel -= (100 / 2) * delta;
        if (localPlayerRef.current.fuel < 0) localPlayerRef.current.fuel = 0;
      } else {
        localPlayerRef.current.fuel += (100 / 30) * delta;
        if (localPlayerRef.current.fuel > 100) localPlayerRef.current.fuel = 100;
      }
      
      const head = { ...localPlayerRef.current.segments[0] };
      head.x += Math.cos(localPlayerRef.current.currentAngle) * speed * delta;
      head.y += Math.sin(localPlayerRef.current.currentAngle) * speed * delta;

      // Boundary check
      const boundary = WORLD_SIZE / 2;
      if (head.x < -boundary) head.x = -boundary;
      if (head.x > boundary) head.x = boundary;
      if (head.y < -boundary) head.y = -boundary;
      if (head.y > boundary) head.y = boundary;

      localPlayerRef.current.segments.unshift(head);

      const targetLength = Math.floor(localPlayerRef.current.score);
      while (localPlayerRef.current.segments.length > targetLength) {
        localPlayerRef.current.segments.pop();
      }

      // Check orb collisions
      for (const orbId in gs.orbs) {
        if (localCollectedOrbs.has(orbId)) continue;
        const orb = gs.orbs[orbId];
        const dx = head.x - orb.x;
        const dy = head.y - orb.y;
        if (dx * dx + dy * dy < 4) {
          localPlayerRef.current.score += orb.value;
          localCollectedOrbs.add(orbId);
          delete gs.orbs[orbId]; // predict locally
          sendCollectOrb(orbId);
        }
      }

      // Cleanup localCollectedOrbs occasionally
      if (Math.random() < 0.05) {
        for (const id of localCollectedOrbs) {
          if (!gs.orbs[id]) localCollectedOrbs.delete(id);
        }
      }

      // Check player collisions
      let collided = false;
      for (const otherId in gs.players) {
        if (otherId === playerId) continue;
        const other = gs.players[otherId];
        if (other.state !== 'alive') continue;
        for (const seg of other.segments) {
          const dx = head.x - seg.x;
          const dy = head.y - seg.y;
          if (dx * dx + dy * dy < 2.25) {
            collided = true;
            break;
          }
        }
        if (collided) break;
      }

      if (collided) {
        localPlayerRef.current.active = false;
        sendPlayerState({
          segments: localPlayerRef.current.segments,
          score: localPlayerRef.current.score,
          currentAngle: localPlayerRef.current.currentAngle,
          isBoosting: localPlayerRef.current.isBoosting,
          state: 'dead'
        });
        return;
      }

      // Overwrite global state for local rendering
      gs.players[playerId].segments = localPlayerRef.current.segments;
      gs.players[playerId].score = localPlayerRef.current.score;
      gs.players[playerId].currentAngle = localPlayerRef.current.currentAngle;
      gs.players[playerId].isBoosting = localPlayerRef.current.isBoosting;

      // Send state to server at 20Hz
      const now = Date.now();
      if (now - localPlayerRef.current.lastSendTime > 50) {
        sendPlayerState({
          segments: localPlayerRef.current.segments,
          score: localPlayerRef.current.score,
          currentAngle: localPlayerRef.current.currentAngle,
          isBoosting: localPlayerRef.current.isBoosting,
          state: 'alive'
        });
        localPlayerRef.current.lastSendTime = now;
        setLocalFuel(localPlayerRef.current.fuel, localPlayerRef.current.isOverheated);
      }

      const targetZ = Math.min(45, Math.max(20, 20 + localPlayerRef.current.score * 0.2));
      
      // Smooth camera follow predicted head
      camera.position.x += (head.x - camera.position.x) * 10 * delta;
      camera.position.y += (head.y - camera.position.y) * 10 * delta;
      camera.position.z += (targetZ - camera.position.z) * 4 * delta;
      camera.lookAt(camera.position.x, camera.position.y, 0);

      // Make the directional light follow the camera to keep shadows crisp
      if (lightRef.current) {
        lightRef.current.position.set(camera.position.x + 10, camera.position.y - 10, 30);
        lightTarget.position.set(camera.position.x, camera.position.y, 0);
      }
    } else {
      localPlayerRef.current.active = false;
    }
  });

  if (!gameState) return null;

  return (
    <>
      <ambientLight intensity={0.4} />
      
      <directionalLight
        ref={lightRef}
        target={lightTarget}
        castShadow
        intensity={2}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-near={0.1}
        shadow-camera-far={100}
        shadow-bias={-0.001}
      />
      <primitive object={lightTarget} />

      {/* Ground plane to receive shadows */}
      <mesh receiveShadow position={[0, 0, -0.2]}>
        <planeGeometry args={[WORLD_SIZE, WORLD_SIZE]} />
        <meshStandardMaterial color="#0a0a0a" />
      </mesh>

      <Grid
        position={[0, 0, -0.1]}
        rotation={[Math.PI / 2, 0, 0]}
        args={[WORLD_SIZE, WORLD_SIZE]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#1e3a8a"
        sectionSize={10}
        sectionThickness={1}
        sectionColor="#3b82f6"
        fadeDistance={100}
        fadeStrength={1}
      />

      <Orbs />

      {Object.values(gameState.players).map((player) => {
        if (player.state !== 'alive' || player.segments.length === 0) return null;
        return (
          <Racer
            key={player.id}
            playerId={player.id}
            color={player.color}
            isLocal={player.id === playerId}
          />
        );
      })}
    </>
  );
}
