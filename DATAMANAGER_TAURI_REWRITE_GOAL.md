# DataManager Tauri 재작성 Goal

> 기준 저장소: https://github.com/hhhhm8826/DataManager  
> 기준 커밋: `3a4ba6ec652d750d88c88dcc9af8ada13b6eb169`  
> 문서 목적: Codex `/goal` 실행용 완료 계약  
> 우선 출시 플랫폼: Windows x64

## /goal 시작 문구

아래 문구로 Goal을 시작한다.

> /goal 이 저장소를 `DATAMANAGER_TAURI_REWRITE_GOAL.md`의 계약에 따라 Tauri + TypeScript 애플리케이션으로 처음부터 재작성한다. 기존 사용자 기능과 파일 호환성을 보존하고, 각 마일스톤의 검증 게이트를 통과한 뒤 다음 단계로 진행한다. 모든 완료 조건을 증거로 확인할 때까지 계속하되, 문서의 차단 조건에 해당하면 반복하지 말고 시도·증거·차단 원인·필요한 입력을 보고한다.

Codex는 구현 전에 이 문서 전체와 다음 파일을 반드시 읽는다.

- `README.md`
- `config.json`
- `src/shared/types.ts`
- `src/main/services/ProtoParserService.ts`
- `src/main/services/ExcelService.ts`
- `src/main/ipc/excel.ipc.ts`
- `src/main/services/CodeGeneratorService.ts`
- `src/main/services/UnrealCodeGeneratorService.ts`
- `src/renderer/src/components/`
- `examples/PROTO/`, `examples/EXCEL/`, `examples/JSON/`, `examples/CODE/`

## 1. Goal 계약

### Outcome

기존 Electron 앱을 Tauri 2 + TypeScript 기반의 새 데스크톱 앱으로 교체한다. UI 구조와 구현 방식은 자유롭게 재설계하되, 현재 사용자가 수행할 수 있는 스키마 편집, 관계 확인, Excel 생성, JSON 내보내기, 코드 생성, 설정 작업은 계속 사용할 수 있어야 한다.

### Verification surface

완료 여부는 설명이 아니라 다음 증거로 판단한다.

1. 기준 기능을 고정한 characterization/golden test
2. TypeScript 및 Rust 자동 테스트
3. Proto, XLSX, JSON, protoc, Unreal 생성물의 계약 테스트
4. Windows Tauri 패키지 빌드와 설치 후 실행 smoke test
5. 기존 `config.json`과 예제 작업공간을 이용한 마이그레이션 smoke test
6. 최종 기능 동등성 표에서 모든 필수 항목이 통과 상태임을 보여 주는 보고서

### Constraints

- 데스크톱 런타임은 Electron이 아니라 Tauri 2를 사용한다.
- 프런트엔드 및 도메인 로직의 주 언어는 TypeScript다.
- Tauri에 필요한 최소 Rust 코드는 네이티브 파일 I/O, 경로 검증, 원자적 쓰기, 외부 프로세스 실행 등 OS 경계에 한정한다.
- 기존 프런트 구조, IPC 구조, 컴포넌트 구조, 스타일은 보존할 필요가 없다.
- 기존 Proto, Excel, JSON, 설정 파일을 사용자 동의 없이 파괴적으로 변환하지 않는다.
- 기준 앱의 의도된 사용자 기능은 보존하되, 데이터 손상·보안·명백한 정확성 버그는 characterization test와 변경 기록을 남긴 뒤 수정할 수 있다.
- 기존 앱은 새 앱이 모든 parity gate를 통과하기 전까지 삭제하지 않는다.

### Boundaries

- 이 저장소 안의 코드, 문서, 테스트, 예제만 변경한다.
- 원격 push, PR 생성, 릴리스 업로드, 코드 서명, 외부 서비스 변경은 별도 요청 없이는 수행하지 않는다.
- VCS 연동, 클라우드 동기화, 협업 서버, 데이터베이스, 모바일 앱은 범위 밖이다.
- macOS/Linux 정식 지원은 Windows parity 완료 뒤 별도 목표로 다룬다.

### Iteration policy

각 마일스톤에서 다음 루프를 사용한다.

