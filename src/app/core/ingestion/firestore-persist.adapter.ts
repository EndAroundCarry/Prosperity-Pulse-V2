import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
} from '@angular/fire/firestore';
import { PersistContext } from './dataset-registry';

/**
 * Firestore-backed PersistContext adapter.
 *
 * The persist handlers in the registry are pure functions taking
 * `(raw, PersistContext)`; this adapter is the Angular/Firestore binding.
 * Swapping ingestion to a Cloud Function later means writing a ~40-line
 * Node entry point that supplies a different PersistContext — no rewrite
 * of the mapping logic (Phase 1.6).
 */
@Injectable({ providedIn: 'root' })
export class FirestorePersistAdapter implements PersistContext {
  private readonly firestore = inject(Firestore);

  setDoc(path: string, data: Record<string, unknown>): Promise<void> {
    const [collectionPath, docId] = splitPath(path);
    return setDoc(doc(this.firestore, collectionPath, docId), data);
  }

  deleteDoc(path: string): Promise<void> {
    const [collectionPath, docId] = splitPath(path);
    return deleteDoc(doc(this.firestore, collectionPath, docId));
  }

  async getDoc(path: string): Promise<Record<string, unknown> | null> {
    const [collectionPath, docId] = splitPath(path);
    const snap = await getDoc(doc(this.firestore, collectionPath, docId));
    return snap.exists() ? (snap.data() as Record<string, unknown>) : null;
  }

  now(): Date {
    return new Date();
  }
}

function splitPath(path: string): [string, string] {
  const idx = path.lastIndexOf('/');
  if (idx <= 0 || idx === path.length - 1) {
    throw new Error(`Invalid Firestore path: ${path}`);
  }
  return [path.slice(0, idx), path.slice(idx + 1)];
}
