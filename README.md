# omok-ai-ELO

`omok-web-ai`에 들어 있는 오목 AI 모델들을 서로 직접 대국시켜 Elo 점수로 비교하는 Node.js 기반 평가기입니다.

`omok-web-ai`의 모델들은 브라우저용 JavaScript 파일로 작성되어 있으므로, 이 프로젝트는 Python으로 감싸기보다 Node.js의 `vm`으로 원본 모델 파일을 그대로 읽어 실행합니다. 덕분에 모델 로직을 따로 변환하지 않고 실제 웹 앱과 거의 같은 코드 경로를 사용합니다.

## 평가 대상

기본 평가 대상은 다음 6개입니다.

- `greedy`
- `pattern`
- `search` / Alpha-Beta
- `tactical`
- `threat` / Threat Search
- `mcts`

`policy`도 지원하지만, 현재 `policy-net.js`는 TensorFlow.js와 `./assets/policy-net/model.json`이 없으면 내부 fallback으로 `tacticalMove`를 사용합니다. 그래서 기본 목록에서는 제외했습니다. 전체를 강제로 돌리고 싶으면 `--models all`을 사용하면 됩니다.

## 빠른 실행

두 레포를 같은 부모 폴더에 둔 경우를 기준으로 합니다.

```bash
git clone https://github.com/gimon0330/omok-web-ai.git
git clone https://github.com/gimon0330/omok-ai-ELO.git
cd omok-ai-ELO
npm start -- --source ../omok-web-ai --games 10 --depth 2
```

결과 파일까지 저장하려면 다음처럼 실행합니다.

```bash
npm start -- \
  --source ../omok-web-ai \
  --games 20 \
  --depth 2 \
  --json results/elo.json \
  --csv results/elo.csv
```

## 주요 옵션

| 옵션 | 의미 | 기본값 |
| --- | --- | --- |
| `--source` | `omok-web-ai` 레포 또는 `models` 폴더 경로 | `../omok-web-ai` |
| `--models` | 평가할 모델 목록. 예: `greedy,pattern,mcts` 또는 `all` | `greedy,pattern,search,tactical,threat,mcts` |
| `--games` | 각 모델 쌍마다 진행할 게임 수 | `2` |
| `--depth` | 각 모델에 넘길 탐색 깊이 | `2` |
| `--k` | Elo 업데이트 K-factor | `32` |
| `--initial-elo` | 시작 Elo | `1000` |
| `--max-plies` | 이 수 이상 착수하면 무승부 처리 | `225` |
| `--move-timeout-ms` | 한 수 제한 시간. `0`이면 비활성화 | `0` |
| `--seed` | MCTS 등 난수 모델을 위한 seed | `20260523` |
| `--json` | 전체 게임 로그와 랭킹을 JSON으로 저장 | 없음 |
| `--csv` | 랭킹 표를 CSV로 저장 | 없음 |

## 평가 방식

각 모델 쌍에 대해 `--games`판을 진행하고, 게임 번호마다 흑/백을 번갈아 배정합니다. 오목 판정은 `omok-web-ai`와 동일하게 15×15 보드에서 5개 이상 연속이면 승리로 처리합니다.

중요한 점은 `omok-web-ai`의 모델들이 항상 `AI = 2`, `HUMAN = 1` 관점에서 수를 고른다는 것입니다. 따라서 이 평가기는 어떤 모델이 흑을 잡더라도 내부적으로 보드를 변환해서 “현재 착수할 모델 = AI”처럼 보이게 만든 뒤 수를 요청합니다. 이 처리를 하지 않으면 흑 모델이 상대 돌을 자기 돌로 착각할 수 있습니다.

Elo는 게임이 끝날 때마다 다음 식으로 갱신합니다.

```text
expected(A) = 1 / (1 + 10 ^ ((EloB - EloA) / 400))
newElo(A) = EloA + K * (scoreA - expected(A))
```

승리는 `1`, 무승부는 `0.5`, 패배는 `0`으로 계산합니다.

## 출력 예시

```text
=== Omok AI Elo Ranking ===
Rank  Model     Elo     W-L-D   Score%  Win%   Avg ms/move  Illegal
----  --------  ------  ------  ------  -----  -----------  -------
1     threat    1042.3  8-2-0   80.0%   80.0%  112.4        0
2     tactical  1018.6  6-4-0   60.0%   60.0%  85.7         0
```

## 구조

```text
src/
  cli.js            CLI entrypoint
  model-loader.js   omok-web-ai 모델 파일을 Node vm으로 로드
  gomoku.js         보드/승리/합법수 판정
  tournament.js     모델 간 대국 및 통계 누적
  elo.js            Elo 계산
  format.js         콘솔/CSV 출력
```

## 주의

- 같은 deterministic 모델끼리는 같은 흑/백 배정에서 같은 게임이 반복될 수 있습니다. 결과 안정성을 보려면 `--games`를 늘리는 것뿐 아니라 이후 opening book 또는 random opening plies를 추가하는 방식도 고려할 수 있습니다.
- `mcts`는 `Math.random()`을 사용하므로 `--seed`를 통해 재현성을 확보했습니다.
- 현재는 자유오목 판정입니다. Renju 금수 규칙은 적용하지 않습니다.