1. 기준 코드와 fixture에서 해당 동작을 확인한다.
2. 가장 작은 수직 기능 단위로 구현한다.
3. 단위 테스트와 계약 테스트를 추가한다.
4. 해당 마일스톤의 검증 명령을 실행한다.
5. 실패하면 원인을 좁혀 수정하고 같은 검증을 다시 실행한다.
6. 통과 증거와 남은 차이를 `docs/rewrite-progress.md`에 짧게 기록한다.
7. 게이트가 통과하기 전에는 다음 마일스톤으로 넘어가지 않는다.

동일한 차단 원인에 대해 근거 없는 변형을 반복하지 않는다. 서로 다른 합리적 해결 경로를 최대 3개까지 시도한 뒤에도 진행할 수 없으면 차단 상태로 종료한다.

### Blocked stop condition

다음 중 하나이면 Goal을 완료로 표시하지 말고 멈춘다.

- Windows 패키지 빌드/실행에 필요한 환경을 확보할 수 없음
- 기존 데이터 의미를 코드, 예제, 테스트로 결정할 수 없고 임의 선택이 JSON 또는 Proto 호환성을 깨뜨림
- 필수 외부 도구인 protoc 또는 언어 플러그인을 검증할 방법이 없음
- 필요한 파일 또는 권한이 저장소 범위를 벗어남
- 세 가지 합리적 접근이 모두 같은 근본 원인으로 실패함

차단 보고에는 현재 마일스톤, 시도한 경로, 명령과 결과, 보존된 작업, 정확히 필요한 추가 입력을 포함한다.

## 2. 요구사항 우선순위

충돌 시 다음 순서로 판단한다.

1. 이 문서에 적힌 사용자 요구사항
2. 데이터 손실 방지와 기존 파일 읽기 호환성
3. characterization/golden test로 고정한 사용자 관찰 가능 동작
4. 목표 아키텍처와 품질 기준
5. 기존 내부 구현 방식

## 3. 키 용어 및 호환성 계약

이 항목은 구현자가 자의적으로 재해석하지 않는다.

### 확정 명칭

- 기존 UI의 `PK` 표시명은 **기본키**로 변경한다.
- 기존 UI의 `Key` 표시명은 **합성키**로 변경한다.
- 버튼, 배지, 도움말, 오류 문구, 관계도, 테스트 설명에서 새 한글 명칭을 사용한다.

### 동작 보존

요구사항 4는 **사용자-facing 명칭 변경**으로 취급한다. 기능 동등성 요구와 충돌하므로 키 의미를 관계형 데이터베이스식으로 몰래 재정의하지 않는다.

- **기본키**는 기존 `@PK` 동작을 보존한다.
  - 한 개 이상의 필드를 지정할 수 있다.
  - 모든 값은 비어 있을 수 없다.
  - 여러 필드이면 전체 tuple의 중복을 금지한다.
  - 단일 필드 참조는 대상 한 행을 객체로 인라인화한다.
- **합성키**는 기존 `@Key`의 그룹 동작을 보존한다.
  - 같은 첫 번째 Key 값을 가진 여러 행을 참조 시 배열로 인라인화한다.
  - 기존 `RewardItemGroup.GroupId` 예제가 대표 회귀 계약이다.
- 한 테이블에서 기본키 모드와 합성키 모드를 동시에 만들 수 없다.
- Proto의 저장 annotation은 호환성을 위해 `// @PK`, `// @Key`를 계속 읽고 쓴다.
- 내부 모델에서는 오해를 줄이기 위해 `primaryKeyFields`와 `groupKeyFields` 같은 명확한 이름을 사용해도 되지만 UI 매핑은 위 명칭을 따른다.

이 문서에서 말하는 **합성키**는 기존 앱의 그룹 Key에 대한 새 표시명이다. 이를 “두 개 이상 필드로 이루어진 고유키”로 바꾸려면 JSON 배열 shape와 Excel 참조 규약이 달라지므로 별도 요구사항과 데이터 마이그레이션 계획 없이는 수행하지 않는다.

### 레거시 회귀 fixture

최소한 다음 사례를 독립 fixture로 만든다.

- 단일 `@PK`: 한 행 객체 참조
- 복수 `@PK`: tuple 빈 값/중복 검증과 현재 참조 shape
- `@Key`: 같은 값의 여러 행을 배열로 참조
- 키 없음: 원시 참조 값 유지 또는 명시적 진단
- 다단계 참조
- 누락 참조와 순환 참조

