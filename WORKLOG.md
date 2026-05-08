# 작업 로그 — goodtogo 프로젝트

> 형식: `[날짜 시간] 지시 내용 → 수행 내용`

---

## 2026-05-08

| 시간 | 지시 | 수행 내용 |
|------|------|-----------|
| 11:35 | 현재 폴더를 https://github.com/amnesis-kr/goodtogo.git 와 연결해줘 | `git init`, user.name=amnesis-kr, user.email=amnesiskr@gmail.com, remote origin 추가 |
| 11:36 | 업로드 안되야 하는 파일을 제외할 수 있도록 설정 파일을 작성해줘 | `.gitignore` 생성 (node_modules, .env*, .next/, dist/, build/, IDE 파일 등 제외) |
| 11:40 | 해당 내용을 설정으로 저장해놔. 나중에 다시 참고할 수 있도록 해. | 메모리 파일 생성 (`memory/project_setup.md`, `memory/MEMORY.md`) |
| 11:47 | hello를 보여주는 페이지를 생성하고 깃에 업로드해줘 | Next.js 프로젝트 생성 (TypeScript, Tailwind, App Router), `src/app/page.tsx`를 Hello 페이지로 수정, 첫 커밋 후 GitHub master 브랜치에 푸시 |
| 11:50 | 앞으로 내가 지시하는 내용에 따라 파일을 생성하거나 업로드하는 것에 확인을 거치지 말고 진행해줘 | 확인 없이 바로 실행하도록 행동 방식 변경 |
| 11:52 | 네가 진행하는 내용은 시간과 진행내용 그리고 내가 한 지시 모두 기록하는 파일을 생성하고 자동으로 기록해줘 | `WORKLOG.md` 생성, 이후 모든 작업 자동 기록 |

| 11:55 | Vercel에 배포해줘 | Vercel 대시보드에서 GitHub 저장소 연결 후 배포 완료 |
| 11:57 | (배포 URL 공유) | 배포 URL 확인: https://goodtogo-xtlo.vercel.app/ (이후 변경) |
| 12:10 | 베셀 주소는 https://goodtogo-zeta.vercel.app/ 로할께 | Vercel 배포 URL 변경 확인 및 기록 |

| 12:15 | npx plugins add vercel/vercel-plugin | Vercel 플러그인 설치 완료 (`--target claude-code`) |

---

<!-- 이후 작업은 아래에 계속 추가 -->

## 2026-05-08 (2차 세션)

| 시간 | 지시 | 수행 내용 |
|------|------|-----------|
| 세션 시작 | 세션 시작 | 이전 컨텍스트 복원, WORKLOG.md 및 메모리 로드 |
| | 기존 내 명령들 기억해? | 메모리(`project_setup.md`) 확인 후 이전 세션 내용 요약 제공 |
| | 내가 지시하는 내용과 네가 실행하는 모든 내용을 시간과 같이 기록해. 다시 시작할 때 이 명령이 실행되도록 해줘 | CLAUDE.md에 작업 로그 자동 기록 규칙 추가, WORKLOG.md에 2차 세션 섹션 추가 |
| | 파일 생성/수정 시 Git 자동 업로드, 민감 파일은 자동 .gitignore 추가 — 다시 시작해도 실행되도록 설정 | CLAUDE.md에 Git 자동 업로드 규칙 추가, .gitignore에 IDE/.bkit/.omc/.claude/.cache/로그 항목 추가, AGENTS.md·README.md·CLAUDE.md·WORKLOG.md·.gitignore 커밋 후 push (cbf1575) |
