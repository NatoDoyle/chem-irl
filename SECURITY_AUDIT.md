# Security Audit: SECURITY DEFINER Functions

**Date**: 2025-12-24  
**Scope**: `db/rls.sql` and `db/scoring.sql`  
**Focus**: SECURITY DEFINER functions that bypass RLS

---

## Executive Summary

**CRITICAL VULNERABILITIES FOUND**: 8 of 10 SECURITY DEFINER functions have security issues where they allow users to access or modify data belonging to other users without proper authorization checks.

**Risk Level**: 🔴 **HIGH** - Users can access other users' data, emails, matches, scores, and credits.

---

## Security Issues Overview

| Function | Risk | Issue | Impact |
|----------|------|-------|--------|
| `get_user_matches()` | 🔴 CRITICAL | No auth check | Any user can see any user's matches + emails |
| `are_users_matched()` | 🟡 MEDIUM | No auth check | Any user can check if any two users are matched |
| `get_user_action_speed()` | 🟡 MEDIUM | No auth check | Any user can see any user's score |
| `get_discovery_feed()` | 🟡 MEDIUM | No auth check on p_viewer | Can query feed as any user (minor impact) |
| `create_like_and_check_match()` | 🔴 CRITICAL | No auth check | Users can create likes as other users |
| `update_daily_action_speed()` | 🟢 LOW | System function, no user input | OK (but should be restricted to system) |
| `apply_action_speed_bonus()` | 🔴 CRITICAL | No auth check | Users can modify any user's scores |
| `update_profile_quality()` | 🔴 CRITICAL | No auth check | Users can modify any user's scores |
| `update_reliability()` | 🔴 CRITICAL | No auth check | Users can modify any user's scores |
| `get_user_credits()` | 🔴 CRITICAL | No auth check | Users can see any user's credit balance |

---

## Detailed Function Analysis

### 1. `get_user_matches(user_uuid UUID)`

**Location**: `db/rls.sql:206`  
**Signature**: `get_user_matches(user_uuid UUID)`  
**Returns**: `TABLE(match_id UUID, other_user_id UUID, other_user_email TEXT, created_at TIMESTAMPTZ)`

**Tables Touched**:
- `matches` (SELECT)
- `users` (SELECT - LEFT JOIN)

**Current Authorization**:
- ❌ **NONE** - Function accepts any UUID parameter without verifying `auth.uid() = user_uuid`

**Security Issue**:
- 🔴 **CRITICAL**: Any authenticated user can call `get_user_matches('<any-user-uuid>')` and retrieve:
  - All matches for that user
  - Email addresses of matched users
  - Match creation timestamps

**Example Attack**:
```sql
-- Attacker (user A) can see all matches and emails of user B
SELECT * FROM get_user_matches('<victim-user-uuid>');
```

**Data Exposure**:
- ✅ Can read matches across users: YES
- ✅ Can read emails across users: YES (via JOIN with users table)
- ❌ Can write data: NO

**Fix Required**: ✅ **YES**
```sql
-- Add check: auth.uid() = user_uuid
WHERE (m.user_a = user_uuid OR m.user_b = user_uuid)
  AND m.status = 'open'
  AND auth.uid() = user_uuid  -- ADD THIS
```

---

### 2. `are_users_matched(user_a UUID, user_b UUID)`

**Location**: `db/rls.sql:230`  
**Signature**: `are_users_matched(user_a UUID, user_b UUID)`  
**Returns**: `BOOLEAN`

**Tables Touched**:
- `matches` (SELECT)

**Current Authorization**:
- ❌ **NONE** - Function accepts any two UUIDs without verifying caller is one of them

**Security Issue**:
- 🟡 **MEDIUM**: Any authenticated user can check if any two users are matched by calling:
  ```sql
  SELECT are_users_matched('<user-1-uuid>', '<user-2-uuid>');
  ```
- This leaks relationship information between users

