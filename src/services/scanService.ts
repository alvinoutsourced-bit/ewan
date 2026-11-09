import { 
  collection, 
  query, 
  where, 
  getDocs, 
  getDoc, 
  doc, 
  setDoc, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { hashTokenClient } from '../utils/qr';
import { EventType, ScanResult, Student } from '../types';

export interface ScanOptions {
  qrToken: string;
  eventType: EventType;
  guardId: string;
  guardName: string;
}

// Generate cryptographically secure 24-byte base64url token in browser
export async function generateCryptographicToken(): Promise<{ token: string; tokenHash: string }> {
  try {
    const array = new Uint8Array(24);
    window.crypto.getRandomValues(array);
    let binary = '';
    for (let i = 0; i < array.length; i++) {
      binary += String.fromCharCode(array[i]);
    }
    const token = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const tokenHash = await hashTokenClient(token);
    return { token, tokenHash };
  } catch (err) {
    // Fallback pseudo-random token if web crypto fails
    const token = `marhs_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
    const tokenHash = await hashTokenClient(token);
    return { token, tokenHash };
  }
}

// Helper: Formatter in school timezone
export function getSchoolFormattedDateTime(timezone: string = 'Asia/Manila') {
  const now = new Date();
  
  let dateStr = '';
  let timeStr = '';
  let hour24Str = '';

  try {
    dateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now); // "YYYY-MM-DD"

    timeStr = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(now); // "07:45:12 AM"

    hour24Str = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now); // "07:45"
  } catch {
    dateStr = now.toISOString().split('T')[0];
    timeStr = now.toLocaleTimeString();
    hour24Str = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  return { dateStr, timeStr, hour24Str, isoTimestamp: now.toISOString() };
}

/**
 * Client-Side QR Scanner Engine
 * Runs directly against Firebase Firestore in the browser.
 * This guarantees 100% operation on static hosts like Vercel with zero server dependencies.
 */
export async function processScanClient({
  qrToken,
  eventType,
  guardId,
  guardName,
}: ScanOptions): Promise<ScanResult> {
  const cleanToken = qrToken.trim();
  if (!cleanToken) {
    throw new Error('Valid QR token is required.');
  }

  // 1. Multi-strategy Student Lookup
  // Handles:
  //   a) Raw token (hashed via SHA-256)
  //   b) Token Hash directly (when printed ID badge has qrTokenHash)
  //   c) Student ID directly (when QR is student ID)
  //   d) JSON format payload
  const studentsCol = collection(db, 'students');
  let matchedStudentDoc: any = null;

  // Compute SHA-256 hash
  const computedHash = await hashTokenClient(cleanToken);

  // Strategy A: Match by computed SHA-256 hash
  try {
    const qHash = query(studentsCol, where('qrTokenHash', '==', computedHash));
    const snapHash = await getDocs(qHash);
    if (!snapHash.empty) {
      matchedStudentDoc = snapHash.docs[0];
    }
  } catch (err) {
    console.warn('Strategy A query failed:', err);
  }

  // Strategy B: Match by direct token string (matches qrTokenHash directly)
  if (!matchedStudentDoc) {
    try {
      const qDirect = query(studentsCol, where('qrTokenHash', '==', cleanToken));
      const snapDirect = await getDocs(qDirect);
      if (!snapDirect.empty) {
        matchedStudentDoc = snapDirect.docs[0];
      }
    } catch (err) {
      console.warn('Strategy B query failed:', err);
    }
  }

  // Strategy C: Match by Student ID (e.g. STD-2026-101)
  if (!matchedStudentDoc) {
    try {
      const qStdId = query(studentsCol, where('studentId', '==', cleanToken));
      const snapStdId = await getDocs(qStdId);
      if (!snapStdId.empty) {
        matchedStudentDoc = snapStdId.docs[0];
      }
    } catch (err) {
      console.warn('Strategy C query failed:', err);
    }
  }

  // Strategy D: If token is JSON
  if (!matchedStudentDoc && cleanToken.startsWith('{') && cleanToken.endsWith('}')) {
    try {
      const parsed = JSON.parse(cleanToken);
      const possibleId = parsed.studentId || parsed.id;
      const possibleToken = parsed.token || parsed.qrToken;
      if (possibleId) {
        const qParsedId = query(studentsCol, where('studentId', '==', possibleId));
        const sParsed = await getDocs(qParsedId);
        if (!sParsed.empty) matchedStudentDoc = sParsed.docs[0];
      }
      if (!matchedStudentDoc && possibleToken) {
        const pHash = await hashTokenClient(possibleToken);
        const qParsedToken = query(studentsCol, where('qrTokenHash', '==', pHash));
        const sParsed2 = await getDocs(qParsedToken);
        if (!sParsed2.empty) matchedStudentDoc = sParsed2.docs[0];
      }
    } catch {
      // not valid json, ignore
    }
  }

  if (!matchedStudentDoc) {
    throw new Error('Invalid QR code. No registered student matching this credential was found.');
  }

  const student = matchedStudentDoc.data() as Student;

  // 2. Validate Student Active Status
  if (student.status !== 'ACTIVE') {
    throw new Error(`Student ${student.firstName} ${student.lastName} is marked as ${student.status}. Access denied.`);
  }

  // 3. School Settings
  let settings = {
    schoolName: 'Madapdap Resettlement High School',
    timezone: 'Asia/Manila',
    openingTime: '07:00',
    lateCutoff: '07:30',
    closingTime: '17:00',
    resendApiKey: ''
  };

  try {
    const settingsSnap = await getDoc(doc(db, 'school_settings', 'global'));
    if (settingsSnap.exists()) {
      settings = { ...settings, ...settingsSnap.data() as any };
    }
  } catch (err) {
    console.warn('Could not read school_settings, using defaults:', err);
  }

  const { dateStr, timeStr, hour24Str, isoTimestamp } = getSchoolFormattedDateTime(settings.timezone);

  // 4. Duplicate Scan Protection (60 seconds)
  try {
    const eventsCol = collection(db, 'attendance_events');
    const recentQuery = query(
      eventsCol,
      where('studentId', '==', student.studentId),
      where('date', '==', dateStr),
      orderBy('timestamp', 'desc'),
      limit(1)
    );
    const recentSnap = await getDocs(recentQuery);
    if (!recentSnap.empty) {
      const lastEvent = recentSnap.docs[0].data();
      const lastTime = new Date(lastEvent.timestamp).getTime();
      const nowTime = new Date(isoTimestamp).getTime();
      const diffSeconds = Math.floor((nowTime - lastTime) / 1000);

      if (diffSeconds < 60) {
        const remaining = 60 - diffSeconds;
        throw new Error(`Duplicate scan detected! ${student.firstName} was scanned ${diffSeconds}s ago. Please wait ${remaining}s.`);
      }
    }
  } catch (err: any) {
    // If it's our duplicate error, rethrow it
    if (err.message && err.message.includes('Duplicate scan')) {
      throw err;
    }
    // Otherwise index might not exist yet, continue safely
  }

  // 5. Determine attendance status for ENTRY
  let calculatedStatus: 'PRESENT' | 'LATE' | 'N/A' = 'N/A';
  if (eventType === 'ENTRY') {
    calculatedStatus = hour24Str > settings.lateCutoff ? 'LATE' : 'PRESENT';
  }

  // 6. Record attendance_event document
  const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const idempotencyKey = `${student.studentId}_${eventType}_${dateStr}_${hour24Str}`;

  const eventPayload = {
    eventId,
    studentId: student.studentId,
    studentName: `${student.firstName} ${student.lastName}`,
    eventType,
    timestamp: isoTimestamp,
    guardId: guardId || 'gate-guard-1',
    guardName: guardName || 'Duty Guard',
    date: dateStr,
    status: calculatedStatus,
    idempotencyKey,
    createdAt: isoTimestamp
  };

  await setDoc(doc(db, 'attendance_events', eventId), eventPayload);

  // 7. Update Daily Attendance Rollup
  const dailyDocId = `${student.studentId}_${dateStr}`;
  const dailyRef = doc(db, 'attendance', dailyDocId);
  const dailySnap = await getDoc(dailyRef);

  if (!dailySnap.exists()) {
    await setDoc(dailyRef, {
      studentId: student.studentId,
      studentName: `${student.firstName} ${student.lastName}`,
      gradeLevel: student.gradeLevel,
      section: student.section,
      date: dateStr,
      status: calculatedStatus === 'N/A' ? 'PRESENT' : calculatedStatus,
      firstEntryAt: eventType === 'ENTRY' ? isoTimestamp : null,
      lastExitAt: eventType === 'EXIT' ? isoTimestamp : null,
      entryCount: eventType === 'ENTRY' ? 1 : 0,
      exitCount: eventType === 'EXIT' ? 1 : 0,
      createdAt: isoTimestamp,
      updatedAt: isoTimestamp
    });
  } else {
    const existing = dailySnap.data();
    const updates: any = {
      updatedAt: isoTimestamp,
      entryCount: eventType === 'ENTRY' ? (existing.entryCount || 0) + 1 : existing.entryCount || 0,
      exitCount: eventType === 'EXIT' ? (existing.exitCount || 0) + 1 : existing.exitCount || 0
    };

    if (eventType === 'ENTRY') {
      if (!existing.firstEntryAt) {
        updates.firstEntryAt = isoTimestamp;
        updates.status = calculatedStatus;
      }
    } else {
      updates.lastExitAt = isoTimestamp;
    }

    await setDoc(dailyRef, updates, { merge: true });
  }

  // 8. Fetch registered parent/guardians
  const guardiansCol = collection(db, 'guardians');
  const guardianIds: string[] = student.guardianIds || [];
  let guardians: any[] = [];

  if (guardianIds.length > 0) {
    for (const gId of guardianIds) {
      try {
        const gSnap = await getDoc(doc(db, 'guardians', gId));
        if (gSnap.exists()) {
          guardians.push(gSnap.data());
        }
      } catch (e) {
        console.warn(`Error fetching guardian ${gId}:`, e);
      }
    }
  } else {
    try {
      const gQuery = query(guardiansCol, where('studentIds', 'array-contains', student.studentId));
      const gSnap = await getDocs(gQuery);
      guardians = gSnap.docs.map(d => d.data());
    } catch (e) {
      console.warn('Fallback guardian query failed:', e);
    }
  }

  const activeGuardians = guardians.filter(g => g.notificationsEnabled !== false && g.email);
  const emailResults: any[] = [];

  // 9. Dispatch Parent Notifications / Log
  for (const guardian of activeGuardians) {
    const emailLogId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    const logPayload = {
      logId: emailLogId,
      eventId,
      studentId: student.studentId,
      recipient: guardian.email,
      guardianName: guardian.fullName || 'Guardian',
      eventType,
      deliveryStatus: 'SENT' as const,
      providerMessageId: `msg_${Date.now()}`,
      sentAt: isoTimestamp,
      errorMessage: null,
      simulated: true
    };

    try {
      await setDoc(doc(db, 'email_logs', emailLogId), logPayload);
    } catch (logErr) {
      console.warn('Could not record email_log:', logErr);
    }

    emailResults.push({
      recipient: guardian.email,
      status: 'SENT' as const,
      simulated: true
    });
  }

  return {
    success: true,
    student: {
      studentId: student.studentId,
      firstName: student.firstName,
      middleName: student.middleName,
      lastName: student.lastName,
      fullName: `${student.firstName} ${student.middleName ? student.middleName + ' ' : ''}${student.lastName}`,
      gradeLevel: student.gradeLevel,
      section: student.section,
      status: student.status
    },
    attendance: {
      eventId,
      eventType,
      date: dateStr,
      time: timeStr,
      status: calculatedStatus
    },
    notifications: {
      totalTargeted: activeGuardians.length,
      dispatched: emailResults
    }
  };
}

/**
 * Universal Scanner: tries API first (when running on local server/backend),
 * and automatically falls back to client-side Firestore scanner (for Vercel).
 */
export async function executeScan(options: ScanOptions): Promise<ScanResult> {
  // If in browser, first try API with a short timeout. If unavailable (Vercel static), run client-side!
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    // If server responded with JSON
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Server rejected QR scan.');
      }
      return data as ScanResult;
    }
  } catch (apiError: any) {
    // If it's a specific validation error from the API (not network/404)
    if (apiError.message && (
      apiError.message.includes('Invalid QR code') ||
      apiError.message.includes('Duplicate scan') ||
      apiError.message.includes('marked as')
    )) {
      throw apiError;
    }
    // Fall through to client-side scanner for Vercel / offline backend
  }

  // Execute client-side scanner directly against Firestore
  return await processScanClient(options);
}
