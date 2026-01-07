"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  QueryConstraint,
} from "firebase/firestore";
import { db } from "./firebase";

// Generic type for Firestore documents
export interface FirestoreDoc {
  id: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// Collection references
export const collections = {
  users: "users",
  initiatives: "initiatives",
  plans: "plans",
  forecasts: "forecasts",
  resources: "resources",
  teams: "teams",
} as const;

// Get a single document
export const getDocument = async <T extends FirestoreDoc>(
  collectionName: string,
  docId: string
): Promise<T | null> => {
  try {
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as T;
    }
    return null;
  } catch (error) {
    console.error("Error getting document:", error);
    return null;
  }
};

// Get all documents in a collection
export const getDocuments = async <T extends FirestoreDoc>(
  collectionName: string,
  ...constraints: QueryConstraint[]
): Promise<T[]> => {
  try {
    const q = query(collection(db, collectionName), ...constraints);
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as T[];
  } catch (error) {
    console.error("Error getting documents:", error);
    return [];
  }
};

// Create or update a document
export const setDocument = async <T extends Record<string, unknown>>(
  collectionName: string,
  docId: string,
  data: T,
  merge = true
): Promise<boolean> => {
  try {
    const docRef = doc(db, collectionName, docId);
    await setDoc(
      docRef,
      {
        ...data,
        updatedAt: serverTimestamp(),
      },
      { merge }
    );
    return true;
  } catch (error) {
    console.error("Error setting document:", error);
    return false;
  }
};

// Create a new document with auto-generated ID
export const addDocument = async <T extends Record<string, unknown>>(
  collectionName: string,
  data: T
): Promise<string | null> => {
  try {
    const docRef = doc(collection(db, collectionName));
    await setDoc(docRef, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error adding document:", error);
    return null;
  }
};

// Update specific fields in a document
export const updateDocument = async <T extends Record<string, unknown>>(
  collectionName: string,
  docId: string,
  data: Partial<T>
): Promise<boolean> => {
  try {
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error("Error updating document:", error);
    return false;
  }
};

// Delete a document
export const deleteDocument = async (
  collectionName: string,
  docId: string
): Promise<boolean> => {
  try {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.error("Error deleting document:", error);
    return false;
  }
};

// Subscribe to document changes (real-time)
export const subscribeToDocument = <T extends FirestoreDoc>(
  collectionName: string,
  docId: string,
  callback: (data: T | null) => void
) => {
  const docRef = doc(db, collectionName, docId);
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() } as T);
    } else {
      callback(null);
    }
  });
};

// Subscribe to collection changes (real-time)
export const subscribeToCollection = <T extends FirestoreDoc>(
  collectionName: string,
  callback: (data: T[]) => void,
  ...constraints: QueryConstraint[]
) => {
  const q = query(collection(db, collectionName), ...constraints);
  return onSnapshot(q, (querySnapshot) => {
    const docs = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as T[];
    callback(docs);
  });
};

// Export query helpers
export { query, where, orderBy, limit, collection, doc };