## 4. 현재 기능 동등성 표

| 영역 | 현재 사용자 기능 | 새 앱의 필수 수용 조건 |
|---|---|---|
| 앱 화면 | 관계도, 테이블, Enum, Excel, 코드 생성, 설정의 6개 작업 영역 | 동일 작업을 모두 수행할 수 있다. 화면 배치와 디자인은 달라도 된다. |
| 시작 | 저장된 설정을 읽고 Proto 자동 로드 | 재실행 후 설정을 복원하고 유효한 Proto 경로이면 자동 로드한다. |
| Proto 탐색 | 현재 디렉터리의 `*Table.proto`, `*EnumType.proto` 파싱 | 기준 fixture의 Message, Enum, 필드, 번호, 타입, import, annotation을 정확히 읽는다. |
| 테이블 CRUD | 파일/테이블 검색, 파일별 목록, 필드 펼치기, 추가·수정·삭제, 새 파일 또는 기존 파일 저장 | CRUD 후 재파싱이 성공하고 무관한 선언·주석·import를 손상하지 않는다. |
| 필드 편집 | 필드 추가·삭제·순서 변경, primitive/Message/Enum 타입 선택 | 기존 필드 번호는 순서 변경으로 바뀌지 않고 새 필드는 안전한 새 번호를 사용한다. |
| 키 | PK/Key 선택과 상호 배타, PK 빈 값·tuple 중복 검사, Key 배열 그룹 | 3장의 새 명칭과 레거시 동작을 모두 만족한다. |
| Enum CRUD | 파일 선택/생성, Enum과 값 추가·수정·삭제, 이름/번호 중복 검사 | `{Enum}_NONE = 0`, `{Enum}_MAX` 자동 규칙과 재파싱이 동작한다. |
| 관계도 | 참조 edge, 자동 배치, 노드 이동, pan/zoom, MiniMap, 검색 흐림, hover 강조, Enum 상세 | fixture의 node/edge 집합이 일치하며 검색·강조·색상·Enum 상세가 동작한다. |
| 관계도 설정 | Proto 파일별 색상, 열당 최대 테이블 수 | 저장 후 재실행해도 유지되고 레이아웃에 반영된다. |
| Excel 생성 | Proto 파일 선택, 파일당 workbook, Message당 sheet, 헤더/스타일, Enum/Message dropdown | Excel에서 정상적으로 열리고 시트·헤더·스타일·검증 규칙이 구조 테스트를 통과한다. |
| 덮어쓰기 보호 | 취소, 백업 없는 덮어쓰기, 시각 포함 백업 후 생성 | 세 경로를 모두 제공하며 백업은 `backup/{Name}_YYYYMMDDHHmmss.xlsx` 형식을 유지한다. |
| JSON 내보내기 | 존재 workbook의 시트 선택, 참조 의존성 자동 포함, 다단계 인라인화 | 선택과 의존성 closure가 결정적이며 기준 JSON shape와 일치한다. |
| JSON 파일 | Message별 배열 root, 2칸 들여쓰기, 마지막 개행, Enum 이름 문자열 | 구조와 포맷 계약을 유지하고 원자적으로 저장한다. |
| protoc | C++, C#, Java, Python, Go, Rust, Ruby, PHP 개별/전체 생성 | 설정된 언어만 생성하고 실행 인자·오류·산출물을 테스트한다. |
| Unreal | Enum header, `DataTables.h`, `DataTableLoader.h/.cpp` 생성 | 정규화 snapshot과 타입별 생성 계약을 통과한다. 알려진 기존 generator 버그는 복제하지 않는다. |
| 설정 | Proto/Excel/JSON/protoc/언어별 출력 경로, 파일 색상, 관계도 열 수 | 버전이 있는 설정으로 저장하며 기존 `config.json`을 안전하게 가져온다. |
| 경로 | 절대경로와 실행 위치 기준 상대경로 | 레거시 상대경로가 가리키던 실제 위치를 migration 후에도 가리킨다. |
| 탐색기 연동 | 폴더/파일 선택, 경로 열기, Excel 외부 앱 열기 | Tauri 공식 dialog/opener 또는 제한된 native command로 동작한다. |
| 배포 | Windows 중심 패키지 | Windows x64 설치 파일을 만들고 깨끗한 환경에서 설치·실행할 수 있다. |

