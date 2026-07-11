<div align="center">
  <img src="./build/icon.png" width="112" alt="DataManager 아이콘" />
  <h1>DataManager</h1>
  <p><strong>게임과 서비스의 기획 데이터를 Excel에서 관리하고 JSON과 코드로 안전하게 연결하는 Windows 도구</strong></p>
  <p>테이블 설계, 관계 확인, Excel 양식 생성, 데이터 배포 준비를 하나의 작업 공간에서 처리합니다.</p>
  <p>
    <img src="https://img.shields.io/badge/Windows-x64-0078D4?logo=windows&logoColor=white" alt="Windows x64" />
    <img src="https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white" alt="Tauri 2" />
    <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=20232A" alt="React 19" />
    <img src="https://img.shields.io/badge/Rust-stable-000000?logo=rust&logoColor=white" alt="Rust stable" />
  </p>
</div>

---

## DataManager가 하는 일

DataManager는 **데이터의 구조**와 **실제 입력 데이터**를 분리해 관리합니다.
개발자는 Proto로 데이터 규칙을 정하고, 기획자는 그 규칙으로 만들어진 Excel
양식에 값을 입력합니다. 완성된 Excel은 검증을 거쳐 JSON과 각 언어의 코드로
생성됩니다.

```text
테이블·Enum 설계 → 관계도 확인 → Excel 양식 생성 → 기획 데이터 입력 → JSON·코드 생성
```

여러 도구를 오가며 파일명과 칼럼을 맞추는 대신, 하나의 스키마를 기준으로
전체 결과를 일관되게 유지하는 것이 목적입니다.

## 이런 용도에 적합합니다

| 사용자                     | DataManager에서 하는 작업                                        |
| -------------------------- | ---------------------------------------------------------------- |
| **기획자**                 | 생성된 Excel에 데이터를 입력하고 테이블 간 참조를 확인합니다.    |
| **콘텐츠 디자이너**        | 아이템, 몬스터, 보상, 문자열 같은 테이블 구조와 값을 관리합니다. |
| **클라이언트·서버 개발자** | Proto 스키마를 관리하고 JSON 또는 언어별 코드를 생성합니다.      |

## 주요 작업 화면

### 관계도

테이블이 어떤 테이블과 Enum을 참조하는지 한눈에 확인합니다. 참조가 집중되는
테이블은 설정한 기준에 따라 모달로 정리할 수 있으며, 참조 필드의 자료형
버튼을 눌러 내용을 확인할 수 있습니다. 검색, 자동 배치, 확대·축소와 배치
저장도 지원합니다.

### 테이블과 Enum

화면에서 칼럼 이름, 자료형, 기본키와 합성키를 편집합니다. Excel에만 필요한
메모 칼럼은 Message 안의 순서에 함께 배치되지만 JSON과 코드에는 포함되지
않습니다.

### Excel

하나의 Proto 파일에서 여러 Excel 시트 또는 파일을 만들 수 있습니다. 참조
관계는 드롭다운으로 제공되며, 기존 파일을 덮어쓸 때는 백업과 진행 상태를
확인할 수 있습니다. Excel 파일이 많아도 검색과 포함 테이블 목록으로 원하는
대상을 찾을 수 있습니다.

### JSON과 코드 생성

선택한 테이블에 필요한 의존 테이블을 함께 확인하고 JSON을 생성합니다.
동일한 Proto에서 C++, C#, Java, Python, Go, Rust, Ruby, PHP와 Unreal용 코드를
생성할 수 있습니다.

## 기획자가 알아두면 좋은 용어

| 화면 용어            | 의미                                                               |
| -------------------- | ------------------------------------------------------------------ |
| **Proto**            | 테이블 이름, 칼럼, 자료형과 관계를 정의하는 원본 설계 파일입니다.  |
| **Message / 테이블** | Excel 시트와 JSON 데이터의 기본 단위입니다.                        |
| **Enum**             | 아이템 등급처럼 선택 가능한 값을 미리 정한 목록입니다.             |
| **기본키(PK)**       | 각 행을 구분하는 대표 값입니다.                                    |
| **합성키(KEY)**      | 여러 칼럼을 조합해 한 행을 구분할 때 사용합니다.                   |
| **메모**             | 기획 편의를 위한 Excel 전용 칼럼이며 JSON과 코드에서는 제외됩니다. |

## 기본 사용 흐름

1. **설정**에서 Proto, Excel, JSON, 코드 출력 폴더를 지정합니다.
2. **테이블**과 **Enum**에서 데이터 구조를 만들거나 기존 Proto를 불러옵니다.
3. **관계도**에서 참조 방향과 누락된 자료형이 없는지 확인합니다.
4. **Excel**에서 필요한 파일을 선택해 입력 양식을 생성합니다.
5. Excel에 데이터를 입력한 뒤 **JSON 생성**으로 값을 검증하고 출력합니다.
6. 개발 환경에 필요한 언어를 선택해 **코드 생성**을 실행합니다.

> Proto 구조를 변경한 뒤에는 Excel을 다시 생성하기 전에 관계도와 영향 범위를
> 확인하는 것을 권장합니다. 기존 Excel을 덮어쓸 때는 DataManager의 백업 옵션을
> 사용하세요.

## 데이터 보호 원칙

- 설정된 작업 폴더 밖의 파일은 읽거나 쓰지 않습니다.
- Proto 수정과 프로젝트 메타데이터 변경은 하나의 작업으로 처리합니다.
- Excel 덮어쓰기와 생성 결과 교체는 임시 파일 또는 staging을 거칩니다.
- 오류가 있는 Excel은 JSON 파일을 쓰기 전에 전체 검증합니다.
- 기존 `config.json` 가져오기는 원본 Proto, Excel, JSON을 수정하지 않습니다.

## 개발 환경에서 실행

### 준비 사항

- Windows x64 및 Microsoft Edge WebView2
- Node.js 24 이상
- pnpm 11.10.0
- Rust stable 1.97.0 이상, `rustfmt`, `clippy`

Tauri CLI와 EdgeDriver는 전역 설치가 필요하지 않습니다. 저장소의 manifest와
lockfile에 고정된 버전을 사용합니다.

활성 브랜치에는 Electron 런타임이나 빌드 경로가 없습니다. 이전 Electron
버전의 기준선과 롤백 절차는 마이그레이션 문서에 별도로 보존합니다.

```powershell
pnpm install --frozen-lockfile
pnpm tauri:dev
```

## 검증과 배포 빌드

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm rust:test
pnpm rust:clippy
pnpm test:e2e
```

Windows 설치 파일은 다음 명령으로 생성합니다.

```powershell
pnpm tauri:build
```

기본 NSIS 결과 경로:

```text
target/release/bundle/nsis/DataManager_0.1.0_x64-setup.exe
```

## 저장소 구조

```text
DataManager/
├─ apps/desktop/       # React UI와 Tauri 네이티브 명령
├─ packages/core/      # Proto, 관계도, Excel, JSON 핵심 규칙
├─ tests/              # 단위·계약·네이티브 E2E 테스트
├─ examples/           # 실행과 생성 결과를 확인할 예제
├─ scripts/            # Windows 검증 및 fixture 자동화
└─ docs/               # 설정, 이전, 호환성 문서
```

## 관련 문서

- [설정 가이드](docs/settings.md)
- [마이그레이션과 롤백](docs/migration.md)
- [기능 동등성 및 검증 근거](docs/parity-matrix.md)

## 라이선스

이 프로젝트는 [Apache License 2.0](LICENSE)에 따라 배포됩니다.
