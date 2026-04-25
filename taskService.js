import { collection, addDoc, doc, setDoc, getDocs, deleteDoc, query, where, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase.js";

/**
 * Saves a new task to Firestore.
 */
export const createTaskFirestore = async (uid, taskData) => {
    try {
        const tasksRef = doc(db, "users", uid, "tasks", taskData.id);
        await setDoc(tasksRef, {
            ...taskData,
            status: "pending",
            createdAt: serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error("Error creating task: ", error);
        throw error;
    }
};

/**
 * Fetches all pending tasks for a user.
 */
export const fetchTasksFirestore = async (uid) => {
    try {
        const tasksRef = collection(db, "users", uid, "tasks");
        const q = query(tasksRef, where("status", "==", "pending"));
        const querySnapshot = await getDocs(q);
        
        const tasks = [];
        querySnapshot.forEach((doc) => {
            tasks.push(doc.data());
        });
        return tasks;
    } catch (error) {
        console.error("Error fetching tasks: ", error);
        throw error;
    }
};

/**
 * Deletes a task from Firestore.
 */
export const delTaskFirestore = async (uid, taskId) => {
    try {
        const taskRef = doc(db, "users", uid, "tasks", taskId);
        await deleteDoc(taskRef);
        return true;
    } catch (error) {
        console.error("Error deleting task: ", error);
        throw error;
    }
};

/**
 * Saves a completed task to Firestore and updates its status.
 */
export const markTaskDoneFirestore = async (uid, taskData) => {
    try {
        const { id, subject, description } = taskData;
        
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const dateString = `${yyyy}-${mm}-${dd}`;
        
        const timeString = now.toLocaleTimeString('en-US', {
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true
        });

        // 1. Add to completedTasks collection
        const completedTasksRef = collection(db, "users", uid, "completedTasks");
        await addDoc(completedTasksRef, {
            taskId: id,
            taskTitle: subject,
            subject: subject,
            description: description || "",
            completedAt: serverTimestamp(),
            date: dateString,
            time: timeString,
            durationMinutes: 0 
        });

        // 2. Set/Merge task status to done
        const taskRef = doc(db, "users", uid, "tasks", id);
        await setDoc(taskRef, {
            status: "done",
            updatedAt: serverTimestamp()
        }, { merge: true });

        return true;
    } catch (error) {
        console.error("Error saving completed task to Firestore: ", error);
        throw error; 
    }
};
