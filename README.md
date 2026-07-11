# 무빙 도장 (Movement Dojo)

리그 오브 레전드의 **카이팅**과 **스킬샷 회피** 감각을 모바일/PC에서 가볍게 연습할 수 있는 정적 웹앱입니다.
서버 없이 순수 HTML/CSS/JS로만 동작하며, GitHub Pages로 바로 배포할 수 있습니다.

## 기능

- **카이팅 연습**: 사방에서 다가오는 추적자를 피해 거리를 유지하며 계속 움직이기
- **스킬샷 회피 연습**: 조준되어 날아오는 투사체를 실시간으로 피하기
- **난이도 3단계**: 쉬움 / 보통 / 어려움 (속도·스폰 주기 조절)
- **모바일 조작**: 화면 아무 곳이나 터치하면 그 지점으로 이동 (LoL 우클릭 이동과 동일한 감각)
- **PC 조작**: WASD 키보드 이동 지원
- 생존 시간, 피격 횟수, 모드별 최고 기록 표시

## 로컬에서 실행하기

별도 빌드 과정이 없습니다. `index.html`을 브라우저로 열면 바로 동작합니다.

```bash
# 간단한 정적 서버로 실행하고 싶다면 (선택 사항)
python3 -m http.server 8000
# 이후 브라우저에서 http://localhost:8000 접속
```

## GitHub Pages로 배포하기

1. 이 폴더 전체를 GitHub 저장소에 푸시합니다.

   ```bash
   git init
   git add .
   git commit -m "무빙 도장 초기 버전"
   git branch -M main
   git remote add origin https://github.com/<사용자명>/<저장소명>.git
   git push -u origin main
   ```

2. GitHub 저장소 페이지에서 **Settings → Pages**로 이동합니다.
3. **Build and deployment** 항목에서:
   - Source: `Deploy from a branch`
   - Branch: `main` / `/(root)` 선택 후 **Save**
4. 1~2분 후 `https://<사용자명>.github.io/<저장소명>/` 주소로 접속하면 사이트가 열립니다.

> `index.html`이 저장소 루트에 있어야 별도 경로 설정 없이 바로 열립니다. (이 프로젝트는 이미 루트 구조입니다.)

## 폴더 구조

```
lol-moving-practice/
├── index.html        # 페이지 구조 (HUD, 모드 선택 패널, 캔버스)
├── css/
│   └── style.css      # 다크 골드 톤 UI 스타일
└── js/
    └── main.js         # 게임 루프, 이동 로직, 카이팅/스킬샷 모드
```

## 커스터마이징 팁

- `js/main.js` 상단의 `DIFF` 객체에서 난이도별 속도·스폰 주기를 조절할 수 있습니다.
- 새로운 훈련 모드를 추가하려면 `updateKiting` / `updateDodge`처럼 `update누구든지()` 형태의 함수를 만들고, `loop()` 함수 안의 모드 분기에 추가하면 됩니다.
- 캐릭터 이동 속도는 `player.speed` 값을 수정하세요.

## 브라우저 지원

최신 Chrome, Safari(iOS 포함), Edge에서 동작을 확인했습니다. Canvas 2D와 `requestAnimationFrame`만 사용하므로 대부분의 모던 브라우저에서 문제 없이 동작합니다.
