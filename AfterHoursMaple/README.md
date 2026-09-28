# AFTER HOURS — Unity 6

이 폴더가 Unity 프로젝트입니다. 편집기 기준은 **Unity 6000.0.74f1 + Web Build Support**입니다.

## 실행

`Play.cmd`를 실행하고 열린 브라우저에서 **시작하기**를 누르세요. 브라우저에서 `index.html`을 직접 여는 방식은 지원하지 않습니다. 로컬 서버 주소는 `http://127.0.0.1:8790/`이며 서버 창을 닫으면 종료됩니다.

- 방향키: 걷기, 사다리·로프 오르내리기
- Space / 왼쪽 Alt: 점프, 아래 방향키와 함께 누르면 아래 발판으로 내려가기
- 위 방향키: 원래 위치의 문·포털 사용
- F / Enter 또는 가까운 NPC 클릭: 대화
- W: 월드맵, P: 메신저, H: 조작 안내, Esc: 창 닫기
- 흡연 중 L: 점화, Space 길게: 흡입, E 길게: 내쉬기, A: 재 털기, X: 끄기

첫 만남을 마치면 연락처와 대화가 브라우저에 저장됩니다. 일정한 게임 시간이 지나면 초대가 오고, NPC는 이동하지 않으므로 플레이어가 같은 장소를 다시 찾아갑니다. 브라우저별로 저장이 분리됩니다.

## 원본 자료와 현재 범위

- 현재 확보된 기준 자료는 **GMS v83**입니다. 한국 메이플의 특정 빅뱅 이전 패치와 동일하다고 검증한 자료는 아닙니다.
- 커닝시티·헤네시스·엘리니아·페리온·리스항구와 연결 실내 등 43개 맵을 원본 좌표와 레이어로 구성했습니다. NPC 152종과 처음 선택한 초보자 캐릭터의 원본 이미지가 들어 있습니다.
- 원본 그림은 MapleStory.io의 GMS/83 API, 맵·발판·포털·이미지 원점 메타데이터는 HeavenMS의 WZ XML 자료를 사용했습니다. 원본 그림의 출처와 해시는 `Tools/import-report.json`에 기록합니다.
- 배경음악은 현재 헤네시스·엘리니아·커닝시티를 수록했습니다.
- 원본 미니맵·월드맵·상태 표시줄·창 테두리를 사용합니다. 새로운 메신저 대화와 흡연 조작은 자체 구현입니다.
- 맵 연결 범위 밖 필드·이벤트·퀘스트 전용 이동과 상점 기능은 구현 대상에 아직 포함되지 않았습니다. 미수록 연결은 `Tools/asset-check.json`에 명시합니다.
- 이동 물리, 카메라, 일부 UI 흐름은 현재 구현값이며 원작 클라이언트와 완전 일치 검증이 남아 있습니다.
- 흡연 화면은 같은 Unity 맵 위에 원본 NPC 이미지를 확대하고, 투명한 웹 캔버스의 손·담배·연기 렌더러를 합성합니다. 원작에 없는 NPC의 정면 흡연 애니메이션이나 표정 그림을 원본 에셋인 것처럼 대체하지 않습니다.

택시는 확보된 v83 스크립트의 목적지별 요금과 초보자 90% 할인을 적용하고 안내 → 선택 → 확인 절차로 이동합니다. 아직 수록하지 않은 노틸러스는 목적지에서 제외됩니다.

따라서 이 빌드는 전체 기획 완성본이나 한국 원작 완전 재현본으로 표기하지 않습니다.

## 개발 및 검증

Unity Hub에서 이 폴더를 추가하거나 작업 폴더의 `.tools/Unity6000/Editor/Unity.exe`로 열 수 있습니다.

```powershell
./Build-Web.ps1
# 다른 위치에 설치한 편집기:
./Build-Web.ps1 -UnityPath 'C:/Program Files/Unity/Hub/Editor/6000.0.74f1/Editor/Unity.exe'
```

산출물은 `Builds/Web`, 빌드 로그는 `build-web.log`에 생성됩니다. 첫 빌드는 패키지와 원본 에셋을 가져오므로 재빌드보다 오래 걸립니다.

`Tools/import_maple.py`는 자료 수집·캐시·출처 기록, `Tools/prepare_runtime.py`는 흡연 렌더러 결합, `Tools/check_assets.py`는 확보된 원본 XML 대비 NPC 좌표·포털·맵 구성 요소와 이미지 파일 검사입니다. Python과 Pillow가 필요합니다.

자료 출처:

- https://maplestory.io/
- https://github.com/ronancpl/HeavenMS/tree/master/wz
- Nanum Gothic: Google Fonts, SIL Open Font License (`Assets/Resources/Font-LICENSE.txt`)
- 흡입 효과음: kczub, CC0 (`Assets/StreamingAssets/Smoke/CREDITS.md`)

메이플스토리 원본 그림·음악·명칭의 권리는 Nexon 및 해당 권리자에게 있습니다. 이 프로젝트는 로컬 팬게임 개발 자료이며 별도의 배포 허가를 포함하지 않습니다.

## 브라우저 통합 검증

로컬 서버를 실행한 뒤 `node Tools/web-smoke.cjs`를 실행하면 실제 방향키와 마우스 입력으로 상점 진입, NPC 접근, 점화·흡입·내쉬기, 연락처 생성, 초대, 저장 복원, 대화 기억을 검사합니다. Node.js와 Playwright, Chrome이 필요합니다. 결과와 실제 스크린샷은 `Verification/`에 저장됩니다.
