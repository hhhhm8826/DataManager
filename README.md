<div align="center">

# 📊 Data Manager

**Legacy Electron application with an in-progress Tauri 2 rewrite**

![Electron](https://img.shields.io/badge/Electron-2B2E3A?style=for-the-badge&logo=electron&logoColor=white) ![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB) ![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white) ![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)

</div>

---

## ✨ 주요 기능

![diagram](./resources/diagram.png)

| 기능                             | 설명                                               |
| -------------------------------- | -------------------------------------------------- |
| 🗂️ **테이블 다이어그램**         | 테이블 간 참조 관계를 시각적으로 확인              |
| 📝 **테이블 · Enum 스키마 설정** | Proto 기반으로 스키마를 정의                       |
| 📊 **Excel 파일 생성**           | 스키마를 기반으로 드롭다운이 포함된 엑셀 파일 생성 |
| ⚙️ **코드 생성**                 | Protobuf, Unreal 데이터 컨테이너 자동 생성         |
| 🔄 **JSON 변환**                 | 엑셀 데이터를 JSON으로 변환                        |

### ✨ TODO

- 새로운 엑셀 파일을 생성 하지않고 Enum 수정을 DropDown에 반영할 수 있는 기능
- VCS 관련

---

## Tauri Rewrite (M8 integration in progress)

The new desktop application lives in `apps/desktop`, with pure domain contracts
in `packages/core`. It now includes versioned settings, a canonical native file
boundary, source-preserving Proto table/Enum CRUD, an interactive schema
relationship graph, worker-backed Excel generation/validation, and deterministic
JSON dependency/reference export. It also provides transactional protoc output
for eight languages and a pure TypeScript Unreal generator with per-language
and all-configured execution UI. The Electron application remains available
under `legacy:*` scripts until M8 completes the migration.

The Windows x64 NSIS build is emitted at
`target/release/bundle/nsis/DataManager_0.1.0_x64-setup.exe`. The installer is
currently unsigned by design; signing and release upload are outside this goal.

The Tauri workspace requires pnpm 11.10.0 and Rust stable 1.97.0 or newer.
Once those tools are available, use the root commands below:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm tauri:dev
pnpm tauri:build
```

The native E2E command builds a release binary with the test-only `e2e` Cargo
feature, Rust/frontend WDIO plugins, and Tauri capability, then uses the
embedded WebDriver provider. Windows E2E applies a test-process-only WebView2
sandbox override; none of those test surfaces are present in the normal binary.
It does not require `tauri-driver` or a globally installed MSEdgeDriver; the
setup downloads the matching driver to `.e2e-runtime`. See
`docs/rewrite-progress.md` for current gate evidence.

Configuration and final desktop verification are documented in
`docs/settings.md` and `docs/interactive-smoke.md`.

Rewrite-generated examples are kept under `examples/TAURI_REWRITE`, separate
from stale legacy example outputs. Recreate and verify them with:

```bash
pnpm fixtures:rewrite
pnpm fixtures:rewrite:check
```

All eight protoc outputs use the committed `libprotoc 34.1`. Go additionally
uses the committed `protoc-gen-go`; Rust uses protoc's bundled experimental upb
generator and does not require an external plugin.

## Legacy Electron Setup

### Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run legacy:dev
```

### Build

```bash
# For windows
$ npm run legacy:build:win

# For macOS (Currently not supported)
$ npm run legacy:build:mac
```

### Start

```bash
$ .\dist\win-unpacked\data-manager.exe
```

---

## ❓ FAQ

**Q. 무슨 목적으로 만들어졌나요?**  
A. AI를 활용해 단기간에 기획자 분들이 사용할 수 있는 데이터 툴을 제공하기 위해 개발된 프로토 타입입니다.  
이 프로젝트는 대부분의 작업이 Github Copilot으로 이뤄졌습니다.

**Q. 왜 Proto 파일을 기반으로 엑셀 테이블을 만들었나요?**  
A. 엑셀과 Json에 사용할 스키마를 명세할 수 있고 동시에 클라이언트/서버가 함께 사용할 수 있는 코드 생성이 가능하기 때문입니다.
