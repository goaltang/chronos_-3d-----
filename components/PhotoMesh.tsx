
import React, { useRef, useState, useMemo, useEffect, memo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Image, Text } from '@react-three/drei';
import * as THREE from 'three';
import { PhotoData } from '../types';

interface PhotoMeshProps {
  photo: PhotoData;
  position: [number, number, number];
  rotation: [number, number, number];
  isFocused: boolean;
  onFocus: () => void;
  visible?: boolean; // 新增：受父组件控制的可见性
}

const PhotoMesh: React.FC<PhotoMeshProps> = ({ photo, position, rotation, isFocused, onFocus, visible = true }) => {
  const meshRef = useRef<THREE.Group>(null!);
  const bgRef = useRef<THREE.MeshBasicMaterial>(null!);
  const [hovered, setHovered] = useState(false);
  const [imageError, setImageError] = useState(false); // ✅ 追踪图片加载错误

  const randomOffset = useMemo(() => Math.random() * Math.PI * 2, []);
  const randomSpeed = useMemo(() => 0.4 + Math.random() * 0.4, []);

  // 当 photo.url 变化时重置错误状态
  useEffect(() => {
    setImageError(false);
  }, [photo.url]);

  // 使用 useEffect 来同步 position prop 的变化
  // 当 position prop 改变时（比如照片数量变化导致位置重新计算），立即更新 z 坐标
  // z 坐标不参与动画，必须直接同步
  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.position.z = position[2];
    }
  }, [position[2]]);

  useFrame((state) => {
    // 性能优化：如果该组件不可见或距离相机太远，停止更新逻辑
    if (!visible || !meshRef.current) return;

    const time = state.clock.getElapsedTime();

    // 1. 缩放逻辑
    const targetScale = isFocused ? 1.6 : (hovered ? 1.4 : 1);
    meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, 1), 0.1);

    // 2. 位置逻辑 - 基于 position prop 进行偏移，而不是直接设置
    if (!isFocused) {
      const animY = Math.sin(time * randomSpeed + randomOffset) * 0.4;
      const animX = Math.cos(time * 0.3 + randomOffset) * 0.2;
      meshRef.current.position.y = position[1] + animY;
      meshRef.current.position.x = position[0] + animX;
      meshRef.current.position.z = position[2]; // 确保 z 坐标始终同步
    } else {
      meshRef.current.position.x = THREE.MathUtils.lerp(meshRef.current.position.x, position[0], 0.1);
      meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, position[1], 0.1);
      meshRef.current.position.z = position[2]; // 确保 z 坐标始终同步
    }

    // 3. 旋转逻辑 - 只在非聚焦状态下才计算动画旋转
    if (!isFocused && !hovered) {
      const targetRotX = Math.sin(time * 0.5 + randomOffset) * 0.12;
      const targetRotY = rotation[1] + Math.cos(time * 0.4 + randomOffset) * 0.12;
      const targetRotZ = Math.sin(time * 0.3 + randomOffset) * 0.08;

      meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, targetRotX, 0.1);
      meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, targetRotY, 0.1);
      meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, targetRotZ, 0.1);
    } else {
      // 聚焦或悬停时，直接设置旋转，避免不必要的计算
      meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, 0, 0.1);
      meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, rotation[1], 0.1);
      meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, 0, 0.1);
    }

    // 4. 背景发光
    if (bgRef.current) {
      const isHighlight = hovered || isFocused;
      const targetColor = isHighlight ? new THREE.Color("#00ffff") : new THREE.Color("#111111");
      bgRef.current.color.lerp(targetColor, 0.1);
      bgRef.current.opacity = THREE.MathUtils.lerp(bgRef.current.opacity, isHighlight ? 0.6 : 0.2, 0.1);
    }
  });

  return (
    <group
      ref={meshRef}
      position={[position[0], position[1], position[2]]}
      visible={visible}
      onPointerOver={(e) => {
        if (!visible) return;
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => {
        if (!visible) return;
        e.stopPropagation();
        onFocus();
      }}
    >
      {/* ✅ 图片加载失败时显示占位色块，而非让整个 Canvas 崩溃 */}
      {!imageError ? (
        <Image
          url={photo.url}
          transparent
          opacity={isFocused ? 1 : 0.9}
          toneMapped={false}
          scale={[7, 9.5]}
        />
      ) : (
        <mesh>
          <planeGeometry args={[7, 9.5]} />
          <meshBasicMaterial color="#1a1a2e" transparent opacity={0.8} />
        </mesh>
      )}

      {(hovered && !isFocused && visible) && (
        <group position={[0, -5.2, 0.2]}>
          <Text
            fontSize={0.4}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            maxWidth={8}
            fontWeight="bold"
          >
            {photo.title.toUpperCase()}
          </Text>
        </group>
      )}

      <mesh position={[0, 0, -0.05]}>
        <planeGeometry args={[7.2, 9.7]} />
        <meshBasicMaterial
          ref={bgRef}
          color="#111111"
          transparent
          opacity={0.2}
        />
      </mesh>
    </group>
  );
};

// 使用 React.memo 优化，避免不必要的重新渲染
export default memo(PhotoMesh, (prevProps, nextProps) => {
  // 自定义比较函数：返回 true 表示 props 相等（不需要重新渲染）
  // 返回 false 表示 props 不相等（需要重新渲染）
  return (
    prevProps.photo.id === nextProps.photo.id &&
    prevProps.position[0] === nextProps.position[0] &&
    prevProps.position[1] === nextProps.position[1] &&
    prevProps.position[2] === nextProps.position[2] &&
    prevProps.rotation[1] === nextProps.rotation[1] &&
    prevProps.isFocused === nextProps.isFocused &&
    prevProps.visible === nextProps.visible &&
    prevProps.photo.url === nextProps.photo.url
  );
});