**Data Exposure**:
- ✅ Can read match status across users: YES
- ❌ Can write data: NO

**Fix Required**: ✅ **YES**
```sql
-- Add check: caller must be one of the users
WHERE ((user_a = $1 AND user_b = $2) OR (user_a = $2 AND user_b = $1))
  AND status = 'open'
  AND (auth.uid() = $1 OR auth.uid() = $2)  -- ADD THIS
```

---

### 3. `get_user_action_speed(user_uuid UUID)`

**Location**: `db/rls.sql:243`  
**Signature**: `get_user_action_speed(user_uuid UUID)`  
**Returns**: `INTEGER`

**Tables Touched**:
- `scores_daily` (SELECT)

**Current Authorization**:
- ❌ **NONE** - Function accepts any UUID without verifying `auth.uid() = user_uuid`

**Security Issue**:
- 🟡 **MEDIUM**: Any authenticated user can query any user's action speed score:
  ```sql
  SELECT get_user_action_speed('<any-user-uuid>');
  ```
- Scores are business-sensitive data and should be private

**Data Exposure**:
- ✅ Can read scores across users: YES
- ❌ Can write data: NO

**Fix Required**: ✅ **YES**
```sql
-- Add check: auth.uid() = user_uuid
SELECT COALESCE(
  (SELECT action_speed FROM scores_daily 
   WHERE user_id = user_uuid 
     AND auth.uid() = user_uuid  -- ADD THIS
   ORDER BY day DESC LIMIT 1),
  50
);
```

---

### 4. `get_discovery_feed(p_viewer UUID, p_limit INTEGER DEFAULT 20)`

**Location**: `db/rls.sql:257`  
**Signature**: `get_discovery_feed(p_viewer UUID, p_limit INTEGER DEFAULT 20)`  
**Returns**: `TABLE(...)`

**Tables Touched**:
- `profiles` (SELECT)
- `scores_daily` (SELECT - LEFT JOIN)
- `likes` (SELECT - EXISTS subquery)
- `matches` (SELECT - EXISTS subquery)

**Current Authorization**:
- ❌ **NONE** - Function accepts any UUID as `p_viewer` without verifying `auth.uid() = p_viewer`

**Security Issue**:
- 🟡 **MEDIUM**: Any authenticated user can query the discovery feed as if they were another user:
  ```sql
  SELECT * FROM get_discovery_feed('<other-user-uuid>', 20);
  ```
- This allows seeing what profiles another user would see in their feed
- While less critical than data modification, it's still a privacy issue

**Data Exposure**:
- ✅ Can read feed for any user: YES (indirect data leak)
- ❌ Can write data: NO

**Fix Required**: ✅ **YES**
```sql
-- Add check at start of function body
WHERE p.user_id <> p_viewer
  AND p.completion_pct >= 80
  AND auth.uid() = p_viewer  -- ADD THIS (enforce caller identity)
```

---

### 5. `create_like_and_check_match(p_liker UUID, p_likee UUID)`

**Location**: `db/rls.sql:302`  
**Signature**: `create_like_and_check_match(p_liker UUID, p_likee UUID)`  
**Returns**: `JSONB`

**Tables Touched**:
- `likes` (INSERT, SELECT)
- `matches` (INSERT, SELECT)

**Current Authorization**:
- ❌ **NONE** - Function accepts any two UUIDs without verifying `auth.uid() = p_liker`

**Security Issue**:
- 🔴 **CRITICAL**: Any authenticated user can create likes as if they were another user:
  ```sql
  SELECT create_like_and_check_match('<victim-uuid>', '<target-uuid>');
  ```
- This allows:
  - Creating fake likes from other users
  - Potentially creating matches without consent
  - Spoofing user activity

**Data Exposure**:
- ✅ Can read likes/matches across users: YES
- ✅ **Can write likes/matches as other users**: YES - **CRITICAL**