수동으로 edge를 추가하는 현재 관계도 동작은 저장되지 않으므로 데이터 기능으로 간주하지 않는다. 새 앱에서 제공해도 영속 기능처럼 오해시키지 않는다.

## 5. 기존 산출물의 주의점

`examples/` 전체를 곧바로 정답 golden으로 사용하지 않는다. 현재 서로 다른 시점의 파일이 섞여 있다.

- `StringTable.proto`와 `StringTable.xlsx`/`StringData.json`의 필드명·타입이 다르다.
- `GameItemTypeTable.json`, `MonsterTable.json` 등 현재 Message와 맞지 않는 잔존 파일이 있다.
- 생성 코드에는 사용한 protoc/plugin 버전에 따른 차이가 포함될 수 있다.
- Unreal 예제에는 Enum 접두사 중복, 선언 순서 문제 등 기존 generator 버그가 있을 수 있다.

M0에서 작은 정합 fixture를 새로 만들고, 기존 앱 코드로 재현 가능한 동작과 오래된 잔존 산출물을 분리한다. ZIP 컨테이너인 XLSX는 바이트 동일성이 아니라 workbook 구조와 동작을 비교한다.

## 6. 목표 기술 스택

의존성은 구현 시작 시점의 안정 버전을 선택하고 lockfile에 고정한다. “latest” 범위를 package manifest에 남기지 않는다.

| 계층 | 선택 | 이유 |
|---|---|---|
| Desktop | Tauri 2 | 필수 조건, 작은 배포물, capability 기반 권한 |
| Frontend | React + TypeScript + Vite | 복잡한 편집 UI와 React Flow 재사용에 적합 |
| Package manager | pnpm workspace | 새 앱과 순수 domain package를 분리하고 재현 가능한 설치 |
| Domain state | Zustand | 작은 로컬 앱 상태를 명시적으로 관리 |
| Form/validation | React Hook Form + Zod | 폼 상태와 native boundary runtime 검증 |
| Diagram | `@xyflow/react` | 현재 관계 편집/시각화 기능을 안정적으로 구현 |
| Notifications | Sonner 또는 동급 경량 toast | 기존 성공/오류 피드백 유지 |
| Proto | TypeScript source-preserving parser/patcher | annotation과 무관한 주석·import·선언 보존 |
| Excel | ExcelJS를 adapter 뒤에서 사용하되 M1 spike로 WebView/worker 적합성 검증 | 현재 workbook 기능과 가장 가까운 경로 |
| Native boundary | 좁은 Tauri commands + 공식 dialog/opener/store plugin | 임의 shell/전체 파일시스템 권한 방지 |
| Tests | Vitest, React Testing Library, WebdriverIO + tauri-driver, Cargo test | 순수 로직, UI, 실제 데스크톱 경계를 계층별 검증 |
| Quality | ESLint, Prettier, rustfmt, Clippy | TS/Rust 일관성 및 CI gate |

SQLite, 서버, Electron 호환 layer, Node sidecar는 사용하지 않는다. 파일 디렉터리가 기존 제품의 source of truth이므로 DB를 추가하면 불필요한 동기화 문제가 생긴다.

참고할 공식 문서:

- Tauri 프로젝트 생성: https://v2.tauri.app/start/create-project/
- Vite 기반 프런트엔드: https://v2.tauri.app/start/frontend/
- Capability: https://v2.tauri.app/security/capabilities/
- File system plugin: https://v2.tauri.app/plugin/file-system/
- Dialog plugin: https://v2.tauri.app/plugin/dialog/
- Shell plugin 권한: https://v2.tauri.app/plugin/shell/
- Store plugin: https://v2.tauri.app/plugin/store/
- WebDriver CI: https://v2.tauri.app/develop/tests/webdriver/ci/

## 7. 목표 아키텍처

최종 구조의 기본안은 다음과 같다.

