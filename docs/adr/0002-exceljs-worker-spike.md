# ADR 0002: ExcelJS Worker Spike

## Status

Provisionally accepted. Final M1 acceptance still requires a real Tauri WebView
worker run after pnpm dependencies and Rust are available.

## Context

The rewrite needs to create and read XLSX workbooks without blocking the
WebView. Required structure includes Message sheets, primary-key header style,
Enum validation, Message validation, 10,000-row validation ranges, and binary
read/write support.

## Decision

Use ExcelJS 4.4.0 behind a desktop adapter and execute workbook work in a
module worker. ExcelJS stays outside packages/core. The core package owns
domain data and validation, while the desktop adapter translates that data to
and from workbook structures.

## Evidence

- tests/tauri-rewrite/m1-excel-spike.test.cjs creates Item and RelatedItem
  Message sheets, restores their binary representation, verifies the
  primary-key header style, Enum validation, a cross-Message dynamic reference
  validation, and independent row-10,000 coverage for both validations.
- The same test reads examples/EXCEL/TestTable.xlsx only to prove legacy XLSX
  binary readability. It does not treat the stale example contents as golden.
- A Vite browser-mode production build with the Excel spike enabled emitted a
  separate excelWorkbook.worker bundle of 938.98 kB, proving the browser build
  can bundle ExcelJS outside the main UI chunk.

## Constraints and Follow-up

- The browser worker is only loaded when VITE_EXCEL_SPIKE=1. Product Excel
  flows will use the same worker boundary in M5.
- The live worker run in a Tauri WebView, cancellation, progress reporting,
  and a 10,000-row timing budget remain M1/M5 gates.
- If a real Tauri worker run fails, keep the adapter interface and replace its
  implementation with a Rust XLSX solution rather than leaking a new API into
  core or React components.
