# Test Report - Signal Market

> Generated: 2025-03-05

## Test Overview

This document records all test cases for the Signal Market API integration tests.

## Test Suites

### 1. Basic Tests (Tests 1-6)

| ID | Test Name | Description | Status |
|----|-----------|-------------|--------|
| 1 | Health Check | Verify `/signals/health` returns healthy status | ✅ |
| 2 | Get Events | Verify `/events` returns event list with pagination | ✅ |
| 3 | Get Predictions | Verify `/predictions` returns predictions | ✅ |
| 4 | Get Lens Brief | Verify `/lenses/:lens_id/daily-brief` works | ✅ |
| 5 | Prediction Curve | Verify `/predictions/:event_id` returns curve data | ✅ |
| 6 | Get Evidence | Verify `/evidence/:id` returns evidence details | ✅ |

### 2. Pagination Tests (Tests 7-9)

| ID | Test Name | Description | Status |
|----|-----------|-------------|--------|
| 7 | Pagination - limit | Verify `?limit=N` parameter works | ✅ |
| 8 | Pagination - offset | Verify `?offset=N` returns different results | ✅ |
| 9 | Pagination - hasMore | Verify `hasMore` flag is present | ✅ |

### 3. Filtering Tests (Tests 10-12)

| ID | Test Name | Description | Status |
|----|-----------|-------------|--------|
| 10 | Filter by stage | Verify `?stage=accelerating` filter works | ✅ |
| 11 | Filter by topic | Verify `?topic=AI算力` filter works | ✅ |
| 12 | Multiple stage filters | Verify `?stage=accelerating,peak` works | ✅ |

### 4. Sorting Tests (Tests 13-14)

| ID | Test Name | Description | Status |
|----|-----------|-------------|--------|
| 13 | Sort by probability | Verify `?sortBy=probability&sortOrder=desc` | ✅ |
| 14 | Sort by title | Verify `?sortBy=title&sortOrder=asc` | ✅ |

### 5. Predictions Tests (Tests 15-18)

| ID | Test Name | Description | Status |
|----|-----------|-------------|--------|
| 15 | Predictions - pagination | Verify predictions support pagination | ✅ |
| 16 | Predictions - filter | Verify predictions can be filtered | ✅ |
| 17 | Predictions - sort | Verify predictions can be sorted | ✅ |
| 18 | Non-existent prediction | Verify 404 for non-existent event | ✅ |

### 6. Edge Cases (Tests 19-22)

| ID | Test Name | Description | Status |
|----|-----------|-------------|--------|
| 19 | Combined pagination and filter | Verify complex queries work | ✅ |
| 20 | Combined sort and filter | Verify combined query parameters | ✅ |
| 21 | Invalid lens ID | Verify 404 for invalid lens | ✅ |
| 22 | Total count | Verify `pagination.total` is returned | ✅ |

### 7. Error Handling Tests (Tests 23-29)

| ID | Test Name | Description | Status |
|----|-----------|-------------|--------|
| 23 | 404 Non-existent route | Verify unknown routes return 404 | ✅ |
| 24 | Invalid limit value | Verify `?limit=-1` is handled | ✅ |
| 25 | Non-numeric limit | Verify `?limit=abc` is handled | ✅ |
| 26 | Negative offset | Verify `?offset=-5` is handled | ✅ |
| 27 | Large limit value | Verify `?limit=99999` is handled | ✅ |
| 28 | Invalid sort order | Verify invalid sortOrder is handled | ✅ |
| 29 | Invalid sortBy field | Verify invalid sortBy is handled | ✅ |

### 8. Boundary Tests (Tests 30-35)

| ID | Test Name | Description | Status |
|----|-----------|-------------|--------|
| 30 | Empty result set | Verify filter with no results | ✅ |
| 31 | Offset beyond total | Verify offset > total count | ✅ |
| 32 | limit=0 edge case | Verify `?limit=0` is handled | ✅ |
| 33 | URL-encoded filter | Verify URL-encoded parameters | ✅ |
| 34 | Double slash path | Verify `//events` path handling | ✅ |
| 35 | Unknown params | Verify unknown params are ignored | ✅ |

### 9. Structure Validation Tests (Tests 36-38)

| ID | Test Name | Description | Status |
|----|-----------|-------------|--------|
| 36 | Events response structure | Validate events API response format | ✅ |
| 37 | Predictions response structure | Validate predictions API response | ✅ |
| 38 | Health response structure | Validate health API response | ✅ |

## Test Coverage Summary

- **Total Tests**: 38
- **Categories**: 9
- **Coverage Areas**:
  - Basic API endpoints
  - Pagination (limit, offset, hasMore, total)
  - Filtering (stage, topic, multi-value)
  - Sorting (probability, title, asc/desc)
  - Error handling (404, invalid params)
  - Boundary conditions (empty results, overflow)
  - Response structure validation

## Running Tests

```bash
# Run integration tests
npm run test:integration

# Or directly
node test/integration.js
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| API_URL | http://localhost:3000 | API base URL |

## Notes

- Tests require the API server to be running
- Some tests may be skipped if no data is available
- Tests are designed to be idempotent
