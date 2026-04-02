/**
 * Aim DNA 기어 선택기
 * 마우스 + 마우스패드 검색/자동완성 — gearDatabase.json 기반
 * 선택한 기어 정보를 AimDnaInsights에 전달하기 위해 콜백으로 노출
 */
import { useState, useMemo } from 'react';
import gearDb from '../data/gearDatabase.json';

/** JSON 타입 정의 */
export interface MouseEntry {
  id: string;
  name: string;
  brand: string;
  weight_g: number;
  /** symmetric | ergonomic | semi-ergo */
  shape: string;
  /** small | medium | large */
  size: string;
  /** wired | wireless | both */
  connection: string;
  sensor: string;
  max_dpi: number;
  length_mm: number;
  width_mm: number;
  height_mm: number;
}

export interface MousepadEntry {
  id: string;
  name: string;
  brand: string;
  /** speed | control | hybrid */
  surface: string;
  /** large | xl | xxl | desk */
  size: string;
  thickness_mm: number;
  dimensions_mm: string;
}

export interface GearSelection {
  mouse: MouseEntry | null;
  mousepad: MousepadEntry | null;
}

interface Props {
  value: GearSelection;
  onChange: (sel: GearSelection) => void;
}

const MICE: MouseEntry[] = gearDb.mice as MouseEntry[];
const PADS: MousepadEntry[] = gearDb.mousepads as MousepadEntry[];

/** 크기 한글 레이블 */
const SIZE_KO: Record<string, string> = {
  small: '소형',
  medium: '중형',
  large: '대형',
  xl: 'XL',
  xxl: 'XXL',
  desk: '데스크매트',
};

/** 서피스 한글 레이블 */
const SURFACE_KO: Record<string, string> = {
  speed: '스피드',
  control: '컨트롤',
  hybrid: '하이브리드',
};

/** 형태 한글 레이블 */
const SHAPE_KO: Record<string, string> = {
  symmetric: '시메트릭',
  ergonomic: '에르고노믹',
  'semi-ergo': '세미에르고',
};

