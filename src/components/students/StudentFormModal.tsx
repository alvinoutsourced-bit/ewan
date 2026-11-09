import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Guardian, Student } from '../../types';
import { db } from '../../lib/firebase';
import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { generateQrDataUrl, downloadDataUrl } from '../../utils/qr';
import { useAuth } from '../../context/AuthContext';
import { generateCryptographicToken } from '../../services/scanService';

interface StudentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (student: Student, rawToken?: string) => void;
  studentToEdit?: Student | null;
}

export const StudentFormModal: React.FC<StudentFormModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  studentToEdit,
}) => {
  const { userProfile } = useAuth();

  const [studentId, setStudentId] = useState(studentToEdit?.studentId || '');
  const [firstName, setFirstName] = useState(studentToEdit?.firstName || '');
  const [lastName, setLastName] = useState(studentToEdit?.lastName || '');
  const [gradeLevel, setGradeLevel] = useState(studentToEdit?.gradeLevel || 'Grade 10');
  const [section, setSection] = useState(studentToEdit?.section || '');
  const [guardianName, setGuardianName] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [savedStudent, setSavedStudent] = useState<Student | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');

    try {
      let token = studentToEdit?.rawQrToken || '';
      let tokenHash = studentToEdit?.qrTokenHash || '';

      if (!studentToEdit || !tokenHash) {
        try {
          const response = await fetch('/api/qr/generate-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          if (response.ok) {
            const data = await response.json();
            token = data.token;
            tokenHash = data.tokenHash;
          } else {
            throw new Error('API offline');
          }
        } catch {
          // Client-side cryptographic fallback (ensures Vercel deployment works seamlessly)
          const gen = await generateCryptographicToken();
          token = gen.token;
          tokenHash = gen.tokenHash;
        }
      }

      const cleanStudentId = studentId.trim();
      const payload = {
        studentId: cleanStudentId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        gradeLevel,
        section: section.trim(),
        status: studentToEdit?.status || 'ACTIVE',
        qrTokenHash: tokenHash,
        guardianIds: studentToEdit?.guardianIds || [],
        createdAt: studentToEdit?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Student;

      if (!studentToEdit) {
        const dup = await getDocs(query(collection(db, 'students'), where('studentId', '==', payload.studentId)));
        if (!dup.empty) throw new Error('Student ID already exists.');
      }

      if (guardianName.trim() && guardianEmail.trim()) {
        const gid = `guard_${payload.studentId}_${Date.now()}`;
        await setDoc(
          doc(db, 'guardians', gid),
          {
            guardianId: gid,
            fullName: guardianName.trim(),
            email: guardianEmail.trim().toLowerCase(),
            studentIds: [payload.studentId],
            notificationsEnabled: true,
            createdAt: new Date().toISOString(),
          } as Guardian,
          { merge: true }
        );
        payload.guardianIds = [...(payload.guardianIds || []), gid];
      }

      const studentDocId = studentToEdit?.id || `std_${payload.studentId}`;
      await setDoc(doc(db, 'students', studentDocId), payload, { merge: true });

      const finalStudent = { ...payload, id: studentDocId } as Student;
      onSaved(finalStudent, token);
      setSavedStudent(finalStudent);
      if (token) {
        const generated = await generateQrDataUrl(token);
        setQrUrl(generated);
      }

      try {
        await setDoc(doc(db, 'audit_logs', `audit_${Date.now()}`), {
          actorId: userProfile?.uid || 'admin',
          action: studentToEdit ? 'UPDATE_STUDENT' : 'REGISTER_STUDENT',
          targetId: payload.studentId,
          timestamp: new Date().toISOString(),
        });
      } catch (e) {
        console.warn(e);
      }
    } catch (e: any) {
      setError(e.message || 'Could not save student.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={studentToEdit ? 'Edit Student' : 'Register Student'}
      description="Student and guardian details"
      maxWidth="2xl"
    >
      {error && <p role="alert" className="text-red-700 text-xs mb-3">{error}</p>}

      {savedStudent && qrUrl ? (
        <div className="text-center space-y-4">
          <h3 className="text-base font-bold text-slate-900">
            {savedStudent.firstName} {savedStudent.lastName}
          </h3>
          <div className="inline-block p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
            <img src={qrUrl} alt="Student QR" className="w-48 h-48 mx-auto rounded" />
          </div>
          <div className="flex gap-3 justify-center">
            <button
              type="button"
              onClick={() => downloadDataUrl(qrUrl, `QR_${savedStudent.studentId}.png`)}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
            >
              Download QR
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <input
              required
              placeholder="Student ID"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              disabled={!!studentToEdit}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs"
            />
            <input
              required
              placeholder="Grade level"
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs"
            />
            <input
              required
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs"
            />
            <input
              required
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs"
            />
          </div>

          <input
            required
            placeholder="Section"
            value={section}
            onChange={(e) => setSection(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs"
          />

          <div className="grid md:grid-cols-2 gap-3 border-t border-slate-200 pt-4">
            <input
              placeholder="Guardian name (optional)"
              value={guardianName}
              onChange={(e) => setGuardianName(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs"
            />
            <input
              type="email"
              placeholder="Guardian email (optional)"
              value={guardianEmail}
              onChange={(e) => setGuardianEmail(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 text-xs font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? 'Saving...' : 'Save & Generate QR'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default StudentFormModal;