**Fix Required**: ✅ **YES - URGENT**
```sql
-- Add check at function start
BEGIN
  -- Verify caller is the liker
  IF auth.uid() IS NULL OR auth.uid() != p_liker THEN
    RAISE EXCEPTION 'Unauthorized: caller must be the liker';
  END IF;
  
  -- Rest of function...
```

---

### 6. `update_daily_action_speed()`

**Location**: `db/scoring.sql:5`  
**Signature**: `update_daily_action_speed()`  
**Returns**: `void`

**Tables Touched**:
- `users` (SELECT)
- `scores_daily` (INSERT, UPDATE)
- `likes` (SELECT - subquery)

**Current Authorization**:
- ⚠️ **NONE** - Function has no parameters, but any authenticated user can call it

**Security Issue**:
- 🟢 **LOW** - This is a system/cron function that should update all users' scores
- Current implementation is OK functionally, but should be restricted to:
  - Service role (bypass auth check)
  - OR add check that caller is system/service account

**Data Exposure**:
- ✅ Can read/write scores for ALL users: YES (by design, but should be restricted)

**Fix Required**: ⚠️ **RECOMMENDED** (not critical if only called by cron/edge function)
```sql
-- Option 1: Restrict to service role (if called from edge function)
-- Option 2: Add check for system role
IF auth.role() != 'service_role' THEN
  RAISE EXCEPTION 'Unauthorized: only system can update daily scores';
END IF;
```

---

### 7. `apply_action_speed_bonus(p_user_id UUID, p_bonus INTEGER, p_event_type TEXT)`

**Location**: `db/scoring.sql:63`  
**Signature**: `apply_action_speed_bonus(p_user_id UUID, p_bonus INTEGER, p_event_type TEXT)`  
**Returns**: `INTEGER`

**Tables Touched**:
- `scores_daily` (SELECT, INSERT, UPDATE)

**Current Authorization**:
- ❌ **NONE** - Function accepts any UUID without verifying `auth.uid() = p_user_id`

**Security Issue**:
- 🔴 **CRITICAL**: Any authenticated user can modify any user's action speed score:
  ```sql
  SELECT apply_action_speed_bonus('<victim-uuid>', 100, 'fake_event');
  ```
- This allows score manipulation, potentially giving users unfair advantages

**Data Exposure**:
- ✅ Can read scores across users: YES
- ✅ **Can write scores for any user**: YES - **CRITICAL**

**Fix Required**: ✅ **YES - URGENT**
```sql
-- Add check at function start
BEGIN
  -- Verify caller is the user whose score is being updated
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: caller must be the user';
  END IF;
  
  -- Rest of function...
```

---

### 8. `update_profile_quality(p_user_id UUID)`

**Location**: `db/scoring.sql:147`  
**Signature**: `update_profile_quality(p_user_id UUID)`  
**Returns**: `INTEGER`

**Tables Touched**:
- `matches` (SELECT)
- `likes` (SELECT)
- `scores_daily` (SELECT, INSERT, UPDATE)

**Current Authorization**:
- ❌ **NONE** - Function accepts any UUID without verifying `auth.uid() = p_user_id`

**Security Issue**:
- 🔴 **CRITICAL**: Any authenticated user can recalculate and modify any user's profile quality score:
  ```sql
  SELECT update_profile_quality('<victim-uuid>');
  ```
- This allows score manipulation

**Data Exposure**:
- ✅ Can read matches/likes/scores across users: YES
- ✅ **Can write scores for any user**: YES - **CRITICAL**

**Fix Required**: ✅ **YES - URGENT**
```sql
-- Add check at function start
BEGIN
  -- Verify caller is the user whose score is being updated
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: caller must be the user';
  END IF;
  
  -- Rest of function...
```

---

### 9. `update_reliability(p_user_id UUID, p_event_type TEXT, p_value NUMERIC DEFAULT 0)`

