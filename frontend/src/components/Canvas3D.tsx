import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export const Canvas3D: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 1.5, 6);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // ─── 3D Barber Chair Abstraction Group ─────────────────────────────────
    const chairGroup = new THREE.Group();

    // Metallic Base Disk
    const baseGeo = new THREE.CylinderGeometry(1.2, 1.3, 0.15, 32);
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0x22222a,
      metalness: 0.9,
      roughness: 0.2,
    });
    const baseMesh = new THREE.Mesh(baseGeo, chromeMat);
    baseMesh.position.y = -1.2;
    chairGroup.add(baseMesh);

    // Hydraulic Stem
    const stemGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.8, 16);
    const stemMesh = new THREE.Mesh(stemGeo, chromeMat);
    stemMesh.position.y = -0.7;
    chairGroup.add(stemMesh);

    // Main Seat Cushion (Luxury Dark Leather with Gold Trim)
    const seatGeo = new THREE.BoxGeometry(1.4, 0.25, 1.3);
    const leatherMat = new THREE.MeshStandardMaterial({
      color: 0x12121a,
      roughness: 0.4,
      metalness: 0.1,
    });
    const seatMesh = new THREE.Mesh(seatGeo, leatherMat);
    seatMesh.position.y = -0.2;
    chairGroup.add(seatMesh);

    // Backrest
    const backGeo = new THREE.BoxGeometry(1.3, 1.2, 0.2);
    const backMesh = new THREE.Mesh(backGeo, leatherMat);
    backMesh.position.set(0, 0.5, -0.55);
    backMesh.rotation.x = -0.15;
    chairGroup.add(backMesh);

    // Headrest
    const headGeo = new THREE.BoxGeometry(0.6, 0.35, 0.15);
    const headMesh = new THREE.Mesh(headGeo, leatherMat);
    headMesh.position.set(0, 1.25, -0.65);
    chairGroup.add(headMesh);

    // Neon Accent Ring around Base
    const ringGeo = new THREE.TorusGeometry(1.4, 0.04, 16, 64);
    const neonMat = new THREE.MeshBasicMaterial({ color: 0x8B5CF6 });
    const ringMesh = new THREE.Mesh(ringGeo, neonMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = -1.18;
    chairGroup.add(ringMesh);

    scene.add(chairGroup);

    // ─── Floating Orbiting Particle Stars ──────────────────────────────────
    const particlesCount = 120;
    const particlesGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particlesCount * 3);
    const colors = new Float32Array(particlesCount * 3);

    for (let i = 0; i < particlesCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 12;
      positions[i + 1] = (Math.random() - 0.5) * 8;
      positions[i + 2] = (Math.random() - 0.5) * 10;

      // Mix purple & gold particle colors
      const isPurple = Math.random() > 0.4;
      colors[i] = isPurple ? 0.54 : 0.96;     // R
      colors[i + 1] = isPurple ? 0.36 : 0.62; // G
      colors[i + 2] = isPurple ? 0.96 : 0.04; // B
    }

    particlesGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particlesGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particlesMat = new THREE.PointsMaterial({
      size: 0.08,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
    });

    const particlesMesh = new THREE.Points(particlesGeo, particlesMat);
    scene.add(particlesMesh);

    // ─── Lighting ────────────────────────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const purpleSpot = new THREE.SpotLight(0x8B5CF6, 3);
    purpleSpot.position.set(5, 5, 5);
    scene.add(purpleSpot);

    const goldSpot = new THREE.SpotLight(0xF59E0B, 2.5);
    goldSpot.position.set(-5, -2, 3);
    scene.add(goldSpot);

    // ─── Mouse Movement Interactivity ─────────────────────────────────────
    let mouseX = 0;
    let mouseY = 0;
    let targetRotationY = 0;

    const handleMouseMove = (event: MouseEvent) => {
      const windowHalfX = window.innerWidth / 2;
      const windowHalfY = window.innerHeight / 2;
      mouseX = (event.clientX - windowHalfX) / 100;
      mouseY = (event.clientY - windowHalfY) / 100;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // ─── Animation Loop ───────────────────────────────────────────────────
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Continuous gentle rotation + mouse target interpolation
      targetRotationY = elapsedTime * 0.4 + mouseX * 0.3;
      chairGroup.rotation.y += (targetRotationY - chairGroup.rotation.y) * 0.05;
      chairGroup.rotation.x = Math.sin(elapsedTime * 0.8) * 0.05 + mouseY * 0.1;

      // Floating wave animation
      chairGroup.position.y = Math.sin(elapsedTime * 1.5) * 0.12;

      // Particle rotation
      particlesMesh.rotation.y = elapsedTime * 0.05;

      renderer.render(scene, camera);
    };

    animate();

    // ─── Resize Handler ───────────────────────────────────────────────────
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full h-[450px] md:h-[550px] relative cursor-grab active:cursor-grabbing">
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-md px-4 py-1.5 rounded-full border border-purple-500/20 text-xs text-purple-300/80 pointer-events-none flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping"></span>
        Interactive 3D Studio Model — Drag to Rotate
      </div>
    </div>
  );
};
