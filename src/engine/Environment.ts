/**
 * 3D 환경 구성 — 바닥, 벽, 조명
 * 거리감/깊이 참조를 위한 최소한의 환경
 * THREE.Group으로 래핑하여 Counter-Strafe 시나리오에서 이동 가능
 */
import * as THREE from 'three';
import {
  GRID_SIZE,
  GRID_DIVISIONS,
  AMBIENT_LIGHT_INTENSITY,
  DIRECTIONAL_LIGHT_INTENSITY,
  DIRECTIONAL_LIGHT_POSITION,
} from '../config/constants';
import { ENV_COLORS } from '../config/theme';

/** 씬에 기본 환경 요소 추가, Group 반환 (counter-strafe에서 이동용) */
export function createEnvironment(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();

  // === 바닥 그리드 === (100×100, 50 세분, 어두운 색상)
  const grid = new THREE.GridHelper(GRID_SIZE, GRID_DIVISIONS, ENV_COLORS.gridPrimary, ENV_COLORS.gridSecondary);
  grid.position.y = -1;
  group.add(grid);

  // === 벽 구조물 === (공간감 제공용 BoxGeometry 5개)
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: ENV_COLORS.wall,
    roughness: 0.8,
    metalness: 0.2,
  });

  // 후방 벽
  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(40, 8, 0.5),
    wallMaterial,
  );
  backWall.position.set(0, 3, -20);
  group.add(backWall);

  // 좌측 벽
  const leftWall = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 6, 20),
    wallMaterial,
  );
  leftWall.position.set(-15, 2, -5);
  group.add(leftWall);

  // 우측 벽
  const rightWall = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 6, 20),
    wallMaterial,
  );
  rightWall.position.set(15, 2, -5);
  group.add(rightWall);

  // 좌측 기둥
  const leftPillar = new THREE.Mesh(
    new THREE.BoxGeometry(2, 10, 2),
    wallMaterial,
  );
  leftPillar.position.set(-8, 4, -10);
  group.add(leftPillar);

  // 우측 기둥
  const rightPillar = new THREE.Mesh(
    new THREE.BoxGeometry(2, 10, 2),
    wallMaterial,
  );
  rightPillar.position.set(8, 4, -10);
  group.add(rightPillar);

  // 그룹을 씬에 추가
  scene.add(group);

  // === 조명 === (씬에 직접 추가 — 환경 그룹 이동과 무관)
  // 환경광 (전체 기본 밝기)
  const ambient = new THREE.AmbientLight(ENV_COLORS.light, AMBIENT_LIGHT_INTENSITY);
  scene.add(ambient);

  // 방향광 (그림자/입체감)
  const directional = new THREE.DirectionalLight(ENV_COLORS.light, DIRECTIONAL_LIGHT_INTENSITY);
  directional.position.set(DIRECTIONAL_LIGHT_POSITION.x, DIRECTIONAL_LIGHT_POSITION.y, DIRECTIONAL_LIGHT_POSITION.z);
  scene.add(directional);

  // 배경색 (어두운 네이비)
  scene.background = new THREE.Color(ENV_COLORS.background);

  return group;
}