**Location**: `db/scoring.sql:201`  
**Signature**: `update_reliability(p_user_id UUID, p_event_type TEXT, p_value NUMERIC DEFAULT 0)`  
**Returns**: `INTEGER`

**Tables Touched**:
- `scores_daily` (SELECT, INSERT, UPDATE)

**Current Authorization**:
- ❌ **NONE** - Function accepts any UUID without verifying `auth.uid() = p_user_id`

**Security Issue**:
- 🔴 **CRITICAL**: Any authenticated user can modify any user's reliability score:
  ```sql
  SELECT update_reliability('<victim-uuid>', 'no_show', 0);
  -- This would give victim -30 reliability penalty
  ```
- This allows severe score manipulation and reputation damage

**Data Exposure**:
- ✅ Can read scores across users: YES
- ✅ **Can write scores for any user**: YES - **CRITICAL**

**Fix Required**: ✅ **YES - URGENT**
```sql
-- Add check at function start
BEGIN
  -- Verify caller is the user whose score is being updated
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: caller must be the user';
  END IF;
  
  -- Rest of function...
```

**Note**: However, for some event types like 'no_show' or 'safety_report', the caller might need to be a moderator or the system. Consider adding role-based checks for sensitive events.

---

### 10. `get_user_credits(p_user_id UUID)`

**Location**: `db/scoring.sql:266`  
**Signature**: `get_user_credits(p_user_id UUID)`  
**Returns**: `INTEGER`

**Tables Touched**:
- `credits_ledger` (SELECT)

**Current Authorization**:
- ❌ **NONE** - Function accepts any UUID without verifying `auth.uid() = p_user_id`

**Security Issue**:
- 🔴 **CRITICAL**: Any authenticated user can see any user's credit balance:
  ```sql
  SELECT get_user_credits('<victim-uuid>');
  ```
- Financial data should be private

**Data Exposure**:
- ✅ Can read credit balance across users: YES
- ❌ Can write data: NO

**Fix Required**: ✅ **YES - URGENT**
```sql
-- Add check: auth.uid() = p_user_id
SELECT COALESCE(SUM(delta), 0)::INTEGER
FROM credits_ledger
WHERE user_id = p_user_id
  AND auth.uid() = p_user_id;  -- ADD THIS
```

---

## Recommended Fixes Summary

### Critical Priority (Fix Immediately)

1. **`create_like_and_check_match()`** - Add `auth.uid() = p_liker` check
2. **`apply_action_speed_bonus()`** - Add `auth.uid() = p_user_id` check
3. **`update_profile_quality()`** - Add `auth.uid() = p_user_id` check
4. **`update_reliability()`** - Add `auth.uid() = p_user_id` check (with role checks for sensitive events)
5. **`get_user_credits()`** - Add `auth.uid() = p_user_id` check
6. **`get_user_matches()`** - Add `auth.uid() = user_uuid` check

### Medium Priority

7. **`are_users_matched()`** - Add check that caller is one of the users
8. **`get_user_action_speed()`** - Add `auth.uid() = user_uuid` check
9. **`get_discovery_feed()`** - Add `auth.uid() = p_viewer` check

### Low Priority

10. **`update_daily_action_speed()`** - Restrict to service role or system account (if not already restricted at call site)

---

## Additional Recommendations

1. **Add Function-Level Documentation**: Document which functions are meant to be called by users vs. system/cron jobs.

2. **Consider Role-Based Access**: Some functions (like `update_reliability` with 'no_show' events) might need moderator roles.

3. **Audit Logging**: Consider adding audit logs for sensitive operations (score modifications, credit queries).

4. **Input Validation**: Add checks for NULL UUIDs and invalid parameters.

5. **Testing**: Add security tests that verify unauthorized access attempts are blocked.

---

## Patch File

See `db/security_fixes.sql` for the complete SQL patch with all recommended fixes.

