# Copilot Instructions — DataManager

## 프로젝트 개요
게임 데이터 테이블 관리 Electron 데스크톱 앱.  
Proto 파일을 스키마로 사용해 Excel ↔ JSON 변환, 코드 생성(C#·C++·Go·Rust·Unreal C++), 테이블 관계도 시각화를 제공한다.

## 기술 스택
- **Electron + electron-vite** — 메인/렌더러 분리 빌드
- **React 19 + TypeScript** — 렌더러 UI
- **Zustand** — 전역 상태 (`useAppStore`)
- **@xyflow/react** — 테이블 관계도 다이어그램
- **electron-store** — 설정 영속화 (`config.json`)
- **ExcelJS** — Excel 읽기/쓰기
- **protobufjs** — Proto 파일 파싱

## 디렉터리 구조
```
src/
  main/
    index.ts               # Electron 메인 진입점
    ipc/                   # IPC 핸들러 등록 (*.ipc.ts)
    services/              # 비즈니스 로직 서비스
  preload/
    index.ts               # contextBridge 노출
  renderer/src/
    App.tsx
    store/appStore.ts      # Zustand 스토어
    components/
      Settings/            # 경로·다이어그램 설정
      CodeGen/             # 코드 생성 패널
      TableCreator/        # Proto 메시지 편집
      EnumCreator/         # Proto Enum 편집
      ExcelPanel/          # Excel 관리
      DiagramView/         # 관계도 (ReactFlow)
  shared/
    types.ts               # 공유 타입 정의
    ipc-channels.ts        # IPC 채널 상수 (IPC.*)
```

## 핵심 규칙

### IPC 패턴
- 렌더러 → `ipcInvoke(IPC.XXX, ...args)` (preload 경유)
- 메인 → `ipcMain.handle(IPC.XXX, handler)`
- 채널 이름은 반드시 `src/shared/ipc-channels.ts`의 `IPC` 상수 사용

### 설정 서비스
- `settingsService.get()` — UI 표시용, 상대경로 그대로 반환
- `settingsService.getResolved()` — 파일 조작용, 절대경로로 변환
- **파일 I/O IPC 핸들러는 반드시 `getResolved()` 사용**
- 상대경로 기준점: 패키징 시 exe 디렉터리, 개발 시 프로젝트 루트 (`STORE_CWD`)

### 상태 관리
- `useAppStore`에서 `parsed`, `settings`, `loadProto`, `loadSettings`, `saveSettings` 사용
- `saveSettings(partial)` 호출 후 필요 시 `loadProto()` 재호출

### 코드 스타일
- 줄바꿈: CRLF (`.editorconfig` 기준)
- ESLint: `linebreak-style: 'off'`
- Prettier 강제 적용 — 한 줄 인라인 블록 지양, 변수 선언 분리

### Proto 스키마 규칙
- `// @PK` 주석 → `pkFields` (단일/합성 PK)
- `// @Key` 주석 → `keyFields` (배열 그룹화 기준)
- 필드 타입이 다른 Message 이름이면 → 외래 참조 (관계도 엣지 생성)
- 파일 헤더: `syntax = "proto3"; package DATA_MANAGER_TABLE; option go_package = "./DATA_MANAGER_TABLE";`

### 다이어그램 (DiagramCanvas.tsx)
- 레이아웃: `buildLayout(messages, edges, maxPerCol)` — Kahn BFS 깊이 할당, 허브 열 중앙 배치, 고립 노드 하단 분리
- 엣지: `offsetEdge` 타입 (병렬 엣지 Y 오프셋 분리)
- 기본 엣지 `zIndex: 0` (노드 뒤), hover 활성 엣지 `zIndex: 1000`
- ReactFlow `key={diagramMaxPerCol}` — 설정 변경 시 강제 리마운트

### 코드 생성
- 지원 언어: `C#`, `C++`, `Go`, `Rust`, `Unreal C++`
- Unreal C++: `DataTables.h`(struct), `DataTableLoader.h`/`.cpp`(템플릿 로더) 생성
- 각 struct에 `ParseFromJson(const TSharedPtr<FJsonObject>&)` 멤버 함수 포함

## 주의사항
- 렌더러에서 `useEffect` 안에 동기 `setState` 연쇄 호출 금지 → 파생 상태 패턴 사용
- ReactFlow는 내부 위치 캐시를 가짐 → 레이아웃 변경 시 `key` prop 변경으로 강제 리마운트
- `electron-store`는 메인 프로세스에서만 직접 접근, 렌더러는 IPC 경유
