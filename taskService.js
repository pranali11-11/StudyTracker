import { collection, addDoc, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase.js";

/**
 * Saves a completed task to Firestore and updates its status.
 * @param {string} uid The active user's ID
 * @param {Object} taskData The raw task object from local state
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
