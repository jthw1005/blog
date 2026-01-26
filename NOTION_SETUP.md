# Notion 데이터베이스 설정 가이드

## 1. Notion Integration 생성

1. [Notion Developers](https://www.notion.so/my-integrations)로 이동
2. **"새 Integration 만들기"** 클릭
3. 이름 입력 (예: "Dev Blog")
4. **Submit** 클릭
5. **Internal Integration Secret** 복사 → `.env` 파일의 `NOTION_API_KEY`에 붙여넣기

## 2. Notion 데이터베이스 생성

Notion에서 새 데이터베이스를 생성하고 다음 속성들을 추가하세요:

| 속성 이름 | 속성 타입 | 설명 |
|----------|---------|------|
| **Name** | Title | 글 제목 (기본 생성됨) |
| **Slug** | Text | URL 슬러그 (예: `my-first-post`) |
| **Description** | Text | 글 요약 설명 |
| **Date** | Date | 작성일 |
| **Tags** | Multi-select | 태그 목록 |
| **Published** | Checkbox | 공개 여부 (체크하면 블로그에 표시) |

## 3. Integration 연결

1. Notion 데이터베이스 페이지 열기
2. 우측 상단 **⋯** 클릭
3. **Connections** > **Connect to** 선택
4. 생성한 Integration 선택

## 4. 데이터베이스 ID 확인

데이터베이스 URL에서 ID를 복사합니다:

```
https://www.notion.so/myworkspace/[DATABASE_ID]?v=...
                                  ^^^^^^^^^^^^
                                  이 부분을 복사
```

`.env` 파일의 `NOTION_DATABASE_ID`에 붙여넣기

## 5. 환경변수 설정

`.env` 파일이 다음과 같이 설정되어 있는지 확인:

```env
NOTION_API_KEY="secret_xxxxxxxxx"
NOTION_DATABASE_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

## 6. 글 작성하기

1. Notion 데이터베이스에 새 페이지 추가
2. 속성들을 채우기:
   - **Name**: 글 제목
   - **Slug**: URL-friendly 슬러그 (예: `react-hooks-guide`)
   - **Description**: 한 줄 요약
   - **Date**: 작성일
   - **Tags**: 관련 태그들
   - **Published**: ✅ 체크
3. 페이지 본문에 마크다운 형식으로 내용 작성

## 7. 빌드 및 배포

```bash
# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 빌드 결과 미리보기
npm run preview
```

## 지원되는 Notion 블록

- ✅ 제목 (H1, H2, H3)
- ✅ 단락
- ✅ 글머리 기호 목록
- ✅ 번호 목록
- ✅ 코드 블록
- ✅ 인용구
- ✅ 구분선
- ✅ 이미지
- ✅ 콜아웃

## 문제 해결

### 404 오류가 발생하는 경우
- Integration이 데이터베이스에 연결되어 있는지 확인
- 데이터베이스 ID가 올바른지 확인
- API 키가 유효한지 확인

### 글이 표시되지 않는 경우
- **Published** 속성이 체크되어 있는지 확인
- 데이터베이스 속성 이름이 정확한지 확인 (대소문자 구분)