~~~text
/
├─ apps/
│  └─ desktop/
│     ├─ src/
│     │  ├─ app/
│     │  ├─ features/
│     │  │  ├─ schema/
│     │  │  ├─ diagram/
│     │  │  ├─ excel/
│     │  │  ├─ json-export/
│     │  │  ├─ codegen/
│     │  │  └─ settings/
│     │  ├─ adapters/
│     │  │  ├─ native/
│     │  │  └─ excel/
│     │  └─ workers/
│     └─ src-tauri/
│        ├─ capabilities/
│        └─ src/
│           ├─ commands/
│           ├─ paths/
│           └─ process/
├─ packages/
│  └─ core/
│     └─ src/
│        ├─ schema/
│        ├─ proto/
│        ├─ validation/
│        ├─ references/
│        ├─ json/
│        └─ generators/
├─ tests/
│  ├─ fixtures/
│  └─ e2e/
└─ docs/
   ├─ parity-matrix.md
   ├─ migration.md
   └─ rewrite-progress.md
~~~

### 계층 규칙

- `packages/core`는 DOM, Tauri, Node API를 import하지 않는 순수 TypeScript다.
- React 컴포넌트는 직접 파일을 읽거나 protoc를 실행하지 않는다.
- feature use case는 port interface만 사용한다.
- native adapter만 Tauri API를 호출한다.
- Rust command는 좁고 목적 중심으로 만든다. 예: 설정 읽기/쓰기, 허용 디렉터리 목록, 원자적 파일 저장, 백업, protoc 실행.
- 임의 문자열을 shell에 넘기지 않는다. protoc는 executable과 args 배열로 실행한다.
- 긴 Proto/Excel/JSON 작업은 progress/cancel을 지원하고 WebView를 막지 않도록 worker 또는 Rust task에서 처리한다.

### 파일 안전 규칙

- 모든 쓰기는 같은 디렉터리의 임시 파일에 먼저 쓴 뒤 flush/rename하는 원자적 교체를 사용한다.
- 기존 파일 덮어쓰기는 UI 확인과 선택적 백업 뒤에만 수행한다.
- 경로를 canonicalize하고 사용자가 설정하거나 dialog로 선택한 root 밖의 접근을 거부한다.
- capability에는 필요한 command와 경로 scope만 허용한다.
- 설정과 native 응답은 Zod로 다시 검증한다.
- 실패 시 부분 산출물과 임시 파일을 정리하고 원본을 보존한다.

## 8. 구현 마일스톤

### M0. 기준선과 계약 고정

작업:

- 기준 커밋과 현재 기능을 `docs/parity-matrix.md`에 기록한다.
- 기준 앱의 6개 사용자 흐름을 가능한 Windows 환경에서 실행해 결과를 기록한다.
- 정합한 소형 fixture를 만든다.
- fixture에는 단일 기본키, 복수 기본키, 레거시 합성키 그룹, Enum, 같은/다른 Proto 파일 참조, 다단계 참조, 누락·순환 참조를 포함한다.
- 기존 parser, Excel, JSON, protoc, Unreal 동작을 characterization test 또는 실행 가능한 harness로 고정한다.
- 버그와 호환 동작을 구분한 ADR을 작성한다.

Gate:

- 기존 테스트가 없다는 사실을 문서화했다.
- fixture의 Proto/Excel/JSON 세트가 서로 정합하다.
- 4장의 모든 기능에 자동 또는 명시적 수동 검증 방법이 있다.
- 기존 `@Key` 배열 JSON shape가 golden test로 고정됐다.

### M1. 기술 spike와 Tauri 골격

작업:

- pnpm workspace와 Tauri 2 + React + TypeScript + Vite 앱을 별도 경로에 생성한다.
- root에서 품질 명령을 실행할 수 있도록 pnpm workspace와 Cargo workspace 또는 동등한 root script를 구성한다.
- strict TypeScript, lint, format, Vitest, Cargo fmt/clippy/test 스크립트를 구성한다.
- native bridge interface와 mock adapter를 만든다.
- native 오류는 문자열 하나가 아니라 `{ code, message, context }` 형태의 구조화된 DTO로 통일한다.
- Tauri dialog로 디렉터리를 선택하고 설정을 저장/다시 읽는 최소 수직 기능을 구현한다.
- capability를 최소 권한으로 시작한다.
- Excel 기술 spike로 다음을 검증한다.
  - 기존 XLSX 읽기
  - Message별 sheet
  - header style
  - Enum dropdown
  - 동적 Message reference dropdown
  - 10,000행 검증 범위
  - binary read/write
  - 작업 중 UI 비차단

