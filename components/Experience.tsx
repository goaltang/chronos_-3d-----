
import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { ScrollControls, Scroll, useScroll, Text } from '@react-three/drei';
import * as THREE from 'three';
import PhotoMesh from './PhotoMesh';
import Starfield from './Starfield';
import { PhotoData } from '../types';
import { TUNNEL_DEPTH, SPIRAL_RADIUS } from '../constants';

const getPathOffset = (z: number) => {
  const x = Math.sin(z * 0.05) * 4 + Math.cos(z * 0.02) * 2;
  const y = Math.cos(z * 0.04) * 3 + Math.sin(z * 0.01) * 2;
  return { x: isNaN(x) ? 0 : x, y: isNaN(y) ? 0 : y };
};

const TimeMilestone: React.FC<{ label: string; position: [number, number, number]; visible: boolean }> = ({ label, position, visible }) => {
  return (
    <group position={position} visible={visible}>
      {/* Fix: replace opacity with fillOpacity and remove invalid transparent/depthTest props for Text component */}
      <Text
        fontSize={2.5}
        color="#00ffff"
        fillOpacity={0.15}
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
      <mesh position={[0, 0, -0.1]}>
        <ringGeometry args={[4, 4.1, 64]} />
        <meshBasicMaterial color="#00ffff" transparent opacity={0.05} />
      </mesh>
    </group>
  );
};

