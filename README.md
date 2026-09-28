# After Hours Maple

빅뱅 이전 메이플스토리 자료를 사용한 Unity 6 팬게임 프로토타입입니다. 마을을 직접 돌아다니고 원래 위치의 NPC를 찾아가 대화·흡연·메신저로 관계를 이어갑니다.

## 실행

**[브라우저에서 바로 실행](https://wwonnn.github.io/after-hours-maple/)**

이 저장소를 내려받은 뒤 `AfterHoursMaple/Play.cmd`를 실행하세요. Python 3와 Chrome 또는 Edge가 필요합니다. 이미 생성된 웹 빌드가 `AfterHoursMaple/Builds/Web/`에 포함돼 있어 Unity 설치 없이 실행할 수 있습니다.

Unity에서 수정하려면 **6000.0.74f1 + Web Build Support**로 `AfterHoursMaple` 폴더를 열어주세요.

- [프로젝트 설명과 조작법](AfterHoursMaple/README.md)
- [실제 실행 검증 결과](AfterHoursMaple/Verification/RESULTS.md)
- [게임 기획서](docs/after-hours-maple-romance-design-v1.md)

## GitHub Pages

GitHub Actions로 배포되어 있습니다. 웹 빌드를 갱신한 뒤 Actions → **Deploy Unity Web to Pages** → Run workflow로 다시 배포합니다. 사이트에는 `AfterHoursMaple/Builds/Web`의 웹 실행 파일만 배포합니다.

이 저장소와 게임 사이트는 공개입니다. 실제 배포 상태는 저장소 Settings → Pages와 Actions에서 확인하세요.

## 현재 범위

GMS v83 자료 기반 43개 맵, 152종 NPC와 원본 UI·음악을 포함합니다. 한국판 특정 패치와의 완전 일치, 외부 필드 일부, NPC별 정면 흡연 애니메이션은 아직 구현·검증하지 않았습니다.

메이플스토리 원본 에셋의 권리는 Nexon 및 해당 권리자에게 있습니다. 출처와 해시는 `AfterHoursMaple/Tools/import-report.json`에 기록했습니다.