ExcelJS가 핵심 요구를 충족하지 못하면 adapter interface는 유지하고 Rust의 검증된 XLSX 라이브러리 조합으로 교체한다. spike 결론과 근거를 ADR로 남긴다.

Gate:

- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `cargo test`가 통과한다.
- Tauri dev 앱에서 설정 저장과 디렉터리 선택이 실제 동작한다.
- Excel 기술 선택이 fixture 기반 증거로 확정됐다.

### M2. 설정, 경로, 파일 경계

작업:

- version 필드가 있는 새 settings schema를 만든다.
- 레거시 `config.json`을 찾고 dry-run 결과를 보여 준 뒤 일회성 import한다.
- 레거시 상대경로를 원래 기준점에 대해 절대경로로 해석해 동일 실제 파일을 가리키게 한다.
- Proto, Excel, JSON, protoc, 언어별 출력, 파일 색상, 관계도 열 수를 모두 마이그레이션한다.
- 한글, 공백, 긴 Windows 경로, 없는 경로, 읽기 전용 경로를 테스트한다.
- 파일 읽기/쓰기/백업/열기 command와 오류 모델을 구현한다.

Gate:

- 현재 `config.json` fixture의 모든 설정이 손실 없이 import된다.
- 재실행 후 설정이 유지된다.
- 허용 root 밖 접근과 path traversal이 거부된다.
- 실패하는 쓰기가 원본 파일을 바꾸지 않는다.

### M3. Proto domain과 테이블/Enum CRUD

작업:

- source span을 보존하는 Proto lexer/parser/patcher를 구현하거나 검증된 library를 adapter로 감싼다.
- 현재 파일명 규칙, proto3 header, package, go_package, import 자동 추가를 지원한다.
- 지원하지 않는 Proto 문법을 조용히 손상시키지 말고 읽기 전용 또는 구체적 오류로 처리한다.
- 테이블/필드/Enum CRUD와 이름·번호·타입 검증을 구현한다.
- 기존 필드 번호를 보존하고 새 번호는 기존 최대값 이후로 배정한다.
- 일반 주석, import, 다른 선언, 줄바꿈 스타일을 보존한다.
- 3장의 기본키/합성키 표시와 annotation 호환을 구현한다.
- 삭제/이름 변경 전 참조 영향을 보여 준다.

Gate:

- 기준 fixture parse snapshot이 일치한다.
- parse → 수정 → 재파싱 테스트가 통과한다.
- 대상 블록 외의 파일 내용이 byte-level로 보존된다.
- 순서 변경으로 기존 field number가 변하지 않는다.
- Enum 자동 NONE/MAX와 중복 오류 테스트가 통과한다.
- legacy `@PK`, `@Key` round-trip이 유지된다.

### M4. 스키마 UI와 관계도

작업:

- 테이블/Enum 목록, 검색, 펼치기, 추가·수정·삭제 폼을 새 구조로 구현한다.
- 명칭은 기본키/합성키로 통일하고 정확한 동작 도움말을 제공한다.
- 파일별 색상과 관계도 열당 노드 수를 편집한다.
- Message reference edge, 자동 배치, drag, pan/zoom, MiniMap, 검색 흐림, hover label, Enum 상세를 구현한다.
- 파싱 오류, 참조 영향, 저장 성공/실패를 사용자가 이해할 수 있게 표시한다.

Gate:

- UI component test와 keyboard navigation test가 통과한다.
- fixture의 node/edge 집합이 예상과 일치한다.
- 6개 핵심 화면으로 이동할 수 있다.
- 기본키/합성키를 동시에 선택할 수 없다.
- 앱 재실행 뒤 색상과 레이아웃 설정이 유지된다.

### M5. Excel 생성과 읽기

작업:

- 선택한 Proto 파일마다 같은 이름의 workbook을 생성한다.
- Message마다 sheet와 필드 header를 만든다.
- 기본키 header 강조, 일반 header 스타일, 열 너비를 적용한다.
- Enum dropdown에서 MAX를 제외하고 데이터 검증을 적용한다.
- Message reference dropdown을 지원한다.
- 현재 20행 후보 제한은 버그로 복제하지 않고 실제 사용 범위를 처리한다.
- 기존 파일 충돌 시 취소, 즉시 덮어쓰기, 시각 백업 후 생성 흐름을 제공한다.
- workbook을 읽어 header와 셀 값을 TypeScript domain row로 변환한다.
- schema에 없는 header, 타입 불일치, 빈 필수 키를 진단한다.