const SceneContent: React.FC<{
  photos: PhotoData[];
  focusedPhotoId: number | null;
  onFocusPhoto: (id: number | null) => void;
  isAutoPlaying?: boolean;
  autoPlaySpeed?: number;
}> = ({ photos, focusedPhotoId, onFocusPhoto, isAutoPlaying = false, autoPlaySpeed = 0.3 }) => {
  const scroll = useScroll();
  const { viewport } = useThree();
  const groupRef = useRef<THREE.Group>(null!);
  const [visibleIndices, setVisibleIndices] = useState<Set<number>>(new Set());
  const focusedPhotoIndexRef = useRef<number>(-1);
  const autoPlayRef = useRef<number | null>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const lastVisibleUpdateRef = useRef<number>(0);

  const dynamicDepth = useMemo(() => {
    // 少量照片时使用紧凑布局，避免照片间距过大
    // 每张照片最多间隔 15 单位，少量照片不会被拉到 225 深度
    const maxSpacing = 15;
    const neededDepth = photos.length * maxSpacing;
    return Math.max(neededDepth, Math.min(TUNNEL_DEPTH * 1.5, photos.length * 15));
  }, [photos.length]);

  const sortedPhotos = useMemo(() => {
    return [...photos].sort((a, b) => b.timestamp - a.timestamp);
  }, [photos]);

  // 缓存聚焦照片的索引，避免在 useFrame 中重复查找
  useEffect(() => {
    if (focusedPhotoId !== null) {
      focusedPhotoIndexRef.current = sortedPhotos.findIndex(p => p.id === focusedPhotoId);
    } else {
      focusedPhotoIndexRef.current = -1;
    }
  }, [focusedPhotoId, sortedPhotos]);

  const photoTransforms = useMemo(() => {
    if (sortedPhotos.length === 0) return [];
    // 计算照片间距，确保照片分布均匀
    // 第一张照片（最新，索引0）应该在相机前方合适的位置（z=-10左右）
    // 这样相机在 z=10 时，看向 z=-10，第一张照片就在视野中心附近
    const firstPhotoZ = -10; // 第一张照片在相机前方10单位
    // 最大间距 15 单位，避免少量照片时间距过大
    const rawSpacing = sortedPhotos.length > 1 ? dynamicDepth / (sortedPhotos.length - 1) : 15;
    const spacing = Math.min(rawSpacing, 15);
    return sortedPhotos.map((_, i) => {
      const angle = i * 0.9;
      // 第一张照片在 firstPhotoZ，之后每张照片向后（负方向）移动 spacing 距离
      const z = firstPhotoZ - i * spacing;
      const offset = getPathOffset(z);
      const radius = SPIRAL_RADIUS + (i % 2 === 0 ? 3 : -3) + Math.sin(i) * 2;
      const x = Math.cos(angle) * radius + offset.x;
      const y = Math.sin(angle) * radius + offset.y;
      const rotationY = -Math.atan2(x - offset.x, -z || 1) * 0.5;
      return { x, y, z, rotationY };
    });
  }, [sortedPhotos, dynamicDepth]);

  const milestones = useMemo(() => {
    const items: { label: string; z: number; offset: { x: number; y: number } }[] = [];
    let lastKey = "";
    const firstPhotoZ = -10;
    const rawSpacing = sortedPhotos.length > 1 ? dynamicDepth / (sortedPhotos.length - 1) : 15;
    const spacing = Math.min(rawSpacing, 15);
    sortedPhotos.forEach((p, i) => {
      const key = `${p.month} ${p.year}`;
      if (key !== lastKey) {
        const z = firstPhotoZ - i * spacing;
        items.push({ label: key, z, offset: getPathOffset(z) });
        lastKey = key;
      }
    });
    return items;
  }, [sortedPhotos, dynamicDepth]);

  // 自动播放逻辑：通过编程方式滚动 HTML 元素
  useEffect(() => {
    if (!isAutoPlaying || focusedPhotoId !== null) {
      if (autoPlayRef.current) {
        cancelAnimationFrame(autoPlayRef.current);
        autoPlayRef.current = null;
      }
      return;
    }

    // 找到滚动容器
    const getScrollContainer = (): HTMLElement | null => {
      const divs = document.querySelectorAll('div');
      return Array.from(divs).find(el => {
        const style = window.getComputedStyle(el);
        return (style.overflow === 'auto' || style.overflowY === 'auto' || style.overflow === 'scroll') &&
          el.scrollHeight > el.clientHeight;
      }) as HTMLElement | null;
    };

    const scrollContainer = getScrollContainer();
    if (!scrollContainer) return;

    let lastTime = performance.now();
    const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;

    const animate = (currentTime: number) => {
      if (!isAutoPlaying || focusedPhotoId !== null) return;

      const deltaTime = (currentTime - lastTime) / 1000; // 转换为秒
      lastTime = currentTime;

      // 计算滚动增量：autoPlaySpeed 是每秒滚动的比例（0-1）
      const scrollDelta = maxScroll * autoPlaySpeed * deltaTime;
      const newScrollTop = Math.min(
        scrollContainer.scrollTop + scrollDelta,
        maxScroll
      );

      scrollContainer.scrollTop = newScrollTop;

      // 如果到达底部，停止自动播放
      if (newScrollTop >= maxScroll - 1) {
        return;
      }

      autoPlayRef.current = requestAnimationFrame(animate);
    };

    autoPlayRef.current = requestAnimationFrame(animate);

    return () => {
      if (autoPlayRef.current) {
        cancelAnimationFrame(autoPlayRef.current);
        autoPlayRef.current = null;
      }
    };
  }, [isAutoPlaying, focusedPhotoId, autoPlaySpeed]);

  useFrame((state) => {
    const offset = scroll?.offset || 0;
    const camZ = state.camera.position.z;

    // 降低可见性计算频率，减少每帧状态更新
    const now = state.clock.getElapsedTime();
    if (now - lastVisibleUpdateRef.current > 0.08) {
      lastVisibleUpdateRef.current = now;

      const nextVisible = new Set<number>();
      photoTransforms.forEach((t, i) => {
        const dist = t.z - camZ;
        // 照片应该在相机前方才能看到：dist < 0 表示照片在相机前方（z 值更小）
        // 我们显示相机前方 100 单位内的照片，同时允许相机后方 5 单位的缓冲区域（避免边界闪烁）
        if (dist <= 5 && dist > -100) {
          nextVisible.add(i);
        }
      });

      if (nextVisible.size !== visibleIndices.size ||
        ![...nextVisible].every(idx => visibleIndices.has(idx))) {
        setVisibleIndices(nextVisible);
      }
    }

    if (focusedPhotoId !== null) {
      const index = focusedPhotoIndexRef.current;
      if (index !== -1 && index < photoTransforms.length && photoTransforms[index]) {
        const target = photoTransforms[index];
        const isMobile = viewport.width < 10;

        // 当聚焦时，相机向右偏移更多，让图片更靠左、为右侧详情卡留出空间
        const offsetX = isMobile ? 0 : 5;
        const offsetY = isMobile ? 2 : 0;
        const offsetZ = isMobile ? 18 : 14;

        const targetCamPos = new THREE.Vector3(target.x + offsetX, target.y - offsetY, target.z + offsetZ);
        state.camera.position.lerp(targetCamPos, 0.08);

        // 视角中心点向右侧偏移，使被观察的物体（图片）靠左
        const lookAtTarget = new THREE.Vector3(target.x + offsetX * 0.8, target.y - offsetY * 0.8, target.z);
        state.camera.lookAt(lookAtTarget);
      }
    } else {
      const targetZ = 10 - offset * (dynamicDepth + 20);
      const pathOffset = getPathOffset(targetZ);
      const targetPos = new THREE.Vector3(pathOffset.x, pathOffset.y, targetZ);
      state.camera.position.lerp(targetPos, 0.08);
      const lookAtZ = targetZ - 20;
      const futureOffset = getPathOffset(lookAtZ);
      state.camera.lookAt(futureOffset.x, futureOffset.y, lookAtZ);
    }
  });

  return (
    <>
      <color attach="background" args={['#000000']} />
      <fog attach="fog" args={['#000000', 10, 80]} />
      <ambientLight intensity={0.5} />
      <Starfield />
      <group ref={groupRef}>
        {milestones.map((m, idx) => (
          <TimeMilestone
            key={`milestone-${m.label}-${idx}`}
            label={m.label}
            position={[m.offset.x, m.offset.y, m.z - 5]}
            visible={Math.abs(m.z - scroll.offset * -dynamicDepth) < 80}
          />
        ))}
        {sortedPhotos.map((photo, i) => {
          const t = photoTransforms[i];
          if (!t) return null;
          return (
            <PhotoMesh
              key={photo.id}
              photo={photo}
              position={[t.x, t.y, t.z]}
              rotation={[0, t.rotationY, 0]}
              isFocused={focusedPhotoId === photo.id}
              onFocus={() => onFocusPhoto(photo.id)}
              visible={visibleIndices.has(i)}
            />
          );
        })}
      </group>
    </>
  );
};

const Experience: React.FC<{
  photos: PhotoData[];
  focusedPhotoId: number | null;
  onFocusPhoto: (id: number | null) => void;
  isAutoPlaying?: boolean;
  autoPlaySpeed?: number;
}> = ({ photos, focusedPhotoId, onFocusPhoto, isAutoPlaying = false, autoPlaySpeed = 0.3 }) => {
  const dynamicPages = Math.max(10, Math.ceil(photos.length / 2.5));
  return (
    <ScrollControls pages={dynamicPages} damping={0.4} enabled={focusedPhotoId === null}>
      <SceneContent
        photos={photos}
        focusedPhotoId={focusedPhotoId}
        onFocusPhoto={onFocusPhoto}
        isAutoPlaying={isAutoPlaying}
        autoPlaySpeed={autoPlaySpeed}
      />
      <Scroll html>
        <div className="w-screen pointer-events-none" />
      </Scroll>
    </ScrollControls>
  );
};

export default Experience;
