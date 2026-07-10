<div align="center">
  <img src="./build/icon.png" width="112" alt="DataManager 아이콘" />
  <h1>DataManager</h1>
  <p><strong>Proto 스키마부터 Excel, JSON, 코드 생성까지 하나의 흐름으로 관리하는 Windows 데스크톱 도구</strong></p>
  <p>
    <img src="https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white" alt="Tauri 2" />
    <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=20232A" alt="React 19" />
    <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript 5" />
    <img src="https://img.shields.io/badge/Rust-stable-000000?logo=rust&logoColor=white" alt="Rust stable" />
    <img src="https://img.shields.io/badge/Windows-x64-0078D4?logo=windows&logoColor=white" alt="Windows x64" />
  </p>
</div>

---

## DataManager 소개

DataManager는 Proto 파일을 중심으로 데이터 스키마를 편집하고, 관계를
확인하며, Excel 입력 양식과 JSON 및 애플리케이션 코드를 생성하는 Windows
x64 데스크톱 애플리케이션입니다.

Tauri 2 기반의 네이티브 경계와 React·TypeScript 기반 UI를 사용합니다. 파일
접근과 외부 프로세스 실행은 Rust 명령으로 제한하고, 스키마 해석과 생성
규칙은 테스트 가능한 순수 TypeScript 도메인에 분리했습니다.

## 주요 기능

| 영역             | 제공 기능                                                       |
| ---------------- | --------------------------------------------------------------- |
| **Proto 스키마** | 원본 주석과 선언을 보존하는 Table·Enum 생성, 수정, 삭제         |
| **관계도**       | Message·Enum 관계 탐색, 검색, 강조, 확대·축소, 파일별 색상      |
| **Excel**        | Message별 시트, 스타일, 참조 dropdown, 백업·덮어쓰기, 진행 상태 |
| **JSON**         | 의존성 자동 탐색, 참조 인라인화, 결정적인 파일 구조와 포맷      |
| **코드 생성**    | C++, C#, Java, Python, Go, Rust, Ruby, PHP용 protoc 실행        |
| **Unreal**       | `DataTables.h`와 `DataTableLoader.h/.cpp` 생성                  |
| **설정 이전**    | 기존 `config.json`을 검토 후 한 번만 안전하게 가져오기          |

기존 `// @PK`와 `// @Key` 의미를 각각 **기본키**와 **합성키**로 유지합니다.
활성 브랜치에는 Electron 런타임이나 빌드 경로가 없습니다.

## 빠른 시작

### 준비 사항

- Windows x64 및 Microsoft Edge WebView2
- Node.js 24 이상
- pnpm 11.10.0
- Rust stable 1.97.0 이상, `rustfmt`, `clippy`

Tauri CLI, EdgeDriver, Electron은 전역으로 설치할 필요가 없습니다. 프로젝트에
필요한 도구와 의존성은 저장소의 manifest와 lockfile로 관리합니다.

### 개발 모드 실행

```powershell
pnpm install --frozen-lockfile
pnpm tauri:dev
```

## 프로젝트 구조

```text
DataManager/
├─ apps/desktop/       # React UI, Tauri 어댑터, Rust 네이티브 명령
├─ packages/core/      # Proto, Excel, JSON, 관계도, 생성 도메인
├─ tests/              # 계약 테스트, fixture, 네이티브 E2E
├─ examples/           # 재현 가능한 생성 결과
├─ scripts/            # Windows smoke 및 fixture 자동화
└─ docs/               # 설정, 이전, 검증 및 호환성 문서
```

## 품질 검증

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm rust:test
pnpm rust:clippy
pnpm test:e2e
```

`pnpm test:e2e`는 테스트 전용 Tauri 바이너리를 만든 뒤 실제 WebView에서 핵심
작업 흐름과 AppData 재시작 복원을 검증합니다. 테스트용 WDIO 권한과 WebView2
인자는 일반 배포 바이너리에 포함되지 않습니다.

## Windows 설치 파일

```powershell
pnpm tauri:build
```

빌드가 완료되면 서명되지 않은 NSIS 설치 파일이 다음 경로에 생성됩니다.

```text
target/release/bundle/nsis/DataManager_0.1.0_x64-setup.exe
```

설치·실행·제거 smoke는 다음 명령으로 확인할 수 있습니다.

```powershell
./scripts/windows-installer-smoke.ps1 `
  -InstallerPath ./target/release/bundle/nsis/DataManager_0.1.0_x64-setup.exe
```

## Fixture 재생성

Tauri 구현의 재현 가능한 예제는 `examples/TAURI_REWRITE`에 있습니다.

```powershell
pnpm fixtures:rewrite
pnpm fixtures:rewrite:check
```

레거시 동작 기준은 `tests/fixtures/m0-legacy`에 변경 불가능한 golden으로
보존합니다.

## 문서

- [D1000–D1012 개선 Goal](DATAMANAGER_D1000_D1012_GOAL.md)
- [설정 가이드](docs/settings.md)
- [마이그레이션과 롤백](docs/migration.md)
- [기능 동등성 및 검증 근거](docs/parity-matrix.md)
- [Tauri 전환 완료 기록](docs/rewrite-progress.md)
- [Windows 상호작용 smoke](docs/interactive-smoke.md)

## 레거시 버전 롤백

Tauri 이전 Electron 구현은 기준 커밋
`3a4ba6ec652d750d88c88dcc9af8ada13b6eb169`에 보존되어 있습니다. 현재 작업
공간과 사용자 데이터를 건드리지 않도록 별도 worktree에서 실행합니다.

```powershell
git worktree add ..\DataManager-electron 3a4ba6ec652d750d88c88dcc9af8ada13b6eb169
Set-Location ..\DataManager-electron
npm ci
npm run build:win
```

Tauri 가져오기 기능은 기존 `config.json`, Proto, Excel, JSON, 생성 코드를
수정하지 않습니다.

## 라이선스

이 프로젝트는 [Apache License 2.0](LICENSE)에 따라 배포됩니다.