Gate:

- workbook 구조 테스트에서 파일명, sheet, header, style, validation이 일치한다.
- 생성한 XLSX를 Excel 또는 호환 앱에서 열 수 있다.
- backup/overwrite/cancel의 세 경로가 모두 테스트된다.
- 10,000행 fixture 처리 중 UI가 멈추지 않고 취소 또는 progress가 동작한다.
- 입력 오류가 있으면 JSON 쓰기 전에 중단하고 원본 XLSX는 보존한다.

### M6. JSON 내보내기와 참조 해석

작업:

- 선택 sheet의 참조 의존성을 재귀적으로 수집한다.
- dependency graph의 처리 순서를 결정적으로 만든다.
- 기본키 빈 값과 단일/tuple 중복을 검증한다.
- 단일 기본키는 한 행 객체, 레거시 합성키 그룹은 행 배열로 인라인화한다.
- 기준 앱의 복수 `@PK` 참조 shape는 golden 결과를 따른다.
- 다단계 참조를 이미 해석된 행으로 인라인화한다.
- 누락, 중복 대상, 순환 참조는 조용히 순서 의존 결과를 만들지 말고 위치와 원인을 포함한 진단을 반환한다.
- Message별 JSON 배열, 2칸 들여쓰기, 마지막 개행으로 원자적 저장한다.

Gate:

- 단일 기본키, 복수 기본키, 합성키 그룹, 다단계, 누락, 순환 fixture가 모두 계약 테스트를 통과한다.
- 같은 입력의 반복 실행은 byte-identical JSON을 만든다.
- 일부 파일 저장 실패 시 성공한 것처럼 보고하지 않고 원본/기존 출력 정책을 일관되게 적용한다.
- 기존 `RewardItemGroup` 배열 임베드 shape가 유지된다.

### M7. protoc 및 Unreal 코드 생성

작업:

- protoc executable, Proto root, 언어별 output directory를 검증한다.
- C++, C#, Java, Python, Go, Rust, Ruby, PHP를 개별 및 전체 생성한다.
- shell 문자열이 아니라 executable + args 배열로 실행한다.
- stdout, stderr, exit code를 구조화해 사용자에게 보여 준다.
- Go/Rust plugin 누락과 잘못된 protoc 버전을 구체적으로 진단한다.
- 임시 output에 먼저 생성하고 성공 시 target으로 교체하는 정책을 사용한다.
- Unreal Enum, DataTables, JSON loader generator를 순수 TypeScript로 구현하고 snapshot test한다.
- Enum 접두사 중복과 타입 선언 순서 등 기존의 명백한 generator 버그를 수정한다.

Gate:

- fake protoc 테스트가 executable/args/cwd/error 전달을 검증한다.
- 사용 가능한 실제 protoc로 최소 smoke test를 통과한다.
- 모든 언어의 output path 선택과 일괄 생성 흐름이 동작한다.
- Unreal fixture snapshot과 최소 구문 검증이 통과한다.
- 실패한 생성이 기존 정상 산출물을 부분적으로 덮어쓰지 않는다.

### M8. 통합, 배포, cutover

작업:

- 핵심 흐름 E2E를 작성한다: 설정 → Proto 로드 → schema 편집 → 관계도 → Excel → JSON → 코드 생성.
- Windows CI에서 lint, typecheck, TS/Rust test, Tauri build, WebDriver smoke를 실행한다.
- NSIS 또는 검증된 Windows installer target을 구성한다.
- 깨끗한 Windows 환경에서 설치, 실행, 제거를 확인한다.
- 기존 `config.json`과 사용자 데이터 복사본으로 migration smoke를 수행한다.
- README, 설정 가이드, migration/rollback 문서를 갱신한다.
- parity matrix의 모든 필수 행이 통과한 뒤에만 Electron 코드와 의존성을 active branch에서 제거한다.
- 예제와 기준 fixture를 새 앱에서 재생성하고 구분해 보관한다.

Gate:

