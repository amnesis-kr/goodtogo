@AGENTS.md

## 작업 로그 자동 기록 규칙

- 모든 세션에서 사용자의 지시와 수행 내용을 `WORKLOG.md`에 기록한다.
- 형식: `| HH:MM | 지시 내용 | 수행 내용 |`
- 날짜가 바뀌면 새 섹션(`## YYYY-MM-DD`)을 추가한다.
- 세션 시작 시 `| HH:MM | 세션 시작 | 이전 컨텍스트 복원 및 WORKLOG.md 로드 |` 항목을 추가한다.
- 파일 생성/수정/삭제, Git 커밋/푸시, 배포 등 모든 실행 작업을 빠짐없이 기록한다.
- 확인 없이 바로 실행한다 (파일 생성, Git 업로드 포함).

## Git 자동 업로드 규칙

- 파일이 생성되거나 수정되면 즉시 `git add` → `git commit` → `git push origin master`를 실행한다.
- 커밋 메시지는 변경 내용을 간결하게 한국어로 작성한다.
- 민감 정보, 빌드 산출물, 캐시 등 Git에 올리면 안 되는 파일은 판단하여 `.gitignore`에 추가한 뒤 커밋한다.
- `.gitignore`에 추가해야 할 파일 유형: 환경변수(`.env*`), 시크릿/키 파일, 빌드 결과물(`.next/`, `dist/`, `build/`, `out/`), 캐시(`.cache/`, `node_modules/`), OS 파일(`.DS_Store`, `Thumbs.db`), IDE 설정(`.idea/`, `.vscode/`), 로그 파일(`*.log`), bkit/omc 상태 파일(`.bkit/`, `.omc/`).