export function AimDnaSensitivitySelector({ value, onChange }: Props) {
  const [mouseQuery, setMouseQuery] = useState('');
  const [padQuery, setPadQuery] = useState('');
  const [mouseOpen, setMouseOpen] = useState(false);
  const [padOpen, setPadOpen] = useState(false);

  /** 마우스 검색 필터 — 이름/브랜드/형태 매칭 */
  const filteredMice = useMemo(() => {
    const q = mouseQuery.toLowerCase().trim();
    if (!q) return MICE;
    return MICE.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.brand.toLowerCase().includes(q) ||
      m.shape.toLowerCase().includes(q) ||
      m.size.toLowerCase().includes(q)
    );
  }, [mouseQuery]);

  /** 마우스패드 검색 필터 */
  const filteredPads = useMemo(() => {
    const q = padQuery.toLowerCase().trim();
    if (!q) return PADS;
    return PADS.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.surface.toLowerCase().includes(q) ||
      p.size.toLowerCase().includes(q)
    );
  }, [padQuery]);

  /** 마우스 선택 */
  const selectMouse = (mouse: MouseEntry) => {
    onChange({ ...value, mouse });
    setMouseQuery(mouse.name);
    setMouseOpen(false);
  };

  /** 마우스패드 선택 */
  const selectPad = (pad: MousepadEntry) => {
    onChange({ ...value, mousepad: pad });
    setPadQuery(pad.name);
    setPadOpen(false);
  };

  return (
    <div className="gear-selector">
      {/* 마우스 선택 */}
      <div className="gear-field">
        <label className="gear-label">마우스</label>
        <div className="gear-autocomplete">
          <input
            className="input-field"
            type="text"
            placeholder="마우스 이름/브랜드로 검색..."
            value={mouseQuery}
            onChange={e => {
              setMouseQuery(e.target.value);
              setMouseOpen(true);
              // 입력 변경 시 선택 초기화
              if (value.mouse && e.target.value !== value.mouse.name) {
                onChange({ ...value, mouse: null });
              }
            }}
            onFocus={() => setMouseOpen(true)}
            onBlur={() => setTimeout(() => setMouseOpen(false), 150)}
          />
          {mouseOpen && filteredMice.length > 0 && (
            <ul className="gear-dropdown">
              {filteredMice.slice(0, 12).map(m => (
                <li
                  key={m.id}
                  className="gear-dropdown-item"
                  onMouseDown={() => selectMouse(m)}
                >
                  <span className="gear-item-name">{m.name}</span>
                  <span className="gear-item-meta">
                    {m.weight_g}g · {SHAPE_KO[m.shape] ?? m.shape} · {SIZE_KO[m.size] ?? m.size}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 선택된 마우스 상세 */}
        {value.mouse && (
          <div className="gear-detail-card">
            <div className="gear-detail-row">
              <span className="gear-detail-key">무게</span>
              <span className="gear-detail-val">{value.mouse.weight_g}g</span>
            </div>
            <div className="gear-detail-row">
              <span className="gear-detail-key">형태</span>
              <span className="gear-detail-val">{SHAPE_KO[value.mouse.shape] ?? value.mouse.shape}</span>
            </div>
            <div className="gear-detail-row">
              <span className="gear-detail-key">크기</span>
              <span className="gear-detail-val">{SIZE_KO[value.mouse.size] ?? value.mouse.size}</span>
            </div>
            <div className="gear-detail-row">
              <span className="gear-detail-key">연결</span>
              <span className="gear-detail-val">
                {value.mouse.connection === 'both' ? '유무선' : value.mouse.connection === 'wireless' ? '무선' : '유선'}
              </span>
            </div>
            <div className="gear-detail-row">
              <span className="gear-detail-key">크기(mm)</span>
              <span className="gear-detail-val">
                {value.mouse.length_mm}×{value.mouse.width_mm}×{value.mouse.height_mm}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 마우스패드 선택 */}
      <div className="gear-field">
        <label className="gear-label">마우스패드</label>
        <div className="gear-autocomplete">
          <input
            className="input-field"
            type="text"
            placeholder="패드 이름/브랜드/서피스로 검색..."
            value={padQuery}
            onChange={e => {
              setPadQuery(e.target.value);
              setPadOpen(true);
              if (value.mousepad && e.target.value !== value.mousepad.name) {
                onChange({ ...value, mousepad: null });
              }
            }}
            onFocus={() => setPadOpen(true)}
            onBlur={() => setTimeout(() => setPadOpen(false), 150)}
          />
          {padOpen && filteredPads.length > 0 && (
            <ul className="gear-dropdown">
              {filteredPads.slice(0, 12).map(p => (
                <li
                  key={p.id}
                  className="gear-dropdown-item"
                  onMouseDown={() => selectPad(p)}
                >
                  <span className="gear-item-name">{p.name}</span>
                  <span className="gear-item-meta">
                    {SURFACE_KO[p.surface] ?? p.surface} · {SIZE_KO[p.size] ?? p.size} · {p.dimensions_mm}mm
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 선택된 패드 상세 */}
        {value.mousepad && (
          <div className="gear-detail-card">
            <div className="gear-detail-row">
              <span className="gear-detail-key">서피스</span>
              <span className="gear-detail-val">{SURFACE_KO[value.mousepad.surface] ?? value.mousepad.surface}</span>
            </div>
            <div className="gear-detail-row">
              <span className="gear-detail-key">크기</span>
              <span className="gear-detail-val">{SIZE_KO[value.mousepad.size] ?? value.mousepad.size}</span>
            </div>
            <div className="gear-detail-row">
              <span className="gear-detail-key">치수</span>
              <span className="gear-detail-val">{value.mousepad.dimensions_mm}mm</span>
            </div>
            <div className="gear-detail-row">
              <span className="gear-detail-key">두께</span>
              <span className="gear-detail-val">{value.mousepad.thickness_mm}mm</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
