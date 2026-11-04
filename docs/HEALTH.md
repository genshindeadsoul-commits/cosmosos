# Health Connect & Google Fit Integration Guide

This guide explains how Cosmos OS integrates with fitness and health data, the browser limitations regarding Health Connect, and how to set up an Android companion app or automated script to sync workouts into Cosmos OS.

---

## 1. Architecture Overview & Browser Limitation

### Why Doesn't Cosmos OS Connect to Health Connect Directly in the Browser?
- **Health Connect on Android** is an on-device Android system service (`androidx.health.connect.client`) managed through Google Play services and Android 14+ platform APIs.
- Web browsers running on desktop or mobile **do not have direct access** to on-device Health Connect data due to operating system sandbox and permission boundaries.
- **Google Fit REST APIs are deprecated**: Google is sunsetting legacy cloud-based Google Fit APIs in favor of on-device Android Health Connect.
- Therefore, a companion sender (an Android app or local automation) is required to query Health Connect on your Android device and forward workout logs to Cosmos OS.

### Connection State Lifecycle
Cosmos OS adheres to strict honesty in reporting integration status:
1. **Not Connected (`not_connected`)**: No ingest token exists, or tokens exist but no workout payload has ever been ingested. The status will **never** display "Connected" until actual data has reached Cosmos OS.
2. **Connected (`connected`)**: At least one valid workout payload was received and verified by the Supabase Edge Function `health-ingest`. The `last_synced_at` timestamp is updated to reflect the exact synchronization time.
3. **Revoked / Inactive**: If an ingest token is revoked, subsequent ingest requests with that token are rejected with HTTP 401 Unauthorized.

---

## 2. Ingest API Specification

### Endpoint
- **URL**: `https://<your-supabase-project>.supabase.co/functions/v1/api/health-ingest`
- **Method**: `POST`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <personal_ingest_token>` (starts with `cosmos_h_` followed by 64 hex characters)

### Request Payload Schema
Send between 1 and 100 workouts per request:
```json
{
  "workouts": [
    {
      "externalId": "health-connect-session-unique-id",
      "title": "Morning Outdoor Run",
      "date": "2026-11-04",
      "durationMinutes": 42,
      "calories": 380,
      "notes": "Felt great, steady cadence."
    }
  ]
}
```

#### Field Specifications
| Field | Type | Required | Constraints | Behavior |
| :--- | :--- | :--- | :--- | :--- |
| `externalId` | `string` | **Yes** | Max 128 characters | Unique identifier from Health Connect. Used for idempotency. |
| `title` | `string` | **Yes** | Max 200 characters | Name of the session/exercise type. |
| `date` | `string` | **Yes** | `YYYY-MM-DD` | Valid calendar date. |
| `durationMinutes` | `number \| null` | No | Integer `0`–`1440` or `null` | Missing values stay `null` (never coerced to `0`). Rendered as `—` in Cosmos. |
| `calories` | `number \| null` | No | Integer `0`–`20000` or `null` | Missing values stay `null` (never coerced to `0`). Rendered as `—` in Cosmos. |
| `notes` | `string \| null` | No | Max 2000 characters | Optional session notes or description. |

### Response Schema
- **Success (200 OK)**:
  ```json
  {
    "received": 1,
    "inserted": 1,
    "duplicates": 0
  }
  ```
- **Duplicate handling (Idempotent)**:
  Re-sending previously synced `externalId`s is completely safe. The server detects existing IDs, inserts only fresh workouts, and returns:
  ```json
  {
    "received": 1,
    "inserted": 0,
    "duplicates": 1
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`: Token missing, malformed, invalid, or revoked.
  - `400 Bad Request`: Invalid payload structure, date format, or out-of-range numerical values.

---

## 3. Quick Verification with cURL

You can verify your token immediately from any terminal:

```bash
curl -X POST "https://<your-supabase-project>.supabase.co/functions/v1/api/health-ingest" \
  -H "Authorization: Bearer <YOUR_COSMOS_INGEST_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "workouts": [
      {
        "externalId": "test-curl-001",
        "title": "Evening Cycling",
        "date": "2026-11-04",
        "durationMinutes": 35,
        "calories": 290,
        "notes": "Verified via curl"
      }
    ]
  }'
```

After executing this request:
1. Open Cosmos OS **Settings → Integrations → Health Connect / Google Fit**. The status will show **Connected** with the timestamp of sync.
2. Navigate to **Fitness & Training** in Cosmos OS. The workout will appear under **Recent Logs** with an **Imported** badge.

---

## 4. Companion Android App Setup (Kotlin)

### Step 1: AndroidManifest.xml Permissions
Add permissions to query Health Connect in your Android app:
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.health.READ_EXERCISE"/>

    <queries>
        <package android:name="com.google.android.apps.healthdata" />
    </queries>
</manifest>
```

### Step 2: Read Sessions and POST to Ingest API
```kotlin
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

suspend fun syncHealthConnectToCosmos(
    client: HealthConnectClient,
    ingestToken: String,
    endpointUrl: String
) {
    // 1. Read exercise sessions from the last 7 days
    val startTime = Instant.now().minus(7, ChronoUnit.DAYS)
    val response = client.readRecords(
        ReadRecordsRequest(
            recordType = ExerciseSessionRecord::class,
            timeRangeFilter = TimeRangeFilter.after(startTime)
        )
    )

    if (response.records.isEmpty()) return

    // 2. Build JSON payload
    val workoutsJson = JSONArray()
    val dateFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd").withZone(ZoneId.systemDefault())

    for (record in response.records) {
        val durationMins = ChronoUnit.MINUTES.between(record.startTime, record.endTime).toInt()
        val dateString = dateFormatter.format(record.startTime)
        val title = record.title ?: when (record.exerciseType) {
            ExerciseSessionRecord.EXERCISE_TYPE_RUNNING -> "Running"
            ExerciseSessionRecord.EXERCISE_TYPE_BIKING -> "Cycling"
            ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_OPEN_WATER,
            ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_POOL -> "Swimming"
            ExerciseSessionRecord.EXERCISE_TYPE_WALKING -> "Walking"
            ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING -> "Strength Training"
            else -> "Workout Session"
        }

        val item = JSONObject().apply {
            put("externalId", "hc_${record.metadata.id}")
            put("title", title)
            put("date", dateString)
            put("durationMinutes", if (durationMins > 0) durationMins else JSONObject.NULL)
            put("calories", JSONObject.NULL) // Or aggregate from TotalCaloriesBurnedRecord
            put("notes", record.notes ?: JSONObject.NULL)
        }
        workoutsJson.put(item)
    }

    val body = JSONObject().apply {
        put("workouts", workoutsJson)
    }

    // 3. POST to Cosmos OS health-ingest endpoint
    val okHttpClient = OkHttpClient()
    val mediaType = "application/json; charset=utf-8".toMediaType()
    val requestBody = body.toString().toRequestBody(mediaType)

    val request = Request.Builder()
        .url(endpointUrl)
        .addHeader("Authorization", "Bearer $ingestToken")
        .post(requestBody)
        .build()

    okHttpClient.newCall(request).execute().use { res ->
        if (!res.isSuccessful) {
            throw RuntimeException("Cosmos health-ingest failed: ${res.code} ${res.body?.string()}")
        }
    }
}
```

### Step 3: Background Sync via WorkManager
Use `androidx.work.PeriodicWorkRequestBuilder` running every few hours or once daily with network constraints (`NetworkType.CONNECTED`) to keep Cosmos OS automatically up to date.