- Windows installer가 생성되고 설치 후 앱이 실행된다.
- E2E 핵심 흐름이 통과한다.
- Electron package, main/preload IPC, electron-builder가 최종 active build에 남아 있지 않다.
- Tauri capability audit에서 불필요한 broad file/shell 권한이 없다.
- 문서화된 rollback 방법으로 이전 release/branch로 돌아갈 수 있다.

## 9. 공통 품질 게이트

실제 script 이름은 M1에서 확정하되 다음 의미의 명령을 root에서 한 번에 실행할 수 있어야 한다.

~~~bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm tauri:build
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test
~~~

모든 마일스톤에서 관련 명령을 통과시키고, M8에서는 전체 명령을 깨끗한 checkout에서 실행한다.

추가 품질 조건:

- TypeScript `strict`를 끄지 않는다.
- native 응답을 type assertion만으로 신뢰하지 않는다.
- 사용자 데이터 오류와 프로그램 오류를 구분한다.
- 오류에는 파일, Message/sheet, field/row 등 가능한 위치 정보를 포함한다.
- 무한 재귀, 순환 참조, 무한 retry가 없다.
- 긴 작업은 progress와 cancel 또는 안전한 중단 정책을 가진다.
- 테스트를 통과시키기 위해 실제 기능을 skip하거나 fixture를 임의로 약화하지 않는다.

## 10. 비목표

다음은 이 Goal에 포함하지 않는다.

- 기존 Electron/React 컴포넌트 구조의 유지
- 기존 UI의 픽셀 단위 복제
- 기존 정규식 parser의 버그 복제
- 기존 field reorder의 번호 재할당 버그 복제
- VCS 연동
- 기존 XLSX를 재생성하지 않고 Enum dropdown만 갱신하는 README TODO
- 클라우드 저장, 팀 협업, 로그인, 서버, 데이터베이스
- 완전한 범용 Proto3 IDE
- 자동 업데이트와 코드 서명
- macOS/Linux 정식 배포
- 숨겨진 repeated 체크박스를 새 제품 기능으로 확장하는 일
- 기존 stale example을 검증 없이 정답으로 취급하는 일

단, 기존 파일에 이미 존재하는 `repeated` 필드는 읽기, 표시, round-trip, 코드 생성에서 손실하지 않는다.

## 11. 최종 완료 조건

다음을 모두 만족해야 Goal을 완료로 표시한다.

- [ ] Tauri 2 + TypeScript 새 앱이 6개 기존 작업 영역을 제공한다.
- [ ] 기준 fixture의 Proto/Enum CRUD와 source-preserving round-trip이 통과한다.
- [ ] UI 전체에서 PK는 기본키, Key는 합성키로 표시된다.
- [ ] 기존 `@PK`, `@Key` annotation을 읽고 다시 저장할 수 있다.
- [ ] 기존 Key 그룹의 배열 JSON shape가 보존된다.
- [ ] Excel 생성, 백업/덮어쓰기, 읽기가 계약 테스트를 통과한다.
- [ ] JSON dependency와 인라인 참조 테스트가 모두 통과한다.
- [ ] 8개 protoc 언어와 Unreal 생성 흐름이 검증된다.
- [ ] 기존 `config.json`이 실제 동일 경로를 가리키도록 import된다.
- [ ] TS/Rust 전체 품질 게이트가 깨끗한 checkout에서 통과한다.
- [ ] Windows installer 빌드, 설치, 실행 smoke가 통과한다.
- [ ] active build에서 Electron과 broad shell/file 권한이 제거됐다.
- [ ] `docs/parity-matrix.md`, `docs/migration.md`, `docs/rewrite-progress.md`, README가 최종 상태와 일치한다.
- [ ] 남은 차이, 수정한 기존 버그, 검증 명령과 결과를 최종 보고서에 기록했다.

## 12. 최종 보고 형식

완료 또는 차단 시 다음 순서로 보고한다.

1. Outcome: 달성/차단
2. 기준 커밋과 최종 커밋
3. 마일스톤별 완료 상태
4. parity matrix 요약
5. 실행한 검증 명령과 결과
6. 생성한 Windows artifact
7. 마이그레이션 결과
8. 의도적으로 수정한 기존 버그
9. 남은 제한 또는 차단 원인
10. rollback 방법
