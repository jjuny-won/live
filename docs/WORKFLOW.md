# 작업 방식 (세션 분담)

| 세션 | 작업 위치 | 브랜치 | 수정 범위 |
|---|---|---|---|
| 문서화·학습 | 메인 폴더 `~/Developer/Portfolio/live` | `main` | `docs/`, 루트 `README.md` |
| BE 개발 | 별도 worktree | `be/...` | `backend/`, `docker-compose.yml`, `.env.example`, `infra/` |
| FE 개발 | 별도 worktree | `fe/...` | `frontend/` |

## 규칙
1. **API 계약은 `docs/API.md`가 기준**이다. BE·FE가 바꿔야 하면 자기 브랜치에서 `docs/API.md`도 함께 고치고 커밋 메시지에 `API 변경`을 적는다.
2. 사용자가 정해야 하는 것은 `docs/DECISIONS.md`에 모은다. 개발 세션은 결정 전에는 **표시된 기본값**으로 진행하고, 바꾸기 쉽게(환경변수·상수) 만든다.
3. 시크릿(LiveKit 키, DB 비밀번호)은 커밋하지 않는다. `.env.example`에 키 이름만.
4. 커밋 메시지: `Feat: …`, `Fix: …`, `Docs: …`, `Chore: …` (한국어 설명). AI 공동 저자 줄은 넣지 않는다.
5. 개발 브랜치는 기능 단위로 끝나면 `main`에 병합(병합·푸시는 사용자가 결정).
6. 진행 상황은 `docs/PROGRESS.md`에 날짜별로 기록(문서화 세션이 정리).
