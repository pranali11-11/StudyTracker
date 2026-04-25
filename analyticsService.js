import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "./firebase.js";

/**
 * Initializes a real-time listener for user analytics.
 * @param {string} uid The active user ID
 * @param {Function} onData Callback function receiving the processed analytics object
 */
export const subscribeToAnalytics = (uid, onData) => {
    const q = query(
        collection(db, "users", uid, "completedTasks"),
        orderBy("completedAt", "desc")
    );

    return onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map(doc => doc.data());
        
        const analyticsData = {
            totalCompleted: snapshot.size,
            todayCount: 0,
            weekCount: 0,
            streak: 0,
            subjectBreakdown: {}, // { Math: 5, CS: 2 }
            trendData: {},       // { '2026-04-24': 3, ... }
            isReady: true
        };

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        
        // Use a Set for streak calculation (unique dates)
        const uniqueDates = new Set();
        
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(now.getDate() - 7);

        docs.forEach(data => {
            const date = data.date; // already YYYY-MM-DD from taskService
            uniqueDates.add(date);

            // 1. Today Count
            if (date === todayStr) analyticsData.todayCount++;

            // 2. Week Count
            const taskDate = new Date(date);
            if (taskDate >= oneWeekAgo) analyticsData.weekCount++;

            // 3. Subject Breakdown
            const sub = data.subject || "Other";
            analyticsData.subjectBreakdown[sub] = (analyticsData.subjectBreakdown[sub] || 0) + 1;

            // 4. Trend Data (Filter last 14 days)
            const trendLimit = new Date();
            trendLimit.setDate(now.getDate() - 14);
            if (taskDate >= trendLimit) {
                analyticsData.trendData[date] = (analyticsData.trendData[date] || 0) + 1;
            }
        });

        // 5. Calculate Streak
        analyticsData.streak = calculateStreak(Array.from(uniqueDates).sort().reverse());

        onData(analyticsData);
    }, (error) => {
        console.error("Analytics subscription error:", error);
    });
};

/**
 * Helper to calculate current consecutive day streak
 * @param {string[]} sortedDates Unique date strings sorted descending (newest first)
 */
function calculateStreak(sortedDates) {
    if (sortedDates.length === 0) return 0;

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // If no task done today OR yesterday, streak is broken (unless today hasn't finished)
    if (sortedDates[0] !== today && sortedDates[0] !== yesterdayStr) return 0;

    let streak = 0;
    let checkDate = new Date(sortedDates[0]);

    for (let i = 0; i < sortedDates.length; i++) {
        const currentDateStr = sortedDates[i];
        const expectedDateStr = checkDate.toISOString().split('T')[0];

        if (currentDateStr === expectedDateStr) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
    }

    return streak;
}
